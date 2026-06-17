# Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
# Aevum — proprietary software. Unauthorized use or distribution is prohibited.

"""
Aevum ephemeris sidecar.

Computes horary charts at full Swiss Ephemeris precision using pyswisseph
directly — bypassing flatlib's HH:MM time truncation so the Julian Day
(including seconds) flows unchanged through every calculation.

Planetary positions, house cusps, Ascendant, and MC are all derived from
the same precise JD. Positions are apparent geocentric ecliptic (light-time
+ aberration included), matching JPL Horizons QUANTITIES=31.
"""

import os
from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo
from typing import Optional

import swisseph as swe
from fastapi import FastAPI, HTTPException
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderServiceError, GeocoderTimedOut
from pydantic import BaseModel, Field

app = FastAPI(title="Aevum Ephemeris Service")

PRECISION = 7

# ── Ephemeris data files ────────────────────────────────────────────────────────
#
# FLG_SWIEPH only delivers full JPL-derived precision (~0.001 arcsec) when the
# compressed Swiss Ephemeris data files (sepl_*.se1, semo_*.se1, …) are present
# and the search path is registered. If they are missing, pyswisseph SILENTLY
# falls back to the built-in Moshier ephemeris (~0.1 arcsec for the Sun, several
# arcsec for the Moon over the modern era) — so the path must be set explicitly
# and the actually-used ephemeris must be reported back, never assumed.
#
# Install the files (1800–2400 CE block is enough for horary):
#   sepl_18.se1, semo_18.se1, seas_18.se1  →  ephemeris-service/ephe/
# from https://github.com/aloistr/swisseph/tree/master/ephe (or astro.com/ftp/swisseph/ephe)
# Override the location with SE_EPHE_PATH.
EPHE_PATH = os.environ.get(
    "SE_EPHE_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "ephe"),
)
swe.set_ephe_path(EPHE_PATH)

# One concise startup provenance log: which ephemeris pyswisseph actually answers
# with at boot. (Per-request re-assertion in calculate() is what guarantees Swiss
# precision at request time — see the comment there.)
def _log_startup_provenance() -> None:
    import sys
    try:
        jd = swe.utc_to_jd(2026, 1, 1, 0, 0, 0, 1)[1]
        _, retflag = swe.calc_ut(jd, swe.MOON, swe.FLG_SWIEPH)
        src = "Swiss" if (retflag & swe.FLG_SWIEPH) else ("Moshier" if (retflag & swe.FLG_MOSEPH) else "unknown")
        print(f"[ephe] startup: pyswisseph={swe.version} path={EPHE_PATH!r} source={src}", file=sys.stderr)
    except Exception as e:  # never let a diagnostic break startup
        print(f"[ephe] startup provenance check failed: {e}", file=sys.stderr)

_log_startup_provenance()


def _ephemeris_name(retflag: int) -> str:
    """Decode which ephemeris pyswisseph actually used from the return flag."""
    if retflag & swe.FLG_SWIEPH:
        return "Swiss Ephemeris (sepl/semo data files)"
    if retflag & swe.FLG_JPLEPH:
        return "JPL DE"
    if retflag & swe.FLG_MOSEPH:
        return "Moshier (analytic fallback — reduced precision)"
    return "unknown"

# ── Sign utilities ────────────────────────────────────────────────────────────

SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]

def _lon_to_sign(lon: float) -> tuple[str, float]:
    """Convert ecliptic longitude to (sign_name, degrees_within_sign)."""
    lon = lon % 360
    idx = int(lon / 30)
    return SIGNS[idx], lon - idx * 30.0


# ── House system codes ────────────────────────────────────────────────────────

# Single-letter codes passed through directly to pyswisseph swe.houses().
HOUSE_SYS_BYTES: dict[str, bytes] = {
    'P': b'P',   # Placidus
    'K': b'K',   # Koch
    'O': b'O',   # Porphyrius
    'R': b'R',   # Regiomontanus (Aevum default — traditional Lilly)
    'C': b'C',   # Campanus
    'A': b'A',   # Equal (from ASC)
    'E': b'E',   # Equal (from MC)
    'V': b'V',   # Vehlow Equal
    'W': b'W',   # Whole Sign
    'X': b'X',   # Meridian
    'H': b'H',   # Azimuthal / Horizontal
    'T': b'T',   # Polich-Page (Topocentric)
    'B': b'B',   # Alcabitus
    'M': b'M',   # Morinus
}

