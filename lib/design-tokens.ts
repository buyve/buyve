// 디자인 토큰 타입 정의
export interface DesignTokens {
  colors: {
    background: string;
    secondaryBackground: string;
    foreground: string;
    mainForeground: string;
    main: string;
    border: string;
    ring: string;
    overlay: string;
    chart: {
      1: string;
      2: string;
      3: string;
      4: string;
      5: string;
      activeDot: string;
    };
  };
  spacing: {
    boxShadowX: string;
    boxShadowY: string;
    reverseBoxShadowX: string;
    reverseBoxShadowY: string;
  };
  borderRadius: {
    base: string;
  };
  shadows: {
    default: string;
    hover: string;
    active: string;
  };
  fontWeight: {
    base: string;
    heading: string;
  };
}

// 라이트 테마 토큰
export const lightTheme: DesignTokens = {
  colors: {
    background: 'oklch(26.86% 0.0327 60.06)',
    secondaryBackground: 'oklch(100% 0 0)',
    foreground: 'oklch(0% 0 0)',
    mainForeground: 'oklch(0% 0 0)',
    main: 'oklch(78.57% 0.1422 180.36)',
    border: 'oklch(0% 0 0)',
    ring: 'oklch(0% 0 0)',
    overlay: 'oklch(0% 0 0 / 0.8)',
    chart: {
      1: '#00D6BD',
      2: '#0099FF',
      3: '#7A83FF',
      4: '#FF4D50',
      5: '#FACC00',
      activeDot: '#000',
    },
  },
  spacing: {
    boxShadowX: '4px',
    boxShadowY: '4px',
    reverseBoxShadowX: '-4px',
    reverseBoxShadowY: '-4px',
  },
  borderRadius: {
    base: '0px',
  },
  shadows: {
    default: '4px 4px 0px 0px var(--color-border)',
    hover: '6px 6px 0px 0px var(--color-border)',
    active: '2px 2px 0px 0px var(--color-border)',
  },
  fontWeight: {
    base: '500',
    heading: '900',
  },
};

// 다크 테마 토큰
export const darkTheme: DesignTokens = {
  colors: {
    background: 'oklch(22.65% 0.0236 198.49)',
    secondaryBackground: 'oklch(23.93% 0 0)',
    foreground: 'oklch(92.49% 0 0)',
    mainForeground: 'oklch(0% 0 0)',
    main: 'oklch(71.47% 0.129261 180.4742)',
    border: 'oklch(0% 0 0)',
    ring: 'oklch(100% 0 0)',
    overlay: 'oklch(0% 0 0 / 0.8)',
    chart: {
      1: '#00BDA7',
      2: '#008AE5',
      3: '#7A83FF',
      4: '#FF6669',
      5: '#E0B700',
      activeDot: '#fff',
    },
  },
  spacing: {
    boxShadowX: '4px',
    boxShadowY: '4px',
    reverseBoxShadowX: '-4px',
    reverseBoxShadowY: '-4px',
  },
  borderRadius: {
    base: '0px',
  },
  shadows: {
    default: '4px 4px 0px 0px var(--color-border)',
    hover: '6px 6px 0px 0px var(--color-border)',
    active: '2px 2px 0px 0px var(--color-border)',
  },
  fontWeight: {
    base: '500',
    heading: '900',
  },
};

// 테마 적용 함수
export const applyTheme = (theme: DesignTokens, isDark = false) => {
  const root = document.documentElement;
  
  // CSS 변수 업데이트
  root.style.setProperty('--background', theme.colors.background);
  root.style.setProperty('--secondary-background', theme.colors.secondaryBackground);
  root.style.setProperty('--foreground', theme.colors.foreground);
  root.style.setProperty('--main-foreground', theme.colors.mainForeground);
  root.style.setProperty('--main', theme.colors.main);
  root.style.setProperty('--border', theme.colors.border);
  root.style.setProperty('--ring', theme.colors.ring);
  root.style.setProperty('--overlay', theme.colors.overlay);
  
  // 차트 컬러
  root.style.setProperty('--chart-1', theme.colors.chart[1]);
  root.style.setProperty('--chart-2', theme.colors.chart[2]);
  root.style.setProperty('--chart-3', theme.colors.chart[3]);
  root.style.setProperty('--chart-4', theme.colors.chart[4]);
  root.style.setProperty('--chart-5', theme.colors.chart[5]);
  root.style.setProperty('--chart-active-dot', theme.colors.chart.activeDot);
  
  // 간격과 그림자
  root.style.setProperty('--spacing-boxShadowX', theme.spacing.boxShadowX);
  root.style.setProperty('--spacing-boxShadowY', theme.spacing.boxShadowY);
  root.style.setProperty('--spacing-reverseBoxShadowX', theme.spacing.reverseBoxShadowX);
  root.style.setProperty('--spacing-reverseBoxShadowY', theme.spacing.reverseBoxShadowY);
  root.style.setProperty('--radius-base', theme.borderRadius.base);
  root.style.setProperty('--shadow-shadow', theme.shadows.default);
  root.style.setProperty('--font-weight-base', theme.fontWeight.base);
  root.style.setProperty('--font-weight-heading', theme.fontWeight.heading);
  
  // 다크모드 클래스 토글
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

// 커스텀 테마 생성 헬퍼
export const createCustomTheme = (overrides: Partial<DesignTokens>): DesignTokens => {
  return {
    ...lightTheme,
    ...overrides,
    colors: {
      ...lightTheme.colors,
      ...overrides.colors,
    },
  };
};

// 사전 정의된 테마 변형들
export const themes = {
  light: lightTheme,
  dark: darkTheme,
  
  // 예시: 미니멀 테마
  minimal: createCustomTheme({
    colors: {
      ...lightTheme.colors,
      background: 'oklch(99% 0 0)',
      main: 'oklch(20% 0 0)',
      border: 'oklch(80% 0 0)',
    },
    borderRadius: {
      base: '8px',
    },
  }),
  
  // 예시: 컬러풀 테마
  colorful: createCustomTheme({
    colors: {
      ...lightTheme.colors,
      main: 'oklch(65% 0.2 330)',
      background: 'oklch(97% 0.02 330)',
      border: 'oklch(30% 0.1 330)',
    },
  }),
  
  // 예시: 어스 톤 테마
  earth: createCustomTheme({
    colors: {
      ...lightTheme.colors,
      background: 'oklch(92% 0.05 60)',
      main: 'oklch(45% 0.15 60)',
      border: 'oklch(25% 0.1 60)',
    },
  }),
};

// 테마 사용 예시:
// import { applyTheme, themes } from './lib/design-tokens';
// applyTheme(themes.minimal); 