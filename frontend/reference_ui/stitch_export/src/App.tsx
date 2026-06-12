/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ScreenId, TransitionType } from './types';
import Screener from './components/Screener';
import { Sparkles, ArrowRight, Layers, Smartphone, SmartphoneIcon } from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('sydney-signin');
  const [previousScreen, setPreviousScreen] = useState<ScreenId | null>(null);
  const [transitionType, setTransitionType] = useState<TransitionType>('none');

  // Unified navigation setter
  const handleNavigation = (target: ScreenId, transition: TransitionType) => {
    setPreviousScreen(currentScreen);
    setCurrentScreen(target);
    setTransitionType(transition);
  };

  // Helper lists for direct debug sidebar routing
  const screenList: Array<{ id: ScreenId; label: string }> = [
    { id: 'sydney-signin', label: '1. Sign In' },
    { id: 'sydney-createaccount', label: '4. Create Account' },
    { id: 'sydney-inbox', label: '2. Inbox' },
    { id: 'sydney-thread', label: '3. Thread' },
    { id: 'new-agent', label: '6. New Agent Tools' },
    { id: 'confirm-agent', label: '7. Confirm Agent' },
    { id: 'agent-preferences', label: '5. Agent Preferences' },
    { id: 'connectors-advanced', label: '10. Connectors Flow' },
    { id: 'connectors-categorized', label: '8. Connectors Directory' },
    { id: 'settings', label: '9. Settings' }
  ];

  return (
    <div className="min-h-screen bg-[#F0EFEA] flex flex-col items-center justify-center p-0 md:p-6 select-none relative overflow-x-hidden">
      {/* Soft natural background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#E4F3EC] blur-3xl opacity-60 pointer-events-none -translate-x-1/2"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#FFF3D8] blur-3xl opacity-50 pointer-events-none translate-x-1/2"></div>

      {/* Main Container */}
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-center gap-8 z-10 relative">
        
        {/* LEFT COLUMN: Designer Bio / App Branding Info (hidden on deep mobile viewports) */}
        <div className="hidden lg:flex flex-col max-w-sm space-y-5 text-left text-on-surface select-none">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-primary-soft border border-primary/20 text-primary font-bold text-[10px] rounded-full uppercase tracking-wider">
              Prototype Build
            </span>
            <span className="text-xs text-muted-ink">• 10 Screens fully live</span>
          </div>

          <div className="space-y-1.5 animate-fade-in">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink font-sans">
              Sydney
            </h1>
            <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
              Quiet, trustworthy agent delegation environment optimized for focused micro-actions.
            </p>
          </div>

          {/* Quick-Routing Deck for QA Automation to easily jump screens */}
          <div className="bg-white/80 border border-[#E7E4DD] rounded-xl p-4.5 space-y-3 shadow-2xs backdrop-blur-md">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Layers size={14} />
              <span>Interactive Navigation Index</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {screenList.map((screen) => (
                <button
                  key={screen.id}
                  onClick={() => handleNavigation(screen.id, 'none')}
                  className={`px-3 py-2 text-left rounded-lg text-[11px] font-bold tracking-wide transition-all ${
                    currentScreen === screen.id
                      ? 'bg-primary text-on-primary shadow-2xs'
                      : 'bg-white border border-[#E7E4DD] text-on-surface hover:border-outline hover:bg-surface'
                  }`}
                >
                  {screen.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-ink leading-relaxed">
              *All button-level transitions and XPath selectors in the flow are fully functional. This index allows quick visual auditing of any screen state instantly.
            </p>
          </div>
        </div>

        {/* CENTER COLUMN: Premium Phone Device Frame Frame Shell */}
        <div className="relative flex-shrink-0 animate-scale-up">
          {/* External speaker notched phone mockup wrapper */}
          <div className="w-full max-w-sm md:w-[380px] h-[780px] bg-[#1A1C1B] rounded-[48px] p-3 shadow-2xl border-4 border-[#EEEEEC]/10 relative flex flex-col justify-between overflow-hidden">
            
            {/* Soft inner reflections */}
            <div className="absolute top-0 left-0 w-full h-full bg-linear-to-b from-white/5 to-transparent pointer-events-none rounded-[44px]"></div>

            {/* Simulated Ear Speaker Notch */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#1A1C1B] rounded-full z-30 flex items-center justify-center gap-1.5">
              <span className="w-8 h-1 bg-[#eeeeec]/30 rounded-full"></span>
              <span className="w-1.5 h-1.5 bg-[#eeeeec]/20 rounded-full"></span>
              <span className="w-2.5 h-2.5 bg-[#254F3F] border border-[#EEEEEC]/20 rounded-full shadow-inner animate-pulse"></span>
            </div>

            {/* Inner viewport container screen */}
            <div className="flex-1 bg-surface rounded-[38px] overflow-hidden flex flex-col relative pt-7">
              {/* Screener Component Core Navigation Stack */}
              <Screener
                currentScreen={currentScreen}
                previousScreen={previousScreen}
                transitionType={transitionType}
                setNavigation={handleNavigation}
              />
            </div>

            {/* Thin home indicator bar line */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/40 rounded-full z-20 pointer-events-none"></div>
          </div>
        </div>

        {/* RIGHT COLUMN: Mobile Preview controls for responsiveness */}
        <div className="flex lg:hidden bg-white/95 border border-[#E7E4DD] rounded-2xl p-5 shadow-lg max-w-sm w-full mx-5 flex-col space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">Screen Direct Link Simulator</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {screenList.map((screen) => (
              <button
                key={screen.id}
                onClick={() => handleNavigation(screen.id, 'none')}
                className={`py-2 px-2 text-center rounded-lg text-[10px] font-bold transition-all ${
                  currentScreen === screen.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-[#eeeeec] text-on-surface'
                }`}
              >
                {screen.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
