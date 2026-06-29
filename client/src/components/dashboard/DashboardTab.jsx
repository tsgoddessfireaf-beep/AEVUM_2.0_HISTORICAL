import Astrolabe from '../Astrolabe.jsx';
import LoadingState from '../LoadingState.jsx';
import { formatInline, answerStyle } from '../../lib/analysis.js';

export default function DashboardTab({ question, sections, ephemerisData, houseSignifications, chartPrefs, isWaiting }) {
  if (isWaiting && !ephemerisData) {
    return <LoadingState text="Erecting the Moment of Reception…" />;
  }

  const style = sections?.answer ? answerStyle(sections.answer) : null;

  return (
    <div className="flex flex-col xl:flex-row items-center xl:items-start justify-center gap-12 max-w-full mx-auto w-full pb-12 pt-8">
      
      {/* Left Panel: What This Means For You */}
      <div className="w-full xl:w-1/3 flex-1 xl:max-w-md xl:mt-24">
        {sections?.meaning && (
          <div className="glass-panel rounded-3xl p-8 flex flex-col justify-start">
            <h3 className="text-copper-400 font-serif text-2xl mb-2">Cosmic Synthesis</h3>
            <h4 className="text-silver/80 font-sans font-medium text-xs uppercase tracking-widest mb-6">What This Means For You</h4>
            <div className="text-bone/80 text-sm leading-loose font-serif">
              <span dangerouslySetInnerHTML={{ __html: formatInline(sections.meaning) }} />
            </div>
          </div>
        )}
      </div>

      {/* Center: Chart */}
      <div className="w-full xl:w-auto flex-shrink-0 flex justify-center order-first xl:order-none relative">
        <div className="absolute inset-0 bg-copper-400/20 blur-[120px] rounded-full z-0"></div>
        <div className="relative z-10 glass-panel rounded-[2.5rem] p-4 pb-2 pt-4">
          {ephemerisData ? (
            <Astrolabe 
              ephemerisData={ephemerisData} 
            />
          ) : (
            <LoadingState text="Preparing Chart..." />
          )}
        </div>
      </div>

      {/* Right Panel: What The Stars Show (or Petition/Answer) */}
      <div className="w-full xl:w-1/3 flex-1 xl:max-w-md xl:mt-24 space-y-6">
        <div className="glass-panel rounded-3xl p-8 flex flex-col justify-start">
          <h3 className="text-copper-400 font-serif text-2xl mb-2">The Verdict</h3>
          <h4 className="text-silver/80 font-sans font-medium text-xs uppercase tracking-widest mb-6">Your Petition</h4>
          <p className="text-bone/70 italic text-sm mb-6">"{question}"</p>
          
          {!sections?.answer ? (
            <LoadingState text="Judgment is being prepared…" />
          ) : (
            <div className="text-center mt-4">
              <p className={`text-5xl font-serif font-bold tracking-wider drop-shadow-lg ${style?.text}`}>
                {sections.answer.toUpperCase()}
              </p>
            </div>
          )}
        </div>
        
        {sections?.stars && (
          <div className="glass-panel rounded-3xl p-8 flex flex-col justify-start">
            <h3 className="text-copper-400 font-serif text-xl mb-2">Technical Analysis</h3>
            <h4 className="text-silver/80 font-sans font-medium text-xs uppercase tracking-widest mb-6">What The Stars Show</h4>
            <ul className="space-y-4 text-bone/80 text-sm leading-relaxed font-serif">
              {sections.stars.split('\n').filter(b => b.trim()).map((bullet, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-copper-400 mt-1 shrink-0">✦</span>
                  <span dangerouslySetInnerHTML={{ __html: formatInline(bullet.replace(/^[-*]\s*/, '')) }} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

    </div>
  );
}
