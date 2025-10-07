'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import PCNavbar from '@/components/layout/PCNavbar';
import ChatArea from '@/components/layout/ChatArea';
import TradeSettingsPanel from '@/components/layout/TradeSettingsPanel';
import MobilePutter from '@/components/layout/MobilePutter';


export default function Home() {
  const [isPopupMode, setIsPopupMode] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const popup = urlParams.get('popup') === 'true';
    setIsPopupMode(popup);

    document.body.classList.add('trade-page');

    return () => {
      document.body.classList.remove('trade-page');
    };
  }, []);

  if (isPopupMode) {
    return <ChatArea />;
  }

  return (
    <>
      {/* PC Navbar - independent top 70px area */}
      <PCNavbar />

      {/* Desktop Layout (≥1024px) */}
      <div className="desktop-layout">
        <Navbar />
        <main className="desktop-main">
          <ChatArea />
          <TradeSettingsPanel />
        </main>
      </div>

      {/* Mobile Layout (<1024px) */}
      <div className="mobile-layout">
        <main className="mobile-main">
          <ChatArea />
        </main>
        <TradeSettingsPanel mobile />
        <MobilePutter />
      </div>
    </>
  );
}