import React, { useState, useEffect } from 'react';
import SlideDeck from '../SlideDeck.jsx';
import LibraryContext from './LibraryContext.jsx';
import { loadPublicReading } from '../../lib/firebase.js';

export default function LearningTab({ ephemerisData, houseSignifications, chartPrefs, slides, audioUrls, readingId }) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [fetchedSlides, setFetchedSlides] = useState(null);
  const [fetchedAudioUrls, setFetchedAudioUrls] = useState(null);
  
  useEffect(() => {
    if (slides) {
      setFetchedSlides(slides);
      setFetchedAudioUrls(audioUrls);
      return;
    }
    if (readingId) {
      loadPublicReading(readingId).then((reading) => {
        if (reading && reading.packageSlides) {
          setFetchedSlides(reading.packageSlides);
          setFetchedAudioUrls(reading.audioUrls || {});
        }
      }).catch(console.error);
    }
  }, [slides, audioUrls, readingId]);

  const activeSlides = fetchedSlides || [];

  if (activeSlides.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-serif text-bone tracking-wide">Learning & Texts</h2>
          <p className="text-silver/70 text-sm mt-1">Astrological education and historical source texts.</p>
        </div>
        <div className="bg-teal-900/40 border border-teal-800/50 rounded-2xl p-8 text-center mt-12">
          <p className="text-silver/70">Preparing learning modules...</p>
        </div>
      </div>
    );
  }

  const currentSlide = activeSlides[currentSlideIndex];

  return (
    <div className="w-full max-w-6xl mx-auto h-[80vh] flex flex-col md:flex-row gap-6 p-4">
      {/* Left Pane: Slide Presentation */}
      <div className="w-full md:w-1/2 flex flex-col h-full bg-teal-900/20 border border-teal-800/40 rounded-2xl p-4 overflow-hidden">
        <div className="mb-4 text-center">
          <h2 className="text-xl font-serif text-bone tracking-wide">Chart Walkthrough</h2>
          <p className="text-silver/70 text-xs mt-1">Visual synthesis of your reading.</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          <SlideDeck 
            slides={activeSlides}
            audioUrls={fetchedAudioUrls || {}}
            ephemerisData={ephemerisData}
            significations={houseSignifications}
            chartPrefs={chartPrefs}
            onSlideChange={(idx) => setCurrentSlideIndex(idx)}
          />
        </div>
      </div>

      {/* Right Pane: Interactive Translations */}
      <div className="w-full md:w-1/2 h-full">
        <LibraryContext currentSlide={currentSlide} />
      </div>
    </div>
  );
}
