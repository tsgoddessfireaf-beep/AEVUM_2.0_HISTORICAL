import { useState, useEffect } from 'react';
import { fetchLibraryText } from '../../lib/firebase';

const ASTROLOGERS = [
  { id: 'alchabitius', name: 'Alchabitius', file: 'alchabitius-english.txt', title: 'Introduction to the Art of Judgments', color: 'copper' },
  { id: 'ibnezra', name: 'Abraham Ibn Ezra', file: 'ibnezra-english.txt', title: 'The Beginning of Wisdom', color: 'emerald' },
  { id: 'lilly', name: 'William Lilly', file: 'lilly-modern.txt', title: 'Christian Astrology', color: 'teal' },
  { id: 'dariot', name: 'Claude Dariot', file: 'dariot-english.txt', title: 'A Briefe and Most Easie Introduction', color: 'purple' },
];

/**
 * LibraryContext displays relevant astrological quotes based on the current slide's topic.
 * It fetches the texts from Firebase Storage.
 */
export default function LibraryContext({ currentSlide }) {
  const [texts, setTexts] = useState({});
  const [loading, setLoading] = useState(true);

  // A very basic keyword extractor for demo purposes.
  const keyword = currentSlide?.title?.toLowerCase() || '';
  
  useEffect(() => {
    async function fetchLibrary() {
      setLoading(true);
      try {
        const fetchPromises = ASTROLOGERS.map(a => fetchLibraryText(a.file));
        const results = await Promise.all(fetchPromises);
        
        const newTexts = {};
        ASTROLOGERS.forEach((a, i) => {
          newTexts[a.id] = results[i];
        });
        
        setTexts(newTexts);
      } catch (err) {
        console.error('Error fetching library texts:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLibrary();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-silver/50 text-sm">
        Consulting the archives...
      </div>
    );
  }

  if (!currentSlide) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8 text-silver/70 text-center text-sm border border-teal-800/30 rounded-2xl bg-teal-900/20">
        The Library awaits. Select a slide to view historical contexts.
      </div>
    );
  }

  // Very naive search function to extract a snippet containing the keyword.
  const extractSnippet = (text, word) => {
    if (!text || !word) return null;
    
    // Look for paragraphs or sentences containing the word.
    const regex = new RegExp(`([^\\n]*?\\b${word}\\b[^\\n]*)`, 'i');
    const match = text.match(regex);
    if (match) {
      return match[1].trim();
    }
    // Fallback: search for signs or planets mentioned in the script
    const terms = ['moon', 'sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'ascendant', 'midheaven'];
    for (let t of terms) {
      if (currentSlide.script?.toLowerCase().includes(t) || currentSlide.title?.toLowerCase().includes(t)) {
        const fallbackRegex = new RegExp(`([^\\n]*?\\b${t}\\b[^\\n]*)`, 'i');
        const fallbackMatch = text.match(fallbackRegex);
        if (fallbackMatch) return fallbackMatch[1].trim();
      }
    }
    return "No direct mention found in this text for the current topic.";
  };

  const getColorClasses = (color) => {
    const map = {
      copper: 'bg-copper-500 text-copper-400 border-copper-900/50',
      emerald: 'bg-emerald-500 text-emerald-400 border-emerald-900/50',
      teal: 'bg-teal-500 text-teal-400 border-teal-900/50',
      purple: 'bg-purple-500 text-purple-400 border-purple-900/50',
    };
    return map[color] || map.copper;
  };

  return (
    <div className="flex flex-col h-full bg-teal-900/30 border border-teal-800/50 rounded-2xl overflow-hidden">
      <div className="bg-teal-900/80 px-4 py-3 border-b border-teal-800/50 flex items-center justify-between">
        <h3 className="text-bone font-serif text-lg">Astrological Tradition</h3>
        <span className="text-xs text-silver/70 uppercase tracking-widest">{currentSlide.title}</span>
      </div>
      
      <div className="p-6 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
        {ASTROLOGERS.map((astrologer) => {
          const quote = extractSnippet(texts[astrologer.id], keyword);
          const colorClass = getColorClasses(astrologer.color);
          const [bg, text, border] = colorClass.split(' ');
          
          return (
            <div key={astrologer.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${bg}`}></div>
                <h4 className={`${text} font-serif tracking-wide`}>{astrologer.name}</h4>
                <span className="text-silver/50 text-xs italic">{astrologer.title}</span>
              </div>
              <div className={`pl-4 border-l ${border}`}>
                <p className="text-bone/80 text-sm leading-relaxed font-serif italic">
                  "{quote}"
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
