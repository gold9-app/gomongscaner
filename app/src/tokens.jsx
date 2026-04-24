// ============================================================
// 고몽스캐너 디자인 토큰
// ============================================================
// 모든 색/타입/간격/모션 토큰이 여기 모여있습니다.
// 스크린/컴포넌트에서는 `TOKENS.*` 또는 CSS 변수(`var(--gm-*)`)로 참조.
// ============================================================

const TOKENS = {
  color: {
    // 배경 스케일 (다크)
    bg0: "#07070A",       // 가장 깊은 배경
    bg1: "#0E0E14",       // 카드/시트 배경
    bg2: "#17171F",       // 패널/input
    bg3: "#24242E",       // 호버/보더
    bg4: "#32323E",

    // 전경 스케일
    fg0: "#F5F5F7",       // 주요 텍스트
    fg1: "#C8C8D0",       // 보조 텍스트
    fg2: "#86868F",       // 라벨
    fg3: "#56565E",       // disabled
    fg4: "#3A3A42",       // divider

    // 포인트
    yellow: "#FFCB05",    // 고몽 시그니처 옐로우 (주CTA)
    yellowDim: "#B38E00",
    yellowGlow: "rgba(255, 203, 5, 0.35)",

    // 홀로 그라디언트 (3색)
    holoA: "#A78BFA",     // violet
    holoB: "#F472B6",     // pink
    holoC: "#60A5FA",     // blue
    holoGrad: "linear-gradient(135deg, #A78BFA 0%, #F472B6 50%, #60A5FA 100%)",
    holoConic: "conic-gradient(from 140deg at 50% 50%, #60A5FA, #A78BFA, #F472B6, #FFCB05, #A78BFA, #60A5FA)",

    // 시맨틱
    up: "#34D399",        // 가격 상승
    down: "#F87171",      // 가격 하락
    info: "#60A5FA",
    warning: "#FBBF24",
  },

  font: {
    sans: `"Pretendard", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Noto Sans KR", system-ui, sans-serif`,
    mono: `"JetBrains Mono", "SF Mono", "Menlo", ui-monospace, monospace`,
  },

  // 모바일 프레임
  device: {
    width: 390,
    height: 844,
    safeTop: 47,
    safeBottom: 34,
    radius: 48,
  },

  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
    full: 999,
  },

  space: {
    px: 1,
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },

  shadow: {
    card: "0 10px 40px -12px rgba(0,0,0,0.7), 0 2px 8px -2px rgba(0,0,0,0.5)",
    glow: "0 0 0 1px rgba(255,203,5,0.4), 0 8px 32px -8px rgba(255,203,5,0.5)",
    holo: "0 10px 48px -12px rgba(167,139,250,0.5), 0 4px 20px -4px rgba(244,114,182,0.3)",
  },

  motion: {
    fast: "120ms cubic-bezier(0.4, 0, 0.2, 1)",
    base: "220ms cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "420ms cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "560ms cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
};

// ---- CSS 변수로도 동일하게 노출 ----
const TOKENS_CSS = `
  :root {
    --gm-bg0: ${TOKENS.color.bg0};
    --gm-bg1: ${TOKENS.color.bg1};
    --gm-bg2: ${TOKENS.color.bg2};
    --gm-bg3: ${TOKENS.color.bg3};
    --gm-bg4: ${TOKENS.color.bg4};
    --gm-fg0: ${TOKENS.color.fg0};
    --gm-fg1: ${TOKENS.color.fg1};
    --gm-fg2: ${TOKENS.color.fg2};
    --gm-fg3: ${TOKENS.color.fg3};
    --gm-fg4: ${TOKENS.color.fg4};
    --gm-yellow: ${TOKENS.color.yellow};
    --gm-yellow-dim: ${TOKENS.color.yellowDim};
    --gm-yellow-glow: ${TOKENS.color.yellowGlow};
    --gm-holo-a: ${TOKENS.color.holoA};
    --gm-holo-b: ${TOKENS.color.holoB};
    --gm-holo-c: ${TOKENS.color.holoC};
    --gm-holo-grad: ${TOKENS.color.holoGrad};
    --gm-up: ${TOKENS.color.up};
    --gm-down: ${TOKENS.color.down};
    --gm-font-sans: ${TOKENS.font.sans};
    --gm-font-mono: ${TOKENS.font.mono};
    --gm-shadow-card: ${TOKENS.shadow.card};
    --gm-shadow-glow: ${TOKENS.shadow.glow};
    --gm-shadow-holo: ${TOKENS.shadow.holo};
  }

  /* 글로벌 리셋 (프레임 안쪽 한정) */
  .gm-frame *, .gm-frame *::before, .gm-frame *::after {
    box-sizing: border-box;
  }
  .gm-frame {
    font-family: var(--gm-font-sans);
    color: var(--gm-fg0);
    -webkit-font-smoothing: antialiased;
    letter-spacing: -0.01em;
  }
  .gm-mono { font-family: var(--gm-font-mono); letter-spacing: -0.02em; }
  .gm-tabular { font-variant-numeric: tabular-nums; }

  /* 홀로 애니메이션 */
  @keyframes gm-holo-shift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes gm-scan-line {
    0%   { top: 8%; opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { top: 92%; opacity: 0; }
  }
  @keyframes gm-pulse-ring {
    0%   { transform: scale(0.8); opacity: 0.9; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  @keyframes gm-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes gm-bar-grow {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }
  @keyframes gm-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes gm-shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

// 전역 노출
Object.assign(window, { TOKENS, TOKENS_CSS });
