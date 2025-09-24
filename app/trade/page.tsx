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
    // URL 파라미터로 팝업 모드인지 확인
    const urlParams = new URLSearchParams(window.location.search);
    const popup = urlParams.get('popup') === 'true';
    setIsPopupMode(popup);

    // 트레이딩 페이지에서 모바일 스크롤 방지를 위한 클래스 추가
    document.body.classList.add('trade-page');

    // 컴포넌트 언마운트 시 클래스 제거
    return () => {
      document.body.classList.remove('trade-page');
    };
  }, []);

  // 팝업 모드일 때는 ChatArea만 렌더링
  if (isPopupMode) {
    return <ChatArea />;
  }

  return (
    <>
      {/* PC Navbar - 독립적인 상단 70px 영역 */}
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