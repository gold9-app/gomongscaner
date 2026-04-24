"use client";

import {
  ArrowLeft,
  Bookmark,
  Camera,
  ChevronRight,
  Flashlight,
  FlashlightOff,
  Grid2x2,
  Library,
  List,
  Loader2,
  Search,
  Share2,
  Sparkles,
  Upload,
  Zap
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type MarketQuote = {
  market: string;
  label: string;
  priceKrw: number;
  condition: string;
  category?: "sold" | "listing" | "reference" | "raw-reference" | "other-condition";
  soldAt?: string;
  recencyDays?: number;
  sourceReliability?: "high" | "medium" | "low";
  evidenceScore?: number;
  url: string;
};

type PriceResult = {
  card: {
    name: string;
    language: string;
    setName: string;
    number: string;
    rarity: string;
    productLine?: string;
    year?: string;
    gradingCompany?: string;
    grade?: string;
    certNumber?: string;
    imageType?: string;
    targetCondition: string;
    confidence: number;
  };
  price: {
    lowKrw: number;
    highKrw: number;
    medianKrw: number;
    confidence: "low" | "medium" | "high";
    summary: string;
  };
  markets: MarketQuote[];
  sources: Array<{
    title: string;
    url: string;
    note: string;
  }>;
  usedMock: boolean;
};

type SavedCard = {
  id: string;
  savedAt: string;
  name: string;
  setName: string;
  number: string;
  language: string;
  rarity: string;
  condition: string;
  query: string;
  price: {
    lowKrw: number;
    highKrw: number;
    medianKrw: number;
  };
  lastCheckedAt: string;
  priceHistory: Array<{
    checkedAt: string;
    lowKrw: number;
    highKrw: number;
    medianKrw: number;
  }>;
  sources: string[];
};

type Screen = "home" | "search" | "scanning" | "result" | "collection";
type CardType = "single" | "psa";
type ViewMode = "grid" | "list";
type CardLanguage = "any" | "japanese" | "english" | "korean";
type SearchFilters = {
  pokemonName: string;
  cardNumber: string;
  language: CardLanguage;
  grade: string;
};

const currency = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0
});

const quickQuests = [
  { label: "고라파덕 AR", query: "Psyduck 199/193", cardType: "single" as CardType },
  { label: "고라파덕 PSA10", query: "Psyduck 199/193 PSA 10", cardType: "psa" as CardType },
  { label: "리자몽 SAR", query: "Charizard ex 201/165", cardType: "single" as CardType },
  { label: "피카츄 25th", query: "Pikachu 25th anniversary", cardType: "single" as CardType }
];