HOUSE_SYSTEM_NAMES: dict[bytes, str] = {
    b'P': 'Placidus',
    b'K': 'Koch',
    b'O': 'Porphyrius',
    b'R': 'Regiomontanus',
    b'C': 'Campanus',
    b'A': 'Equal',
    b'E': 'Equal (MC)',
    b'V': 'Vehlow Equal',
    b'W': 'Whole Sign',
    b'X': 'Meridian',
    b'H': 'Azimuthal',
    b'T': 'Polich-Page',
    b'B': 'Alcabitus',
    b'M': 'Morinus',
}

# ── Planet registry ───────────────────────────────────────────────────────────

# (display_name, pyswisseph_id)
CLASSICAL_PLANETS = [
    ('Sun',     swe.SUN),
    ('Moon',    swe.MOON),
    ('Mercury', swe.MERCURY),
    ('Venus',   swe.VENUS),
    ('Mars',    swe.MARS),
    ('Jupiter', swe.JUPITER),
    ('Saturn',  swe.SATURN),
]

# Planets eligible for void-of-course check (classical 7)
VOC_PLANET_IDS = [swe.SUN, swe.MERCURY, swe.VENUS, swe.MARS, swe.JUPITER, swe.SATURN]

# Ptolemaic aspects in degrees
ASPECT_ANGLES = [0.0, 60.0, 90.0, 120.0, 180.0]

# ── pyswisseph flags ──────────────────────────────────────────────────────────

# Apparent geocentric ecliptic longitude (light-time + aberration).
# Matches JPL Horizons QUANTITIES=31 for the dual-source audit.
FLAGS_ECLIPTIC  = swe.FLG_SWIEPH | swe.FLG_SPEED
# Equatorial (for declination)
FLAGS_EQUATORIAL = swe.FLG_SWIEPH | swe.FLG_SPEED | swe.FLG_EQUATORIAL

# ── Helpers ───────────────────────────────────────────────────────────────────

geolocator = Nominatim(user_agent="aevum-ephemeris-sidecar")


class EphemerisRequest(BaseModel):
    date: str = Field(..., description="Local civil date YYYY-MM-DD")
    time: str = Field(..., description="Local civil time HH:MM or HH:MM:SS")
    timezone: str = Field(..., description="IANA timezone e.g. 'America/New_York'")
    location: str = Field(..., description="Place name for display and geocoding fallback")
    latitude: Optional[float] = Field(None, description="Pre-resolved latitude — skips geocoding")
    longitude: Optional[float] = Field(None, description="Pre-resolved longitude — skips geocoding")
    house_system: str = Field('R', description="Single-letter house system code")


def _geocode(query: str) -> tuple[float, float, str]:
    try:
        result = geolocator.geocode(query, timeout=10)
    except (GeocoderServiceError, GeocoderTimedOut) as e:
        raise HTTPException(status_code=502, detail=f"Geocoding service error: {e}")
    if result is None:
        raise HTTPException(status_code=400, detail=f"Could not geocode location: {query!r}")
    return float(result.latitude), float(result.longitude), result.address


def _parse_local_dt(req: EphemerisRequest) -> tuple[datetime, datetime]:
    """
    Parse the request date+time+timezone and return (local_dt, utc_dt).
    Preserves seconds — does NOT truncate to HH:MM.
    """
    try:
        tz = ZoneInfo(req.timezone)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid timezone {req.timezone!r}: {e}")

    time_str = req.time.strip()
    # Normalise to HH:MM:SS
    if len(time_str) == 5:
        time_str = time_str + ':00'
    try:
        local_dt = datetime.strptime(f"{req.date} {time_str}", "%Y-%m-%d %H:%M:%S")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date/time: {e}")

    local_dt = local_dt.replace(tzinfo=tz)
    utc_dt = local_dt.astimezone(dt_timezone.utc)
    return local_dt, utc_dt


