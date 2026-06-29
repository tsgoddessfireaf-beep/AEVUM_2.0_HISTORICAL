import { useMemo } from 'react';
import { PLANET_GLYPHS, SIGN_GLYPHS, GLYPH_CLASS } from '../lib/glyphs.js';
import { getLotOfFortune } from '../lib/lots.js';

const ZODIAC_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                      'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const SIGN_RULERS = {
  Aries:'Mars', Taurus:'Venus', Gemini:'Mercury', Cancer:'Moon', Leo:'Sun', Virgo:'Mercury',
  Libra:'Venus', Scorpio:'Mars', Sagittarius:'Jupiter', Capricorn:'Saturn',
  Aquarius:'Saturn', Pisces:'Jupiter',
};

// S = 500
const H_POLYGONS = {
  1:  "0,250 125,125 250,250 125,375",
  2:  "0,500 125,375 0,250",
  3:  "250,500 125,375 0,500",
  4:  "250,500 375,375 250,250 125,375",
  5:  "500,500 375,375 250,500",
  6:  "500,250 375,375 500,500",
  7:  "500,250 375,125 250,250 375,375",
  8:  "500,0 375,125 500,250",
  9:  "250,0 375,125 500,0",
  10: "250,0 125,125 250,250 375,125",
  11: "0,0 125,125 250,0",
  12: "0,250 125,125 0,0",
};

const H_CENTROIDS = {
  1:  { x: 125, y: 250 },
  2:  { x: 42,  y: 375 },
  3:  { x: 125, y: 458 },
  4:  { x: 250, y: 375 },
  5:  { x: 375, y: 458 },
  6:  { x: 458, y: 375 },
  7:  { x: 375, y: 250 },
  8:  { x: 458, y: 125 },
  9:  { x: 375, y: 42  },
  10: { x: 250, y: 125 },
  11: { x: 125, y: 42  },
  12: { x: 42,  y: 125 },
};

// Adjust house number label positions closer to the outer edges/corners
const H_LABELS = {
  1:  { x: 25,  y: 250 },
  2:  { x: 15,  y: 485 },
  3:  { x: 235, y: 485 },
  4:  { x: 250, y: 475 },
  5:  { x: 265, y: 485 },
  6:  { x: 485, y: 485 },
  7:  { x: 475, y: 250 },
  8:  { x: 485, y: 15  },
  9:  { x: 265, y: 15  },
  10: { x: 250, y: 25  },
  11: { x: 235, y: 15  },
  12: { x: 15,  y: 15  },
};