const scanSteps = [
  { key: "detect", label: "카드 이미지 인식", sub: "Detecting card..." },
  { key: "normalize", label: "검색어 정리", sub: "Normalizing query..." },
  { key: "collect", label: "마켓 시세 수집", sub: "Collecting prices..." },
  { key: "done", label: "시세 계산 완료", sub: "Preparing result..." }
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [cardType, setCardType] = useState<CardType>("single");
  const [query, setQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    pokemonName: "",
    cardNumber: "",
    language: "any",
    grade: "10"
  });
  const [imageData, setImageData] = useState<string | null>(null);
  const [result, setResult] = useState<PriceResult | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [loadingStep, setLoadingStep] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const totalCollectionValue = useMemo(
    () => savedCards.reduce((sum, card) => sum + card.price.medianKrw, 0),
    [savedCards]
  );

  useEffect(() => {
    setRecentQueries(JSON.parse(localStorage.getItem("recent-price-queries") || "[]"));
    const migrated = readSavedCards();
    setSavedCards(migrated);
    localStorage.setItem("saved-price-cards", JSON.stringify(migrated));
  }, []);

  useEffect(() => {
    if (screen !== "scanning") {
      setLoadingStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingStep((step) => Math.min(step + 1, scanSteps.length - 1));
    }, 900);

    return () => window.clearInterval(timer);
  }, [screen]);

  function rememberQuery(value: string) {
    const next = [value, ...recentQueries.filter((item) => item !== value)].slice(0, 6);
    setRecentQueries(next);
    localStorage.setItem("recent-price-queries", JSON.stringify(next));
  }

  function goHome() {
    setScreen("home");
    setResult(null);
    setError("");
  }

  function openCollection() {
    setScreen("collection");
    setError("");
  }

  function openSearch() {
    setScreen("search");
    setError("");
  }

  function saveCurrentCard() {
    if (!result) return;

    const saved = makeSavedCard(result, query);
    const existing = savedCards.find((item) => item.id === saved.id);
    const merged = existing
      ? {
          ...saved,
          savedAt: existing.savedAt,
          priceHistory: [...existing.priceHistory, ...saved.priceHistory].slice(-20)
        }
      : saved;

    const next = [merged, ...savedCards.filter((item) => item.id !== saved.id)].slice(0, 36);
    setSavedCards(next);
    localStorage.setItem("saved-price-cards", JSON.stringify(next));
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1400);
  }

  function removeSavedCard(id: string) {
    const next = savedCards.filter((item) => item.id !== id);
    setSavedCards(next);
    localStorage.setItem("saved-price-cards", JSON.stringify(next));
  }

  function openSavedCard(card: SavedCard) {
    setResult(savedCardToResult(card));
    setQuery(card.query || `${card.name} ${card.number}`.trim());
    setCardType(card.condition.toLowerCase().includes("psa") ? "psa" : "single");
    setScreen("result");
    setError("");
  }

  function recheckSavedCard(card: SavedCard) {
    setCardType(card.condition.toLowerCase().includes("psa") ? "psa" : "single");
    setQuery(card.query || `${card.name} ${card.number}`.trim());
    setScreen("search");
    setResult(null);
    setError("");
  }

  async function startEstimate(nextMode: "photo" | "text", nextQuery?: string, nextImageData?: string) {
    const payloadQuery = (nextQuery ?? query).trim();
    const payloadImage = nextImageData ?? imageData;
    const structuredQuery = buildStructuredSearchQuery(payloadQuery, cardType, searchFilters);
    if (nextMode === "text" && structuredQuery.length < 2) return;
    if (nextMode === "photo" && !payloadImage) return;

    setScreen("scanning");
    setResult(null);
    setError("");
    setLoadingStep(0);

    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: nextMode,
          intent: "own",
          cardType,
          query: nextMode === "text" ? structuredQuery : undefined,
          pokemonName: nextMode === "text" ? searchFilters.pokemonName.trim() : undefined,
          cardNumber: nextMode === "text" ? searchFilters.cardNumber.trim() : undefined,
          language: nextMode === "text" && searchFilters.language !== "any" ? searchFilters.language : undefined,
          grade: nextMode === "text" && cardType === "psa" ? searchFilters.grade.trim() || "10" : undefined,
          imageData: nextMode === "photo" ? payloadImage : undefined
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "시세 조회에 실패했습니다.");
      }

      setResult(payload);
      if (nextMode === "text") rememberQuery(structuredQuery);
      setScreen("result");
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(message);
      setScreen(nextMode === "text" ? "search" : "home");
    }
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") return;
      setImageData(reader.result);
      await startEstimate("photo", undefined, reader.result);
    };
    reader.readAsDataURL(file);
  }

  const activeTab = screen === "search" ? "search" : screen === "collection" ? "collection" : "scan";

  return (
    <main className="gm-app">
      <div className="gm-phone">
        {screen === "home" ? (
          <HomeScreen
            cardType={cardType}
            flashOn={flashOn}
            imageData={imageData}
            onOpenCamera={() => cameraInputRef.current?.click()}
            onOpenGallery={() => galleryInputRef.current?.click()}
            onOpenSearch={openSearch}
            onToggleCardType={setCardType}
            onToggleFlash={() => setFlashOn((value) => !value)}
          />
        ) : null}

        {screen === "search" ? (
          <SearchScreen
            cardType={cardType}
            error={error}
          query={query}
          searchFilters={searchFilters}
          recentQueries={recentQueries}
          onBack={goHome}
          onChangeCardType={setCardType}
          onChangeQuery={setQuery}
          onChangeFilters={(next) => setSearchFilters((current) => ({ ...current, ...next }))}
          onQuickQuest={(item) => {
            setCardType(item.cardType);
            setQuery(item.query);
          }}
            onSubmit={() => startEstimate("text")}
          />
        ) : null}

        {screen === "scanning" ? <ScanningScreen currentStep={loadingStep} /> : null}

        {screen === "result" ? (
          <ResultScreen
            justSaved={justSaved}
            result={result}
            onBack={goHome}
            onOpenSource={(url) => window.open(url, "_blank", "noopener,noreferrer")}
            onSave={saveCurrentCard}
          />
        ) : null}

        {screen === "collection" ? (
          <CollectionScreen
            cards={savedCards}
            totalValue={totalCollectionValue}
            viewMode={viewMode}
            onBack={goHome}
            onOpenCard={openSavedCard}
            onRecheck={recheckSavedCard}
            onRemove={removeSavedCard}
            onToggleView={setViewMode}
          />
        ) : null}

        {screen !== "scanning" ? (
          <BottomTabBar
            active={activeTab}
            onChange={(tab) => {
              if (tab === "scan") goHome();
              if (tab === "search") openSearch();
              if (tab === "collection") openCollection();
            }}
          />
        ) : null}

        <input
          accept="image/*"
          capture="environment"
          className="gm-hidden-input"
          ref={cameraInputRef}
          type="file"
          onChange={handleImage}
        />
        <input
          accept="image/*"
          className="gm-hidden-input"
          ref={galleryInputRef}
          type="file"
          onChange={handleImage}
        />
      </div>
    </main>
  );
}