def _utc_to_jd(utc_dt: datetime) -> float:
    """
    Convert a UTC datetime to the Julian Day in Universal Time (UT1) using
    swe.utc_to_jd, which applies leap seconds and the UTC→UT1 correction.

    This is more correct than feeding the UTC clock value straight into
    swe.julday() as if it were UT: that shortcut introduces a ~0.3 s error,
    which is ~0.19 arcsec of Moon motion — non-trivial for a tool claiming
    sub-arcsecond precision. calc_ut() and houses() both expect UT and apply
    ΔT internally to reach Terrestrial Time, so we return the UT value.
    """
    seconds = utc_dt.second + utc_dt.microsecond / 1_000_000.0
    _jd_tt, jd_ut = swe.utc_to_jd(
        utc_dt.year,
        utc_dt.month,
        utc_dt.day,
        utc_dt.hour,
        utc_dt.minute,
        seconds,
        swe.GREG_CAL,
    )
    return jd_ut


def _which_house(lon: float, cusps: dict[str, float]) -> int:
    """Determine which house a longitude falls in given the 12 house cusps."""
    lon = lon % 360
    for i in range(1, 13):
        cur = cusps[str(i)] % 360
        nxt = cusps[str((i % 12) + 1)] % 360
        if cur < nxt:
            if cur <= lon < nxt:
                return i
        else:
            if lon >= cur or lon < nxt:
                return i
    return 1


def _moon_void_of_course(moon_lon: float, planet_lons: dict[int, float]) -> bool:
    """
    Classical void-of-course: the Moon makes no more Ptolemaic aspects to a
    classical planet before leaving its current sign.
    """
    deg_to_sign_change = 30.0 - (moon_lon % 30.0)
    for swe_id, p_lon in planet_lons.items():
        for angle in ASPECT_ANGLES:
            for target in ((p_lon + angle) % 360, (p_lon - angle) % 360):
                fwd = (target - moon_lon) % 360
                if 0.0 < fwd <= deg_to_sign_change:
                    return False
    return True


# ── API endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "aevum-ephemeris"}


