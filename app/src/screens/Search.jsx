// ============================================================
// Search — 텍스트 검색 화면
// ============================================================
function Search({ onSubmit, onBack }) {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("single");
  const inputRef = React.useRef(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div style={{
      position: "absolute", inset: 0, background: "var(--gm-bg0)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <StatusBar />

      {/* 상단 */}
      <div style={{
        padding: "8px 16px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <IconPill onClick={onBack}><IconBack /></IconPill>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em" }}>
          텍스트 검색
        </div>
      </div>

      {/* 검색 입력 */}
      <div style={{ paddingInline: 20 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          height: 54, paddingInline: 18, borderRadius: 16,
          background: "var(--gm-bg1)",
          boxShadow: "inset 0 0 0 1.5px var(--gm-yellow)",
          transition: "box-shadow 180ms",
        }}>
          <IconSearch size={18} active />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="카드명, 번호, 세트 입력…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--gm-fg0)", fontSize: 15, fontWeight: 600,
              fontFamily: "var(--gm-font-sans)",
            }}
          />
          {q && (
            <button onClick={() => setQ("")} style={{
              background: "var(--gm-bg3)", border: "none", cursor: "pointer",
              width: 22, height: 22, borderRadius: 999,
              display: "grid", placeItems: "center", color: "var(--gm-fg1)",
            }}><IconClose size={12} /></button>
          )}
        </div>
        <div style={{
          fontSize: 10, color: "var(--gm-fg3)",
          fontFamily: "var(--gm-font-mono)", letterSpacing: "0.03em",
          marginTop: 8, paddingInline: 4,
        }}>
          <IconSparkle size={10} /> AI가 자동으로 검색어를 정규화합니다
        </div>
      </div>

      {/* 타입 토글 */}
      <div style={{ paddingInline: 20, marginTop: 16 }}>
        <div style={{
          display: "flex", padding: 4, borderRadius: 14,
          background: "var(--gm-bg1)",
          boxShadow: "inset 0 0 0 1px var(--gm-bg3)",
        }}>
          {[
            { k: "single", label: "싱글 카드" },
            { k: "psa",    label: "PSA / Graded" },
          ].map(t => {
            const active = type === t.k;
            return (
              <button key={t.k} onClick={() => setType(t.k)} style={{
                flex: 1, height: 40, borderRadius: 10,
                border: "none", cursor: "pointer",
                background: active ? "var(--gm-bg3)" : "transparent",
                color: active ? "var(--gm-fg0)" : "var(--gm-fg2)",
                fontWeight: 700, fontSize: 13,
              }}>{t.label}</button>
            );
          })}
        </div>
      </div>

      {/* 자동완성 / 추천 */}
      <div style={{ flex: 1, overflowY: "auto", paddingInline: 20, marginTop: 24 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: "var(--gm-fg3)",
          letterSpacing: "0.1em", marginBottom: 10,
        }}>SUGGESTIONS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {MOCK_SUGGESTIONS.map(s => (
            <button key={s.q} onClick={() => onSubmit?.(s.q, type)} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 12px", borderRadius: 12,
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--gm-fg0)", textAlign: "left",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: "var(--gm-bg2)",
                display: "grid", placeItems: "center", color: "var(--gm-fg2)",
              }}><IconSearch size={14} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.q}</div>
                <div style={{
                  fontSize: 11, color: "var(--gm-fg3)",
                  fontFamily: "var(--gm-font-mono)", marginTop: 1,
                }}>{s.hint}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{
        padding: "12px 20px 34px",
        background: "linear-gradient(to top, var(--gm-bg0) 60%, transparent)",
      }}>
        <Button
          variant={q ? "primary" : "ghost"}
          size="lg" fullWidth
          onClick={() => q && onSubmit?.(q, type)}
        >
          시세 스캔 실행
        </Button>
      </div>
    </div>
  );
}

Object.assign(window, { Search });
