/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // 폰트 패밀리 설정
      fontFamily: {
        'sans': ['"Satoshi"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        'satoshi': ['"Satoshi"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        'comfortaa': ['"Comfortaa"', 'sans-serif'],
        'bitcount': ['"Bitcount Grid Double"', 'system-ui'],
      },
      
      // 커스텀 컬러 팔레트
      colors: {
        // 기존 CSS 변수들을 Tailwind에서도 사용
        main: 'var(--color-main)',
        background: 'var(--color-background)',
        'secondary-background': 'var(--color-secondary-background)',
        foreground: 'var(--color-foreground)',
        'main-foreground': 'var(--color-main-foreground)',
        border: 'var(--color-border)',
        ring: 'var(--color-ring)',
        
        // 차트 컬러들
        chart: {
          1: 'var(--color-chart-1)',
          2: 'var(--color-chart-2)',
          3: 'var(--color-chart-3)',
          4: 'var(--color-chart-4)',
          5: 'var(--color-chart-5)',
        },
        
        // 추가 컬러 팔레트 (필요시)
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
        accent: {
          50: '#fef3c7',
          100: '#fde68a',
          500: '#f59e0b',
          600: '#d97706',
        }
      },
      
      // 커스텀 박스 섀도우 (네오브루탈리즘용)
      boxShadow: {
        'neo': 'var(--shadow-shadow)',
        'neo-hover': '6px 6px 0px 0px var(--color-border)',
        'neo-active': '2px 2px 0px 0px var(--color-border)',
      },
      
      // 커스텀 보더 라디우스
      borderRadius: {
        'neo': 'var(--radius-base)',
      },
      
      // 커스텀 폰트 웨이트
      fontWeight: {
        'base': 'var(--font-weight-base)',
        'heading': 'var(--font-weight-heading)',
      },
      
      // 애니메이션
      animation: {
        'bounce-gentle': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      
      // 간격 시스템
      spacing: {
        'neo-shadow': '4px',
      }
    },
  },
  plugins: [
    // 커스텀 플러그인 추가 가능
    function({ addUtilities }) {
      const newUtilities = {
        '.neo-card': {
          'border-width': '2px',
          'border-color': 'var(--color-border)',
          'box-shadow': 'var(--shadow-shadow)',
          'background': 'var(--color-secondary-background)',
          'border-radius': 'var(--radius-base)',
        },
        '.neo-button': {
          'border-width': '2px',
          'border-color': 'var(--color-border)',
          'box-shadow': 'var(--shadow-shadow)',
          'background': 'var(--color-main)',
          'color': 'var(--color-main-foreground)',
          'border-radius': 'var(--radius-base)',
          'font-weight': 'var(--font-weight-heading)',
          'transition': 'filter 0.1s',
          '&:active': {
            'filter': 'brightness(0.95)',
          }
        },
        '.neo-input': {
          'border-width': '2px',
          'border-color': 'var(--color-border)',
          'box-shadow': 'var(--shadow-shadow)',
          'background': 'var(--color-secondary-background)',
          'color': 'var(--color-foreground)',
          'border-radius': 'var(--radius-base)',
          'font-weight': 'var(--font-weight-base)',
        }
      }
      addUtilities(newUtilities)
    }
  ],
}