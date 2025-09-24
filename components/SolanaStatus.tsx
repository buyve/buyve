'use client';

import { useState } from 'react';
import { useSolanaStatus } from '@/hooks/useSolana';
import { NETWORK_CONFIG } from '@/lib/solana';

interface SolanaStatusProps {
  showDetails?: boolean;
  className?: string;
}

export default function SolanaStatus({ showDetails = false, className = '' }: SolanaStatusProps) {
  const { refresh, ...status } = useSolanaStatus();
  const [showDropdown, setShowDropdown] = useState(false);

  const getStatusColor = () => {
    if (status.loading) return 'bg-yellow-500';
    if (status.connected) return 'bg-green-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (status.loading) return '연결 중...';
    if (status.connected) return '연결됨';
    return '연결 끊김';
  };

  return (
    <div className={`relative ${className}`}>
      {/* 상태 표시 버튼 */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        title={status.error || `Solana ${status.network} - ${getStatusText()}`}
      >
        {/* 상태 표시 점 */}
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}>
          {status.loading && (
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
          )}
        </div>
        
        {/* 네트워크 이름 */}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {status.network || 'Solana'}
        </span>
        
        {/* 블록 높이 (간단 표시) */}
        {status.connected && status.blockHeight && !showDetails && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            #{status.blockHeight.toLocaleString()}
          </span>
        )}

        {/* 드롭다운 화살표 */}
        <svg
          className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 드롭다운 메뉴 */}
      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Solana 네트워크
              </h3>
              <div className="flex items-center space-x-2">
                {/* 수동 새로고침 버튼 */}
                <button
                  onClick={refresh}
                  disabled={status.loading}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  title="연결 상태 새로고침"
                >
                  <svg 
                    className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${status.loading ? 'animate-spin' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
              </div>
            </div>

            {/* 연결 상태 정보 */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">상태:</span>
                <span className={`text-sm font-medium ${
                  status.connected ? 'text-green-600' : 'text-red-600'
                }`}>
                  {getStatusText()}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">네트워크:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {status.network}
                </span>
              </div>

              {status.connected && status.blockHeight && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">블록 높이:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    #{status.blockHeight.toLocaleString()}
                  </span>
                </div>
              )}

              {status.error && (
                <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    오류: {status.error}
                  </p>
                </div>
              )}
            </div>

            {/* 네트워크 전환 (개발용) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  개발 모드 - 네트워크 전환:
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {Object.entries(NETWORK_CONFIG).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => {
                        // 네트워크 전환 로직은 환경 변수 변경 필요로 알림만 표시
                        alert(`네트워크 전환은 환경 변수 변경 후 재시작이 필요합니다.`);
                      }}
                      className={`px-2 py-1 text-xs rounded ${
                        status.network === config.name
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {config.name.replace(' Beta', '')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 닫기 버튼 */}
            <button
              onClick={() => setShowDropdown(false)}
              className="w-full mt-3 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 드롭다운 외부 클릭 시 닫기 */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}

// 간단한 상태 표시만 하는 컴포넌트
export function SolanaStatusBadge({ className = '' }: { className?: string }) {
  const status = useSolanaStatus();

  const getStatusColor = () => {
    if (status.loading) return 'bg-yellow-500';
    if (status.connected) return 'bg-green-500';
    return 'bg-red-500';
  };

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
      <span className="text-xs text-gray-600 dark:text-gray-400">
        {status.network}
      </span>
    </div>
  );
} 