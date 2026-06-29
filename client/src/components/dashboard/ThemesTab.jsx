import { useState, useEffect } from 'react';

const THEMES = [
  { name: 'Teal (Default)', value: 'teal', colors: { 900: '#0E2C27', 800: '#123A33', 700: '#16433A', 600: '#1E5248' } },
  { name: 'Obsidian', value: 'obsidian', colors: { 900: '#0a0a0a', 800: '#141414', 700: '#1f1f1f', 600: '#2a2a2a' } },
  { name: 'Amethyst', value: 'amethyst', colors: { 900: '#1B1425', 800: '#231A31', 700: '#2C213D', 600: '#382A4E' } },
  { name: 'Crimson', value: 'crimson', colors: { 900: '#2A0808', 800: '#3D0D0D', 700: '#521414', 600: '#661A1A' } },
  { name: 'Sapphire', value: 'sapphire', colors: { 900: '#08172A', 800: '#0B223D', 700: '#103052', 600: '#153E66' } }
];

// Helper to convert hex to space-separated RGB (e.g. "14 44 39") for Tailwind
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

export function applyTheme(themeValue) {
  const theme = THEMES.find(t => t.value === themeValue) || THEMES[0];
  
  [900, 800, 700, 600].forEach(weight => {
    const hex = theme.colors[weight];
    const rgb = hexToRgb(hex);
    document.documentElement.style.setProperty(`--color-primary-${weight}`, hex);
    document.documentElement.style.setProperty(`--color-primary-${weight}-rgb`, rgb);
  });
}

export default function ThemesTab() {
  const [activeTheme, setActiveTheme] = useState('teal');

  useEffect(() => {
    const saved = localStorage.getItem('aevum_theme') || 'teal';
    setActiveTheme(saved);
  }, []);

  const handleThemeChange = (themeValue) => {
    setActiveTheme(themeValue);
    localStorage.setItem('aevum_theme', themeValue);
    applyTheme(themeValue);
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-serif text-bone tracking-wide">Themes</h2>
        <p className="text-silver/70 text-sm mt-1">Customize your horary dashboard experience.</p>
      </div>

      <div className="bg-teal-900/40 border border-teal-800/50 rounded-2xl p-6">
        <h3 className="text-lg font-serif text-bone mb-4 border-b border-teal-800/50 pb-2">Appearance</h3>
        
        <div className="mb-6">
          <p className="text-silver/90 text-sm font-semibold mb-3">Dashboard Theme Color</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEMES.map(theme => (
              <button
                key={theme.value}
                onClick={() => handleThemeChange(theme.value)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  activeTheme === theme.value 
                    ? 'border-copper-400 bg-teal-800/60 shadow-[0_0_10px_rgba(190,107,61,0.2)]' 
                    : 'border-teal-700/50 bg-teal-900/50 hover:border-teal-600 hover:bg-teal-800/40'
                }`}
              >
                <div 
                  className="w-6 h-6 rounded-full border border-silver/20 shrink-0"
                  style={{ backgroundColor: theme.colors[800] }}
                />
                <span className="text-sm font-medium text-bone/90">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
