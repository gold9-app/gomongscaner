// ============================================================
// Result — 시세 결과 화면
// ============================================================
function Result({ card = MOCK_CARD, price = MOCK_PRICE, onBack, onSave, saved = false }) {
  const [cardType, setCardType] = React.useState(card.type);
  const isUp = price.change24h >= 0;

  return (
    <div style={{
      position: "absolute", inset: 0, background: "var(--gm-bg0)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ===== 상단 앱바 ===== */}
      <div style={{ position: "relative", zIndex: 10, background: "var(--gm-bg0)" }}>
        <StatusBar />
        <div style={{
          padding: "4px 16px 12px", display: "flex",
          alignItems: "center", justifyContent: "space-between",
        }}>
          <IconPill onClick={onBack}><IconBack /></IconPill>
          <div style={{
            fontSize: 11, fontFamily: "var(--gm-font-mono)",
            color: "var(--gm-fg2)", letterSpacing: "0.08em",
          }}>SCAN RESULT</div>
          <IconPill><IconShare /></IconPill>
        </div>
      </div>

      {/* ===== 스크롤 본문 ===== */}
      <div style={{
        flex: 1, overflowY: "auto", paddingBottom: 120,
        scrollbarWidth: "none",
      }}>
        {/* ===== 히어로 영역 ===== */}
        <div style={{
          position: "relative", paddingTop: 8, paddingBottom: 32,
        }}>
          {/* 배경 글로우 */}
          <div style={{
            position: "absolute", top: 0, left: "50%",
            transform: "translateX(-50%)",
            width: 320, height: 320, borderRadius: 999,
            background: "radial-gradient(circle, oklch(45% 0.2 18 / 0.4), transparent 70%)",
            filter: "blur(40px)",
          }} />

          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <HoloCard width={200} hue={18} number={card.number} label={card.nameEn} />
          </div>

          {/* 칩 */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 6,
            marginTop: 20, flexWrap: "wrap", paddingInline: 20,
          }}>
            <Chip tone="holo">{card.rarity}</Chip>
            <Chip tone="neutral">{card.language}</Chip>
            <Chip tone="yellow" leftDot>거래 확인</Chip>
          </div>

          {/* 카드명 / 세트 */}
          <div style={{ textAlign: "center", marginTop: 16, paddingInline: 24 }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>
              {card.nameKo}
            </div>
            <div style={{
              fontSize: 13, color: "var(--gm-fg2)", marginTop: 4,
              fontFamily: "var(--gm-font-mono)",
            }}>
              {card.set} · {card.number}
            </div>
          </div>
        </div>

        {/* ===== Single / PSA 탭 ===== */}
        <div style={{ paddingInline: 20, marginBottom: 16 }}>
          <div style={{
            display: "flex", padding: 4, borderRadius: 14,
            background: "var(--gm-bg1)",
            boxShadow: "inset 0 0 0 1px var(--gm-bg3)",
          }}>
            {[
              { k: "single", label: "싱글", en: "Single" },
              { k: "psa",    label: "PSA 10", en: "Graded" },
            ].map(t => {
              const active = cardType === t.k;
              return (
                <button key={t.k} onClick={() => setCardType(t.k)} style={{
                  flex: 1, height: 40, borderRadius: 10,
                  border: "none", cursor: "pointer",
                  background: active ? "var(--gm-bg3)" : "transparent",
                  color: active ? "var(--gm-fg0)" : "var(--gm-fg2)",
                  fontWeight: 700, fontSize: 13,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 180ms",
                }}>
                  {t.label}
                  <span style={{
                    fontSize: 10, fontFamily: "var(--gm-font-mono)",
                    color: active ? "var(--gm-fg2)" : "var(--gm-fg3)",
                    letterSpacing: "0.05em",
                  }}>{t.en}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== 가격 히어로 카드 ===== */}
        <div style={{ paddingInline: 20 }}>
          <div style={{
            borderRadius: 24, padding: "24px 20px 20px",
            background: "linear-gradient(180deg, var(--gm-bg1) 0%, var(--gm-bg2) 100%)",
            boxShadow: "inset 0 0 0 1px var(--gm-bg3), var(--gm-shadow-card)",
            position: "relative", overflow: "hidden",
          }}>
            {/* 홀로 하이라이트 */}
            <div style={{
              position: "absolute", top: -40, right: -40, width: 160, height: 160,
              background: "var(--gm-holo-grad)", opacity: 0.15,
              filter: "blur(40px)", borderRadius: 999,
            }} />

            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              position: "relative",
            }}>
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "var(--gm-fg2)",
                  letterSpacing: "0.1em", marginBottom: 4,
                }}>NOW · 지금 시세</div>
                <div style={{
                  fontFamily: "var(--gm-font-mono)", fontSize: 38, fontWeight: 800,
                  color: "var(--gm-yellow)", letterSpacing: "-0.03em",
                  textShadow: "0 0 24px var(--gm-yellow-glow)",
                  lineHeight: 1,
                }}>{fmtKRW(price.mid)}</div>
              </div>
              <Chip tone={isUp ? "up" : "down"}>
                <IconTrend size={11} up={isUp} />
                {isUp ? "+" : ""}{price.change24h.toFixed(1)}%
              </Chip>
            </div>

            {/* 범위 바 */}
            <div style={{ marginTop: 24 }}>
              <PriceBar min={price.min} mid={price.mid} max={price.max} animateKey={cardType} />
            </div>

            {/* 메타 정보 */}
            <div style={{
              marginTop: 20, paddingTop: 16,
              borderTop: "1px solid var(--gm-bg3)",
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
            }}>
              {[
                { label: "최근 거래",  value: fmtKRWShort(price.lastSale) + "원", sub: price.lastSaleAt },
                { label: "수집 샘플",  value: price.samples, sub: "거래" },
                { label: "7일 변화",    value: (price.change7d >= 0 ? "+" : "") + price.change7d + "%", sub: "추세", tone: price.change7d >= 0 ? "up" : "down" },
              ].map((m, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: "var(--gm-fg3)",
                    letterSpacing: "0.1em", marginBottom: 4,
                  }}>{m.label}</div>
                  <div style={{
                    fontFamily: "var(--gm-font-mono)", fontSize: 14, fontWeight: 700,
                    color: m.tone === "up" ? "var(--gm-up)" : m.tone === "down" ? "var(--gm-down)" : "var(--gm-fg0)",
                  }}>{m.value}</div>
                  <div style={{ fontSize: 9, color: "var(--gm-fg3)", marginTop: 2 }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 섹션: 마켓별 시세 ===== */}
        <div style={{ paddingInline: 20, marginTop: 28 }}>
          <SectionHeader title="마켓별 시세" sub={`${price.markets.length} sources`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {price.markets.map(m => <MarketRow key={m.key} market={m} />)}
          </div>
        </div>

        {/* ===== 섹션: 최근 거래 ===== */}
        <div style={{ paddingInline: 20, marginTop: 28 }}>
          <SectionHeader title="최근 거래" sub="Recent sales" />
          <div style={{
            marginTop: 12, borderRadius: 16, overflow: "hidden",
            background: "var(--gm-bg1)",
            boxShadow: "inset 0 0 0 1px var(--gm-bg3)",
          }}>
            {price.recentSales.map((s, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 16px",
                borderBottom: i < price.recentSales.length - 1 ? "1px solid var(--gm-bg2)" : "none",
              }}>
                <div>
                  <div style={{
                    fontFamily: "var(--gm-font-mono)", fontSize: 14, fontWeight: 700,
                  }}>{fmtKRW(s.price)}</div>
                  <div style={{ fontSize: 11, color: "var(--gm-fg2)", marginTop: 1 }}>
                    {s.market}
                  </div>
                </div>
                <div style={{
                  fontFamily: "var(--gm-font-mono)", fontSize: 11, color: "var(--gm-fg2)",
                }}>{s.at}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 푸터 근거 */}
        <div style={{
          paddingInline: 20, marginTop: 24,
          fontSize: 10, color: "var(--gm-fg3)",
          fontFamily: "var(--gm-font-mono)", lineHeight: 1.6,
          letterSpacing: "0.02em",
        }}>
          * 시세는 공개 마켓의 최근 거래가와 현재 매물가를 기반으로 추정.<br/>
          * 참고용이며 실제 거래가와 차이가 있을 수 있음.
        </div>
      </div>

      {/* ===== 하단 액션 바 ===== */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "12px 20px 34px",
        background: "linear-gradient(to top, var(--gm-bg0) 60%, transparent)",
        display: "flex", gap: 10, zIndex: 20,
      }}>
        <Button variant="ghost" size="lg" onClick={onSave} style={{
          width: 56, padding: 0,
          color: saved ? "var(--gm-yellow)" : "var(--gm-fg0)",
        }}>
          <IconBookmark filled={saved} />
        </Button>
        <Button variant="primary" size="lg" fullWidth onClick={onBack}>
          다시 스캔하기
        </Button>
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
    }}>
      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em" }}>
        {title}
      </div>
      <div style={{
        fontSize: 10, fontFamily: "var(--gm-font-mono)",
        color: "var(--gm-fg3)", letterSpacing: "0.08em", textTransform: "uppercase",
      }}>{sub}</div>
    </div>
  );
}

Object.assign(window, { Result, SectionHeader });
