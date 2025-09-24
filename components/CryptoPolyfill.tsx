'use client';

import { useEffect } from 'react';

export default function CryptoPolyfill() {
  useEffect(() => {
    // crypto.randomUUID 폴리필
    if (typeof window !== 'undefined' && window.crypto && !window.crypto.randomUUID) {
      window.crypto.randomUUID = function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
    }
  }, []);

  return null;
}