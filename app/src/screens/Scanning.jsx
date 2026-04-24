// ============================================================
// Scanning — AI 분석 애니메이션 화면
// ============================================================
function Scanning({ onDone }) {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (step >= SCAN_STEPS.length - 1) {
      const t = setTimeout(() => onDone?.(), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep(s => s + 1), 900);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div style={{
      position: "absolute", inset: 0, background: "var(--gm-bg0)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* 홀로그래픽 배경 */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.5,
        background: "radial-gradient(ellipse at 50% 40%, oklch(30% 0.15 280) 0%, transparent 60%)",
      }} />
      <div style={{
        position: "absolute", inset: 0, opacity: 0.3,
        background: "radial-gradient(ellipse at 80% 80%, oklch(30% 0.2 340) 0%, transparent 50%)",
      }} />

      <StatusBar />

      {/* 중앙 카드 + 스캐닝 */}
      <div style={{
        position: "relative", flex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        paddingInline: 24,
      }}>
        {/* 펄스 링들 */}
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: "absolute", width: 280, height: 280, borderRadius: 999,
            border: "1.5px solid var(--gm-yellow)",
            animation: `gm-pulse-ring 2.4s ease-out ${i * 0.8}s infinite`,
            opacity: 0,
          }} />
        ))}

        <div style={{ position: "relative" }}>
          <HoloCard width={200} hue={18} number="201/165" label="ANALYZING" />
          {/* 오버레이 스캔 라인 */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 14,
            pointerEvents: "none", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", left: 0, right: 0, height: 3,
              background: "linear-gradient(90deg, transparent, var(--gm-yellow), transparent)",
              boxShadow: "0 0 20px var(--gm-yellow)",
              animation: "gm-scan-line 1.6s ease-in-out infinite",
            }} />
          </div>
          {/* 코너 마커 */}
          <div style={{ position: "absolute", inset: -8 }}>
            <ScanFrame active={true} width={216} aspect={1.4 * (200 + 16) / 216} />
          </div>
        </div>

        {/* 상태 텍스트 */}
        <div style={{ marginTop: 40, textAlign: "center", minHeight: 60 }}>
          <div key={step} style={{
            fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em",
            color: "var(--gm-fg0)", marginBottom: 6,
            animation: "gm-fade-up 300ms",
          }}>
            {SCAN_STEPS[step].label}
          </div>
          <div style={{
            fontFamily: "var(--gm-font-mono)", fontSize: 11,
            color: "var(--gm-fg2)", letterSpacing: "0.05em",
          }}>
            {SCAN_STEPS[step].sub}
          </div>
        </div>
      </div>

      {/* 단계 인디케이터 */}
      <div style={{
        position: "relative", paddingBottom: 60, paddingInline: 24,
      }}>
        <div style={{
          display: "flex", gap: 6, justifyContent: "center", marginBottom: 16,
        }}>
          {SCAN_STEPS.slice(0, -1).map((s, i) => (
            <div key={s.key} style={{
              height: 3, flex: 1, maxWidth: 56, borderRadius: 999,
              background: i <= step ? "var(--gm-yellow)" : "var(--gm-bg3)",
              boxShadow: i === step ? "0 0 10px var(--gm-yellow-glow)" : "none",
              transition: "background 280ms",
            }} />
          ))}
        </div>
        <div style={{
          textAlign: "center",
          fontFamily: "var(--gm-font-mono)", fontSize: 10,
          color: "var(--gm-fg3)", letterSpacing: "0.1em",
        }}>
          STEP {String(step + 1).padStart(2, "0")} / {String(SCAN_STEPS.length - 1).padStart(2, "0")}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Scanning });
