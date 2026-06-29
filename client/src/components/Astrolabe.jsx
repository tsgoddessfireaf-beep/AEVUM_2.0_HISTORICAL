import React, { useState, useEffect, useMemo } from 'react';

/**
 * Animated SVG Astrolabe shown while the analysis is generating.
 * Simulates setting the Rete to the querent's petition time and date.
 */
export default function Astrolabe({ ephemerisData, skipAnimation = false }) {
  const [animStage, setAnimStage] = useState(0);

  useEffect(() => {
    if (!ephemerisData) return;
    if (skipAnimation) { setAnimStage(5); return; }
    
    // Animation sequence:
    // 0: Base hidden, fades in
    // 1: Plate (Tympan) fades in
    // 2: Rete drops in and starts rapid spin (simulating time search)
    // 3: Rete decelerates
    // 4: Rete snaps to the specific RAMC / Midheaven
    // 5: Rule swings to the Sun's position
    const timers = [
      setTimeout(() => setAnimStage(1), 100),
      setTimeout(() => setAnimStage(2), 800),
      setTimeout(() => setAnimStage(3), 2200),
      setTimeout(() => setAnimStage(4), 3200),
      setTimeout(() => setAnimStage(5), 4200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [!!ephemerisData, skipAnimation]);

  const { mcLon = 0, sunLon = 0 } = useMemo(() => {
    if (!ephemerisData) return { mcLon: 0, sunLon: 0 };
    return {
      mcLon: parseFloat(ephemerisData.houses?.mc) || 0,
      sunLon: parseFloat(ephemerisData.planets?.Sun?.longitude) || 0,
    };
  }, [ephemerisData]);

  // Rotations
  // Rete aligns MC to the top (meridian). 
  const targetReteRotation = -mcLon;
  const reteSpin = animStage < 2 ? 0 :
                   animStage === 2 ? targetReteRotation - 1080 :
                   animStage === 3 ? targetReteRotation - 360 : targetReteRotation;
                   
  // The Rule aligns with the Sun on the ecliptic
  const targetRuleRotation = -mcLon + (sunLon - mcLon); 
  const ruleSpin = animStage < 5 ? targetReteRotation : -sunLon;

  // Render Helpers
  const renderLimbMarks = () => {
    const marks = [];
    for (let i = 0; i < 360; i++) {
      const isHour = i % 15 === 0;
      const isDegree = i % 5 === 0;
      const length = isHour ? 12 : isDegree ? 8 : 4;
      const strokeWidth = isHour ? 1.5 : 0.75;
      marks.push(
        <line
          key={`limb-${i}`}
          x1="500" y1={25} x2="500" y2={25 + length}
          transform={`rotate(${i}, 500, 500)`}
          stroke="#D17C49"
          strokeWidth={strokeWidth}
          opacity="0.8"
        />
      );
    }
    return marks;
  };

  const renderAlmucantars = () => {
    // Stereographic altitude circles (approximate for aesthetics)
    const circles = [];
    for (let alt = 0; alt <= 90; alt += 10) {
      const r = 400 - (alt * 4);
      const cy = 500 + (alt * 1.5);
      circles.push(
        <circle
          key={`almu-${alt}`}
          cx="500" cy={cy} r={r}
          fill="none"
          stroke="#AEB6B8"
          strokeWidth="0.5"
          opacity={alt === 0 ? "0.6" : "0.2"}
          strokeDasharray={alt === 0 ? "none" : "4 2"}
        />
      );
    }
    return circles;
  };

  const renderAzimuths = () => {
    // Arcs radiating from the zenith
    const arcs = [];
    for (let az = 0; az < 360; az += 15) {
      arcs.push(
        <path
          key={`az-${az}`}
          d={`M 500,365 Q ${500 + Math.sin(az * Math.PI / 180) * 400},${500 + Math.cos(az * Math.PI / 180) * 400} 500,900`}
          fill="none"
          stroke="#AEB6B8"
          strokeWidth="0.5"
          opacity="0.15"
          transform={`rotate(${az}, 500, 365)`}
        />
      );
    }
    return arcs;
  };

  return (
    <div className="w-full max-w-2xl mx-auto aspect-square relative flex items-center justify-center p-4">
      <svg viewBox="0 0 1000 1000" className="w-full h-full drop-shadow-2xl">
        <defs>
          <radialGradient id="brass-mater" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#1E5248" />
            <stop offset="50%" stopColor="#123A33" />
            <stop offset="100%" stopColor="#0a1f1b" />
          </radialGradient>
          
          <radialGradient id="brass-rete" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#BE6B3D" />
            <stop offset="80%" stopColor="#8c4723" />
            <stop offset="100%" stopColor="#592b13" />
          </radialGradient>

          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* --- 1. MATER (Base) --- */}
        <g 
          style={{ 
            opacity: animStage >= 0 ? 1 : 0, 
            transition: 'opacity 1s ease-in-out' 
          }}
        >
          {/* Outer Rim */}
          <circle cx="500" cy="500" r="480" fill="url(#brass-mater)" stroke="#BE6B3D" strokeWidth="8" />
          <circle cx="500" cy="500" r="450" fill="none" stroke="#D17C49" strokeWidth="2" opacity="0.5" />
          {renderLimbMarks()}
          
          {/* Suspension Ring (Throne) */}
          <path d="M 450,40 Q 500,-20 550,40 L 520,40 Q 500,10 480,40 Z" fill="url(#brass-rete)" stroke="#D17C49" strokeWidth="2" />
          <circle cx="500" cy="15" r="15" fill="none" stroke="#BE6B3D" strokeWidth="6" />
        </g>

        {/* --- 2. PLATE (Tympan) --- */}
        <g 
          style={{ 
            opacity: animStage >= 1 ? 1 : 0, 
            transition: 'opacity 1.5s ease-in-out' 
          }}
        >
          <circle cx="500" cy="500" r="450" fill="#0E2C27" />
          {renderAlmucantars()}
          {renderAzimuths()}
          
          {/* Horizon Line */}
          <line x1="50" y1="500" x2="950" y2="500" stroke="#D17C49" strokeWidth="1" opacity="0.8" />
          {/* Meridian Line */}
          <line x1="500" y1="50" x2="500" y2="950" stroke="#D17C49" strokeWidth="1" opacity="0.8" />
          
          <text x="500" y="80" fill="#D17C49" fontSize="16" textAnchor="middle" opacity="0.7" fontFamily="serif">SOUTH</text>
          <text x="500" y="930" fill="#D17C49" fontSize="16" textAnchor="middle" opacity="0.7" fontFamily="serif">NORTH</text>
          <text x="80" y="505" fill="#D17C49" fontSize="16" textAnchor="start" opacity="0.7" fontFamily="serif">EAST</text>
          <text x="920" y="505" fill="#D17C49" fontSize="16" textAnchor="end" opacity="0.7" fontFamily="serif">WEST</text>
        </g>

        {/* --- 3. RETE (Star Map & Ecliptic) --- */}
        <g 
          style={{ 
            opacity: animStage >= 2 ? 1 : 0,
            transform: `rotate(${reteSpin}deg)`,
            transformOrigin: '500px 500px',
            transition: animStage === 2 ? 'transform 3s cubic-bezier(0.25, 1, 0.5, 1)' : 
                        animStage === 3 ? 'transform 2s cubic-bezier(0.25, 1, 0.5, 1)' :
                        animStage === 4 ? 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'opacity 0.8s ease-in'
          }}
        >
          {/* Ecliptic Circle (Offset) */}
          <circle cx="500" cy="380" r="280" fill="none" stroke="url(#brass-rete)" strokeWidth="24" />
          <circle cx="500" cy="380" r="292" fill="none" stroke="#123A33" strokeWidth="2" opacity="0.5" />
          <circle cx="500" cy="380" r="268" fill="none" stroke="#123A33" strokeWidth="2" opacity="0.5" />
          
          {/* Zodiac Marks on Ecliptic */}
          {Array.from({length: 12}).map((_, i) => (
            <g key={`zodiac-${i}`} transform={`rotate(${i * 30}, 500, 380)`}>
              <line x1="500" y1="88" x2="500" y2="112" stroke="#123A33" strokeWidth="2" opacity="0.7"/>
            </g>
          ))}

          {/* Rete structural tracery (Gothic style arcs) */}
          <path d="M 500,500 L 500,100 A 400 400 0 0 1 900,500 Z" fill="none" stroke="url(#brass-rete)" strokeWidth="8" opacity="0.9" />
          <path d="M 500,500 L 100,500 A 400 400 0 0 0 500,900 Z" fill="none" stroke="url(#brass-rete)" strokeWidth="8" opacity="0.9" />
          <circle cx="500" cy="500" r="400" fill="none" stroke="url(#brass-rete)" strokeWidth="6" opacity="0.8" />
          
          {/* Star Pointers (Flames) */}
          {[
            {x: 650, y: 250, name: 'Aldebaran'},
            {x: 300, y: 350, name: 'Regulus'},
            {x: 750, y: 650, name: 'Spica'},
            {x: 350, y: 750, name: 'Antares'},
            {x: 200, y: 200, name: 'Sirius'}
          ].map((star, i) => (
            <g key={`star-${i}`}>
              <path 
                d={`M ${star.x},${star.y} Q ${star.x+15},${star.y-20} ${star.x+30},${star.y-5} Q ${star.x+10},${star.y+10} ${star.x},${star.y}`}
                fill="url(#brass-rete)" 
                stroke="#D17C49"
                strokeWidth="1"
              />
              <circle cx={star.x+25} cy={star.y-10} r="2" fill="#fff" opacity="0.8" filter="url(#glow)"/>
            </g>
          ))}
        </g>

        {/* --- 4. RULE (Pointer) --- */}
        <g
          style={{
            opacity: animStage >= 4 ? 1 : 0,
            transform: `rotate(${ruleSpin}deg)`,
            transformOrigin: '500px 500px',
            transition: animStage >= 5 ? 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'opacity 1s ease'
          }}
        >
          <path d="M 496,500 L 492,50 L 508,50 L 504,500 Z" fill="#AEB6B8" stroke="#ffffff" strokeWidth="1" opacity="0.85" />
          <path d="M 496,500 L 492,950 L 508,950 L 504,500 Z" fill="#AEB6B8" stroke="#ffffff" strokeWidth="1" opacity="0.85" />
          {/* Rule central pin */}
          <circle cx="500" cy="500" r="15" fill="#D17C49" stroke="#592b13" strokeWidth="4" />
          <circle cx="500" cy="500" r="5" fill="#1E5248" />
        </g>
      </svg>
    </div>
  );
}