function HomeScreen({
  cardType,
  flashOn,
  imageData,
  onOpenCamera,
  onOpenGallery,
  onOpenSearch,
  onToggleCardType,
  onToggleFlash
}: {
  cardType: CardType;
  flashOn: boolean;
  imageData: string | null;
  onOpenCamera: () => void;
  onOpenGallery: () => void;
  onOpenSearch: () => void;
  onToggleCardType: (type: CardType) => void;
  onToggleFlash: () => void;
}) {
  return (
    <section className="gm-screen gm-home-screen">
      <div className="gm-home-hero">
        <div className="gm-brand-lockup">
          <LogoMark />
          <div>
            <strong>고몽스캐너</strong>
            <span>GoMong Scanner</span>
          </div>
        </div>
        <button className="gm-icon-pill" type="button" onClick={onToggleFlash} aria-label="플래시">
          {flashOn ? <Flashlight size={16} /> : <FlashlightOff size={16} />}
        </button>
      </div>

      <div className="gm-home-stage">
        <div className="gm-camera-bg" />
        <div className="gm-vignette" />
        {imageData ? <img className="gm-stage-image" src={imageData} alt="업로드한 카드" /> : <CardStage />}

        <div className="gm-hud-label">
          <span className="gm-live-dot" />
          카드를 프레임 안에 맞춰주세요
        </div>

        <div className="gm-card-type-switch">
          <button
            className={cardType === "single" ? "active" : ""}
            type="button"
            onClick={() => onToggleCardType("single")}
          >
            싱글
          </button>
          <button
            className={cardType === "psa" ? "active" : ""}
            type="button"
            onClick={() => onToggleCardType("psa")}
          >
            PSA
          </button>
        </div>

        <div className="gm-scan-frame">
          <i />
          <i />
          <i />
          <i />
          <div className="gm-scan-line" />
        </div>
        <div className="gm-stage-hint">
          <Sparkles size={12} />
          AI가 자동으로 카드와 시세를 정리합니다
        </div>
      </div>

      <div className="gm-capture-bar">
        <button className="gm-side-action" type="button" onClick={onOpenGallery} aria-label="갤러리">
          <Upload size={22} />
        </button>
        <button className="gm-shutter" type="button" onClick={onOpenCamera} aria-label="카메라 촬영">
          <span />
        </button>
        <button className="gm-side-action" type="button" onClick={onOpenSearch} aria-label="검색">
          <Search size={22} />
        </button>
      </div>
    </section>
  );
}

