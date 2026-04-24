// ============================================================
// 재사용 컴포넌트 라이브러리
// ============================================================
// 프레젠테이션 only — props만 받아서 렌더. 상태/API는 screens에서.
// ============================================================

// ---- 유틸 ----
const fmtKRW = (n) => "₩" + Math.round(n).toLocaleString("ko-KR");
const fmtKRWShort = (n) => {
  if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1) + "만";
  return n.toLocaleString("ko-KR");
};

// ============================================================
// StatusBar — iOS 스타일 상태바 (9:41 / 배터리 / 셀룰러)
// ============================================================
function StatusBar({ dark = true }) {
  const color = dark ? "#F5F5F7" : "#000";
  return (
    <div style={{
      height: 47, padding: "0 24px", display: "flex", alignItems: "flex-end",
      justifyContent: "space-between", paddingBottom: 6, color,
      fontFamily: "var(--gm-font-sans)", fontWeight: 600, fontSize: 15,
      letterSpacing: "-0.02em",
    }}>
      <span>9:41</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {/* 신호 */}
        <svg width="18" height="11" viewBox="0 0 18 11" fill={color}>
          <rect x="0" y="7" width="3" height="4" rx="0.5" />
          <rect x="5" y="5" width="3" height="6" rx="0.5" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="0.5" />
          <rect x="15" y="0" width="3" height="11" rx="0.5" />
        </svg>
        {/* 와이파이 */}
        <svg width="16" height="11" viewBox="0 0 16 11" fill={color}>
          <path d="M8 0C5 0 2.3 1 0 2.8l1.5 1.8C3.4 3 5.6 2.2 8 2.2s4.6.8 6.5 2.4L16 2.8C13.7 1 11 0 8 0zM8 4.4c-1.8 0-3.5.6-4.8 1.7l1.4 1.7c1-.8 2.1-1.2 3.4-1.2s2.4.4 3.4 1.2l1.4-1.7C11.5 5 9.8 4.4 8 4.4zM8 8.8c-.9 0-1.6.3-2.2.9L8 11l2.2-1.3c-.6-.6-1.3-.9-2.2-.9z" />
        </svg>
        {/* 배터리 */}
        <svg width="28" height="12" viewBox="0 0 28 12">
          <rect x="0.5" y="0.5" width="23" height="11" rx="3" fill="none" stroke={color} opacity="0.4" />
          <rect x="2" y="2" width="20" height="8" rx="1.5" fill={color} />
          <rect x="24.5" y="4" width="2" height="4" rx="1" fill={color} opacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

// ============================================================
// TabBar — 하단 네비
// ============================================================
function TabBar({ active = "scan", onChange = () => {} }) {
  const tabs = [
    { key: "scan",       label: "Scan",     icon: IconScan },
    { key: "search",     label: "Search",   icon: IconSearch },
    { key: "collection", label: "Library",  icon: IconLibrary },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      paddingBottom: 22, paddingTop: 10, paddingInline: 24,
      display: "flex", justifyContent: "space-around",
      background: "linear-gradient(to top, rgba(7,7,10,0.98) 40%, rgba(7,7,10,0.7) 80%, transparent)",
      backdropFilter: "blur(20px)",
      zIndex: 30,
    }}>
      {tabs.map(t => {
        const isActive = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "8px 18px", borderRadius: 14,
            color: isActive ? "var(--gm-yellow)" : "var(--gm-fg2)",
            transition: "color var(--gm-shadow-card)",
          }}>
            <t.icon size={24} active={isActive} />
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Button
// ============================================================
function Button({ variant = "primary", size = "md", fullWidth = false, leftIcon, children, onClick, style }) {
  const base = {
    border: "none", cursor: "pointer", fontFamily: "var(--gm-font-sans)",
    fontWeight: 700, letterSpacing: "-0.01em",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    transition: "transform var(--gm-motion-fast), background 160ms",
    width: fullWidth ? "100%" : "auto",
  };
  const sizes = {
    sm: { height: 36, padding: "0 14px", fontSize: 13, borderRadius: 10 },
    md: { height: 48, padding: "0 20px", fontSize: 15, borderRadius: 14 },
    lg: { height: 56, padding: "0 24px", fontSize: 16, borderRadius: 18 },
  };
  const variants = {
    primary: {
      background: "var(--gm-yellow)",
      color: "#0A0A0A",
      boxShadow: "0 8px 24px -8px rgba(255,203,5,0.6), inset 0 1px 0 rgba(255,255,255,0.3)",
    },
    ghost: {
      background: "var(--gm-bg2)",
      color: "var(--gm-fg0)",
      boxShadow: "inset 0 0 0 1px var(--gm-bg3)",
    },
    holo: {
      background: "var(--gm-holo-grad)",
      backgroundSize: "200% 200%",
      animation: "gm-holo-shift 6s ease infinite",
      color: "#0A0A0A",
      fontWeight: 800,
    },
    outline: {
      background: "transparent",
      color: "var(--gm-fg0)",
      boxShadow: "inset 0 0 0 1.5px var(--gm-fg3)",
    },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {leftIcon}{children}
    </button>
  );
}

// ============================================================
// Chip — Single/PSA · 레어도 등
// ============================================================
function Chip({ tone = "neutral", children, leftDot, style }) {
  const tones = {
    neutral: { bg: "var(--gm-bg3)", fg: "var(--gm-fg1)" },
    yellow:  { bg: "rgba(255,203,5,0.15)", fg: "var(--gm-yellow)" },
    holo:    { bg: "var(--gm-holo-grad)", fg: "#0A0A0A", fontWeight: 800 },
    psa:     { bg: "rgba(248,113,113,0.12)", fg: "#FCA5A5" },
    up:      { bg: "rgba(52,211,153,0.12)", fg: "var(--gm-up)" },
    down:    { bg: "rgba(248,113,113,0.12)", fg: "var(--gm-down)" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
      background: t.bg, color: t.fg,
      fontWeight: t.fontWeight ?? 700,
      ...style,
    }}>
      {leftDot && <span style={{
        width: 6, height: 6, borderRadius: 999, background: "currentColor",
      }} />}
      {children}
    </span>
  );
}

// ============================================================
// HoloCard — 홀로그래픽 카드 플레이스홀더 (실제 이미지 오면 교체)
// ============================================================
function HoloCard({ hue = 18, rarity = "SAR", label = "CARD", width = 220, tilt = 0, number = "201/165" }) {
  const height = width * 1.4;
  return (
    <div style={{
      position: "relative", width, height,
      borderRadius: 14,
      transform: `rotate(${tilt}deg)`,
      boxShadow: "var(--gm-shadow-holo)",
      overflow: "hidden",
      isolation: "isolate",
    }}>
      {/* 베이스 컬러 */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(155deg, oklch(35% 0.15 ${hue}) 0%, oklch(20% 0.12 ${hue}) 100%)`,
      }} />
      {/* 홀로 코닉 */}
      <div style={{
        position: "absolute", inset: 0,
        background: "var(--gm-holo-conic)",
        mixBlendMode: "color-dodge",
        opacity: 0.35,
        animation: "gm-holo-shift 8s linear infinite",
        backgroundSize: "200% 200%",
      }} />
      {/* 격자 텍스처 */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.12 }}>
        <defs>
          <pattern id={`grid-${hue}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#fff" strokeWidth="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${hue})`} />
      </svg>
      {/* 상단 라벨 */}
      <div style={{
        position: "absolute", top: 12, left: 12, right: 12,
        display: "flex", justifyContent: "space-between",
        fontFamily: "var(--gm-font-mono)", fontSize: 9, fontWeight: 700,
        color: "rgba(255,255,255,0.85)", letterSpacing: "0.1em",
      }}>
        <span>{rarity}</span>
        <span>{number}</span>
      </div>
      {/* 중앙 카드 일러스트 영역 (스트라이프 플레이스홀더) */}
      <div style={{
        position: "absolute", left: 12, right: 12, top: 32, bottom: 60,
        borderRadius: 8, overflow: "hidden",
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 8px)",
        }} />
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--gm-font-mono)", fontSize: 10, fontWeight: 600,
          color: "rgba(255,255,255,0.45)", letterSpacing: "0.15em",
        }}>
          {label}
        </div>
      </div>
      {/* 하단 네임바 */}
      <div style={{
        position: "absolute", left: 12, right: 12, bottom: 12,
        height: 40, borderRadius: 6,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        padding: "6px 10px",
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em" }}>
          HP 280
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
          ● ● ● ● ●
        </div>
      </div>
      {/* 광택 */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

// ============================================================
// ScanFrame — 카메라 뷰포트 위 스캔 프레임 (L자 코너 + 레이저 라인)
// ============================================================
function ScanFrame({ active = false, width = 250, aspect = 1.4 }) {
  const height = width * aspect;
  const corner = 28;
  const s = 3; // stroke
  const col = active ? "var(--gm-yellow)" : "rgba(255,255,255,0.9)";
  return (
    <div style={{
      position: "relative", width, height,
      pointerEvents: "none",
    }}>
      {/* L자 코너 4개 */}
      {[
        { top: 0, left: 0, borderTop: true,  borderLeft: true },
        { top: 0, right: 0, borderTop: true, borderRight: true },
        { bottom: 0, left: 0, borderBottom: true, borderLeft: true },
        { bottom: 0, right: 0, borderBottom: true, borderRight: true },
      ].map((c, i) => (
        <div key={i} style={{
          position: "absolute", width: corner, height: corner,
          top: c.top, left: c.left, right: c.right, bottom: c.bottom,
          borderTop:    c.borderTop    ? `${s}px solid ${col}` : "none",
          borderBottom: c.borderBottom ? `${s}px solid ${col}` : "none",
          borderLeft:   c.borderLeft   ? `${s}px solid ${col}` : "none",
          borderRight:  c.borderRight  ? `${s}px solid ${col}` : "none",
          borderRadius: "6px",
          boxShadow: active ? `0 0 12px ${col}` : "none",
          transition: "box-shadow 200ms, border-color 200ms",
        }} />
      ))}
      {/* 레이저 스캔 라인 */}
      {active && (
        <div style={{
          position: "absolute", left: 4, right: 4, height: 2,
          background: `linear-gradient(90deg, transparent, ${col} 50%, transparent)`,
          boxShadow: `0 0 16px ${col}, 0 0 32px ${col}`,
          animation: "gm-scan-line 1.8s ease-in-out infinite",
        }} />
      )}
    </div>
  );
}

// ============================================================
// PriceBar — 가격 범위 바 (min/mid/max)
// ============================================================
function PriceBar({ min, mid, max, animateKey }) {
  const pct = Math.max(4, Math.min(96, ((mid - min) / (max - min)) * 100));
  return (
    <div key={animateKey}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontFamily: "var(--gm-font-mono)", fontSize: 11, fontWeight: 600,
        color: "var(--gm-fg2)", marginBottom: 8, letterSpacing: "-0.01em",
      }}>
        <span>MIN {fmtKRWShort(min)}</span>
        <span style={{ color: "var(--gm-fg1)" }}>RANGE</span>
        <span>MAX {fmtKRWShort(max)}</span>
      </div>
      <div style={{
        position: "relative", height: 10, borderRadius: 999,
        background: "var(--gm-bg2)", overflow: "hidden",
      }}>
        {/* 그라디언트 트랙 */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg, #34D399 0%, #FFCB05 50%, #F87171 100%)",
          opacity: 0.25,
        }} />
        {/* 액티브 채움 */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: 0,
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--gm-yellow), #F472B6)",
          boxShadow: "0 0 16px rgba(255,203,5,0.6)",
          animation: "gm-bar-grow 800ms cubic-bezier(0.4,0,0.2,1)",
          transformOrigin: "left",
        }} />
        {/* 중간값 인디케이터 */}
        <div style={{
          position: "absolute", top: -4, bottom: -4,
          left: `${pct}%`, width: 4, borderRadius: 2,
          background: "#fff",
          boxShadow: "0 0 10px #fff, 0 0 20px var(--gm-yellow)",
          transform: "translateX(-50%)",
        }} />
      </div>
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gm-fg2)", letterSpacing: "0.1em" }}>MEDIAN</div>
        <div style={{
          fontFamily: "var(--gm-font-mono)", fontSize: 16, fontWeight: 700,
          color: "var(--gm-yellow)",
        }}>{fmtKRW(mid)}</div>
      </div>
    </div>
  );
}

