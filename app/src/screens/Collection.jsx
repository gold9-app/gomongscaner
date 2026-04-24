// ============================================================
// Collection — 보관함 화면
// ============================================================
function Collection({ onOpenCard, onBack }) {
  const [view, setView] = React.useState("grid"); // grid | list

  return (
    <div style={{
      position: "absolute", inset: 0, background: "var(--gm-bg0)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <StatusBar />

      {/* 상단 */}
      <div style={{
        padding: "8px 20px 20px",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>
            보관함
          </div>
          <div style={{
            display: "flex", padding: 3, borderRadius: 10,
            background: "var(--gm-bg1)",
            boxShadow: "inset 0 0 0 1px var(--gm-bg3)",
          }}>
            {[
              { k: "grid", icon: <IconGrid /> },
              { k: "list", icon: <IconList /> },
            ].map(t => (
              <button key={t.k} onClick={() => setView(t.k)} style={{
                width: 32, height: 28, borderRadius: 7,
                border: "none", cursor: "pointer",
                background: view === t.k ? "var(--gm-bg3)" : "transparent",
                color: view === t.k ? "var(--gm-fg0)" : "var(--gm-fg2)",
                display: "grid", placeItems: "center",
              }}>{t.icon}</button>
            ))}
          </div>
        </div>

        {/* 컬렉션 가치 카드 */}
        <div style={{
          borderRadius: 20, padding: "18px 20px",
          background: "linear-gradient(135deg, oklch(22% 0.08 280) 0%, oklch(18% 0.1 340) 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 200, height: 200, borderRadius: 999,
            background: "var(--gm-holo-grad)", opacity: 0.15,
            filter: "blur(40px)",
          }} />
          <div style={{
            fontSize: 10, fontWeight: 700, color: "var(--gm-fg2)",
            letterSpacing: "0.1em",
          }}>TOTAL COLLECTION VALUE</div>
          <div style={{
            fontFamily: "var(--gm-font-mono)", fontSize: 30, fontWeight: 800,
            letterSpacing: "-0.03em", marginTop: 4, lineHeight: 1,
            background: "linear-gradient(135deg, #fff 0%, #FFCB05 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>{fmtKRW(TOTAL_COLLECTION_VALUE)}</div>
          <div style={{
            display: "flex", gap: 12, marginTop: 10,
            fontSize: 11, fontFamily: "var(--gm-font-mono)",
          }}>
            <span style={{ color: "var(--gm-fg2)" }}>{MOCK_COLLECTION.length} cards</span>
            <span style={{ color: "var(--gm-up)" }}>▲ 2.6% · 24h</span>
          </div>
        </div>
      </div>

      {/* 그리드/리스트 */}
      <div style={{ flex: 1, overflowY: "auto", paddingInline: 20, paddingBottom: 120 }}>
        {view === "grid" ? (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
          }}>
            {MOCK_COLLECTION.map(c => (
              <button key={c.id} onClick={() => onOpenCard?.(c)} style={{
                background: "var(--gm-bg1)", border: "none", cursor: "pointer",
                borderRadius: 16, padding: 10,
                boxShadow: "inset 0 0 0 1px var(--gm-bg3)",
                textAlign: "left",
              }}>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <HoloCard width={130} hue={c.hue} number={c.number} label={c.nameKo} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    <Chip tone={c.type === "psa10" ? "psa" : "neutral"} style={{ fontSize: 9, padding: "2px 6px" }}>
                      {c.type === "psa10" ? "PSA 10" : "Single"}
                    </Chip>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {c.nameKo}
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    marginTop: 4,
                  }}>
                    <div style={{
                      fontFamily: "var(--gm-font-mono)", fontSize: 13, fontWeight: 700,
                      color: "var(--gm-yellow)",
                    }}>{fmtKRWShort(c.price)}</div>
                    <div style={{
                      fontFamily: "var(--gm-font-mono)", fontSize: 10, fontWeight: 600,
                      color: c.change >= 0 ? "var(--gm-up)" : "var(--gm-down)",
                    }}>
                      {c.change >= 0 ? "▲" : "▼"}{Math.abs(c.change).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MOCK_COLLECTION.map(c => (
              <button key={c.id} onClick={() => onOpenCard?.(c)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: 10, borderRadius: 14,
                background: "var(--gm-bg1)", border: "none", cursor: "pointer",
                boxShadow: "inset 0 0 0 1px var(--gm-bg3)",
                textAlign: "left",
              }}>
                <div style={{ flexShrink: 0 }}>
                  <HoloCard width={54} hue={c.hue} number={c.number} label="" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 3 }}>
                    <Chip tone={c.type === "psa10" ? "psa" : "neutral"} style={{ fontSize: 9, padding: "2px 6px" }}>
                      {c.type === "psa10" ? "PSA 10" : "Single"}
                    </Chip>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{c.nameKo}</div>
                  <div style={{
                    fontSize: 11, color: "var(--gm-fg2)",
                    fontFamily: "var(--gm-font-mono)", marginTop: 1,
                  }}>{c.number}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontFamily: "var(--gm-font-mono)", fontSize: 14, fontWeight: 700,
                    color: "var(--gm-yellow)",
                  }}>{fmtKRWShort(c.price)}</div>
                  <div style={{
                    fontFamily: "var(--gm-font-mono)", fontSize: 11, fontWeight: 600,
                    color: c.change >= 0 ? "var(--gm-up)" : "var(--gm-down)", marginTop: 2,
                  }}>
                    {c.change >= 0 ? "▲" : "▼"}{Math.abs(c.change).toFixed(1)}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3"  y="3"  width="8" height="8" rx="1.5"/>
      <rect x="13" y="3"  width="8" height="8" rx="1.5"/>
      <rect x="3"  y="13" width="8" height="8" rx="1.5"/>
      <rect x="13" y="13" width="8" height="8" rx="1.5"/>
    </svg>
  );
}
function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13"/>
      <circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>
    </svg>
  );
}

Object.assign(window, { Collection });
