'use client';

import { useEffect } from 'react';

export default function ErrorSuppressor() {
  useEffect(() => {
    // 🚫 WebSocket 오류 숨기기 (기능에는 영향 없음)
    if (typeof window !== 'undefined') {
      const originalError = console.error;
      const originalWarn = console.warn;
      const originalLog = console.log;
      
      console.error = (...args) => {
        const message = args[0]?.toString?.() || '';
        // WebSocket 관련 오류는 콘솔에 표시하지 않음
        if (message.includes('ws error') || 
            message.includes('WebSocket connection') ||
            message.includes('connect failed') ||
            message.includes('websocket.browser.ts') ||
            message.includes('connection.ts') ||
            args.some(arg => arg?.toString?.().includes('WebSocket'))) {
          return; // 무시
        }
        originalError.apply(console, args);
      };
      
      console.warn = (...args) => {
        const message = args[0]?.toString?.() || '';
        if (message.includes('WebSocket') || message.includes('ws error')) {
          return; // 무시
        }
        originalWarn.apply(console, args);
      };
      
      console.log = (...args) => {
        const message = args[0]?.toString?.() || '';
        if (message.includes('WebSocket connection to') && message.includes('failed')) {
          return; // 무시
        }
        originalLog.apply(console, args);
      };
      
      return () => {
        console.error = originalError;
        console.warn = originalWarn;
        console.log = originalLog;
      };
    }
  }, []);

  return null; // 렌더링하지 않음
} 