// ============================================================
// MarketRow — 마켓별 시세 행
// ============================================================
function MarketRow({ market }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 16px", borderRadius: 14,
      background: "var(--gm-bg1)",
      boxShadow: "inset 0 0 0 1px var(--gm-bg3)",
    }}>
      <MarketLogo k={market.key} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--gm-fg0)" }}>
            {market.label}
          </span>
          {market.listings != null && (
            <span style={{ fontSize: 10, color: "var(--gm-fg2)", fontFamily: "var(--gm-font-mono)" }}>
              · {market.listings} listings
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--gm-fg2)", marginTop: 2 }}>
          {market.updatedAt}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{
          fontFamily: "var(--gm-font-mono)", fontWeight: 700, fontSize: 14,
          color: "var(--gm-fg0)",
        }}>{fmtKRW(market.last)}</div>
        {market.trend != null && (
          <div style={{
            fontFamily: "var(--gm-font-mono)", fontSize: 11, fontWeight: 600,
            color: market.trend >= 0 ? "var(--gm-up)" : "var(--gm-down)",
            marginTop: 2,
          }}>
            {market.trend >= 0 ? "▲" : "▼"} {Math.abs(market.trend).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

// 마켓 로고 플레이스홀더 (모노그램)
function MarketLogo({ k }) {
  const map = {
    "kream":         { bg: "#000", fg: "#fff",  mono: "K" },
    "snkrdunk":      { bg: "#00C2B3", fg: "#000", mono: "SD" },
    "pricecharting": { bg: "#1E40AF", fg: "#fff", mono: "PC" },
    "ebay-sold":     { bg: "#E53E3E", fg: "#fff", mono: "eB" },
    "ebay-listing":  { bg: "#3B82F6", fg: "#fff", mono: "eB" },
  };
  const m = map[k] || { bg: "#333", fg: "#fff", mono: "?" };
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: m.bg, color: m.fg,
      display: "grid", placeItems: "center",
      fontSize: 11, fontWeight: 800, letterSpacing: "-0.02em",
      flexShrink: 0,
      fontFamily: "var(--gm-font-mono)",
    }}>{m.mono}</div>
  );
}

