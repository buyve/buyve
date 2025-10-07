'use client';

import { useEffect } from 'react';

export default function ErrorSuppressor() {
  useEffect(() => {
    // Hide WebSocket errors (no impact on functionality)
    if (typeof window !== 'undefined') {
      const originalError = console.error;
      const originalWarn = console.warn;
      const originalLog = console.log;

      console.error = (...args) => {
        const message = args[0]?.toString?.() || '';
        // Don't display WebSocket-related errors in console
        if (message.includes('ws error') ||
            message.includes('WebSocket connection') ||
            message.includes('connect failed') ||
            message.includes('websocket.browser.ts') ||
            message.includes('connection.ts') ||
            args.some(arg => arg?.toString?.().includes('WebSocket'))) {
          return; // Ignore
        }
        originalError.apply(console, args);
      };

      console.warn = (...args) => {
        const message = args[0]?.toString?.() || '';
        if (message.includes('WebSocket') || message.includes('ws error')) {
          return; // Ignore
        }
        originalWarn.apply(console, args);
      };

      console.log = (...args) => {
        const message = args[0]?.toString?.() || '';
        if (message.includes('WebSocket connection to') && message.includes('failed')) {
          return; // Ignore
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

  return null; // Don't render
} 