@app.post("/calculate")
def calculate(req: EphemerisRequest):
    # ── 0. Re-assert the ephemeris search path per request ────────────────────
    # On Render the Swiss path registered at import is lost by request time
    # (import-time test calc returns SWISS, request-time returns Moshier in the
    # same process). set_ephe_path is idempotent and cheap; re-asserting it here,
    # before any calc_ut/houses call, guarantees full Swiss precision per request.
    swe.set_ephe_path(EPHE_PATH)

    # ── 1. Coordinates ────────────────────────────────────────────────────────
    if req.latitude is not None and req.longitude is not None:
        lat, lon_geo, place_name = req.latitude, req.longitude, req.location
    else:
        lat, lon_geo, place_name = _geocode(req.location)

    # ── 2. Time → precise Julian Day ─────────────────────────────────────────
    local_dt, utc_dt = _parse_local_dt(req)
    jd = _utc_to_jd(utc_dt)

    # ── 3. House cusps (Ascendant, MC, 12 cusps) ─────────────────────────────
    hsys_byte = HOUSE_SYS_BYTES.get(req.house_system.upper(), b'R')
    try:
        # swe.houses returns (cusps_tuple, ascmc_tuple).
        # ascmc: [0]=ASC, [1]=MC, [2]=ARMC, [3]=Vertex, ...
        # The cusps tuple layout DIFFERS by pyswisseph version:
        #   • ≥ 2.10  → 12 elements, 0-indexed (cusp 1 at index 0)
        #   • ≤ 2.08  → 13 elements, 1-indexed (index 0 unused) — the layout
        #                flatlib used to pull in transitively.
        # Normalise to a 12-long, 0-indexed sequence so house numbering is
        # always correct regardless of the installed wheel.
        cusps_raw, ascmc = swe.houses(jd, lat, lon_geo, hsys_byte)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"House calculation failed: {e}")

    cusp_vals = cusps_raw[1:13] if len(cusps_raw) >= 13 else cusps_raw[0:12]
    cusps: dict[str, float] = {str(i + 1): round(cusp_vals[i], PRECISION) for i in range(12)}
    asc_lon = float(ascmc[0])
    mc_lon  = float(ascmc[1])

    # ── 4. Planetary positions ────────────────────────────────────────────────
    planets_out: dict[str, dict] = {}
    planet_lons_for_voc: dict[int, float] = {}
    retflags: set[int] = set()

    for name, swe_id in CLASSICAL_PLANETS:
        try:
            ecl, ecl_flag = swe.calc_ut(jd, swe_id, FLAGS_ECLIPTIC)
            equ, _        = swe.calc_ut(jd, swe_id, FLAGS_EQUATORIAL)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Planet {name} calculation failed: {e}")
        retflags.add(ecl_flag)

        p_lon   = float(ecl[0]) % 360.0
        p_lat   = float(ecl[1])
        p_speed = float(ecl[3])   # longitudinal daily speed in °/day
        p_decl  = float(equ[1])   # declination in degrees

        sign, sign_deg = _lon_to_sign(p_lon)

        planets_out[name] = {
            'sign':               sign,
            'sign_degree':        round(sign_deg, PRECISION),
            'ecliptic_longitude': round(p_lon,   PRECISION),
            'ecliptic_latitude':  round(p_lat,   PRECISION),
            'house':              _which_house(p_lon, cusps),
            'is_retrograde':      p_speed < 0,
            'daily_speed':        round(p_speed, PRECISION),
            'declination':        round(p_decl,  PRECISION),
        }

        if swe_id != swe.MOON:
            planet_lons_for_voc[swe_id] = p_lon

    # ── 5. North Node ─────────────────────────────────────────────────────────
    try:
        node_ecl, _ = swe.calc_ut(jd, swe.MEAN_NODE, FLAGS_ECLIPTIC)
        node_lon     = float(node_ecl[0]) % 360.0
    except Exception:
        node_lon = 0.0
    node_sign, node_sign_deg = _lon_to_sign(node_lon)

    # ── 6. Lunar phase & VOC ──────────────────────────────────────────────────
    # Use the void-of-course Moon longitude from the planet loop (rounded) for
    # VOC, but compute the phase from full-precision values to avoid compounding
    # rounding into the elongation.
    moon_lon = planets_out['Moon']['ecliptic_longitude']
    sun_lon  = planets_out['Sun']['ecliptic_longitude']
    phase_angle = (moon_lon - sun_lon) % 360.0

    moon_voc = _moon_void_of_course(moon_lon, planet_lons_for_voc)

    # ── 7. Ephemeris provenance ────────────────────────────────────────────────
    errors: list[str] = []
    ephemeris_source = _ephemeris_name(max(retflags)) if retflags else "unknown"
    used_moshier = any(rf & swe.FLG_MOSEPH for rf in retflags)
    if used_moshier:
        errors.append(
            "Swiss Ephemeris data files not found at "
            f"{EPHE_PATH!r}; positions computed with the lower-precision Moshier "
            "fallback. Install sepl_18.se1 / semo_18.se1 (or set SE_EPHE_PATH) "
            "for full sub-arcsecond accuracy."
        )

    # ── 8. Response ───────────────────────────────────────────────────────────
    return {
        'chart_meta': {
            'utc_datetime':       utc_dt.strftime('%Y-%m-%dT%H:%M:%S'),
            'julian_day':         round(jd, PRECISION),
            'ephemeris_source':   ephemeris_source,
            'resolved_place_name': place_name,
            'resolved_latitude':  round(lat,     PRECISION),
            'resolved_longitude': round(lon_geo,  PRECISION),
            'input_date':         req.date,
            'input_time':         req.time,
            'input_timezone':     req.timezone,
        },
        'houses': {
            'system':    HOUSE_SYSTEM_NAMES.get(hsys_byte, hsys_byte.decode()),
            'ascendant': round(asc_lon, PRECISION),
            'mc':        round(mc_lon,  PRECISION),
            'cusps':     cusps,
        },
        'planets': planets_out,
        'nodes': {
            'mean_north_node': {
                'sign':               node_sign,
                'sign_degree':        round(node_sign_deg, PRECISION),
                'ecliptic_longitude': round(node_lon,      PRECISION),
            },
        },
        'lunar_phase': {
            'moon_phase_angle': round(phase_angle, PRECISION),
            'moon_is_waxing':   phase_angle < 180.0,
            'moon_is_void':     moon_voc,
        },
        'errors': errors,
    }