// ============================================================
// 아이콘들 — 단순 SVG (복잡한 일러스트 X)
// ============================================================
function IconScan({ size = 24, active }) {
  const c = active ? "var(--gm-yellow)" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V5a1 1 0 011-1h2M20 7V5a1 1 0 00-1-1h-2M4 17v2a1 1 0 001 1h2M20 17v2a1 1 0 01-1 1h-2"/>
      <path d="M4 12h16" stroke={active ? "var(--gm-yellow)" : c} strokeWidth="2.2"/>
    </svg>
  );
}
function IconSearch({ size = 24, active }) {
  const c = active ? "var(--gm-yellow)" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/>
      <path d="m20 20-3.5-3.5"/>
    </svg>
  );
}
function IconLibrary({ size = 24, active }) {
  const c = active ? "var(--gm-yellow)" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3"  y="4" width="5" height="16" rx="1.5"/>
      <rect x="10" y="4" width="5" height="16" rx="1.5"/>
      <path d="M17 6l3.5 1-3 15-3.5-1"/>
    </svg>
  );
}
function IconUpload({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <path d="M17 8l-5-5-5 5"/>
      <path d="M12 3v12"/>
    </svg>
  );
}
function IconFlash({ size = 20, on = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
         fill={on ? "var(--gm-yellow)" : "none"}
         stroke={on ? "var(--gm-yellow)" : "currentColor"} strokeWidth="2" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  );
}
function IconClose({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  );
}
function IconBookmark({ size = 20, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
         fill={filled ? "currentColor" : "none"}
         stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z"/>
    </svg>
  );
}
function IconShare({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13"/>
      <path d="M7 8l5-5 5 5"/>
      <path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/>
    </svg>
  );
}
function IconBack({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6"/>
    </svg>
  );
}
function IconCheck({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7"/>
    </svg>
  );
}
function IconSparkle({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7z"/>
    </svg>
  );
}
function IconTrend({ size = 14, up = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {up
        ? <><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>
        : <><path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h7v-7"/></>}
    </svg>
  );
}
function IconCamera({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 012-2h2.5l1.5-2h6l1.5 2H19a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

// 전역 노출
Object.assign(window, {
  StatusBar, TabBar, Button, Chip, HoloCard, ScanFrame, PriceBar, MarketRow,
  IconScan, IconSearch, IconLibrary, IconUpload, IconFlash, IconClose,
  IconBookmark, IconShare, IconBack, IconCheck, IconSparkle, IconTrend, IconCamera,
  fmtKRW, fmtKRWShort,
});
