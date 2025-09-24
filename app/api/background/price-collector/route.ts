import { NextRequest, NextResponse } from 'next/server';

// 백그라운드 가격 수집 상태 관리
let isCollectorRunning = false;
let collectorInterval: NodeJS.Timeout | null = null;
const collectionStats = {
  lastCollection: null as Date | null,
  successCount: 0,
  errorCount: 0,
  isActive: false
};

// 15분마다 자동 수집 함수
async function collectPrices() {
  try {
    const response = await fetch('http://localhost:3000/api/cron/price-collector', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      await response.json();
      collectionStats.lastCollection = new Date();
      collectionStats.successCount++;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch {
    collectionStats.errorCount++;
  }
}

// 다음 15분 정각까지 남은 시간 계산
function getTimeUntilNextQuarterHour(): number {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const milliseconds = now.getMilliseconds();
  
  const minutesToNext = 15 - (minutes % 15);
  const millisecondsToNext = (minutesToNext * 60 - seconds) * 1000 - milliseconds;
  
  return millisecondsToNext;
}

// 백그라운드 수집기 시작
function startBackgroundCollector() {
  if (isCollectorRunning) {
    return;
  }

  isCollectorRunning = true;
  collectionStats.isActive = true;
  
  // 즉시 한 번 수집
  collectPrices();
  
  // 다음 15분 정각까지 대기 후 시작
  const initialDelay = getTimeUntilNextQuarterHour();
  
  setTimeout(() => {
    // 첫 15분 정각 수집
    collectPrices();
    
    // 이후 15분마다 반복
    collectorInterval = setInterval(collectPrices, 15 * 60 * 1000);
  }, initialDelay);
}

// 백그라운드 수집기 중지
function stopBackgroundCollector() {
  if (collectorInterval) {
    clearInterval(collectorInterval);
    collectorInterval = null;
  }
  
  isCollectorRunning = false;
  collectionStats.isActive = false;
}

// API 엔드포인트들
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'start':
      startBackgroundCollector();
      return NextResponse.json({
        success: true,
        message: '백그라운드 가격 수집기가 시작되었습니다.',
        stats: collectionStats
      });

    case 'stop':
      stopBackgroundCollector();
      return NextResponse.json({
        success: true,
        message: '백그라운드 가격 수집기가 중지되었습니다.',
        stats: collectionStats
      });

    case 'status':
    default:
      return NextResponse.json({
        success: true,
        isRunning: isCollectorRunning,
        stats: {
          ...collectionStats,
          nextCollection: isCollectorRunning ? 
            new Date(Date.now() + getTimeUntilNextQuarterHour()).toISOString() : null
        }
      });
  }
}

export async function POST() {
  // 서버 시작 시 자동으로 백그라운드 수집기 시작
  if (!isCollectorRunning) {
    startBackgroundCollector();
  }
  
  return NextResponse.json({
    success: true,
    message: '백그라운드 가격 수집기가 초기화되었습니다.',
    stats: collectionStats
  });
}

// 서버 시작 시 자동 실행 (모듈 로드 시)
if (typeof window === 'undefined' && !isCollectorRunning) {
  // 서버 환경에서만 실행
  setTimeout(startBackgroundCollector, 5000); // 5초 후 시작 (서버 안정화 대기)
} 