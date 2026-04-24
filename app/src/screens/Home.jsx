// ============================================================
// Home — 홈 = 카메라 스캐너 뷰
// ============================================================
function Home({ onCapture, onOpenSearch, onOpenUpload }) {
  const [flash, setFlash] = React.useState(false);
  const [shutter, setShutter] = React.useState(false);

  const handleShutter = () => {
    setShutter(true);
    setTimeout(() => { setShutter(false); onCapture?.(); }, 280);
  };

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "var(--gm-bg0)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ===== 배경: 카메라 뷰포트 시뮬레이션 ===== */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          radial-gradient(ellipse at 30% 20%, oklch(25% 0.08 260) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, oklch(22% 0.1 30) 0%, transparent 50%),
          #0A0A10
        `,
      }}>
        {/* 먼지/노이즈 */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.3,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }} />
        {/* 테이블 표면 그림자 */}
        <div style={{
          position: "absolute", bottom: "28%", left: "10%", right: "10%", height: "30%",
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.7), transparent 70%)",
          filter: "blur(12px)",
        }} />
        {/* 가상 카드 (뷰포트 안에 있는 실제 카드 시뮬) */}
        <div style={{
          position: "absolute", top: "30%", left: "50%",
          transform: "translateX(-50%) rotate(-2deg)",
          filter: "brightness(0.75) saturate(0.8)",
        }}>
          <HoloCard width={220} hue={18} number="201/165" label="CARD IN FRAME" />
        </div>
      </div>

      {/* ===== 비네팅 ===== */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)",
        pointerEvents: "none",
      }} />

      {/* ===== 상단 HUD ===== */}
      <div style={{ position: "relative", zIndex: 5 }}>
        <StatusBar />
        <div style={{
          padding: "8px 20px 0", display: "flex",
          justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LogoMark />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em" }}>
                고몽<span style={{ color: "var(--gm-yellow)" }}>스캐너</span>
              </div>
              <div style={{
                fontSize: 10, color: "var(--gm-fg2)",
                fontFamily: "var(--gm-font-mono)", letterSpacing: "0.05em",
                marginTop: 1,
              }}>GoMong Scanner · v0.1</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <IconPill onClick={() => setFlash(f => !f)}><IconFlash on={flash} /></IconPill>
          </div>
        </div>
      </div>

      {/* ===== 스캔 프레임 영역 ===== */}
      <div style={{
        position: "relative", zIndex: 4, flex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        paddingInline: 20,
      }}>
        {/* 프레임 위쪽 라벨 */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 999,
          background: "rgba(10,10,14,0.6)", backdropFilter: "blur(12px)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
          marginBottom: 20,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: "var(--gm-yellow)",
            boxShadow: "0 0 8px var(--gm-yellow)",
            animation: "gm-pulse-ring 1.2s ease-out infinite",
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--gm-fg1)", letterSpacing: "0.02em" }}>
            카드를 프레임 안에 맞춰주세요
          </span>
        </div>

        <ScanFrame active={true} width={250} />

        {/* 프레임 하단 힌트 */}
        <div style={{
          marginTop: 20,
          display: "flex", gap: 6, alignItems: "center",
          fontSize: 11, color: "var(--gm-fg2)",
          fontFamily: "var(--gm-font-mono)", letterSpacing: "0.02em",
        }}>
          <IconSparkle size={12} />
          AI가 자동으로 인식합니다
        </div>
      </div>

      {/* ===== 셔터 영역 ===== */}
      <div style={{
        position: "relative", zIndex: 5,
        padding: "20px 32px 120px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* 업로드 */}
        <button onClick={onOpenUpload} style={{
          width: 56, height: 56, borderRadius: 16,
          background: "rgba(23,23,31,0.8)", backdropFilter: "blur(12px)",
          border: "none", cursor: "pointer",
          boxShadow: "inset 0 0 0 1px var(--gm-bg3)",
          color: "var(--gm-fg0)",
          display: "grid", placeItems: "center",
        }}>
          <IconUpload size={22} />
        </button>

        {/* 셔터 */}
        <button onClick={handleShutter} style={{
          width: 84, height: 84, borderRadius: 999,
          padding: 5,
          background: "rgba(255,255,255,0.15)",
          border: "3px solid rgba(255,255,255,0.9)",
          boxShadow: "0 0 0 6px rgba(0,0,0,0.3)",
          cursor: "pointer",
          display: "grid", placeItems: "center",
          transform: shutter ? "scale(0.9)" : "scale(1)",
          transition: "transform 120ms",
        }}>
          <div style={{
            width: "100%", height: "100%", borderRadius: 999,
            background: "var(--gm-yellow)",
            boxShadow: "0 0 24px var(--gm-yellow-glow), inset 0 2px 0 rgba(255,255,255,0.4)",
          }} />
        </button>

        {/* 텍스트 검색 */}
        <button onClick={onOpenSearch} style={{
          width: 56, height: 56, borderRadius: 16,
          background: "rgba(23,23,31,0.8)", backdropFilter: "blur(12px)",
          border: "none", cursor: "pointer",
          boxShadow: "inset 0 0 0 1px var(--gm-bg3)",
          color: "var(--gm-fg0)",
          display: "grid", placeItems: "center",
        }}>
          <IconSearch size={22} />
        </button>
      </div>

      {/* 셔터 플래시 효과 */}
      {shutter && (
        <div style={{
          position: "absolute", inset: 0, background: "#fff",
          animation: "gm-flash 280ms ease-out forwards",
          zIndex: 100,
        }} />
      )}
      <style>{`
        @keyframes gm-flash {
          0% { opacity: 0.8; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function LogoMark() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: "var(--gm-yellow)",
      display: "grid", placeItems: "center",
      boxShadow: "0 4px 16px var(--gm-yellow-glow)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "var(--gm-holo-conic)",
        mixBlendMode: "overlay", opacity: 0.4,
      }} />
      <span style={{
        position: "relative",
        fontSize: 16, fontWeight: 900, color: "#0A0A0A",
        letterSpacing: "-0.04em",
      }}>고</span>
    </div>
  );
}

function IconPill({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 36, height: 36, borderRadius: 999,
      background: "rgba(23,23,31,0.7)", backdropFilter: "blur(12px)",
      border: "none", cursor: "pointer",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
      color: "var(--gm-fg0)",
      display: "grid", placeItems: "center",
    }}>{children}</button>
  );
}

Object.assign(window, { Home, LogoMark, IconPill });