function SearchScreen({
  cardType,
  error,
  query,
  searchFilters,
  recentQueries,
  onBack,
  onChangeCardType,
  onChangeQuery,
  onChangeFilters,
  onQuickQuest,
  onSubmit
}: {
  cardType: CardType;
  error: string;
  query: string;
  searchFilters: SearchFilters;
  recentQueries: string[];
  onBack: () => void;
  onChangeCardType: (type: CardType) => void;
  onChangeQuery: (value: string) => void;
  onChangeFilters: (next: Partial<SearchFilters>) => void;
  onQuickQuest: (item: (typeof quickQuests)[number]) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="gm-screen gm-search-screen">
      <div className="gm-topbar">
        <button className="gm-icon-pill" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <div className="gm-screen-title">
          <strong>검색</strong>
          <span>Search card</span>
        </div>
        <div className="gm-topbar-spacer" />
      </div>

      <div className="gm-search-sheet">
        <div className="gm-search-hero-card">
          <div>
            <strong>검색으로 바로 확인</strong>
            <span>카드명, 번호, PSA 등급 일부만 넣어도 됩니다</span>
          </div>
          <Search size={18} />
        </div>

        <div className="gm-card-toggle">
          <button
            className={cardType === "single" ? "active" : ""}
            type="button"
            onClick={() => onChangeCardType("single")}
          >
            싱글
          </button>
          <button
            className={cardType === "psa" ? "active" : ""}
            type="button"
            onClick={() => onChangeCardType("psa")}
          >
            PSA 10
          </button>
        </div>

        <label className="gm-search-field">
          <span>자유 검색</span>
          <textarea
            placeholder="예: Psyduck 199/193 AR"
            value={query}
            onChange={(event) => onChangeQuery(event.target.value)}
          />
        </label>

        <div className="gm-search-structure">
          <div className="gm-section-head">
            <strong>정확도 보강</strong>
            <span>Structured filters</span>
          </div>

          <div className="gm-search-grid">
            <label className="gm-input-field">
              <span>포켓몬명</span>
              <input
                placeholder="예: Psyduck"
                value={searchFilters.pokemonName}
                onChange={(event) => onChangeFilters({ pokemonName: event.target.value })}
              />
            </label>

            <label className="gm-input-field">
              <span>카드번호</span>
              <input
                placeholder="예: 199/193"
                value={searchFilters.cardNumber}
                onChange={(event) => onChangeFilters({ cardNumber: event.target.value })}
              />
            </label>

            <label className="gm-input-field">
              <span>언어</span>
              <select
                value={searchFilters.language}
                onChange={(event) =>
                  onChangeFilters({ language: event.target.value as SearchFilters["language"] })
                }
              >
                <option value="any">전체</option>
                <option value="japanese">일본판</option>
                <option value="english">북미판</option>
                <option value="korean">한국판</option>
              </select>
            </label>

            {cardType === "psa" ? (
              <label className="gm-input-field">
                <span>등급</span>
                <select
                  value={searchFilters.grade}
                  onChange={(event) => onChangeFilters({ grade: event.target.value })}
                >
                  <option value="10">PSA 10</option>
                  <option value="9">PSA 9</option>
                </select>
              </label>
            ) : null}
          </div>
        </div>

        {error ? <div className="gm-error-box">{error}</div> : null}

        <button
          className="gm-primary-button"
          type="button"
          onClick={onSubmit}
          disabled={buildStructuredSearchQuery(query, cardType, searchFilters).trim().length < 2}
        >
          <Zap size={18} />
          시세 검색
        </button>

        <div className="gm-section-block">
          <div className="gm-section-head">
            <strong>빠른 검색</strong>
            <span>Quick picks</span>
          </div>
          <div className="gm-chip-grid">
            {quickQuests.map((item) => (
              <button key={item.label} className="gm-chip-button" type="button" onClick={() => onQuickQuest(item)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="gm-section-block">
          <div className="gm-section-head">
            <strong>최근 검색</strong>
            <span>Recent</span>
          </div>
          {recentQueries.length === 0 ? (
            <div className="gm-empty-inline">아직 검색 기록이 없습니다.</div>
          ) : (
            <div className="gm-recent-list">
              {recentQueries.map((item) => (
                <button key={item} className="gm-row-button" type="button" onClick={() => onChangeQuery(item)}>
                  <span>{item}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function buildStructuredSearchQuery(query: string, cardType: CardType, filters: SearchFilters) {
  const languageMap: Record<CardLanguage, string> = {
    any: "",
    japanese: "Japanese",
    english: "English",
    korean: "Korean"
  };

  return [
    filters.pokemonName,
    filters.cardNumber,
    query,
    cardType === "psa" ? `PSA ${filters.grade || "10"}` : "",
    languageMap[filters.language]
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function ScanningScreen({ currentStep }: { currentStep: number }) {
  const step = scanSteps[Math.min(currentStep, scanSteps.length - 1)];

  return (
    <section className="gm-screen gm-scanning-screen">
      <div className="gm-scanning-glow gm-scanning-glow-a" />
      <div className="gm-scanning-glow gm-scanning-glow-b" />

      <div className="gm-scanning-core">
        <div className="gm-scan-ring gm-scan-ring-a" />
        <div className="gm-scan-ring gm-scan-ring-b" />
        <div className="gm-scan-ring gm-scan-ring-c" />
        <div className="gm-holo-card gm-holo-card-large">
          <TradingCardSurface rarity="SAR" number="201/165" title="ANALYZING" subtitle="AI SCAN" />
          <div className="gm-scan-line gm-scan-line-strong" />
        </div>

        <div className="gm-scanning-copy">
          <strong>{step.label}</strong>
          <span>{step.sub}</span>
        </div>
      </div>

      <div className="gm-step-footer">
        <div className="gm-step-bars">
          {scanSteps.map((item, index) => (
            <span key={item.key} className={index <= currentStep ? "active" : ""} />
          ))}
        </div>
        <div className="gm-step-count">
          STEP {String(Math.min(currentStep + 1, scanSteps.length)).padStart(2, "0")} / {String(scanSteps.length).padStart(2, "0")}
        </div>
      </div>
    </section>
  );
}

function ResultScreen({
  justSaved,
  result,
  onBack,
  onOpenSource,
  onSave
}: {
  justSaved: boolean;
  result: PriceResult | null;
  onBack: () => void;
  onOpenSource: (url: string) => void;
  onSave: () => void;
}) {
  if (!result) return null;

  const latestSold = bestMarket(result.markets, "sold");
  const listing = bestMarket(result.markets, "listing");
  const recentSales = result.markets.filter((market) => market.category === "sold").slice(0, 5);
  const sourceHighlights = result.sources.slice(0, 3);

  return (
    <section className="gm-screen gm-result-screen">
      <div className="gm-topbar">
        <button className="gm-icon-pill" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <div className="gm-screen-label">SCAN RESULT</div>
        <button className="gm-icon-pill" type="button" onClick={() => result.sources[0] && onOpenSource(result.sources[0].url)}>
          <Share2 size={16} />
        </button>
      </div>

      <div className="gm-result-scroll">
        <div className="gm-result-hero">
          <div className="gm-result-glow" />
          <div className="gm-result-card-stack gm-result-card-stack-back" />
          <div className="gm-result-card-stack gm-result-card-stack-front" />
          <div className="gm-holo-card gm-result-card">
            <TradingCardSurface
              rarity={result.card.rarity || "CARD"}
              number={result.card.number}
              title={result.card.name}
              subtitle={result.card.setName}
            />
          </div>

          <div className="gm-result-chips">
            <span className="gm-chip gm-chip-holo">{result.card.rarity || "카드"}</span>
            <span className="gm-chip">{result.card.language}</span>
            <span className="gm-chip gm-chip-yellow">{marketStateLabel(result)}</span>
          </div>

          <div className="gm-result-title">
            <strong>{result.card.name}</strong>
            <span>
              {result.card.setName} · {result.card.number}
            </span>
          </div>

          <div className="gm-result-facts">
            <div>
              <span>언어</span>
              <strong>{result.card.language}</strong>
            </div>
            <div>
              <span>상태</span>
              <strong>{conditionLabel(result.card.targetCondition)}</strong>
            </div>
            <div>
              <span>신호</span>
              <strong>{marketStateLabel(result)}</strong>
            </div>
          </div>

          <div className="gm-market-pulse">
            <div>
              <span>판매완료</span>
              <strong>{result.markets.filter((market) => market.category === "sold").length}</strong>
            </div>
            <div>
              <span>판매중</span>
              <strong>{result.markets.filter((market) => market.category === "listing").length}</strong>
            </div>
            <div>
              <span>참고소스</span>
              <strong>{result.sources.length}</strong>
            </div>
          </div>
        </div>

        <div className="gm-price-hero">
          <div className="gm-price-head">
            <div>
              <span>NOW · 지금 시세</span>
              <strong>{currency.format(result.price.medianKrw)}</strong>
            </div>
            <span className={`gm-chip ${latestSold ? "gm-chip-up" : ""}`}>{conditionLabel(result.card.targetCondition)}</span>
          </div>
          <div className="gm-price-range-copy">
            <span>예상 범위</span>
            <strong>
              {currency.format(result.price.lowKrw)} - {currency.format(result.price.highKrw)}
            </strong>
          </div>
          <PriceBar low={result.price.lowKrw} high={result.price.highKrw} mid={result.price.medianKrw} />
          <div className="gm-price-meta">
            <div>
              <span>최근 거래</span>
              <strong>{latestSold ? currency.format(latestSold.priceKrw) : "없음"}</strong>
              <em>{latestSold ? marketTimeLabel(latestSold) : "-"}</em>
            </div>
            <div>
              <span>현재 매물</span>
              <strong>{listing ? currency.format(listing.priceKrw) : "없음"}</strong>
              <em>{listing ? listing.market : "-"}</em>
            </div>
            <div>
              <span>근거 수</span>
              <strong>{result.markets.length}</strong>
              <em>{result.usedMock ? "테스트 데이터" : "실거래 기반"}</em>
            </div>
          </div>
        </div>

        <section className="gm-section-block">
          <div className="gm-section-head">
            <strong>주요 출처</strong>
            <span>Sources</span>
          </div>
          <div className="gm-source-pills">
            {sourceHighlights.map((source) => (
              <button key={source.url} className="gm-source-pill" type="button" onClick={() => onOpenSource(source.url)}>
                <span>{source.title}</span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </section>

        <section className="gm-section-block">
          <div className="gm-section-head">
            <strong>마켓별 시세</strong>
            <span>{result.markets.length} sources</span>
          </div>
          <div className="gm-market-list">
            {result.markets.map((market) => (
              <button key={`${market.market}-${market.url}`} className="gm-market-row" type="button" onClick={() => onOpenSource(market.url)}>
                <div>
                  <strong>{market.market}</strong>
                  <span>{market.label}</span>
                </div>
                <div className="gm-market-price">
                  <strong>{currency.format(market.priceKrw)}</strong>
                  <span>{marketTimeLabel(market)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="gm-section-block">
          <div className="gm-section-head">
            <strong>최근 거래</strong>
            <span>Recent sales</span>
          </div>
          <div className="gm-recent-sales">
            {recentSales.length === 0 ? (
              <div className="gm-empty-inline">최근 거래 데이터가 아직 부족합니다.</div>
            ) : (
              recentSales.map((sale) => (
                <div key={`${sale.market}-${sale.url}`} className="gm-sale-row">
                  <div>
                    <strong>{currency.format(sale.priceKrw)}</strong>
                    <span>{sale.market}</span>
                  </div>
                  <em>{marketTimeLabel(sale)}</em>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="gm-section-block gm-footnote">
          <p>{result.price.summary}</p>
          <p>* 공개 마켓의 최근 판매가와 현재 매물가를 조합한 참고용 추정치입니다.</p>
        </section>
      </div>

      <div className="gm-result-actions">
        <button className={`gm-icon-action ${justSaved ? "saved" : ""}`} type="button" onClick={onSave}>
          <Bookmark size={18} fill={justSaved ? "currentColor" : "none"} />
        </button>
        <button className="gm-primary-button" type="button" onClick={onBack}>
          다시 스캔하기
        </button>
      </div>
      {justSaved ? <div className="gm-toast">보관함에 저장됨</div> : null}
    </section>
  );
}

function CollectionScreen({
  cards,
  totalValue,
  viewMode,
  onBack,
  onOpenCard,
  onRecheck,
  onRemove,
  onToggleView
}: {
  cards: SavedCard[];
  totalValue: number;
  viewMode: ViewMode;
  onBack: () => void;
  onOpenCard: (card: SavedCard) => void;
  onRecheck: (card: SavedCard) => void;
  onRemove: (id: string) => void;
  onToggleView: (view: ViewMode) => void;
}) {
  return (
    <section className="gm-screen gm-collection-screen">
      <div className="gm-topbar">
        <button className="gm-icon-pill" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <div className="gm-screen-title">
          <strong>보관함</strong>
          <span>Collection</span>
        </div>
        <div className="gm-view-switch">
          <button className={viewMode === "grid" ? "active" : ""} type="button" onClick={() => onToggleView("grid")}>
            <Grid2x2 size={14} />
          </button>
          <button className={viewMode === "list" ? "active" : ""} type="button" onClick={() => onToggleView("list")}>
            <List size={14} />
          </button>
        </div>
      </div>

      <div className="gm-collection-summary">
        <span>TOTAL COLLECTION VALUE</span>
        <strong>{currency.format(totalValue)}</strong>
        <em>{cards.length} cards</em>
        <div className="gm-collection-summary-stats">
          <div>
            <span>PSA</span>
            <strong>{cards.filter((card) => card.condition.toLowerCase().includes("psa")).length}</strong>
          </div>
          <div>
            <span>싱글</span>
            <strong>{cards.filter((card) => !card.condition.toLowerCase().includes("psa")).length}</strong>
          </div>
          <div>
            <span>최근 저장</span>
            <strong>{cards[0] ? relativeDate(cards[0].savedAt) : "-"}</strong>
          </div>
        </div>
      </div>

      <div className={`gm-collection-list ${viewMode}`}>
        {cards.length === 0 ? (
          <div className="gm-empty-card">
            <strong>아직 저장된 카드가 없습니다</strong>
            <span>시세 결과 화면에서 저장하면 여기에 모입니다.</span>
          </div>
        ) : viewMode === "grid" ? (
          cards.map((card) => (
            <article key={card.id} className="gm-collection-card" onClick={() => onOpenCard(card)}>
              <div className="gm-holo-card gm-collection-thumb">
                <div className="gm-holo-sheen" />
                <div className="gm-card-meta">
                  <span>{conditionLabel(card.condition)}</span>
                  <span>{card.number}</span>
                </div>
                <div className="gm-card-center-label">{card.name}</div>
              </div>
              <div className="gm-collection-copy">
                <span className={`gm-chip ${card.condition.toLowerCase().includes("psa") ? "gm-chip-psa" : ""}`}>
                  {conditionLabel(card.condition)}
                </span>
                <strong>{card.name}</strong>
                <small>{card.number || "번호 없음"} · {relativeDate(card.lastCheckedAt)}</small>
                <em>{currency.format(card.price.medianKrw)}</em>
              </div>
            </article>
          ))
        ) : (
          cards.map((card) => (
            <article key={card.id} className="gm-collection-row">
              <button className="gm-collection-row-main" type="button" onClick={() => onOpenCard(card)}>
                <div className="gm-holo-card gm-list-thumb">
                  <div className="gm-holo-sheen" />
                </div>
                <div>
                  <strong>{card.name}</strong>
                  <span>
                    {card.number} · {relativeDate(card.lastCheckedAt)}
                  </span>
                </div>
                <em>{currency.format(card.price.medianKrw)}</em>
              </button>
              <div className="gm-row-actions">
                <button type="button" onClick={() => onRecheck(card)}>
                  다시 조회
                </button>
                <button type="button" onClick={() => onRemove(card.id)}>
                  삭제
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function BottomTabBar({
  active,
  onChange
}: {
  active: "scan" | "search" | "collection";
  onChange: (tab: "scan" | "search" | "collection") => void;
}) {
  const tabs = [
    { key: "scan" as const, label: "Scan", icon: Camera },
    { key: "search" as const, label: "Search", icon: Search },
    { key: "collection" as const, label: "Library", icon: Library }
  ];

  return (
    <nav className="gm-tabbar" aria-label="하단 탭">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button key={tab.key} className={active === tab.key ? "active" : ""} type="button" onClick={() => onChange(tab.key)}>
            <Icon size={20} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function LogoMark() {
  return (
    <div className="gm-logo-mark">
      <span>고</span>
    </div>
  );
}

function CardStage() {
  return (
    <div className="gm-stage-card">
      <div className="gm-home-card-shadow gm-home-card-shadow-back" />
      <div className="gm-home-card-shadow gm-home-card-shadow-front" />
      <div className="gm-holo-card gm-home-card gm-home-card-main">
        <TradingCardSurface rarity="SAR" number="201/165" title="CARD IN FRAME" subtitle="SCAN READY" />
      </div>
    </div>
  );
}

function TradingCardSurface({
  rarity,
  number,
  title,
  subtitle
}: {
  rarity: string;
  number: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <>
      <div className="gm-holo-sheen" />
      <div className="gm-card-meta">
        <span>{rarity}</span>
        <span>{number}</span>
      </div>
      <div className="gm-card-art">
        <div className="gm-card-art-glow" />
        <div className="gm-card-art-emblem">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="gm-card-energy">
        <span />
        <span />
        <span />
      </div>
      <div className="gm-card-nameplate">
        <strong>{title}</strong>
        <em>{subtitle || "POKEMON CARD"}</em>
      </div>
    </>
  );
}

function PriceBar({ low, mid, high }: { low: number; mid: number; high: number }) {
  const range = Math.max(high - low, 1);
  const lowPct = 0;
  const midPct = ((mid - low) / range) * 100;
  const highPct = 100;

  return (
    <div className="gm-price-bar-wrap">
      <div className="gm-price-range">
        <span>{currency.format(low)}</span>
        <span>{currency.format(mid)}</span>
        <span>{currency.format(high)}</span>
      </div>
      <div className="gm-price-bar">
        <div className="gm-price-track" />
        <div className="gm-price-fill" />
        <span className="gm-price-dot gm-price-dot-low" style={{ left: `${lowPct}%` }} />
        <span className="gm-price-dot gm-price-dot-mid" style={{ left: `${midPct}%` }} />
        <span className="gm-price-dot gm-price-dot-high" style={{ left: `${highPct}%` }} />
      </div>
    </div>
  );
}

function bestMarket(markets: MarketQuote[], category: MarketQuote["category"]) {
  return markets
    .filter((market) => market.category === category)
    .sort((a, b) => (b.evidenceScore || 0) - (a.evidenceScore || 0))[0];
}

function marketStateLabel(result: PriceResult) {
  const hasRecentSold = result.markets.some((market) => market.category === "sold" && (market.recencyDays ?? 999) <= 45);
  const hasListing = result.markets.some((market) => market.category === "listing");
  if (hasRecentSold && hasListing) return "거래 확인";
  if (hasRecentSold) return "최근 거래";
  if (hasListing) return "매물 기준";
  return confidenceLabel(result.price.confidence);
}

function conditionLabel(condition: string) {
  if (condition === "psa10") return "PSA 10";
  if (condition === "psa9") return "PSA 9";
  if (condition === "bgs10") return "BGS 10";
  if (condition === "bgs9.5") return "BGS 9.5";
  if (condition === "cgc10") return "CGC 10";
  if (condition === "cgc9.5") return "CGC 9.5";
  if (condition === "sealed") return "미개봉";
  return "싱글";
}

function confidenceLabel(confidence: PriceResult["price"]["confidence"]) {
  if (confidence === "high") return "충분함";
  if (confidence === "medium") return "보통";
  return "참고용";
}

function marketTimeLabel(market: MarketQuote) {
  if (market.soldAt && market.recencyDays !== undefined) {
    return `${market.soldAt} · ${market.recencyDays}일 전`;
  }
  if (market.soldAt) return market.soldAt;
  if (market.category === "listing") return "현재 판매중";
  if (market.category === "reference") return "참고 지표";
  return market.condition;
}

function readSavedCards(): SavedCard[] {
  const raw = JSON.parse(localStorage.getItem("saved-price-cards") || "[]") as unknown;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === "string") return migrateSavedLabel(item);
      if (item && typeof item === "object" && "id" in item) return normalizeSavedCard(item as Partial<SavedCard>);
      return null;
    })
    .filter((item): item is SavedCard => Boolean(item));
}

function migrateSavedLabel(label: string): SavedCard {
  const [name = label, number = "", condition = "싱글"] = label.split(" · ");
  const now = new Date().toISOString();
  return {
    id: savedCardId(name, number, condition),
    savedAt: now,
    name,
    setName: "",
    number,
    language: "",
    rarity: "",
    condition,
    query: `${name} ${number}`.trim(),
    price: {
      lowKrw: 0,
      highKrw: 0,
      medianKrw: 0
    },
    lastCheckedAt: now,
    priceHistory: [],
    sources: []
  };
}

function normalizeSavedCard(card: Partial<SavedCard>): SavedCard {
  const now = new Date().toISOString();
  const name = card.name || "Unknown card";
  const number = card.number || "";
  const condition = card.condition || "싱글";
  return {
    id: card.id || savedCardId(name, number, condition),
    savedAt: card.savedAt || now,
    name,
    setName: card.setName || "",
    number,
    language: card.language || "",
    rarity: card.rarity || "",
    condition,
    query: card.query || `${name} ${number}`.trim(),
    price: {
      lowKrw: Number(card.price?.lowKrw) || 0,
      highKrw: Number(card.price?.highKrw) || 0,
      medianKrw: Number(card.price?.medianKrw) || 0
    },
    lastCheckedAt: card.lastCheckedAt || now,
    priceHistory: Array.isArray(card.priceHistory) ? card.priceHistory : [],
    sources: Array.isArray(card.sources) ? card.sources : []
  };
}

function makeSavedCard(result: PriceResult, currentQuery: string): SavedCard {
  const now = new Date().toISOString();
  const condition = result.card.targetCondition;
  return {
    id: savedCardId(result.card.name, result.card.number, condition),
    savedAt: now,
    name: result.card.name,
    setName: result.card.setName,
    number: result.card.number,
    language: result.card.language,
    rarity: result.card.rarity,
    condition,
    query: currentQuery || `${result.card.name} ${result.card.number}`.trim(),
    price: {
      lowKrw: result.price.lowKrw,
      highKrw: result.price.highKrw,
      medianKrw: result.price.medianKrw
    },
    lastCheckedAt: now,
    priceHistory: [
      {
        checkedAt: now,
        lowKrw: result.price.lowKrw,
        highKrw: result.price.highKrw,
        medianKrw: result.price.medianKrw
      }
    ],
    sources: result.sources.map((source) => source.url).slice(0, 8)
  };
}

function savedCardToResult(card: SavedCard): PriceResult {
  return {
    card: {
      name: card.name,
      language: card.language,
      setName: card.setName,
      number: card.number,
      rarity: card.rarity,
      targetCondition: card.condition,
      confidence: 80
    },
    price: {
      lowKrw: card.price.lowKrw,
      highKrw: card.price.highKrw,
      medianKrw: card.price.medianKrw,
      confidence: "medium",
      summary: "보관함에 저장된 마지막 시세입니다. 다시 조회하면 최신 가격으로 갱신할 수 있습니다."
    },
    markets: [],
    sources: card.sources.map((url) => ({
      title: url,
      url,
      note: "저장된 출처"
    })),
    usedMock: false
  };
}

function savedCardId(name: string, number: string, condition: string) {
  return `${name}-${number}-${condition}`.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-");
}

function relativeDate(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "저장됨";
  const days = Math.floor((Date.now() - time) / 86_400_000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  return `${days}일 전`;
}