export default function SquareChart({ ephemerisData, houseSignifications = {} }) {
  if (!ephemerisData || !ephemerisData.houses) return null;
  const { houses, planets, nodes } = ephemerisData;

  // We assign signs to houses based on the cusp of that house.
  // In Whole Sign houses, H1 cusp sign is the Ascendant sign.
  const houseSigns = useMemo(() => {
    const signs = {};
    for (let i = 1; i <= 12; i++) {
      const lon = parseFloat(houses.cusps[i] || 0);
      const signIdx = Math.floor(lon / 30) % 12;
      signs[i] = {
        sign: ZODIAC_SIGNS[signIdx],
        degree: (lon % 30).toFixed(1)
      };
    }
    return signs;
  }, [houses]);

  const houseBodies = useMemo(() => {
    const bodiesByHouse = { 1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[], 10:[], 11:[], 12:[] };
    
    // Helper to add a body
    const addBody = (name, data, isRetro) => {
      if (!data?.house) return;
      const h = parseInt(data.house, 10);
      if (bodiesByHouse[h]) {
        bodiesByHouse[h].push({ name, ...data, isRetro });
      }
    };

    // Add planets
    for (const [name, p] of Object.entries(planets)) {
      addBody(name, p, p.is_retrograde);
    }
    
    // Add Node
    if (nodes?.mean_north_node) {
      addBody('North Node', nodes.mean_north_node, false);
      
      // Calculate South Node
      const nnLon = ZODIAC_SIGNS.indexOf(nodes.mean_north_node.sign) * 30 + (nodes.mean_north_node.sign_degree || 0);
      const snLon = (nnLon + 180) % 360;
      const snSign = ZODIAC_SIGNS[Math.floor(snLon / 30)];
      
      const nnHouse = parseInt(nodes.mean_north_node.house, 10);
      const snHouse = nnHouse <= 6 ? nnHouse + 6 : nnHouse - 6;
      bodiesByHouse[snHouse]?.push({
        name: 'South Node',
        sign: snSign,
        sign_degree: (snLon % 30),
      });
    }
    
    // Add Part of Fortune
    const fort = getLotOfFortune(ephemerisData);
    if (fort) {
      const fortLon = ZODIAC_SIGNS.indexOf(fort.sign) * 30 + fort.degree;
      let fortHouse = 1;
      if (houses.system === 'whole' && houseSigns[1]) {
        const ascIdx = ZODIAC_SIGNS.indexOf(houseSigns[1].sign);
        const fortIdx = ZODIAC_SIGNS.indexOf(fort.sign);
        fortHouse = ((fortIdx - ascIdx + 12) % 12) + 1;
      }
      bodiesByHouse[fortHouse]?.push({
        name: 'Fortune',
        sign: fort.sign,
        sign_degree: fort.degree,
      });
    }

    return bodiesByHouse;
  }, [planets, nodes, ephemerisData, houseSigns, houses.system]);

  const isHighlighted = (h) => {
    return h === parseInt(houseSignifications.querent_house) || 
           h === parseInt(houseSignifications.quesited_house);
  };

  return (
    <div className="relative w-full aspect-square max-w-[500px] mx-auto overflow-hidden rounded-lg">
      <svg viewBox="-10 -10 520 520" className="w-full h-auto drop-shadow-2xl filter" style={{ filter: 'drop-shadow(0 0 20px rgba(190, 107, 61, 0.4))' }}>
        <defs>
          <linearGradient id="bgGrad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#0B1C1A" />
            <stop offset="100%" stopColor="#051210" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect x="0" y="0" width="500" height="500" fill="url(#bgGrad)" rx="8" />
        
        {Object.entries(H_POLYGONS).map(([hStr, points]) => {
          const h = parseInt(hStr, 10);
          return (
            <polygon 
              key={h}
              points={points}
              fill={isHighlighted(h) ? 'rgba(190, 107, 61, 0.1)' : 'transparent'}
              stroke="#D17C49"
              strokeWidth="1.5"
              strokeOpacity="0.7"
              filter="url(#glow)"
              className="transition-colors duration-700 ease-in-out"
            />
          );
        })}

        <rect x="0" y="0" width="500" height="500" fill="none" stroke="#D17C49" strokeWidth="3" rx="8" filter="url(#glow)" />
        <rect x="4" y="4" width="492" height="492" fill="none" stroke="#D17C49" strokeWidth="1" strokeOpacity="0.5" rx="4" />

        {Object.keys(H_CENTROIDS).map((hStr) => {
          const h = parseInt(hStr, 10);
          const { x, y } = H_CENTROIDS[h];
          const labelPos = H_LABELS[h];
          const signInfo = houseSigns[h];
          const bodies = houseBodies[h] || [];
          
          return (
            <g key={h}>
              <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle" 
                    fill="rgba(255, 255, 255, 0.2)" fontSize="18" fontWeight="bold" fontFamily="serif">
                {h}
              </text>

              {signInfo && (
                <text x={x} y={y - 20 - (bodies.length * 8)} textAnchor="middle" dominantBaseline="middle" fill="#D17C49">
                  <tspan className={GLYPH_CLASS} fontSize="20" filter="url(#glow)">{SIGN_GLYPHS[signInfo.sign]}</tspan>
                  <tspan fontSize="10" dx="4" dy="-4" fill="rgba(255, 255, 255, 0.7)">{signInfo.degree}°</tspan>
                </text>
              )}

              {bodies.map((body, idx) => {
                const isQuerent = body.name === SIGN_RULERS[houseSigns[houseSignifications.querent_house || 1]?.sign];
                const isQuesited = body.name === SIGN_RULERS[houseSigns[houseSignifications.quesited_house || 7]?.sign];
                const highlight = isQuerent || isQuesited;
                
                return (
                  <text key={idx} x={x} y={y + 5 + (idx * 16) - (bodies.length * 5)} textAnchor="middle" dominantBaseline="middle"
                        fill={highlight ? '#FDE68A' : 'rgba(255, 255, 255, 0.95)'} 
                        fontWeight={highlight ? 'bold' : 'normal'}
                        fontSize="13">
                    <tspan className={GLYPH_CLASS} fill={highlight ? '#FDE68A' : '#D17C49'}>{PLANET_GLYPHS[body.name] || body.name.charAt(0)}</tspan>
                    <tspan dx="4" fontSize="11">{parseFloat(body.sign_degree).toFixed(1)}°</tspan>
                    {body.isRetro && <tspan dx="2" fill="#D17C49">℞</tspan>}
                  </text>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
