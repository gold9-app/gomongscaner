// ============================================================
// 목 데이터 — 실제 API 스키마 참고용
// ============================================================

const MOCK_CARD = {
  id: "sv4-201",
  nameKo: "리자몽 ex",
  nameEn: "Charizard ex",
  number: "201/165",
  set: "Scarlet & Violet — 151",
  setCode: "SV2a",
  language: "JP",
  rarity: "SAR",        // Special Art Rare
  type: "single",        // "single" | "psa"
  gradeLabel: null,      // "PSA 10" 등
  cert: null,
  imageHue: 18,          // 플레이스홀더 색조
};

const MOCK_PRICE = {
  currency: "KRW",
  min: 312000,
  mid: 385000,
  max: 468000,
  change24h: +4.2,        // % 변동
  change7d: +12.8,
  lastSale: 372000,
  lastSaleAt: "2시간 전",
  samples: 47,            // 수집된 거래 수
  markets: [
    { key: "kream",         label: "KREAM",         last: 378000, listings: 12, trend: +3.1, updatedAt: "2분 전" },
    { key: "snkrdunk",      label: "SNKRDUNK",      last: 372000, listings: 8,  trend: +1.8, updatedAt: "14분 전" },
    { key: "pricecharting", label: "PriceCharting", last: 395000, listings: null, trend: +4.9, updatedAt: "1시간 전" },
    { key: "ebay-sold",     label: "eBay (sold)",   last: 401000, listings: 23, trend: +5.2, updatedAt: "3시간 전" },
    { key: "ebay-listing",  label: "eBay (listing)",last: 420000, listings: 41, trend: null,   updatedAt: "실시간" },
  ],
  recentSales: [
    { price: 372000, market: "SNKRDUNK",   at: "2시간 전" },
    { price: 378000, market: "KREAM",       at: "5시간 전" },
    { price: 401000, market: "eBay",        at: "어제" },
    { price: 365000, market: "KREAM",       at: "어제" },
    { price: 388000, market: "PriceCharting", at: "2일 전" },
  ],
};

// 보관함용 — 여러 카드
const MOCK_COLLECTION = [
  { id: "c1", nameKo: "리자몽 ex",     number: "201/165", type: "single", price: 385000, change: +4.2,  hue: 18 },
  { id: "c2", nameKo: "피카츄",         number: "25th",    type: "psa10",  price: 1240000, change: -1.2, hue: 52 },
  { id: "c3", nameKo: "뮤츠 VSTAR",     number: "109/100", type: "single", price: 78000,  change: +0.8, hue: 280 },
  { id: "c4", nameKo: "이상해씨",       number: "001/165", type: "single", price: 32000,  change: -2.1, hue: 140 },
  { id: "c5", nameKo: "파이리",         number: "004/165", type: "single", price: 45000,  change: +6.4, hue: 12 },
  { id: "c6", nameKo: "꼬부기",         number: "007/165", type: "single", price: 38000,  change: +1.1, hue: 210 },
  { id: "c7", nameKo: "갸라도스 ex",    number: "229/165", type: "single", price: 142000, change: +8.2, hue: 230 },
  { id: "c8", nameKo: "뮤",             number: "151/165", type: "psa10",  price: 580000, change: +3.3, hue: 320 },
];

const TOTAL_COLLECTION_VALUE = MOCK_COLLECTION.reduce((s, c) => s + c.price, 0);

// 검색 자동완성
const MOCK_SUGGESTIONS = [
  { q: "리자몽 ex 201/165 SAR",   hint: "최근 조회" },
  { q: "피카츄 25th PSA10",         hint: "인기 검색" },
  { q: "뮤츠 VSTAR UR",              hint: "인기 검색" },
  { q: "Psyduck 199/193",            hint: "추천" },
  { q: "이상해씨 001/165",          hint: "추천" },
];

// 스캔 단계
const SCAN_STEPS = [
  { key: "detect",    label: "카드 이미지 인식",      sub: "Detecting card…" },
  { key: "identify",  label: "카드 식별",              sub: "Matching identity…" },
  { key: "normalize", label: "검색어 정규화",          sub: "Normalizing query…" },
  { key: "collect",   label: "마켓 시세 수집",         sub: "Collecting prices…" },
  { key: "done",      label: "완료",                   sub: "Done" },
];

Object.assign(window, {
  MOCK_CARD, MOCK_PRICE, MOCK_COLLECTION, TOTAL_COLLECTION_VALUE,
  MOCK_SUGGESTIONS, SCAN_STEPS,
});
