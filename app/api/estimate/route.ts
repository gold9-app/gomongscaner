import { NextRequest, NextResponse } from "next/server";
import pokemonMultilang from "../../../pokemon_multilang.json";

type EstimateRequest = {
  mode: "photo" | "text";
  intent?: "own" | "buy";
  cardType?: "single" | "psa";
  query?: string;
  pokemonName?: string;
  cardNumber?: string;
  language?: "japanese" | "english" | "korean";
  grade?: string;
  imageData?: string;
};

type PokemonNameEntry = {
  number: string;
  ko: string;
  ja: string;
  en: string;
  fr?: string;
  de?: string;
  zh?: string;
  es?: string;
  it?: string;
};

type CardIdentity = {
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
  searchQueries: string[];
  candidates?: CardCandidate[];
  labelBasedIdentity?: CardIdentityEvidence;
  imageBasedIdentity?: CardIdentityEvidence;
  evidencePriority?: "label" | "image" | "mixed";
  validationWarnings?: string[];
  extractedText?: string;
};

type CardIdentityEvidence = {
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
  confidence: number;
  evidence: string;
  searchQueries?: string[];
};

type CardCandidate = {
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
  confidence: number;
  evidence: string;
};

type MarketSearchPlan = {
  canonical: {
    name: string;
    number: string;
    setName: string;
    rarity: string;
    language: string;
    productLine?: string;
    year?: string;
    gradingCompany?: string;
    grade?: string;
    certNumber?: string;
    targetCondition: string;
  };
  broadQueries: string[];
  marketQueries: {
    kream: string[];
    snkrdunk: string[];
    pricecharting: string[];
    ebaySold: string[];
    ebayCurrent: string[];
    research: string[];
  };
  filters: {
    condition: string;
    language: string;
    requiredNumber: string;
    exclude: string[];
  };
};

type MarketQuote = {
  market: string;
  label: string;
  priceKrw: number;
  condition: string;
  category?: MarketCategory;
  soldAt?: string;
  observedAt?: string;
  recencyDays?: number;
  sourceReliability?: "high" | "medium" | "low";
  evidenceScore?: number;
  url: string;
};

type MarketCategory = "sold" | "listing" | "reference" | "raw-reference" | "other-condition";

type PriceCandidate = {
  title: string;
  market: string;
  url: string;
  price: number;
  currency: string;
  approximateKrw: number;
  saleType: "sold" | "listing" | "unknown";
  condition: string;
  language: string;
  exactMatch: boolean;
  excludeReason: string;
  marketSearchQuery?: string;
  matchScore?: number;
  numberMatch?: boolean;
  conditionMatch?: boolean;
};

type PriceEstimate = {
  lowKrw: number;
  highKrw: number;
  medianKrw: number;
  confidence: "low" | "medium" | "high";
  summary: string;
};

type EstimateResponse = {
  card: Omit<CardIdentity, "searchQueries">;
  price: PriceEstimate;
  markets: MarketQuote[];
  sources: Array<{
    title: string;
    url: string;
    note: string;
  }>;
  usedMock: boolean;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-pro-preview";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-7";
const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || "sonar-pro";
const GEMINI_FALLBACK_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash"];
const FX_USD_KRW = Number(process.env.FX_USD_KRW) || 1400;
const FX_JPY_KRW = Number(process.env.FX_JPY_KRW) || 9.5;
const FX_EUR_KRW = Number(process.env.FX_EUR_KRW) || 1550;
const FX_GBP_KRW = Number(process.env.FX_GBP_KRW) || 1800;
const FX_HKD_KRW = Number(process.env.FX_HKD_KRW) || 178;
const POKEMON_NAME_ENTRIES = pokemonMultilang as PokemonNameEntry[];
const POKEMON_NAME_INDEX = buildPokemonNameIndex(POKEMON_NAME_ENTRIES);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EstimateRequest;
    if (body.mode === "photo" && !body.imageData) {
      return NextResponse.json({ error: "카드 사진이 필요합니다." }, { status: 400 });
    }
    if (body.mode === "text" && !body.query?.trim()) {
      return NextResponse.json({ error: "검색어가 필요합니다." }, { status: 400 });
    }

    const usedMock =
      !process.env.GEMINI_API_KEY ||
      !process.env.PERPLEXITY_API_KEY ||
      !process.env.ANTHROPIC_API_KEY;

    if (usedMock) {
      return NextResponse.json(mockEstimate(body));
    }

    const identifiedIdentity = await withTimeout(
      identifyCard(body),
      30000,
      "Gemini identification timed out"
    ).catch(() => fallbackIdentity(body));
    const identity = applyStructuredInputConstraints(identifiedIdentity, body);
    const marketContext = await collectMarketContext(identity);
    const estimate = await withTimeout(
      summarizePrice(identity, marketContext, body.intent || "own"),
      50000,
      "Claude summarization timed out"
    ).catch((error) => fallbackEstimate(identity, marketContext, error));

    return NextResponse.json(estimate);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "시세 조회 중 오류가 발생했습니다."
      },
      { status: 500 }
    );
  }
}

async function identifyCard(input: EstimateRequest): Promise<CardIdentity> {
  const inputSearchText = buildInputSearchText(input);
  const systemPrompt = [
    "You identify Pokemon collectible cards/items from either an image or text.",
    "Return strict JSON only.",
    "Users may upload raw card photos, PSA/BGS/CGC slab photos, marketplace screenshots, or non-TCG Pokemon card items. Do not assume standard Pokemon TCG.",
    "Your priority is exact market identity for pricing, not a generic visual description.",
    "For text input, if the user writes a Pokemon or trainer name in Korean or Japanese, normalize name to the official English market-facing name when possible.",
    "First ignore phone/app UI chrome around the image. Focus on the card, slab label, barcode/cert label, and visible card text.",
    "Extract visible OCR text first: slab label text, certification number, grade, year, product line, card name, card number text, set code/symbol text, rarity marks, and language.",
    "If a grading slab label is visible, prioritize the slab label over the artwork/card body because it is usually the market identity.",
    "Always produce both labelBasedIdentity and imageBasedIdentity when possible:",
    "- labelBasedIdentity: use only slab/label/OCR text such as PSA title, year, grade, cert number.",
    "- imageBasedIdentity: use only visible card artwork/layout/card text, even if no label exists.",
    "- If there is no label, set labelBasedIdentity to null and rely on imageBasedIdentity.",
    "- If label exists but is cropped or unreadable, still identify the card from imageBasedIdentity.",
    "- evidencePriority must be 'label' when label is strong, 'image' when no reliable label exists, or 'mixed' when both are needed.",
    "Recognize non-TCG product lines such as Old Maid, Carddass, Topsun, Bandai, Meiji, sticker, playing cards, promo goods, and other Pokemon card-like collectibles.",
    "Return the best identity plus up to 3 alternate candidates if uncertain.",
    "For standard TCG cards, prefer card number and set identifiers over loose names. If card number is unreadable, set number to Unknown and lower confidence below 65.",
    "For PSA/BGS/CGC slabs or non-TCG items, card number may be Unknown. Do not lower confidence only because TCG card number is absent when slab label/product line/cert are visible.",
    "If name and number disagree, trust number/set more than artwork or loose name.",
    "If slab label shows GEM MT 10, PSA 10, or grade 10 and grading company is PSA, targetCondition must be psa10.",
    "Extract certNumber exactly when visible, e.g. PSA 14059809.",
    "targetCondition must be one of: raw, psa10, psa9, bgs10, bgs9.5, cgc10, cgc9.5, sealed, unknown.",
    "If the user asks for PSA10, PSA 10, PSA GEM MT 10, or graded 10, targetCondition must be psa10.",
    "For image input, only infer PSA/BGS/CGC when a grading slab label or explicit grade is visible. Otherwise follow the user-selected card type.",
    input.cardType === "psa"
      ? "The user selected PSA card. If no explicit PSA grade appears, targetCondition must be psa10."
      : "The user selected single card. If no explicit grading appears, targetCondition must be raw.",
    "Search queries must match the item type:",
    "- Standard TCG: use mostly short number-focused queries like '<English name> <number>', '<localized name> <number>', '<set code> <number>', and condition-specific variants.",
    "- Slab/non-TCG without TCG number: use label-focused queries like '<year> Pokemon <productLine> <name> PSA 10', '<productLine> <name> PSA 10', and 'PSA <certNumber> <name>'.",
    "For Japanese cards, include Japanese and English query variants. For Korean cards, include Korean and English query variants.",
    "When an input name is Korean, do not leave name only in Korean. Include English search queries that work on eBay and PriceCharting.",
    "Return this JSON shape:",
    JSON.stringify({
      name: "Pokemon Name",
      language: "Japanese",
      setName: "Set Name",
      number: "123/100",
      rarity: "SAR",
      productLine: "tcg",
      year: "",
      gradingCompany: "PSA",
      grade: "10",
      certNumber: "",
      imageType: "raw-card | graded-slab | marketplace-screenshot | app-screenshot | unknown",
      evidencePriority: "label",
      labelBasedIdentity: {
        name: "Pokemon Name",
        language: "Japanese",
        setName: "Set Name",
        number: "123/100",
        rarity: "SAR",
        productLine: "tcg",
        year: "",
        gradingCompany: "PSA",
        grade: "10",
        certNumber: "",
        confidence: 90,
        evidence: "PSA label text if present",
        searchQueries: ["Pokemon Name 123/100 PSA 10"]
      },
      imageBasedIdentity: {
        name: "Pokemon Name",
        language: "Japanese",
        setName: "Set Name",
        number: "123/100",
        rarity: "SAR",
        productLine: "tcg",
        year: "",
        confidence: 82,
        evidence: "visible card artwork/layout/text",
        searchQueries: ["Pokemon Name 123/100", "Localized Name 123/100"]
      },
      targetCondition: "psa10",
      confidence: 90,
      extractedText: "visible OCR text",
      validationWarnings: ["string"],
      candidates: [
        {
          name: "Pokemon Name",
          language: "Japanese",
          setName: "Set Name",
          number: "123/100",
          rarity: "SAR",
          productLine: "tcg",
          year: "",
          gradingCompany: "PSA",
          grade: "10",
          certNumber: "",
          confidence: 90,
          evidence: "number, set, and artwork match"
        }
      ],
      searchQueries: ["Pokemon Name 123/100", "Localized Name 123/100", "SET1 123/100", "Pokemon Name 123/100 PSA 10"]
    })
  ].join(" ");

  const parts: Array<Record<string, unknown>> = [
    {
      text:
        input.mode === "text"
          ? `${systemPrompt}\n\nUser text: ${inputSearchText}`
          : `${systemPrompt}\n\nAnalyze the uploaded card image.`
    }
  ];

  if (input.mode === "photo" && input.imageData) {
    const image = parseDataUrl(input.imageData);
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.base64
      }
    });
  }

  const payload = await generateGeminiContent(parts);
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = parseJsonObject(text) as Partial<CardIdentity>;

  return normalizeIdentity(parsed, inputSearchText, input.cardType);
}

async function generateGeminiContent(parts: Array<Record<string, unknown>>) {
  const models = Array.from(new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]));
  const errors: string[] = [];

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1
          }
        })
      }
    );

    if (response.ok) {
      return response.json();
    }

    const errorText = await response.text();
    errors.push(`${model}: ${errorText}`);

    if (![429, 503].includes(response.status)) {
      break;
    }
  }

  throw new Error(`Gemini 카드 식별 실패: ${errors.join(" | ")}`);
}

async function collectMarketContext(identity: CardIdentity) {
  const searchPlan = buildMarketSearchPlan(identity);
  const [perplexity, ebayBrowse, ebaySold, ebayCurrent, priceCharting, snkrdunk, kream] = await Promise.all([
    withTimeout(searchMarketPrices(identity, searchPlan), 45000, "Perplexity search timed out").catch((error) => ({
      error: error instanceof Error ? error.message : "Perplexity search failed"
    })),
    searchEbayBrowse(identity, searchPlan),
    withTimeout(collectEbayHtml(identity, searchPlan, "sold"), 45000, "eBay sold collector timed out").catch(() => []),
    withTimeout(collectEbayHtml(identity, searchPlan, "current"), 45000, "eBay current collector timed out").catch(
      () => []
    ),
    withTimeout(collectPriceCharting(identity, searchPlan), 45000, "PriceCharting collector timed out").catch(() => []),
    withTimeout(collectSnkrdunk(identity, searchPlan), 45000, "SNKRDUNK collector timed out").catch(() => []),
    withTimeout(collectKream(identity, searchPlan), 45000, "KREAM collector timed out").catch(() => [])
  ]);

  const direct = mergeStructuredCandidates(ebaySold, ebayCurrent, priceCharting, snkrdunk, kream);

  return {
    generatedAt: new Date().toISOString(),
    fx: {
      USD_KRW: FX_USD_KRW,
      JPY_KRW: FX_JPY_KRW,
      EUR_KRW: FX_EUR_KRW,
      GBP_KRW: FX_GBP_KRW,
      HKD_KRW: FX_HKD_KRW
    },
    searchPlan,
    requiredSources: buildRequiredSourceTargets(identity, searchPlan),
    sourceCoverage: {
      eBay: { count: ebaySold.length + ebayCurrent.length + ebayBrowse.length, directCount: ebaySold.length + ebayCurrent.length },
      PriceCharting: { count: priceCharting.length, directCount: priceCharting.length },
      SNKRDUNK: { count: snkrdunk.length, directCount: snkrdunk.length },
      KREAM: { count: kream.length, directCount: kream.length }
    },
    structuredCandidates: mergeStructuredCandidates(direct, ebayBrowse),
    directCandidates: direct,
    perplexity
  };
}

async function searchMarketPrices(identity: CardIdentity, searchPlan: MarketSearchPlan) {
  const exactTerms = buildExactTerms(identity);
  const searchPrompt = [
    "Find recent market prices for the exact Pokemon card below.",
    "Return only factual findings with source URLs. Do not invent prices.",
    "",
    "STRICT MATCHING:",
    "- If productLine is not standard TCG or number is Unknown, match by slab label/product line/year/name/grade instead of TCG card number.",
    "- For PSA/BGS/CGC slabs, slab label text and certification number are primary evidence.",
    "- The card number must match exactly when a number is present.",
    "- The language must match when the user specified a language.",
    "- The rarity/art version must match when present, e.g. SAR, SR, AR, Master Ball reverse, promo.",
    "- The requested condition must match exactly.",
    "- Reject listings for proxy, custom, orica, replica, fan art, damaged, lots, bundles, mystery packs, booster packs, sealed boxes, unrelated graded cards, and different languages.",
    "- Separate raw ungraded cards from PSA/BGS/CGC graded cards.",
    "",
    "PRICE PRIORITY:",
    "1. Sold/completed exact-match listings for the requested condition from the last 90 days.",
    "2. Current exact-match listings for the requested condition from major markets.",
    "3. Other conditions only as separate references, never for the main price range.",
    "",
    "SOURCES TO CHECK:",
    "- eBay sold/current listings. Use the eBay sold queries below for sold/completed research.",
    "- PriceCharting, Sports Card Investor, Scrydex, TCGplayer, Cardmarket, PSA APR when they clearly match the exact card.",
    "- SNKRDUNK and KREAM if visible. IMPORTANT: search these markets with short broad queries first, then classify the clicked result as raw or PSA.",
    "- Korean marketplace pages only when the exact card number and version are visible",
    "",
    "MARKET QUERY STRATEGY:",
    "- Do not use one long query for every market.",
    "- For SNKRDUNK/KREAM, prefer short number-focused queries such as '<localized name> <number>' or '<english name> <number>'.",
    "- Use condition terms like PSA 10 mostly after broad results are found, not as the only search query.",
    "- For graded standard TCG cards with a known number, start from exact set-aware queries such as '<english name> <rarity> <number> <set code> PSA 10' or '<english name> <rarity> <number> <set name> PSA 10' before broader number-only queries.",
    "- For each candidate, include marketSearchQuery and matchScore from 0-100.",
    "- Set numberMatch and conditionMatch booleans.",
    "",
    "Return compact JSON inside your answer with this exact shape:",
    JSON.stringify({
      exactTerms: ["string"],
      candidates: [
        {
          title: "string",
          market: "eBay",
          url: "https://example.com",
          price: 0,
          currency: "KRW",
          approximateKrw: 0,
          saleType: "sold | listing | unknown",
          condition: "raw | psa10 | psa9 | bgs | cgc | sealed | lot | damaged | unknown",
          language: "Japanese",
          exactMatch: true,
          excludeReason: "",
          marketSearchQuery: "Pokemon Name 123/100",
          matchScore: 95,
          numberMatch: true,
          conditionMatch: true
        }
      ],
      notes: ["string"]
    }),
    `Card: ${identity.name}`,
    `Set: ${identity.setName}`,
    `Number: ${identity.number}`,
    `Product line: ${identity.productLine || "Unknown"}`,
    `Year: ${identity.year || "Unknown"}`,
    `Grading company: ${identity.gradingCompany || "Unknown"}`,
    `Grade: ${identity.grade || "Unknown"}`,
    `Cert number: ${identity.certNumber || "Unknown"}`,
    `Language: ${identity.language}`,
    `Rarity: ${identity.rarity}`,
    `Requested condition: ${identity.targetCondition}`,
    `Exact terms: ${exactTerms.join(" | ")}`,
    `Legacy queries: ${identity.searchQueries.join(" | ")}`,
    `Search plan: ${JSON.stringify(searchPlan)}`
  ].join("\n");

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a strict market data extractor for trading cards. Accuracy matters more than coverage. Include source URLs. Do not infer prices from unrelated cards."
        },
        {
          role: "user",
          content: searchPrompt
        }
      ],
      temperature: 0,
      search_context_size: "high"
    })
  });

  if (!response.ok) {
    throw new Error(`Perplexity 가격 검색 실패: ${await response.text()}`);
  }

  return response.json();
}

async function summarizePrice(
  identity: CardIdentity,
  marketContext: unknown,
  intent: "own" | "buy"
): Promise<EstimateResponse> {
  const prompt = [
    "You convert market research into a conservative Pokemon card price estimate.",
    "Return strict JSON only with this shape:",
    JSON.stringify({
      card: {
        name: "string",
        language: "string",
        setName: "string",
        number: "string",
          rarity: "string",
          targetCondition: "psa10",
          confidence: 90
        },
      price: {
        lowKrw: 0,
        highKrw: 0,
        medianKrw: 0,
        confidence: "medium",
        summary: "Korean user-facing summary"
      },
      markets: [
        {
          market: "eBay",
          label: "string",
          priceKrw: 0,
          condition: "Raw sold",
          category: "sold",
          soldAt: "2026-04-23",
          sourceReliability: "high",
          evidenceScore: 90,
          url: "https://example.com"
        }
      ],
      sources: [
        {
          title: "string",
          url: "https://example.com",
          note: "string"
        }
      ]
    }),
    "Rules:",
    "- KRW values must be integers.",
    `- Main price range must use exact-match ${identity.targetCondition} cards only.`,
    "- Prefer sold/completed exact matches for the requested condition over current listings.",
    "- Current listing prices can widen the range, but must not dominate if sold data exists.",
    "- If requested condition is raw, exclude PSA/BGS/CGC from lowKrw/highKrw/medianKrw.",
    "- If requested condition is graded, exclude raw cards from lowKrw/highKrw/medianKrw.",
    "- You may include other conditions in markets only if the condition label clearly marks them as reference.",
    "- Exclude lots, bundles, proxy, custom, orica, sealed boxes, packs, damaged cards, and different-language cards.",
    "- If fewer than 3 exact requested-condition observations exist, set confidence to low and explain that data is thin.",
    "- If sources disagree sharply, use the central cluster and ignore outliers above 2.5x or below 0.4x the median unless clearly justified.",
    "- Do not use Korean marketplace asking prices as sold prices unless the page explicitly indicates sold/completed.",
    "- Include at most 6 market rows, ordered by relevance: sold requested-condition, current requested-condition, then other-condition references.",
    "- Always include eBay, KREAM, SNKRDUNK, and PriceCharting in sources when provided in requiredSources.",
    "- If a required source has no visible price, include it in sources with note 'search/reference - price not visible' but do not use it in price range.",
    "- Trusted reference sources include PriceCharting, Sports Card Investor, Scrydex, TCGplayer, Cardmarket, PSA APR, eBay, SNKRDUNK, KREAM, Bunjang, and Joongna.",
    "- For graded cards, prefer sold/last-sale/average values from PriceCharting, Sports Card Investor, Scrydex, PSA APR, and eBay sold over single current listings.",
    "- For KREAM/SNKRDUNK, use recent transaction prices when visible; otherwise treat as current listing/reference.",
    "- Structured candidates are API-derived. Prefer them over unstructured web summaries when exactMatch is true.",
    "- Prefer candidates with numberMatch=true, conditionMatch=true, and matchScore >= 70.",
    "- SNKRDUNK/KREAM candidates may come from broad search queries. Do not reject them only because the query was broad; judge the result title/detail match.",
    "- eBay Browse candidates are current listings, not sold prices.",
    "- Source notes must say whether each source is sold, listing, or reference.",
    "- When a sale date is visible, include soldAt as YYYY-MM-DD.",
    "- evidenceScore is internal 0-100: latest sold/completed prices score highest; current listings score next; references score lower.",
    "- Mention uncertainty when sold data is thin.",
    intent === "buy"
      ? "- The user is checking whether to buy. Summary should answer whether the asking price should be compared against recent sold prices and current listings."
      : "- The user is checking a card they own. Summary should answer what price range they can roughly expect today.",
    "- Keep summary practical and under 2 Korean sentences.",
    `Identity: ${JSON.stringify(identity)}`,
    `Market context: ${JSON.stringify(marketContext).slice(0, 18000)}`
  ].join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2200,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude 가격 정제 실패: ${await response.text()}`);
  }

  const payload = await response.json();
  const text = payload.content?.find((item: { type: string }) => item.type === "text")?.text;
  try {
    const parsed = parseJsonObject(text) as EstimateResponse;
    return normalizeEstimate(parsed, identity, marketContext);
  } catch (error) {
    return fallbackEstimate(identity, marketContext, error);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function searchEbayBrowse(
  identity: CardIdentity,
  searchPlan: MarketSearchPlan
): Promise<PriceCandidate[]> {
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    return [];
  }

  const token = await getEbayAccessToken();
  const query = buildEbayQuery(identity, searchPlan);
  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "20");
  url.searchParams.set("sort", "price");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": process.env.EBAY_MARKETPLACE_ID || "EBAY_US"
    }
  });

  if (!response.ok) {
    return [
      {
        title: "eBay Browse API error",
        market: "eBay",
        url: "https://www.ebay.com/",
        price: 0,
        currency: "USD",
        approximateKrw: 0,
        saleType: "unknown",
        condition: "api-error",
        language: identity.language,
        exactMatch: false,
        excludeReason: await response.text()
      }
    ];
  }

  const payload = await response.json();
  const items = Array.isArray(payload.itemSummaries) ? payload.itemSummaries : [];

  return items.map((item: Record<string, unknown>) => {
    const title = cleanString(item.title);
    const webUrl = cleanString(item.itemWebUrl);
    const price = item.price as { value?: string; currency?: string } | undefined;
    const value = Number(price?.value) || 0;
    const currency = price?.currency || "USD";
    const classification = classifyCandidate(title, identity);

    return {
      title,
      market: "eBay",
      url: webUrl || "https://www.ebay.com/",
      price: value,
      currency,
      approximateKrw: convertToKrw(value, currency),
      saleType: "listing" as const,
      condition: classification.condition,
      language: identity.language,
      exactMatch: classification.exactMatch,
      excludeReason: classification.excludeReason,
      marketSearchQuery: query,
      matchScore: classification.matchScore,
      numberMatch: classification.numberMatch,
      conditionMatch: classification.conditionMatch
    };
  });
}

async function collectDirectMarketPrices(
  identity: CardIdentity,
  searchPlan: MarketSearchPlan
): Promise<PriceCandidate[]> {
  const [ebaySold, ebayCurrent, priceCharting, snkrdunk, kream] = await Promise.all([
    collectEbayHtml(identity, searchPlan, "sold").catch(() => []),
    collectEbayHtml(identity, searchPlan, "current").catch(() => []),
    collectPriceCharting(identity, searchPlan).catch(() => []),
    collectSnkrdunk(identity, searchPlan).catch(() => []),
    collectKream(identity, searchPlan).catch(() => [])
  ]);

  return mergeStructuredCandidates(ebaySold, ebayCurrent, priceCharting, snkrdunk, kream);
}

async function collectEbayHtml(
  identity: CardIdentity,
  searchPlan: MarketSearchPlan,
  mode: "sold" | "current"
): Promise<PriceCandidate[]> {
  const query =
    mode === "sold"
      ? searchPlan.marketQueries.ebaySold[0] || buildEbayQuery(identity, searchPlan)
      : searchPlan.marketQueries.ebayCurrent[0] || buildEbayQuery(identity, searchPlan);
  const url = new URL("https://www.ebay.com/sch/i.html");
  url.searchParams.set("_nkw", query);
  if (mode === "sold") {
    url.searchParams.set("LH_Sold", "1");
    url.searchParams.set("LH_Complete", "1");
  }

  const html = await fetchHtml(url.toString());
  const cards = extractHtmlCards(html, "ebay.com", query, identity, mode === "sold" ? "sold" : "listing");
  return cards.map((candidate) => ({
    ...candidate,
    market: "eBay"
  }));
}

async function collectPriceCharting(
  identity: CardIdentity,
  searchPlan: MarketSearchPlan
): Promise<PriceCandidate[]> {
  const query = searchPlan.marketQueries.pricecharting[0] || buildSourceQuery(identity);
  const searchUrl = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=prices`;
  const searchHtml = await fetchHtml(searchUrl);
  const detailUrl = extractPriceChartingDetailUrl(searchHtml, identity);
  if (!detailUrl) return [];

  const detailHtml = await fetchHtml(detailUrl);
  return [
    ...extractPriceChartingGuideCandidates(detailHtml, detailUrl, identity),
    ...extractPriceChartingRecentSales(detailHtml, detailUrl, identity)
  ];
}

async function collectSnkrdunk(
  identity: CardIdentity,
  searchPlan: MarketSearchPlan
): Promise<PriceCandidate[]> {
  const query = searchPlan.marketQueries.snkrdunk[0] || buildSourceQuery(identity);
  const apiCandidates = await collectSnkrdunkSearchApi(identity, query).catch(() => []);
  const url = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const listCandidates = extractHtmlCards(html, "snkrdunk.com", query, identity, "listing").map((candidate) => ({
    ...candidate,
    market: "SNKRDUNK",
    currency: candidate.currency || "JPY",
    approximateKrw: convertToKrw(candidate.price, candidate.currency || "JPY")
  }));

  const detailCandidates = await collectMarketDetailCandidates(
    "SNKRDUNK",
    [...apiCandidates, ...listCandidates],
    identity,
    "JPY"
  );

  return filterStructuredCandidates([...apiCandidates, ...listCandidates, ...detailCandidates], identity).slice(0, 24);
}

async function collectSnkrdunkSearchApi(identity: CardIdentity, query: string): Promise<PriceCandidate[]> {
  const url = new URL("https://snkrdunk.com/en/v1/search");
  url.searchParams.set("keyword", query);
  url.searchParams.set("perPage", "12");
  url.searchParams.set("page", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(query)}`,
      Origin: "https://snkrdunk.com"
    },
    cache: "no-store"
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as {
    sneakers?: Array<Record<string, unknown>>;
    streetwears?: Array<Record<string, unknown>>;
  };

  const items = [...(payload.sneakers || []), ...(payload.streetwears || [])];
  const searchUrl = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(query)}`;

  return filterStructuredCandidates(
    items
      .map((item) => {
        const title = cleanString(String(item.name || ""));
        const value = Number(item.minPrice) || 0;
        const minPriceFormat = cleanString(String(item.minPriceFormat || ""));
        const currency = detectCurrencyFromText(minPriceFormat) || "USD";
        const classification = classifyCandidate(title, identity);
        return {
          title,
          market: "SNKRDUNK",
          url: searchUrl,
          price: value,
          currency,
          approximateKrw: convertToKrw(value, currency),
          saleType: "listing" as const,
          condition: normalizeCandidateCondition(title, identity, "listing"),
          language: identity.language,
          exactMatch: classification.exactMatch,
          excludeReason: classification.excludeReason,
          marketSearchQuery: query,
          matchScore: classification.matchScore,
          numberMatch: classification.numberMatch,
          conditionMatch: classification.conditionMatch
        } satisfies PriceCandidate;
      })
      .filter((candidate) => candidate.price > 0),
    identity
  ).slice(0, 12);
}

async function collectKream(
  identity: CardIdentity,
  searchPlan: MarketSearchPlan
): Promise<PriceCandidate[]> {
  const queries = uniqueNonEmpty(searchPlan.marketQueries.kream).slice(0, 4);
  const collected: PriceCandidate[] = [];

  for (const query of queries) {
    const url = `https://kream.co.kr/search?keyword=${encodeURIComponent(query)}`;
    const html = await fetchHtml(url).catch(() => "");
    if (!html) continue;

    const listCandidates = extractHtmlCards(html, "kream.co.kr", query, identity, "listing").map((candidate) => ({
      ...candidate,
      market: "KREAM",
      currency: candidate.currency || "KRW",
      approximateKrw: convertToKrw(candidate.price, candidate.currency || "KRW")
    }));

    const embeddedSearchCandidates = extractMarketDetailCandidates(
      html,
      url,
      "KREAM",
      identity,
      "KRW"
    );
    const detailCandidates = await collectMarketDetailCandidates("KREAM", listCandidates, identity, "KRW");
    const searchDetailCandidates = await collectKreamSearchDetailCandidates(html, identity);
    collected.push(...listCandidates, ...embeddedSearchCandidates, ...detailCandidates, ...searchDetailCandidates);

    const filtered = filterStructuredCandidates(dedupePriceCandidates(collected), identity);
    if (filtered.length >= 3 || filtered.some((candidate) => candidate.saleType === "sold")) {
      return filtered.slice(0, 24);
    }
  }

  return filterStructuredCandidates(dedupePriceCandidates(collected), identity).slice(0, 24);
}

async function collectKreamSearchDetailCandidates(html: string, identity: CardIdentity) {
  const detailUrls = extractKreamSearchDetailUrls(html).slice(0, 6);
  if (detailUrls.length === 0) return [];

  const pages = await Promise.all(
    detailUrls.map(async (detailUrl) => {
      try {
        const detailHtml = await fetchHtml(detailUrl);
        return extractMarketDetailCandidates(detailHtml, detailUrl, "KREAM", identity, "KRW");
      } catch {
        return [];
      }
    })
  );

  return filterStructuredCandidates(pages.flat(), identity).slice(0, 18);
}

function extractKreamSearchDetailUrls(html: string) {
  const ids = [
    ...html.matchAll(/product_(?:price|wish|link)\/(\d{4,})/g),
    ...html.matchAll(/\/products\/(\d{4,})/g)
  ]
    .map((match) => match[1])
    .filter(Boolean);

  return uniqueNonEmpty(ids.map((id) => `https://kream.co.kr/products/${id}`));
}

async function collectMarketDetailCandidates(
  market: "KREAM" | "SNKRDUNK",
  baseCandidates: PriceCandidate[],
  identity: CardIdentity,
  defaultCurrency: "KRW" | "JPY"
) {
  const detailUrls = uniqueNonEmpty(
    baseCandidates
      .filter((candidate) => candidateSupportsIdentity(candidate, identity))
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
      .map((candidate) => candidate.url)
  ).slice(0, 3);

  const pages = await Promise.all(
    detailUrls.map(async (detailUrl) => {
      try {
        const html = await fetchHtml(detailUrl);
        return extractMarketDetailCandidates(html, detailUrl, market, identity, defaultCurrency);
      } catch {
        return [];
      }
    })
  );

  return filterStructuredCandidates(pages.flat(), identity).slice(0, 12);
}

function extractMarketDetailCandidates(
  html: string,
  detailUrl: string,
  market: "KREAM" | "SNKRDUNK",
  identity: CardIdentity,
  defaultCurrency: "KRW" | "JPY"
) {
  const embeddedCandidates =
    market === "KREAM"
      ? [...extractKreamRenderedSummaryCandidates(html, detailUrl, identity), ...extractKreamNuxtCandidates(html, detailUrl, identity)]
      : [];
  const normalizedHtml = decodeHtml(html);
  const text = decodeHtml(stripTags(html)).replace(/\s+/g, " ").trim();
  const windows = buildDetailWindows(normalizedHtml, text, identity, market);
  const candidates: PriceCandidate[] = [];

  for (const windowText of windows) {
    candidates.push(
      ...extractDetailPriceRows(windowText, detailUrl, market, identity, defaultCurrency),
      ...extractDetailActionPrices(windowText, detailUrl, market, identity, defaultCurrency)
    );
  }

  return dedupePriceCandidates([...embeddedCandidates, ...candidates])
    .filter((candidate) => candidateSupportsIdentity(candidate, identity))
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
}

function extractKreamRenderedSummaryCandidates(html: string, detailUrl: string, identity: CardIdentity) {
  const salesSection = extractHtmlSectionById(html, "sales", "asks");
  const asksSection = extractHtmlSectionById(html, "asks", "bids");
  const bidsSection = extractHtmlSectionById(html, "bids", "</div><!--]--><!--]--></div>");

  return dedupePriceCandidates([
    ...parseKreamRenderedSection(salesSection, detailUrl, identity, "sold"),
    ...parseKreamRenderedSection(asksSection, detailUrl, identity, "listing"),
    ...parseKreamRenderedSection(bidsSection, detailUrl, identity, "listing")
  ]);
}

function extractHtmlSectionById(html: string, id: string, nextMarker: string) {
  const start = html.indexOf(`id="${id}"`);
  if (start < 0) return "";
  const rest = html.slice(start);
  const end = nextMarker ? rest.indexOf(`id="${nextMarker}"`) : -1;
  return end >= 0 ? rest.slice(0, end) : rest;
}

function parseKreamRenderedSection(
  section: string,
  detailUrl: string,
  identity: CardIdentity,
  saleType: "sold" | "listing"
) {
  if (!section) return [];

  const candidates: PriceCandidate[] = [];
  const targetTerms = detailConditionTerms(identity.targetCondition).map((term) => term.toLowerCase());
  const rowPattern =
    /transaction_history_summary__content__item_option[^>]*>([^<]+)<\/div>\s*<div class="transaction_history_summary__content__item_price"[^>]*>\s*([\d,]+)원[\s\S]{0,120}?<div[^>]*>([^<]+)<\/div>/g;

  for (const match of section.matchAll(rowPattern)) {
    const optionLabel = cleanString(decodeHtml(match[1]));
    if (!matchesTargetOption(optionLabel, targetTerms)) continue;

    const price = Number(match[2].replace(/,/g, ""));
    if (!price) continue;

    const trailing = cleanString(decodeHtml(match[3]));
    const label =
      saleType === "sold"
        ? `${optionLabel} 체결 거래 ${trailing}`.trim()
        : `${optionLabel} ${section.includes('id="bids"') ? "즉시 판매가" : "즉시 구매가"} ${trailing}`.trim();

    candidates.push(
      makeDetailCandidate({
        identity,
        market: "KREAM",
        detailUrl,
        defaultCurrency: "KRW",
        price,
        saleType,
        title: `${identity.name} ${identity.number} ${label}`,
        matchScore: saleType === "sold" ? 100 : 99
      })
    );
  }

  return candidates;
}

function extractKreamNuxtCandidates(html: string, detailUrl: string, identity: CardIdentity) {
  const payload = extractNuxtDataPayload(html);
  if (!payload) return [];

  const summaryIndex = payload.indexOf("transaction_history_summary");
  if (summaryIndex < 0) return [];

  const chunk = payload.slice(summaryIndex, Math.min(payload.length, summaryIndex + 120000));
  const salesSection = betweenMarkers(chunk, "\"체결 거래\"", "\"판매 입찰\"");
  const asksSection = betweenMarkers(chunk, "\"판매 입찰\"", "\"구매 입찰\"");
  const bidsSection = betweenMarkers(chunk, "\"구매 입찰\"", "\"로그인\"");
  const candidates = [
    ...parseKreamSalesSection(salesSection, detailUrl, identity),
    ...parseKreamOrderSection(asksSection, detailUrl, identity, "ask"),
    ...parseKreamOrderSection(bidsSection, detailUrl, identity, "bid")
  ];

  return dedupePriceCandidates(candidates);
}

function extractNuxtDataPayload(html: string) {
  return html.match(
    /<script type="application\/json" data-nuxt-data="nuxt-app"[^>]*>([\s\S]*?)<\/script>/i
  )?.[1];
}

function betweenMarkers(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const rest = source.slice(start);
  const end = rest.indexOf(endMarker, startMarker.length);
  return end >= 0 ? rest.slice(0, end) : rest;
}

function parseKreamSalesSection(section: string, detailUrl: string, identity: CardIdentity) {
  if (!section) return [];

  const candidates: PriceCandidate[] = [];
  const targetTerms = detailConditionTerms(identity.targetCondition).map((term) => term.toLowerCase());
  let currentOption = "";
  const explicitPattern =
    /\{"product_id":\d+,"product_option":\d+,"price":\d+,"is_immediate_delivery_item":[^}]+\},\{"product_id":\d+,"key":\d+,"name":\d+,"name_display":\d+,"id":\d+\},"([^"]+)",\d+,(\d{5,7}),"(20\d{2}-\d{2}-\d{2}T[^"]+)","([^"]+)"/g;
  const implicitPattern =
    /\{"product_id":\d+,"product_option":\d+,"price":\d+,"is_immediate_delivery_item":[^}]+\},\{"product_id":\d+,"key":\d+,"name":\d+,"name_display":\d+,"id":\d+\},(\d{5,7}),"(20\d{2}-\d{2}-\d{2}T[^"]+)","([^"]+)"/g;

  for (const match of section.matchAll(explicitPattern)) {
    currentOption = cleanString(match[1]);
    if (!matchesTargetOption(currentOption, targetTerms)) continue;
    candidates.push(
      makeDetailCandidate({
        identity,
        market: "KREAM",
        detailUrl,
        defaultCurrency: "KRW",
        price: Number(match[2]),
        saleType: "sold",
        title: `${identity.name} ${identity.number} ${currentOption} 체결 거래 ${match[4]}`,
        matchScore: 100
      })
    );
  }

  for (const match of section.matchAll(implicitPattern)) {
    if (!matchesTargetOption(currentOption, targetTerms)) continue;
    candidates.push(
      makeDetailCandidate({
        identity,
        market: "KREAM",
        detailUrl,
        defaultCurrency: "KRW",
        price: Number(match[1]),
        saleType: "sold",
        title: `${identity.name} ${identity.number} ${currentOption || conditionSearchTerm(identity.targetCondition)} 체결 거래 ${match[3]}`,
        matchScore: 99
      })
    );
  }

  return candidates;
}

function parseKreamOrderSection(
  section: string,
  detailUrl: string,
  identity: CardIdentity,
  orderType: "ask" | "bid"
) {
  if (!section) return [];

  const candidates: PriceCandidate[] = [];
  const targetTerms = detailConditionTerms(identity.targetCondition).map((term) => term.toLowerCase());
  let currentOption = "";
  const explicitPattern =
    /\{"product_id":\d+,"product_option":\d+,"price":\d+,"quantity":\d+,"is_immediate_delivery_item":[^}]+\},\{"product_id":\d+,"key":\d+,"name":\d+,"name_display":\d+,"id":\d+\},"([^"]+)",\d+,(\d{5,7})(?=,|})/g;
  const implicitPattern =
    /\{"product_id":\d+,"product_option":\d+,"price":\d+,"quantity":\d+,"is_immediate_delivery_item":[^}]+\},\{"product_id":\d+,"key":\d+,"name":\d+,"name_display":\d+,"id":\d+\},(\d{5,7})(?=,|})/g;

  for (const match of section.matchAll(explicitPattern)) {
    currentOption = cleanString(match[1]);
    if (!matchesTargetOption(currentOption, targetTerms)) continue;
    candidates.push(
      makeDetailCandidate({
        identity,
        market: "KREAM",
        detailUrl,
        defaultCurrency: "KRW",
        price: Number(match[2]),
        saleType: "listing",
        title: `${identity.name} ${identity.number} ${currentOption} ${
          orderType === "ask" ? "즉시 구매가" : "즉시 판매가"
        }`,
        matchScore: 99
      })
    );
  }

  for (const match of section.matchAll(implicitPattern)) {
    if (!matchesTargetOption(currentOption, targetTerms)) continue;
    candidates.push(
      makeDetailCandidate({
        identity,
        market: "KREAM",
        detailUrl,
        defaultCurrency: "KRW",
        price: Number(match[1]),
        saleType: "listing",
        title: `${identity.name} ${identity.number} ${currentOption || conditionSearchTerm(identity.targetCondition)} ${
          orderType === "ask" ? "즉시 구매가" : "즉시 판매가"
        }`,
        matchScore: 98
      })
    );
  }

  return candidates;
}

function matchesTargetOption(optionLabel: string, targetTerms: string[]) {
  const normalized = optionLabel.toLowerCase();
  return targetTerms.some((term) => normalized.includes(term.toLowerCase()));
}

function buildDetailWindows(
  normalizedHtml: string,
  text: string,
  identity: CardIdentity,
  market: "KREAM" | "SNKRDUNK"
) {
  const windows = [text];
  const conditionTerms = detailConditionTerms(identity.targetCondition);
  const markerTerms =
    market === "KREAM"
      ? [...conditionTerms, "체결 거래", "거래 및 입찰 내역", "즉시 구매가", "즉시 판매가", "판매 입찰", "구매 입찰"]
      : [...conditionTerms, "latest sales", "trading history", "buy now", "sell now", "market price", "price history"];

  for (const marker of markerTerms) {
    const escaped = escapeRegExp(marker);
    const regex = new RegExp(`.{0,1400}${escaped}.{0,2200}`, "gi");
    for (const match of normalizedHtml.matchAll(regex)) {
      const snippet = decodeHtml(stripTags(match[0])).replace(/\s+/g, " ").trim();
      if (snippet) windows.push(snippet);
    }
    for (const match of text.matchAll(regex)) {
      const snippet = cleanString(match[0]);
      if (snippet) windows.push(snippet);
    }
  }

  return uniqueNonEmpty(windows).slice(0, 12);
}

function extractDetailPriceRows(
  text: string,
  detailUrl: string,
  market: "KREAM" | "SNKRDUNK",
  identity: CardIdentity,
  defaultCurrency: "KRW" | "JPY"
) {
  const candidates: PriceCandidate[] = [];
  const conditionTerms = detailConditionTerms(identity.targetCondition);
  const currencyPattern = defaultCurrency === "KRW" ? "(\\d{1,3}(?:,\\d{3})+)\\s*원" : "¥\\s*(\\d{1,3}(?:,\\d{3})+)";
  const soldKeywords = market === "KREAM" ? "(?:체결 거래|체결|거래)" : "(?:sold|sale|latest sale|transaction)";
  const recencyPattern =
    market === "KREAM"
      ? "(\\d+\\s*(?:시간|일|주|개월)\\s*전|20\\d{2}[./-]\\d{2}[./-]\\d{2})"
      : "(\\d+\\s*(?:hours?|days?|weeks?|months?)\\s*ago|20\\d{2}[./-]\\d{2}[./-]\\d{2})";

  for (const term of conditionTerms) {
    const pattern = new RegExp(
      `${escapeRegExp(term)}[\\s\\S]{0,120}?${currencyPattern}[\\s\\S]{0,80}?${recencyPattern}?`,
      "gi"
    );
    for (const match of text.matchAll(pattern)) {
      const rawPrice = match[1];
      const rawRecency = match[2] || "";
      const price = Number(rawPrice.replace(/,/g, ""));
      if (!price) continue;

      candidates.push(
        makeDetailCandidate({
          identity,
          market,
          detailUrl,
          defaultCurrency,
          price,
          saleType: "sold",
          title: `${identity.name} ${identity.number} ${term} ${soldKeywordsToLabel(market)} ${rawRecency}`.trim(),
          matchScore: 99
        })
      );
    }
  }

  const genericRowPattern = new RegExp(
    `${currencyPattern}[\\s\\S]{0,80}?${recencyPattern}`,
    "gi"
  );

  for (const match of text.matchAll(genericRowPattern)) {
    const price = Number((match[1] || "").replace(/,/g, ""));
    const recency = cleanString(match[2] || "");
    const rowText = surroundingText(text, match.index || 0);
    if (!price || !conditionTerms.some((term) => rowText.toLowerCase().includes(term.toLowerCase()))) continue;
    if (!new RegExp(soldKeywords, "i").test(rowText) && market !== "KREAM") continue;

    candidates.push(
      makeDetailCandidate({
        identity,
        market,
        detailUrl,
        defaultCurrency,
        price,
        saleType: "sold",
        title: `${identity.name} ${identity.number} ${conditionTerms[0]} trade ${recency}`.trim(),
        matchScore: 97
      })
    );
  }

  return candidates;
}

function extractDetailActionPrices(
  text: string,
  detailUrl: string,
  market: "KREAM" | "SNKRDUNK",
  identity: CardIdentity,
  defaultCurrency: "KRW" | "JPY"
) {
  const candidates: PriceCandidate[] = [];
  const currencyPattern = defaultCurrency === "KRW" ? "(\\d{1,3}(?:,\\d{3})+)\\s*원" : "¥\\s*(\\d{1,3}(?:,\\d{3})+)";
  const actionLabels =
    market === "KREAM"
      ? [
          { label: "즉시 구매가", saleType: "listing" as const },
          { label: "즉시 판매가", saleType: "listing" as const },
          { label: "구매 입찰", saleType: "listing" as const },
          { label: "판매 입찰", saleType: "listing" as const }
        ]
      : [
          { label: "buy now", saleType: "listing" as const },
          { label: "sell now", saleType: "listing" as const },
          { label: "lowest ask", saleType: "listing" as const },
          { label: "highest bid", saleType: "listing" as const },
          { label: "market price", saleType: "listing" as const }
        ];

  for (const action of actionLabels) {
    const pattern = new RegExp(`${escapeRegExp(action.label)}[\\s\\S]{0,60}?${currencyPattern}`, "i");
    const match = text.match(pattern);
    if (!match) continue;
    const price = Number(match[1].replace(/,/g, ""));
    if (!price) continue;
    candidates.push(
      makeDetailCandidate({
        identity,
        market,
        detailUrl,
        defaultCurrency,
        price,
        saleType: action.saleType,
        title: `${identity.name} ${identity.number} ${conditionSearchTerm(identity.targetCondition)} ${action.label}`,
        matchScore: 98
      })
    );
  }

  return candidates;
}

function makeDetailCandidate(args: {
  identity: CardIdentity;
  market: "KREAM" | "SNKRDUNK";
  detailUrl: string;
  defaultCurrency: "KRW" | "JPY";
  price: number;
  saleType: "sold" | "listing";
  title: string;
  matchScore: number;
}): PriceCandidate {
  const { identity, market, detailUrl, defaultCurrency, price, saleType, title, matchScore } = args;
  const setName =
    identity.setName && identity.setName !== "Unknown set" ? identity.setName : "";
  const normalizedTitle =
    setName && !title.toLowerCase().includes(setName.toLowerCase()) ? `${title} ${setName}` : title;
  return {
    title: normalizedTitle,
    market,
    url: detailUrl,
    price,
    currency: defaultCurrency,
    approximateKrw: convertToKrw(price, defaultCurrency),
    saleType,
    condition: normalizeCandidateCondition(normalizedTitle, identity, saleType),
    language: identity.language,
    exactMatch: true,
    excludeReason: "",
    marketSearchQuery: identity.searchQueries[0],
    matchScore,
    numberMatch: true,
    conditionMatch: true
  };
}

function detailConditionTerms(targetCondition: string) {
  if (targetCondition === "psa10") return ["PSA 10", "PSA10"];
  if (targetCondition === "psa9") return ["PSA 9", "PSA9"];
  if (targetCondition === "bgs10") return ["BGS 10", "BGS10"];
  if (targetCondition === "cgc10") return ["CGC 10", "CGC10"];
  return ["raw", "single", "ungraded"];
}

function soldKeywordsToLabel(market: "KREAM" | "SNKRDUNK") {
  return market === "KREAM" ? "체결 거래" : "latest sale";
}

function dedupePriceCandidates(candidates: PriceCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = [
      candidate.market,
      candidate.url,
      candidate.saleType,
      candidate.currency,
      candidate.price,
      candidate.title
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchHtml(url: string) {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1"
  };

  if (url.includes("kream.co.kr")) {
    headers.Referer = "https://kream.co.kr/";
    headers.Origin = "https://kream.co.kr";
  }

  if (url.includes("snkrdunk.com")) {
    headers.Referer = "https://snkrdunk.com/";
    headers.Origin = "https://snkrdunk.com";
  }

  const response = await fetch(url, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HTML fetch failed: ${response.status} ${url}`);
  }

  return response.text();
}

function extractHtmlCards(
  html: string,
  hostHint: string,
  query: string,
  identity: CardIdentity,
  saleType: PriceCandidate["saleType"]
): PriceCandidate[] {
  const snippets = html
    .split(/(?=<a\b)|(?=<li\b)|(?=<article\b)|(?=<div\b)/i)
    .filter((chunk) => /[$¥₩]|\bKRW\b|\bJPY\b|\bUSD\b|원/.test(chunk))
    .slice(0, 300);

  const candidates: PriceCandidate[] = [];
  for (const snippet of snippets) {
    const title = decodeHtml(cleanString(stripTags(snippet))).slice(0, 240);
    const url = extractFirstUrl(snippet, hostHint);
    const priceHit = extractFirstPrice(snippet);
    if (!title || !url || !priceHit) continue;

    const classification = classifyCandidate(title, identity);
    candidates.push({
      title,
      market: hostHint.includes("ebay") ? "eBay" : hostHint.includes("kream") ? "KREAM" : "SNKRDUNK",
      url,
      price: priceHit.value,
      currency: priceHit.currency,
      approximateKrw: convertToKrw(priceHit.value, priceHit.currency),
      saleType,
      condition: normalizeCandidateCondition(title, identity, saleType),
      language: identity.language,
      exactMatch: classification.exactMatch,
      excludeReason: classification.excludeReason,
      marketSearchQuery: query,
      matchScore: classification.matchScore,
      numberMatch: classification.numberMatch,
      conditionMatch: classification.conditionMatch
    });
  }

  return filterStructuredCandidates(candidates, identity).slice(0, 12);
}

function extractPriceChartingDetailUrl(html: string, identity: CardIdentity) {
  const links = [...html.matchAll(/href="(\/game\/[^"]+)"/g)].map((match) => match[1]);
  const best = links.find((link) => contextMatchesIdentity(link, link, identity)) || links[0];
  return best ? `https://www.pricecharting.com${best}` : "";
}

function extractPriceChartingGuideCandidates(
  html: string,
  detailUrl: string,
  identity: CardIdentity
): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];
  const guideSection = html.match(/Full Price Guide:[\s\S]+?(?:All prices are the current market price|Chart shows the price)/i)?.[0] || "";
  if (!guideSection) return candidates;

  const targetLabels = priceChartingTargetLabels(identity.targetCondition);
  for (const label of targetLabels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*\\|\\s*\\$([\\d,]+(?:\\.\\d{1,2})?)`, "i");
    const match = guideSection.match(pattern);
    if (!match) continue;
    const value = Number(match[1].replace(/,/g, ""));
    if (!value) continue;
    candidates.push({
      title: `${identity.name} ${label} market value`,
      market: "PriceCharting",
      url: detailUrl,
      price: value,
      currency: "USD",
      approximateKrw: convertToKrw(value, "USD"),
      saleType: "unknown",
      condition: normalizePriceChartingCondition(label),
      language: identity.language,
      exactMatch: true,
      excludeReason: "",
      marketSearchQuery: identity.searchQueries[0],
      matchScore: 96,
      numberMatch: true,
      conditionMatch: conditionMatchesTarget(normalizePriceChartingCondition(label).toLowerCase(), identity.targetCondition)
    });
  }

  return candidates;
}

function extractPriceChartingRecentSales(
  html: string,
  detailUrl: string,
  identity: CardIdentity
): PriceCandidate[] {
  const conditionLabels = priceChartingTargetLabels(identity.targetCondition);
  const segments = conditionLabels
    .map((label) => html.match(new RegExp(`${escapeRegExp(label)} Sold Listings \\(\\d+\\)([\\s\\S]{0,2400})`, "i"))?.[1] || "")
    .filter(Boolean);

  const candidates: PriceCandidate[] = [];
  for (const segment of segments) {
    const rowMatches = [...segment.matchAll(/(20\d{2}-\d{2}-\d{2})[\s\S]{0,300}?\|\s*\$([\d,]+(?:\.\d{1,2})?)/g)];
    for (const row of rowMatches.slice(0, 8)) {
      const saleDate = row[1];
      const value = Number(row[2].replace(/,/g, ""));
      const nearby = segment.slice(Math.max(0, row.index || 0), Math.min(segment.length, (row.index || 0) + 260));
      const titleMatch = nearby.match(/\|\s*([^|]+?)\s*\|\s*\$[\d,]+(?:\.\d{1,2})?/);
      const title = cleanString(titleMatch?.[1]) || `${identity.name} PriceCharting sold`;
      if (!value) continue;
      candidates.push({
        title,
        market: "PriceCharting",
        url: detailUrl,
        price: value,
        currency: "USD",
        approximateKrw: convertToKrw(value, "USD"),
        saleType: "sold",
        condition: normalizeCandidateCondition(title, identity, "sold"),
        language: identity.language,
        exactMatch: true,
        excludeReason: "",
        marketSearchQuery: identity.searchQueries[0],
        matchScore: 98,
        numberMatch: true,
        conditionMatch: true
      });
    }
  }

  return filterStructuredCandidates(candidates, identity).slice(0, 10);
}

function priceChartingTargetLabels(targetCondition: string) {
  if (targetCondition === "psa10") return ["PSA 10"];
  if (targetCondition === "psa9") return ["Grade 9", "PSA 9"];
  if (targetCondition === "raw") return ["Ungraded"];
  if (targetCondition === "bgs10") return ["BGS 10"];
  if (targetCondition === "cgc10") return ["CGC 10"];
  return ["Ungraded"];
}

function normalizePriceChartingCondition(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("psa 10")) return "PSA 10 reference";
  if (normalized.includes("psa 9") || normalized.includes("grade 9")) return "PSA 9 reference";
  if (normalized.includes("bgs 10")) return "BGS 10 reference";
  if (normalized.includes("cgc 10")) return "CGC 10 reference";
  if (normalized.includes("ungraded")) return "Raw reference";
  return `${label} reference`;
}

function normalizeCandidateCondition(
  title: string,
  identity: CardIdentity,
  saleType: PriceCandidate["saleType"]
) {
  const lower = title.toLowerCase();
  if (/\bpsa\s*10\b/.test(lower)) return saleType === "sold" ? "PSA 10 sold" : "PSA 10 listing";
  if (/\bpsa\s*9\b/.test(lower)) return saleType === "sold" ? "PSA 9 sold" : "PSA 9 listing";
  if (/\bcgc\s*10\b/.test(lower)) return saleType === "sold" ? "CGC 10 sold" : "CGC 10 listing";
  if (/\bbgs\s*10\b/.test(lower)) return saleType === "sold" ? "BGS 10 sold" : "BGS 10 listing";
  if (/lp|lightly played/.test(lower)) return saleType === "sold" ? "Raw LP sold" : "Raw LP listing";
  if (/nm|near mint|mint|art rare|illustration rare|holo/.test(lower) || identity.targetCondition === "raw") {
    return saleType === "sold" ? "Raw sold" : "Raw listing";
  }
  return saleType === "sold" ? `${identity.targetCondition} sold` : `${identity.targetCondition} listing`;
}

function extractFirstUrl(snippet: string, hostHint: string) {
  const absolute = snippet.match(/https?:\/\/[^"'\\\s>]+/i)?.[0];
  if (absolute) return decodeHtml(absolute);
  const relative = snippet.match(/href="([^"]+)"/i)?.[1];
  if (!relative) return "";
  if (relative.startsWith("http")) return decodeHtml(relative);
  return `https://${hostHint}${relative.startsWith("/") ? relative : `/${relative}`}`;
}

function extractFirstPrice(snippet: string) {
  const pricePatterns: Array<{ regex: RegExp; currency: string }> = [
    { regex: /\$\s*([\d,]+(?:\.\d{1,2})?)/, currency: "USD" },
    { regex: /¥\s*([\d,]+(?:\.\d{1,2})?)/, currency: "JPY" },
    { regex: /₩\s*([\d,]+(?:\.\d{1,2})?)/, currency: "KRW" },
    { regex: /([\d,]{3,})\s*원/, currency: "KRW" }
  ];

  for (const pattern of pricePatterns) {
    const match = snippet.match(pattern.regex);
    if (!match) continue;
    const value = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) continue;
    return { value, currency: pattern.currency };
  }

  return null;
}

function detectCurrencyFromText(value: string) {
  const text = value.toUpperCase();
  if (text.includes("US $") || text.includes("USD") || text.includes("$")) return "USD";
  if (text.includes("¥") || text.includes("JPY")) return "JPY";
  if (text.includes("₩") || text.includes("KRW") || text.includes("원")) return "KRW";
  if (text.includes("HK$")) return "HKD";
  return "";
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function filterStructuredCandidates(candidates: PriceCandidate[], identity: CardIdentity) {
  return candidates
    .filter((candidate) => candidate.approximateKrw > 0)
    .filter((candidate) => candidate.numberMatch !== false)
    .filter((candidate) => candidateSupportsIdentity(candidate, identity))
    .filter((candidate) => {
      const strict = isStandardTcgWithNumber(identity);
      if (!strict) return true;
      return candidate.exactMatch || (candidate.matchScore ?? 0) >= 70;
    })
    .filter((candidate) => !candidate.excludeReason || candidate.exactMatch)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
}

function mergeStructuredCandidates(...groups: PriceCandidate[][]) {
  const merged = groups.flat();
  const seen = new Set<string>();
  return merged.filter((candidate) => {
    const key = [
      candidate.market.toLowerCase(),
      candidate.url,
      candidate.price,
      candidate.currency,
      candidate.saleType,
      candidate.condition.toLowerCase()
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getEbayAccessToken() {
  const credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope"
    })
  });

  if (!response.ok) {
    throw new Error(`eBay OAuth 실패: ${await response.text()}`);
  }

  const payload = await response.json();
  return String(payload.access_token);
}

function buildEbayQuery(identity: CardIdentity, searchPlan?: MarketSearchPlan) {
  const planned = searchPlan?.marketQueries.ebayCurrent[0];
  if (planned) return planned;

  const parts = [identity.name, identity.number, conditionSearchTerm(identity.targetCondition), "Pokemon card"];
  return parts.filter((part) => part && !part.toLowerCase().includes("unknown")).join(" ");
}

function classifyCandidate(title: string, identity: CardIdentity) {
  const haystack = title.toLowerCase();
  const number = identity.number.toLowerCase();
  const forbidden = [
    "proxy",
    "orica",
    "custom",
    "replica",
    "fan art",
    "lot",
    "bundle",
    "mystery",
    "booster",
    "pack",
    "box",
    "sealed",
    "damaged",
    "played"
  ];
  const foundForbidden = forbidden.find((term) => haystack.includes(term));
  const graded = haystack.match(/\bpsa\s*10\b|\bpsa\s*9\b|\bbgs\b|\bcgc\b/);
  const hasNumber = number === "unknown" || numberVariants(number).some((variant) => haystack.includes(variant));
  const languageMatches = languageMatchesTitle(haystack, identity.language);
  const conditionMatch = conditionMatchesTarget(
    graded ? graded[0].replace(/\s+/g, "").toLowerCase() : "raw listing",
    identity.targetCondition
  );
  const nameMatch = cardNameMatchesTitle(haystack, identity.name);
  const matchScore = candidateMatchScore({
    numberMatch: hasNumber,
    conditionMatch,
    languageMatch: languageMatches,
    nameMatch
  });

  if (foundForbidden) {
    return {
      condition: foundForbidden === "sealed" ? "sealed" : foundForbidden,
      exactMatch: false,
      excludeReason: `Excluded by keyword: ${foundForbidden}`,
      matchScore: 0,
      numberMatch: hasNumber,
      conditionMatch
    };
  }

  if (graded) {
    return {
      condition: graded[0].replace(/\s+/g, "").toUpperCase(),
      exactMatch: hasNumber && languageMatches && nameMatch && conditionMatch,
      excludeReason: conditionMatch ? "" : "Graded condition does not match request",
      matchScore,
      numberMatch: hasNumber,
      conditionMatch
    };
  }

  return {
    condition: "raw listing",
    exactMatch: hasNumber && languageMatches && nameMatch && conditionMatch,
    excludeReason: hasNumber && languageMatches && nameMatch && conditionMatch
      ? ""
      : "Missing exact number, name, language, or condition match",
    matchScore,
    numberMatch: hasNumber,
    conditionMatch
  };
}

function cardNameMatchesTitle(title: string, name: string) {
  const normalizedName = name.toLowerCase();
  const tokens = normalizedName
    .split(/[^a-z0-9가-힣ぁ-ゟ゠-ヿ一-龯]+/)
    .filter((token) => token.length >= 2 && !["pokemon", "card"].includes(token));
  return tokens.length === 0 || tokens.some((token) => title.includes(token));
}

function candidateMatchScore({
  numberMatch,
  conditionMatch,
  languageMatch,
  nameMatch
}: {
  numberMatch: boolean;
  conditionMatch: boolean;
  languageMatch: boolean;
  nameMatch: boolean;
}) {
  let score = 0;
  if (numberMatch) score += 38;
  if (conditionMatch) score += 28;
  if (languageMatch) score += 18;
  if (nameMatch) score += 16;
  return score;
}

function languageMatchesTitle(title: string, language: string) {
  const normalized = language.toLowerCase();
  if (normalized.includes("japanese")) {
    return title.includes("japanese") || title.includes(" jp ") || title.includes(" sv2a") || title.includes("m2a");
  }
  if (normalized.includes("korean")) {
    return title.includes("korean") || title.includes(" kr ");
  }
  if (normalized.includes("english")) {
    return !title.includes("japanese") && !title.includes("korean");
  }
  return true;
}

function convertToKrw(value: number, currency: string) {
  const normalized = currency.toUpperCase();
  if (normalized === "KRW") return Math.round(value);
  if (normalized === "USD") return Math.round(value * FX_USD_KRW);
  if (normalized === "JPY") return Math.round(value * FX_JPY_KRW);
  if (normalized === "EUR") return Math.round(value * FX_EUR_KRW);
  if (normalized === "GBP") return Math.round(value * FX_GBP_KRW);
  if (normalized === "HKD") return Math.round(value * FX_HKD_KRW);
  return Math.round(value);
}

function conditionSearchTerm(condition: string) {
  if (condition === "raw") return "raw";
  if (condition === "psa10") return "PSA 10";
  if (condition === "psa9") return "PSA 9";
  if (condition === "bgs10") return "BGS 10";
  if (condition === "bgs9.5") return "BGS 9.5";
  if (condition === "cgc10") return "CGC 10";
  if (condition === "cgc9.5") return "CGC 9.5";
  if (condition === "sealed") return "sealed";
  return "";
}

function normalizeCondition(value: unknown, cardType?: EstimateRequest["cardType"]) {
  if (typeof value !== "string") return "";
  return inferTargetCondition(value, cardType);
}

function inferTargetCondition(value: string, cardType?: EstimateRequest["cardType"]) {
  const text = value.toLowerCase().replace(/\s+/g, " ");
  if (/\bpsa\s*10\b|psa10|gem mt\s*10|graded\s*10/.test(text)) return "psa10";
  if (/\bpsa\s*9\b|psa9/.test(text)) return "psa9";
  if (/\bbgs\s*10\b|bgs10/.test(text)) return "bgs10";
  if (/\bbgs\s*9\.5\b|bgs9\.5/.test(text)) return "bgs9.5";
  if (/\bcgc\s*10\b|cgc10/.test(text)) return "cgc10";
  if (/\bcgc\s*9\.5\b|cgc9\.5/.test(text)) return "cgc9.5";
  if (/\bsealed\b|미개봉/.test(text)) return "sealed";
  if (cardType === "psa") return "psa10";
  return "raw";
}

function ensureConditionQueries(queries: string[], condition: string) {
  const term = conditionSearchTerm(condition);
  if (!term) return queries;
  return queries.map((query) => {
    const normalized = query.toLowerCase();
    return normalized.includes(term.toLowerCase()) ? query : `${query} ${term}`;
  });
}

function normalizeIdentity(
  input: Partial<CardIdentity>,
  fallbackQuery?: string,
  cardType?: EstimateRequest["cardType"]
): CardIdentity {
  const name = cleanString(input.name) || cleanString(fallbackQuery) || "Unknown Pokemon Card";
  const number = normalizeCardNumber(cleanString(input.number) || extractCardNumber(fallbackQuery || "") || "Unknown");
  const productLine = normalizeProductLine(cleanString(input.productLine), cleanString(input.setName), cleanString(input.extractedText));
  const gradingCompany = normalizeGradingCompany(cleanString(input.gradingCompany), cleanString(input.extractedText));
  const grade = cleanString(input.grade) || extractGrade(cleanString(input.extractedText));
  const certNumber = cleanString(input.certNumber) || extractCertNumber(cleanString(input.extractedText));
  const year = cleanString(input.year) || extractYear(cleanString(input.extractedText));
  const targetCondition =
    normalizeCondition(input.targetCondition, cardType) ||
    inferTargetCondition(`${fallbackQuery || ""} ${name} ${gradingCompany} ${grade}`, cardType);
  const candidates = normalizeCardCandidates(input.candidates);
  const labelBasedIdentity = normalizeIdentityEvidence(input.labelBasedIdentity);
  const imageBasedIdentity = normalizeIdentityEvidence(input.imageBasedIdentity);
  const evidencePriority = normalizeEvidencePriority(input.evidencePriority, labelBasedIdentity, imageBasedIdentity);
  const warnings = validationWarningsForIdentity({
    name,
    language: cleanString(input.language) || "Unknown",
    setName: cleanString(input.setName) || "Unknown set",
    number,
    rarity: cleanString(input.rarity) || "Unknown rarity",
    productLine,
    year,
    gradingCompany,
    grade,
    certNumber,
    imageType: cleanString(input.imageType),
    targetCondition,
    confidence: clamp(Number(input.confidence) || 72, 0, 100),
    searchQueries: []
  });
  const adjustedConfidence = adjustIdentityConfidence(
    clamp(Number(input.confidence) || 72, 0, 100),
    {
      number,
      productLine,
      gradingCompany,
      certNumber,
      targetCondition
    },
    candidates,
    warnings
  );
  const baseSearchQueries =
    Array.isArray(input.searchQueries) && input.searchQueries.length > 0
      ? expandReferenceQueries(
          ensureConditionQueries(input.searchQueries.map(String).slice(0, 6), targetCondition),
          name,
          number,
          targetCondition,
          { productLine, year, gradingCompany, grade, certNumber }
        )
      : expandReferenceQueries(
          ensureConditionQueries([`${name} ${number}`, `${name} Pokemon card`, `${number} Pokemon SAR`], targetCondition),
          name,
          number,
          targetCondition,
          { productLine, year, gradingCompany, grade, certNumber }
        );

  return applyKnownCardCorrections({
    name,
    language: cleanString(input.language) || "Unknown",
    setName: cleanString(input.setName) || "Unknown set",
    number,
    rarity: cleanString(input.rarity) || "Unknown rarity",
    productLine,
    year,
    gradingCompany,
    grade,
    certNumber,
    imageType: cleanString(input.imageType),
    targetCondition,
    confidence: adjustedConfidence,
    searchQueries: uniqueNonEmpty([
      ...baseSearchQueries,
      ...evidenceSearchQueries(labelBasedIdentity, imageBasedIdentity)
    ]).slice(0, 16),
    candidates,
    labelBasedIdentity,
    imageBasedIdentity,
    evidencePriority,
    validationWarnings: [...warnings, ...(Array.isArray(input.validationWarnings) ? input.validationWarnings.map(String) : [])],
    extractedText: cleanString(input.extractedText)
  });
}

function normalizeCardNumber(value: string) {
  const match = value.match(/([A-Z]{0,4}\s*)?(\d{1,4})\s*[\/／-]\s*(\d{1,4})/i);
  if (!match) return value || "Unknown";
  const prefix = (match[1] || "").replace(/\s+/g, "").toUpperCase();
  const number = `${Number(match[2])}/${Number(match[3])}`;
  return prefix ? `${prefix} ${number}` : number;
}

function extractCardNumber(value: string) {
  return value.match(/(?:[A-Z]{1,4}\s*)?\d{1,4}\s*[\/／-]\s*\d{1,4}/i)?.[0];
}

function normalizeCardCandidates(value: unknown): CardCandidate[] {
  if (!Array.isArray(value)) return [];
  const candidates: CardCandidate[] = [];
  value.forEach((candidate) => {
    if (!candidate || typeof candidate !== "object") return;
    const item = candidate as Partial<CardCandidate>;
    const normalized = {
      name: cleanString(item.name),
      language: cleanString(item.language),
      setName: cleanString(item.setName),
      number: normalizeCardNumber(cleanString(item.number)),
      rarity: cleanString(item.rarity),
      productLine: normalizeProductLine(cleanString(item.productLine), cleanString(item.setName), cleanString(item.evidence)),
      year: cleanString(item.year) || extractYear(cleanString(item.evidence)),
      gradingCompany: normalizeGradingCompany(cleanString(item.gradingCompany), cleanString(item.evidence)),
      grade: cleanString(item.grade) || extractGrade(cleanString(item.evidence)),
      certNumber: cleanString(item.certNumber) || extractCertNumber(cleanString(item.evidence)),
      confidence: clamp(Number(item.confidence) || 0, 0, 100),
      evidence: cleanString(item.evidence)
    };
    if (normalized.name || normalized.number) candidates.push(normalized);
  });
  return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

function normalizeIdentityEvidence(value: unknown): CardIdentityEvidence | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Partial<CardIdentityEvidence>;
  const evidence = cleanString(item.evidence);
  const normalized: CardIdentityEvidence = {
    name: cleanString(item.name),
    language: cleanString(item.language) || "Unknown",
    setName: cleanString(item.setName) || "Unknown set",
    number: normalizeCardNumber(cleanString(item.number) || "Unknown"),
    rarity: cleanString(item.rarity) || "Unknown rarity",
    productLine: normalizeProductLine(cleanString(item.productLine), cleanString(item.setName), evidence),
    year: cleanString(item.year) || extractYear(evidence),
    gradingCompany: normalizeGradingCompany(cleanString(item.gradingCompany), evidence),
    grade: cleanString(item.grade) || extractGrade(evidence),
    certNumber: cleanString(item.certNumber) || extractCertNumber(evidence),
    confidence: clamp(Number(item.confidence) || 0, 0, 100),
    evidence,
    searchQueries: Array.isArray(item.searchQueries) ? item.searchQueries.map(String).slice(0, 6) : []
  };
  if (!normalized.name && normalized.number === "Unknown" && !normalized.evidence) return undefined;
  return normalized;
}

function normalizeEvidencePriority(
  value: unknown,
  label?: CardIdentityEvidence,
  image?: CardIdentityEvidence
): CardIdentity["evidencePriority"] {
  if (value === "label" || value === "image" || value === "mixed") return value;
  if (label && label.confidence >= 75) return "label";
  if (image) return "image";
  return "mixed";
}

function evidenceSearchQueries(label?: CardIdentityEvidence, image?: CardIdentityEvidence) {
  const queries: string[] = [];
  [label, image].forEach((identity) => {
    if (!identity) return;
    queries.push(...(identity.searchQueries || []));
    const condition = identity.gradingCompany === "PSA" && identity.grade ? `PSA ${identity.grade}` : "";
    const productLine = productLineSearchLabel(identity.productLine, identity.setName);
    queries.push(joinSearchParts([identity.year, "Pokemon", productLine, identity.name, condition]));
    queries.push(joinSearchParts(["Pokemon", productLine, identity.name, condition]));
    queries.push(joinSearchParts([identity.name, identity.number === "Unknown" ? "" : identity.number]));
    if (identity.certNumber) queries.push(joinSearchParts(["PSA", identity.certNumber, identity.name]));
  });
  return uniqueNonEmpty(queries);
}

function validationWarningsForIdentity(identity: CardIdentity) {
  const warnings: string[] = [];
  const slabOrNonTcg = isSlabOrNonTcg(identity);
  if (identity.number === "Unknown" && !slabOrNonTcg) warnings.push("card-number-unreadable");
  if (slabOrNonTcg && !identity.certNumber && identity.targetCondition.startsWith("psa")) {
    warnings.push("cert-number-unreadable");
  }
  if (identity.setName === "Unknown set" && !identity.productLine) warnings.push("set-unknown");
  if (identity.language === "Unknown") warnings.push("language-unknown");
  if (identity.rarity === "Unknown rarity") warnings.push("rarity-unknown");
  if (hasRegionalSetMismatch(identity)) warnings.push("regional-set-mismatch");
  return warnings;
}

function adjustIdentityConfidence(
  confidence: number,
  identity: Pick<CardIdentity, "number" | "productLine" | "gradingCompany" | "certNumber" | "targetCondition">,
  candidates: CardCandidate[],
  warnings: string[]
) {
  let adjusted = confidence;
  if (identity.number === "Unknown" && !isSlabOrNonTcg(identity)) adjusted = Math.min(adjusted, 64);
  if (identity.targetCondition?.startsWith("psa") && identity.gradingCompany === "PSA" && identity.certNumber) {
    adjusted += 8;
  }
  if (warnings.includes("set-unknown")) adjusted -= 6;
  if (warnings.includes("language-unknown")) adjusted -= 4;
  if (warnings.includes("regional-set-mismatch")) adjusted -= 18;
  if (candidates.length >= 2 && candidates[0].confidence - candidates[1].confidence < 12) {
    adjusted = Math.min(adjusted, 68);
  }
  return clamp(Math.round(adjusted), 0, 100);
}

function isSlabOrNonTcg(identity: Pick<CardIdentity, "productLine" | "gradingCompany" | "certNumber" | "targetCondition">) {
  const productLine = (identity.productLine || "").toLowerCase();
  return (
    Boolean(identity.certNumber) ||
    Boolean(identity.gradingCompany) ||
    identity.targetCondition?.startsWith("psa") ||
    productLine !== "" && productLine !== "tcg" && productLine !== "unknown"
  );
}

function normalizeProductLine(value: string, setName: string, text: string) {
  const haystack = `${value} ${setName} ${text}`.toLowerCase();
  if (/old\s*maid|올드\s*메이드/.test(haystack)) return "old-maid";
  if (/carddass|cardass|카드다스/.test(haystack)) return "carddass";
  if (/topsun|top sun|탑썬/.test(haystack)) return "topsun";
  if (/bandai|반다이/.test(haystack)) return "bandai";
  if (/meiji|메이지/.test(haystack)) return "meiji";
  if (/sticker|seal|스티커/.test(haystack)) return "sticker";
  if (/tcg|sv\d|s\d|scarlet|violet|sun|moon|sword|shield/i.test(haystack)) return "tcg";
  return value || "";
}

function normalizeGradingCompany(value: string, text: string) {
  const haystack = `${value} ${text}`.toLowerCase();
  if (/\bpsa\b/.test(haystack)) return "PSA";
  if (/\bbgs\b|beckett/.test(haystack)) return "BGS";
  if (/\bcgc\b/.test(haystack)) return "CGC";
  return value ? value.toUpperCase() : "";
}

function extractGrade(text: string) {
  if (/gem\s*mt\s*10|psa\s*10/i.test(text)) return "10";
  return text.match(/\b(?:grade|graded)?\s*(10|9\.5|9)\b/i)?.[1] || "";
}

function extractCertNumber(text: string) {
  return text.match(/\b(?:cert(?:ification)?\s*#?|PSA\s*)?(\d{7,10})\b/i)?.[1] || "";
}

function extractYear(text: string) {
  return text.match(/\b(19\d{2}|20\d{2})\b/)?.[1] || "";
}

function expandReferenceQueries(
  queries: string[],
  name: string,
  number: string,
  targetCondition: string,
  label?: Pick<CardIdentity, "productLine" | "year" | "gradingCompany" | "grade" | "certNumber">
) {
  const condition = conditionSearchTerm(targetCondition);
  const base = joinSearchParts([name, number, condition]);
  const productLine = productLineSearchLabel(label?.productLine, "");
  const slabBase = joinSearchParts([label?.year, "Pokemon", productLine, name, condition]);
  return Array.from(
    new Set([
      ...queries,
      slabBase,
      label?.certNumber ? joinSearchParts(["PSA", label.certNumber, name]) : "",
      `${base} PriceCharting`,
      `${base} Sports Card Investor`,
      `${base} Scrydex`,
      `${base} eBay sold`,
      `${base} SNKRDUNK`,
      `${base} KREAM`
    ].filter(Boolean))
  ).slice(0, 14);
}

function normalizeEstimate(input: EstimateResponse, identity: CardIdentity, marketContext?: unknown): EstimateResponse {
  const aiMarkets = Array.isArray(input.markets)
    ? input.markets
        .filter((market) => market?.url && Number(market.priceKrw) > 0)
        .map((market) => scoreMarketQuote(market, identity.targetCondition))
        .sort((a, b) => (b.evidenceScore || 0) - (a.evidenceScore || 0))
        .slice(0, 6)
    : [];
  const collectorMarkets = structuredCandidatesToMarkets(marketContext, identity);
  const markets = mergeMarketQuotes(collectorMarkets, aiMarkets).slice(0, 8);
  const exactCandidates = exactStructuredCandidates(marketContext, identity);
  const normalizedPrice = normalizePriceBand(input.price, markets, identity.targetCondition);
  const strictFailure = shouldRejectPriceEstimate(identity, exactCandidates, normalizedPrice);

  const summaryPrefix =
    identity.validationWarnings && identity.validationWarnings.length > 0
      ? "사진에서 일부 정보가 불확실합니다. "
      : "";

  return {
    card: {
      name: identity.name,
      language: identity.language,
      setName: identity.setName,
      number: identity.number,
      rarity: identity.rarity,
      productLine: identity.productLine || input.card?.productLine,
      year: identity.year || input.card?.year,
      gradingCompany: identity.gradingCompany || input.card?.gradingCompany,
      grade: identity.grade || input.card?.grade,
      certNumber: identity.certNumber || input.card?.certNumber,
      imageType: identity.imageType || input.card?.imageType,
      targetCondition: identity.targetCondition,
      confidence: clamp(Math.max(Number(input.card?.confidence) || 0, identity.confidence), 0, 100)
    },
    price: {
      lowKrw: strictFailure ? 0 : normalizedPrice.lowKrw,
      highKrw: strictFailure ? 0 : normalizedPrice.highKrw,
      medianKrw: strictFailure ? 0 : normalizedPrice.medianKrw,
      confidence: strictFailure || identity.confidence < 65 ? "low" : normalizedPrice.confidence,
      summary: strictFailure
        ? `${summaryPrefix}정확히 일치하는 거래 근거가 부족해 가격을 숨깁니다. 다만 KREAM, SNKRDUNK, eBay, PriceCharting는 계속 조회하고, 판매완료가 없어도 현재 판매중 매물은 보조 근거로 반영합니다.`
        : `${summaryPrefix}${input.price?.summary || "가격 후보가 충분하지 않아 보수적으로 추정했습니다."}`
    },
    markets: strictFailure ? markets.slice(0, 4) : markets,
    sources: ensureRequiredSources(Array.isArray(input.sources) ? input.sources.slice(0, 8) : [], identity, marketContext),
    usedMock: false
  };
}

function normalizePriceBand(
  price: PriceEstimate | undefined,
  markets: MarketQuote[],
  targetCondition: string
) {
  const targetMarkets = markets
    .filter((market) => {
      const condition = market.condition.toLowerCase();
      return conditionMatchesTarget(condition, targetCondition);
    })
    .sort((a, b) => (b.evidenceScore || 0) - (a.evidenceScore || 0));

  const soldMarkets = targetMarkets.filter((market) => market.category === "sold");
  const listingMarkets = targetMarkets.filter((market) => market.category === "listing");
  const referenceMarkets = targetMarkets.filter((market) => market.category === "reference");
  const chosen =
    soldMarkets.length > 0
      ? soldMarkets.concat(listingMarkets)
      : listingMarkets.length > 0
        ? listingMarkets
        : referenceMarkets;

  const targetPrices = chosen
    .map((market) => market.priceKrw)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (targetPrices.length >= 1) {
    const median = medianOf(targetPrices);
    const clustered = targetPrices.filter((value) => value >= median * 0.4 && value <= median * 2.5);
    const values = clustered.length >= 1 ? clustered : targetPrices;
    const maxScore = Math.max(...chosen.map((market) => market.evidenceScore || 0));
    return {
      lowKrw: values[0],
      highKrw: values[values.length - 1],
      medianKrw: medianOf(values),
      confidence: confidenceFromEvidence(chosen.length, maxScore)
    };
  }

  const lowKrw = Math.max(0, Math.round(Number(price?.lowKrw) || 0));
  const highKrw = Math.max(lowKrw, Math.round(Number(price?.highKrw) || 0));
  const medianKrw = Math.max(lowKrw, Math.min(highKrw, Math.round(Number(price?.medianKrw) || 0)));
  return {
    lowKrw,
    highKrw,
    medianKrw,
    confidence: price?.confidence || "low"
  };
}

function conditionMatchesTarget(condition: string, targetCondition: string) {
  if (condition.includes("lot") || condition.includes("sealed") || condition.includes("proxy")) {
    return targetCondition === "sealed" && condition.includes("sealed");
  }

  if (targetCondition === "raw") {
    return (
      condition.includes("raw") &&
      !condition.includes("psa") &&
      !condition.includes("bgs") &&
      !condition.includes("cgc")
    );
  }

  if (targetCondition === "psa10") {
    return condition.includes("psa10") || condition.includes("psa 10");
  }
  if (targetCondition === "psa9") {
    return condition.includes("psa9") || condition.includes("psa 9");
  }
  if (targetCondition === "bgs10") {
    return condition.includes("bgs10") || condition.includes("bgs 10");
  }
  if (targetCondition === "bgs9.5") {
    return condition.includes("bgs9.5") || condition.includes("bgs 9.5");
  }
  if (targetCondition === "cgc10") {
    return condition.includes("cgc10") || condition.includes("cgc 10");
  }
  if (targetCondition === "cgc9.5") {
    return condition.includes("cgc9.5") || condition.includes("cgc 9.5");
  }

  return condition.includes(targetCondition);
}

function categorizeMarketQuote(market: MarketQuote, targetCondition: string): MarketCategory {
  const condition = market.condition.toLowerCase();
  const label = market.label.toLowerCase();
  const text = `${condition} ${label}`;

  if (!conditionMatchesTarget(condition, targetCondition)) {
    if (conditionMatchesTarget(condition, "raw")) return "raw-reference";
    return "other-condition";
  }
  if (/sold|completed|last sale|recent sale|거래|체결|판매완료/.test(text)) return "sold";
  if (/listing|asking|current|판매중|출품|호가/.test(text)) return "listing";
  return "reference";
}

function categorizeCandidate(
  candidate: PriceCandidate,
  targetCondition: string
): MarketCategory {
  const condition = candidate.condition.toLowerCase();
  if (!conditionMatchesTarget(condition, targetCondition)) {
    if (conditionMatchesTarget(condition, "raw")) return "raw-reference";
    return "other-condition";
  }
  if (candidate.saleType === "sold") return "sold";
  if (candidate.saleType === "listing") return "listing";
  return "reference";
}

function scoreMarketQuote(market: MarketQuote, targetCondition: string): MarketQuote {
  const normalized: MarketQuote = {
    ...market,
    priceKrw: Math.round(Number(market.priceKrw)),
    observedAt: market.observedAt || new Date().toISOString().slice(0, 10)
  };
  normalized.category = categorizeMarketQuote(normalized, targetCondition);
  normalized.recencyDays = calculateRecencyDays(normalized.soldAt);
  normalized.sourceReliability = sourceReliability(normalized.market, normalized.category);
  normalized.evidenceScore = evidenceScore(normalized, targetCondition);
  return normalized;
}

function calculateRecencyDays(date: string | undefined) {
  if (!date) return undefined;
  const time = Date.parse(date);
  if (!Number.isFinite(time)) return undefined;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function sourceReliability(
  market: string,
  category: MarketCategory | undefined
): "high" | "medium" | "low" {
  const normalized = market.toLowerCase();
  if (category === "sold") {
    if (/(kream|ebay|pricecharting|sports card investor|scrydex|snkrdunk)/.test(normalized)) {
      return "high";
    }
    return "medium";
  }
  if (/(pricecharting|sports card investor|scrydex|tcgplayer|kream|snkrdunk|ebay)/.test(normalized)) {
    return "medium";
  }
  return "low";
}

function evidenceScore(market: MarketQuote, targetCondition: string) {
  let score = 0;
  const category = market.category || "reference";
  const reliability = market.sourceReliability || "low";

  if (category === "sold") score += 45;
  else if (category === "listing") score += 30;
  else if (category === "reference") score += 22;
  else if (category === "raw-reference" || category === "other-condition") score += 5;

  if (market.recencyDays !== undefined) {
    if (market.recencyDays <= 7) score += 20;
    else if (market.recencyDays <= 30) score += 16;
    else if (market.recencyDays <= 90) score += 10;
    else score += 4;
  } else if (category === "sold") {
    score += 6;
  }

  if (reliability === "high") score += 18;
  else if (reliability === "medium") score += 10;
  else score += 4;

  if (conditionMatchesTarget(market.condition.toLowerCase(), targetCondition)) score += 12;
  if (/exact|199\/193|201\/165|m2a|sv2a/i.test(`${market.label} ${market.condition}`)) score += 5;

  return clamp(Math.round(score), 0, 100);
}

function confidenceFromEvidence(count: number, maxScore: number): PriceEstimate["confidence"] {
  if (count >= 3 && maxScore >= 80) return "high";
  if (count >= 2 && maxScore >= 65) return "medium";
  if (maxScore >= 75) return "medium";
  return "low";
}

function medianOf(values: number[]) {
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[middle];
  return Math.round((values[middle - 1] + values[middle]) / 2);
}

function buildExactTerms(identity: CardIdentity) {
  return [
    identity.name,
    identity.number,
    identity.setName,
    identity.language,
    identity.rarity,
    identity.targetCondition
  ].filter((value) => value && !value.toLowerCase().includes("unknown"));
}

function exactNameCandidates(identity: CardIdentity) {
  return uniqueNonEmpty([
    ...expandPokemonNameAliases(identity.name),
    ...expandPokemonNameAliases(identity.labelBasedIdentity?.name || ""),
    ...expandPokemonNameAliases(identity.imageBasedIdentity?.name || ""),
    ...(identity.candidates || []).flatMap((candidate) => expandPokemonNameAliases(candidate.name))
  ]);
}

function englishCardName(identity: CardIdentity) {
  const direct = exactNameCandidates(identity).find((name) => /[a-z]/i.test(name));
  if (direct) return stripCardDecorators(direct);

  const queryNames = [
    ...(identity.labelBasedIdentity?.searchQueries || []),
    ...(identity.imageBasedIdentity?.searchQueries || []),
    ...identity.searchQueries
  ]
    .map(extractNameCandidateFromQuery)
    .find((name) => /[a-z]/i.test(name));

  return queryNames ? stripCardDecorators(queryNames) : stripCardDecorators(identity.name);
}

function isStandardTcgWithNumber(identity: CardIdentity) {
  return identity.productLine === "tcg" && identity.number !== "Unknown";
}

function exactConditionQueries(identity: CardIdentity) {
  const condition = conditionSearchTerm(identity.targetCondition);
  if (!condition) return [];

  const primaryExactName = englishCardName(identity);
  const localizedName = localizedCardName(identity);
  const number = identity.number === "Unknown" ? "" : identity.number;
  const setName = identity.setName === "Unknown set" ? "" : identity.setName;
  const setCode = setCodeFromIdentity(identity);
  const rarity = identity.rarity === "Unknown rarity" ? "" : identity.rarity;

  if (!isStandardTcgWithNumber(identity)) {
    return uniqueNonEmpty([
      joinSearchParts([primaryExactName, number, condition]),
      joinSearchParts([localizedName, number, condition]),
      joinSearchParts([primaryExactName, setName, condition])
    ]);
  }

  return uniqueNonEmpty([
    joinSearchParts([primaryExactName, number, setName, condition]),
    joinSearchParts([primaryExactName, number, setCode, condition]),
    joinSearchParts([primaryExactName, rarity, number, setName, condition]),
    joinSearchParts([localizedName, rarity, number, setName, condition]),
    joinSearchParts([primaryExactName, rarity, number, setCode, condition]),
    joinSearchParts([stripCardDecorators(primaryExactName), rarity, number, setName, condition]),
    joinSearchParts([stripCardDecorators(primaryExactName), number, setCode, condition])
  ]);
}

function marketNativeQueries(
  market: "kream" | "snkrdunk" | "ebay",
  identity: CardIdentity
) {
  const englishName = englishCardName(identity);
  const localizedName = localizedCardName(identity);
  const strippedEnglish = stripCardDecorators(englishName);
  const strippedLocalized = stripCardDecorators(localizedName);
  const number = identity.number === "Unknown" ? "" : identity.number;
  const condition = conditionSearchTerm(identity.targetCondition);
  const setCode = setCodeFromIdentity(identity);
  const rarity = identity.rarity === "Unknown rarity" ? "" : identity.rarity;

  if (market === "kream") {
    return uniqueNonEmpty([
      joinSearchParts([strippedLocalized, number]),
      joinSearchParts([strippedLocalized, "프로모", number]),
      joinSearchParts([strippedLocalized, rarity, number]),
      joinSearchParts([strippedLocalized, number, condition]),
      joinSearchParts([strippedEnglish, number, condition]),
      joinSearchParts([strippedEnglish, number])
    ]).slice(0, 5);
  }

  if (market === "snkrdunk") {
    return uniqueNonEmpty([
      joinSearchParts([strippedEnglish, number, condition]),
      joinSearchParts([strippedEnglish, number]),
      joinSearchParts([strippedEnglish, rarity, number]),
      joinSearchParts([strippedLocalized, number, condition]),
      joinSearchParts([strippedLocalized, number])
    ]).slice(0, 5);
  }

  return uniqueNonEmpty([
    joinSearchParts([strippedEnglish, number, condition]),
    joinSearchParts([strippedEnglish, rarity, number, condition]),
    joinSearchParts([strippedEnglish, number, setCode, condition]),
    joinSearchParts([strippedEnglish, number]),
    joinSearchParts([strippedEnglish, number, "Pokemon card"])
  ]).slice(0, 5);
}

function buildMarketSearchPlan(identity: CardIdentity): MarketSearchPlan {
  const englishName = englishCardName(identity);
  const name = englishName || stripCardDecorators(identity.name);
  const localizedName = localizedCardName(identity);
  const number = identity.number === "Unknown" ? "" : identity.number;
  const compactNumber = number.replace(/\s+/g, "");
  const setName = identity.setName === "Unknown set" ? "" : identity.setName;
  const setCode = setCodeFromIdentity(identity);
  const condition = conditionSearchTerm(identity.targetCondition);
  const exactQueries = exactConditionQueries(identity);
  const labelQueries = slabLabelQueries(identity, name, condition, exactQueries);
  const broadQueries = uniqueNonEmpty([
    ...labelQueries.map((query) => stripConditionTerms(query)),
    joinSearchParts([name, number]),
    joinSearchParts([localizedName, number]),
    joinSearchParts([number, name]),
    joinSearchParts([setCode, number]),
    joinSearchParts([setCode, compactNumber]),
    ...identity.searchQueries.map((query) => stripConditionTerms(query))
  ]).slice(0, 6);

  const primaryBroad = broadQueries[0] || joinSearchParts([name, number]) || identity.name;
  const localizedBroad = broadQueries.find((query) => /[가-힣]/.test(query)) || primaryBroad;
  const conditionQuery = joinSearchParts([primaryBroad, condition]);
  const primaryConditionQuery = exactQueries[0] || labelQueries[0] || conditionQuery;
  const kreamQueries = marketNativeQueries("kream", identity);
  const snkrdunkQueries = marketNativeQueries("snkrdunk", identity);
  const ebayQueries = marketNativeQueries("ebay", identity);

  return {
    canonical: {
      name,
      number: number || "Unknown",
      setName: setName || "Unknown set",
      rarity: identity.rarity,
      language: identity.language,
      productLine: identity.productLine,
      year: identity.year,
      gradingCompany: identity.gradingCompany,
      grade: identity.grade,
      certNumber: identity.certNumber,
      targetCondition: identity.targetCondition
    },
    broadQueries,
    marketQueries: {
      kream: uniqueNonEmpty([...kreamQueries, localizedBroad, primaryBroad]).slice(0, 5),
      snkrdunk: uniqueNonEmpty([...snkrdunkQueries, primaryBroad, joinSearchParts([name, number]), number]).slice(0, 5),
      pricecharting: uniqueNonEmpty([
        primaryConditionQuery,
        ...exactQueries,
        joinSearchParts([name, number, setCode, condition]),
        joinSearchParts([name, number, setName, condition]),
        joinSearchParts([name, number])
      ]).slice(0, 5),
      ebaySold: uniqueNonEmpty([
        ...ebayQueries,
        primaryConditionQuery,
        ...exactQueries,
        ...labelQueries,
        joinSearchParts([name, number, setCode, condition]),
        joinSearchParts([name, number, setName, condition]),
        joinSearchParts([name, number, "sold"])
      ]).slice(0, 6),
      ebayCurrent: uniqueNonEmpty([
        ...ebayQueries,
        primaryConditionQuery,
        ...exactQueries,
        ...labelQueries,
        joinSearchParts([name, number, setCode, condition]),
        joinSearchParts([name, number, setName, condition]),
        joinSearchParts([name, number, "Pokemon card"])
      ]).slice(0, 6),
      research: uniqueNonEmpty([
        primaryConditionQuery,
        ...exactQueries,
        ...labelQueries,
        joinSearchParts([primaryBroad, setName, condition]),
        ...broadQueries
      ]).slice(0, 8)
    },
    filters: {
      condition: identity.targetCondition,
      language: identity.language,
      requiredNumber: number || "Unknown",
      exclude: ["lot", "bundle", "proxy", "custom", "orica", "replica", "pack", "box", "damaged"]
    }
  };
}

function slabLabelQueries(
  identity: CardIdentity,
  name: string,
  condition: string,
  exactQueries: string[] = []
) {
  const productLine = productLineSearchLabel(identity.productLine, identity.setName);
  const grade = identity.gradingCompany || condition ? condition : "";
  return uniqueNonEmpty([
    ...exactQueries,
    joinSearchParts([identity.year, "Pokemon", productLine, name, grade]),
    joinSearchParts(["Pokemon", productLine, name, grade]),
    joinSearchParts([name, productLine, grade]),
    identity.certNumber ? joinSearchParts(["PSA", identity.certNumber, name]) : ""
  ]);
}

function productLineSearchLabel(productLine: string | undefined, setName: string) {
  if (productLine === "old-maid") return "Old Maid";
  if (productLine === "carddass") return "Carddass";
  if (productLine === "topsun") return "Topsun";
  if (productLine === "bandai") return "Bandai";
  if (productLine === "meiji") return "Meiji";
  if (productLine === "sticker") return "Sticker";
  return setName === "Unknown set" ? "" : setName;
}

function buildRequiredSourceTargets(identity: CardIdentity, searchPlan = buildMarketSearchPlan(identity)) {
  return [
    {
      market: "KREAM",
      url: `https://kream.co.kr/search?keyword=${encodeURIComponent(searchPlan.marketQueries.kream[0] || buildSourceQuery(identity))}`,
      note: `required source - KREAM broad search: ${searchPlan.marketQueries.kream[0] || buildSourceQuery(identity)}`
    },
    {
      market: "SNKRDUNK",
      url: `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(searchPlan.marketQueries.snkrdunk[0] || buildSourceQuery(identity))}`,
      note: `required source - SNKRDUNK broad search: ${searchPlan.marketQueries.snkrdunk[0] || buildSourceQuery(identity)}`
    },
    {
      market: "PriceCharting",
      url: `https://www.pricecharting.com/search-products?q=${encodeURIComponent(searchPlan.marketQueries.pricecharting[0] || buildSourceQuery(identity))}&type=prices`,
      note: `required source - PriceCharting search: ${searchPlan.marketQueries.pricecharting[0] || buildSourceQuery(identity)}`
    },
    {
      market: "eBay",
      url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchPlan.marketQueries.ebaySold[0] || buildSourceQuery(identity))}&LH_Sold=1&LH_Complete=1`,
      note: `required source - eBay sold search: ${searchPlan.marketQueries.ebaySold[0] || buildSourceQuery(identity)}`
    }
  ];
}

function buildSourceQuery(identity: CardIdentity) {
  return [
    identity.name,
    identity.number === "Unknown" ? "" : identity.number,
    identity.setName === "Unknown set" ? "" : identity.setName,
    conditionSearchTerm(identity.targetCondition)
  ]
    .filter(Boolean)
    .join(" ");
}

function stripCardDecorators(value: string) {
  return value
    .replace(/\b(AR|SAR|SR|UR|CHR|CSR|RRR|RR)\b/gi, "")
    .replace(/\b(PSA|BGS|CGC)\s*\d+(?:\.\d+)?\b/gi, "")
    .replace(/\b(GEM\s*MT|graded|raw|japanese|korean|english|pokemon|card|price|sold)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function numberVariants(number: string) {
  const normalized = number.toLowerCase().replace(/\s+/g, "");
  const noSlash = normalized.replace(/[\/／-]/g, "");
  const spaced = normalized.replace(/^([a-z]{1,4})(\d)/, "$1 $2");
  return uniqueNonEmpty([
    normalized,
    spaced,
    normalized.replace(/[／-]/g, "/"),
    normalized.replace(/[\/／]/g, "-"),
    noSlash
  ]);
}

function stripConditionTerms(value: string) {
  return value
    .replace(/\b(PSA|BGS|CGC)\s*\d+(?:\.\d+)?\b/gi, "")
    .replace(/\b(GEM\s*MT|graded|raw|price|sold|listing|current)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function localizedCardName(identity: CardIdentity) {
  const localized = identityNameCandidates(identity).find((name) => /[가-힣ぁ-ゟ゠-ヿ一-龯]/.test(name));
  if (localized) return localized;
  return stripCardDecorators(identity.name);
}

function identityNameCandidates(identity: CardIdentity) {
  const evidenceNames = [
    identity.labelBasedIdentity?.name,
    identity.imageBasedIdentity?.name,
    ...(identity.candidates || []).map((candidate) => candidate.name)
  ];
  const queryNames = [
    ...(identity.labelBasedIdentity?.searchQueries || []),
    ...(identity.imageBasedIdentity?.searchQueries || []),
    ...identity.searchQueries
  ].map(extractNameCandidateFromQuery);

  return uniqueNonEmpty([
    identity.name,
    ...evidenceNames,
    ...queryNames
  ].flatMap((value) => expandPokemonNameAliases(value || "")).map((value) => stripCardDecorators(value || "")));
}

function extractNameCandidateFromQuery(query: string) {
  return query
    .replace(/\b(?:pokemon|card|tcg|pricecharting|sold|listing|raw|graded|gem\s*mt|psa|bgs|cgc)\b/gi, " ")
    .replace(/\b(?:19\d{2}|20\d{2})\b/g, " ")
    .replace(/\b\d{7,10}\b/g, " ")
    .replace(/\b(?:\d{1,4}\s*[\/／-]\s*\d{1,4}|[a-z]{1,4}\d{1,4}\s*[\/／-]?\s*\d{0,4})\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPokemonNameIndex(entries: PokemonNameEntry[]) {
  const index = new Map<string, PokemonNameEntry>();
  for (const entry of entries) {
    for (const name of [entry.ko, entry.ja, entry.en, entry.fr, entry.de, entry.zh, entry.es, entry.it]) {
      const key = normalizePokemonNameKey(name || "");
      if (key) index.set(key, entry);
    }
  }
  return index;
}

function normalizePokemonNameKey(value: string) {
  return value.trim().toLowerCase();
}

function pokemonEntryForName(value: string) {
  const trimmed = cleanString(value);
  if (!trimmed) return null;

  const direct = POKEMON_NAME_INDEX.get(normalizePokemonNameKey(trimmed));
  if (direct) return { entry: direct, suffix: "" };

  const [firstToken, ...rest] = trimmed.split(/\s+/);
  const prefixed = POKEMON_NAME_INDEX.get(normalizePokemonNameKey(firstToken || ""));
  if (prefixed) {
    return {
      entry: prefixed,
      suffix: rest.join(" ").trim()
    };
  }

  return null;
}

function expandPokemonNameAliases(value: string) {
  const trimmed = cleanString(value);
  if (!trimmed) return [];

  const resolved = pokemonEntryForName(trimmed);
  if (!resolved) return [trimmed];

  const suffix = resolved.suffix ? ` ${resolved.suffix}` : "";
  return uniqueNonEmpty([
    trimmed,
    `${resolved.entry.en}${suffix}`,
    `${resolved.entry.ko}${suffix}`,
    `${resolved.entry.ja}${suffix}`
  ]);
}

function setCodeFromIdentity(identity: CardIdentity) {
  const haystack = `${identity.setName} ${identity.searchQueries.join(" ")}`;
  const explicit = haystack.match(/\b(?:SV\d+[a-z]?|M\d+[a-z]?|M2A|M2a)\b/);
  if (explicit) return explicit[0].toUpperCase();
  if (/mega\s*dream|메가드림/i.test(haystack)) return "M2A";
  if (/151|sv2a/i.test(haystack)) return "SV2a";
  return "";
}

function joinSearchParts(parts: Array<string | undefined>) {
  return parts
    .map((part) => (part || "").trim())
    .filter((part) => part && !part.toLowerCase().includes("unknown"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function ensureRequiredSources(
  sources: EstimateResponse["sources"],
  identity: CardIdentity,
  marketContext?: unknown
): EstimateResponse["sources"] {
  const coverage = sourceCoverageMap(marketContext);
  const existing = new Set<string>(sources.map((source) => guessMarket(source.url)));
  const required = buildRequiredSourceTargets(identity)
    .filter((source) => !existing.has(source.market))
    .map((source) => ({
      title: `${source.market} ${buildSourceQuery(identity)}`,
      url: source.url,
      note:
        coverage[source.market]?.count > 0
          ? `required source collected - ${coverage[source.market]?.count} candidates found`
          : "required source missing - no structured candidates collected"
    }));

  const merged = [...sources, ...required];
  const seen = new Set<string>();
  return merged
    .filter((source) => {
      const market = guessMarket(source.url);
      const key = `${market}:${source.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

function sourceCoverageMap(marketContext?: unknown) {
  const coverage = (marketContext as { sourceCoverage?: Record<string, { count: number; directCount: number }> } | undefined)
    ?.sourceCoverage;
  return coverage || {};
}

function mockEstimate(input: EstimateRequest): EstimateResponse {
  const baseName = input.mode === "text" && input.query ? input.query : "Charizard ex SAR";
  return {
    card: {
      name: baseName.includes("리자몽") ? "Charizard ex SAR" : baseName,
      language: baseName.includes("일본") ? "Japanese" : "Unknown",
      setName: "Pokemon Card 151 / SV2a",
      number: baseName.match(/\d+\/\d+/)?.[0] || "201/165",
      rarity: "SAR",
      targetCondition: inferTargetCondition(baseName, input.cardType),
      confidence: input.mode === "photo" ? 82 : 88
    },
    price: {
      lowKrw: 85000,
      highKrw: 128000,
      medianKrw: 104000,
      confidence: "medium",
      summary:
        "API 키가 아직 설정되지 않아 예시 데이터로 표시 중입니다. 실제 키를 넣으면 Gemini가 카드를 식별하고 Perplexity 검색 결과를 Claude가 정제해 원화 기준 시세 범위를 계산합니다."
    },
    markets: [
      {
        market: "eBay",
        label: "Recent raw listing",
        priceKrw: 98000,
        condition: "Raw",
        category: "listing",
        url: "https://www.ebay.com/sch/i.html?_nkw=Charizard+ex+201%2F165+SAR+Japanese"
      },
      {
        market: "SNKRDUNK",
        label: "Search result",
        priceKrw: 118000,
        condition: "Raw",
        category: "listing",
        url: "https://snkrdunk.com/en/search/result?keyword=Charizard%20ex%20201%2F165"
      },
      {
        market: "KREAM",
        label: "Search result",
        priceKrw: 109000,
        condition: "Raw",
        category: "listing",
        url: "https://kream.co.kr/search?keyword=Charizard%20ex%20201%2F165"
      }
    ],
    sources: [
      {
        title: "eBay search: Charizard ex 201/165 SAR Japanese",
        url: "https://www.ebay.com/sch/i.html?_nkw=Charizard+ex+201%2F165+SAR+Japanese",
        note: "현재 판매가 확인용"
      },
      {
        title: "SNKRDUNK keyword search",
        url: "https://snkrdunk.com/en/search/result?keyword=Charizard%20ex%20201%2F165",
        note: "일본/글로벌 마켓 확인용"
      },
      {
        title: "KREAM keyword search",
        url: "https://kream.co.kr/search?keyword=Charizard%20ex%20201%2F165",
        note: "국내 마켓 확인용"
      }
    ],
    usedMock: true
  };
}

function fallbackIdentity(input: EstimateRequest): CardIdentity {
  const query = buildInputSearchText(input) || "Unknown Pokemon Card";
  const targetCondition = inferTargetCondition(query, input.cardType);
  const number = query.match(/\d+\/\d+/)?.[0] || "Unknown";
  const isJapanese =
    /일본|일어|japanese|jp\b/i.test(query) || /메가드림|mega\s*dream/i.test(query);
  const rarity = /\bar\b|AR|아트레어/i.test(query) ? "AR" : "Unknown rarity";

  return applyKnownCardCorrections({
    name: query,
    language: isJapanese ? "Japanese" : "Unknown",
    setName: /메가드림|mega\s*dream/i.test(query) ? "Mega Dream ex" : "Unknown set",
    number,
    rarity,
    targetCondition,
    confidence: 55,
    searchQueries: ensureConditionQueries(
      [
        query,
        `${query} Pokemon card`,
        `${query} price`,
        `${query} KREAM`,
        `${query} eBay`
      ],
      targetCondition
    )
  });
}

function applyStructuredInputConstraints(identity: CardIdentity, input: EstimateRequest): CardIdentity {
  const languageMap = {
    japanese: "Japanese",
    english: "English",
    korean: "Korean"
  } as const;

  const pokemonName = cleanString(input.pokemonName);
  const pokemonEntry = pokemonEntryForName(pokemonName || "");
  const forcedName = pokemonEntry?.entry.en || pokemonName || identity.name;
  const forcedNumber = normalizeCardNumber(cleanString(input.cardNumber) || identity.number);
  const forcedLanguage = cleanString(input.language ? languageMap[input.language] : "") || identity.language;
  const forcedGrade =
    input.cardType === "psa" ? cleanString(input.grade) || identity.grade || "10" : identity.grade;
  const forcedGradingCompany = input.cardType === "psa" ? "PSA" : identity.gradingCompany;
  const forcedTargetCondition =
    input.cardType === "psa"
      ? forcedGrade === "9"
        ? "psa9"
        : "psa10"
      : identity.targetCondition;
  const numberHintsPromo = /\bSV-P\b/i.test(forcedNumber);
  const queryHintsPromo = /\bpromo\b|프로모/i.test(`${input.query || ""} ${pokemonName || ""}`);
  const forcedSetName =
    numberHintsPromo || queryHintsPromo
      ? forcedLanguage === "Korean"
        ? "Korean Promo"
        : forcedLanguage === "Japanese"
          ? "Japanese Promo"
          : "Promo"
      : identity.setName;
  const forcedRarity =
    numberHintsPromo || queryHintsPromo
      ? identity.rarity === "Unknown rarity" || /sar|ar|sr/i.test(identity.rarity)
        ? "Promo"
        : identity.rarity
      : identity.rarity;

  const forcedSearchQueries = uniqueNonEmpty([
    ...identity.searchQueries,
    ...expandPokemonNameAliases(pokemonName),
    ...expandPokemonNameAliases(cleanString(input.query)),
    joinSearchParts([forcedName, forcedNumber, forcedSetName, conditionSearchTerm(forcedTargetCondition)]),
    joinSearchParts([forcedName, forcedNumber, forcedLanguage, conditionSearchTerm(forcedTargetCondition)]),
    joinSearchParts([forcedName, forcedNumber, conditionSearchTerm(forcedTargetCondition)]),
    joinSearchParts([forcedNumber, forcedLanguage, conditionSearchTerm(forcedTargetCondition)]),
    joinSearchParts([forcedName, forcedLanguage]),
    joinSearchParts([forcedName, forcedNumber])
  ]).slice(0, 18);

  const forcedWarnings = (identity.validationWarnings || []).filter(
    (warning) => warning !== "language-unknown" && warning !== "number-unknown"
  );

  return applyKnownCardCorrections({
    ...identity,
    name: forcedName,
    number: forcedNumber,
    language: forcedLanguage,
    setName: forcedSetName,
    rarity: forcedRarity,
    grade: forcedGrade,
    gradingCompany: forcedGradingCompany,
    targetCondition: forcedTargetCondition,
    confidence: Math.max(identity.confidence, pokemonName || input.cardNumber || input.language ? 92 : identity.confidence),
    searchQueries: forcedSearchQueries,
    validationWarnings: forcedWarnings
  });
}

function buildInputSearchText(input: EstimateRequest) {
  const languageMap = {
    japanese: "Japanese",
    english: "English",
    korean: "Korean"
  } as const;
  const pokemonName = cleanString(input.pokemonName);
  const pokemonNameAliases = expandPokemonNameAliases(pokemonName);
  const queryAliases = expandPokemonNameAliases(cleanString(input.query));

  const gradeText =
    input.cardType === "psa" ? `PSA ${cleanString(input.grade) || "10"}` : "";

  return [
    ...pokemonNameAliases,
    normalizeCardNumber(cleanString(input.cardNumber)),
    ...queryAliases,
    cleanString(input.language ? languageMap[input.language] : ""),
    gradeText
  ]
    .filter((value) => value && !value.toLowerCase().includes("unknown"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackEstimate(
  identity: CardIdentity,
  marketContext: unknown,
  error: unknown
): EstimateResponse {
  const candidates = [
    ...extractStructuredCandidates(marketContext),
    ...extractUnstructuredCandidates(marketContext, identity)
  ];
  const target = candidates
    .filter((candidate) => candidate.exactMatch)
    .filter((candidate) => (candidate.matchScore ?? 100) >= 70)
    .filter((candidate) => candidate.numberMatch !== false)
    .filter((candidate) => candidate.conditionMatch !== false)
    .filter((candidate) => conditionMatchesTarget(candidate.condition.toLowerCase(), identity.targetCondition))
    .filter((candidate) => candidate.approximateKrw > 0)
    .sort((a, b) => a.approximateKrw - b.approximateKrw);

  const prices = target.map((candidate) => candidate.approximateKrw);
  const lowKrw = prices[0] || 0;
  const highKrw = prices[prices.length - 1] || lowKrw;
  const medianKrw = prices.length > 0 ? medianOf(prices) : 0;
  const message = error instanceof Error ? error.message : "AI 정제가 시간 초과되었습니다.";
  const fallbackMarkets = target
    .slice(0, 6)
    .map((candidate) => ({
      market: candidate.market,
      label: candidate.title,
      priceKrw: candidate.approximateKrw,
      condition: `${candidate.condition} ${candidate.saleType}`,
      category: categorizeCandidate(candidate, identity.targetCondition),
      url: candidate.url
    }))
    .map((market) => scoreMarketQuote(market, identity.targetCondition))
    .sort((a, b) => (b.evidenceScore || 0) - (a.evidenceScore || 0));

  return {
    card: {
      name: identity.name,
      language: identity.language,
      setName: identity.setName,
      number: identity.number,
      rarity: identity.rarity,
      targetCondition: identity.targetCondition,
      confidence: identity.confidence
    },
    price: {
      lowKrw,
      highKrw,
      medianKrw,
      confidence: "low",
      summary:
        prices.length > 0
          ? `AI 정제가 지연되어 구조화 후보 ${prices.length}건만 기준으로 보수 추정했습니다. ${message}`
          : `AI 정제가 지연되었고 조건에 맞는 구조화 가격 후보가 부족합니다. ${message}`
    },
    markets: fallbackMarkets,
    sources: ensureRequiredSources(
      target.slice(0, 6).map((candidate) => ({
        title: candidate.title,
        url: candidate.url,
        note: `${candidate.market} ${candidate.saleType}`
      })),
      identity,
      marketContext
    ),
    usedMock: false
  };
}

function extractStructuredCandidates(marketContext: unknown): PriceCandidate[] {
  if (!marketContext || typeof marketContext !== "object") return [];
  const context = marketContext as { structuredCandidates?: unknown };
  return Array.isArray(context.structuredCandidates)
    ? (context.structuredCandidates as PriceCandidate[])
    : [];
}

function structuredCandidatesToMarkets(marketContext: unknown, identity: CardIdentity): MarketQuote[] {
  return exactStructuredCandidates(marketContext, identity)
    .filter((candidate) => candidate.approximateKrw > 0)
    .map((candidate) => ({
      market: candidate.market,
      label: candidate.title,
      priceKrw: candidate.approximateKrw,
      condition: normalizeCandidateCondition(candidate.title, identity, candidate.saleType),
      category: categorizeCandidate(candidate, identity.targetCondition),
      soldAt: inferSoldDate(candidate.title),
      url: candidate.url
    }))
    .map((market) => scoreMarketQuote(market, identity.targetCondition))
    .sort((a, b) => (b.evidenceScore || 0) - (a.evidenceScore || 0));
}

function exactStructuredCandidates(marketContext: unknown, identity: CardIdentity): PriceCandidate[] {
  return extractStructuredCandidates(marketContext)
    .filter((candidate) => candidate.approximateKrw > 0)
    .filter((candidate) => candidate.numberMatch !== false)
    .filter((candidate) => candidate.conditionMatch !== false || candidate.exactMatch)
    .filter((candidate) => (candidate.matchScore ?? 0) >= 80 || candidate.exactMatch)
    .filter((candidate) => candidateSupportsIdentity(candidate, identity));
}

function mergeMarketQuotes(...groups: MarketQuote[][]) {
  const seen = new Set<string>();
  return groups
    .flat()
    .filter((market) => market.url && market.priceKrw > 0)
    .filter((market) => {
      const key = `${market.market.toLowerCase()}|${market.url}|${market.priceKrw}|${market.condition.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.evidenceScore || 0) - (a.evidenceScore || 0));
}

function inferSoldDate(title: string) {
  return title.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
}

function shouldRejectPriceEstimate(
  identity: CardIdentity,
  exactCandidates: PriceCandidate[],
  normalizedPrice: Pick<PriceEstimate, "lowKrw" | "highKrw" | "medianKrw" | "confidence">
) {
  if (normalizedPrice.medianKrw <= 0) return true;
  if (identity.validationWarnings?.includes("regional-set-mismatch")) return true;
  if (identity.confidence < 72) return true;

  const soldCount = exactCandidates.filter((candidate) => candidate.saleType === "sold").length;
  const listingCount = exactCandidates.filter((candidate) => candidate.saleType === "listing").length;
  const totalCount = exactCandidates.length;
  const hasMeaningfulListingSupport = listingCount >= 1 && totalCount >= 2;

  if (identity.targetCondition === "psa10" || identity.targetCondition === "psa9") {
    return soldCount < 1 && !hasMeaningfulListingSupport;
  }

  return soldCount < 1 && !hasMeaningfulListingSupport;
}

function candidateSupportsIdentity(candidate: PriceCandidate, identity: CardIdentity) {
  const haystack = `${candidate.title} ${candidate.url}`.toLowerCase();
  if (!contextMatchesIdentity(candidate.title, candidate.url, identity)) return false;

  const signals = setSignalsForIdentity(identity);
  if (signals.required && !signals.signals.some((signal) => haystack.includes(signal))) {
    return false;
  }

  return true;
}

function setSignalsForIdentity(identity: CardIdentity) {
  const setCode = setCodeFromIdentity(identity).toLowerCase();
  const tokenCandidates = identity.setName
    .toLowerCase()
    .split(/[^a-z0-9가-힣ぁ-ゟ゠-ヿ一-龯]+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !["pokemon", "class", "pack", "high", "card", "the", "set"].includes(token));

  return {
    required: identity.setName !== "Unknown set" || Boolean(setCode),
    signals: uniqueNonEmpty([setCode, ...tokenCandidates])
  };
}

function hasRegionalSetMismatch(identity: CardIdentity) {
  const language = identity.language.toLowerCase();
  const setName = identity.setName.toLowerCase();
  const setCode = setCodeFromIdentity(identity).toLowerCase();
  const asciiOnlySet = /^[a-z0-9 :&'\\-]+$/.test(setName);
  const englishMainSet =
    /(paldea evolved|obsidian flames|paradox rift|temporal forces|twilight masquerade|stellar crown|surging sparks|journey together|scarlet & violet 151)/.test(
      setName
    );

  if (language.includes("japanese")) {
    if (englishMainSet) return true;
    if (asciiOnlySet && !setCode && setName !== "unknown set") return true;
  }

  if (language.includes("korean") && englishMainSet) return true;

  return false;
}

function extractUnstructuredCandidates(
  marketContext: unknown,
  identity: CardIdentity
): PriceCandidate[] {
  const text = JSON.stringify(marketContext);
  const urls = [...text.matchAll(/https?:\/\/[^"\\\s)]+/g)].map((match) => match[0]);
  const krwMatches = [...text.matchAll(/(\d{1,3}(?:,\d{3})+|\d{5,7})\s*(?:원|KRW)/g)];
  const usdMatches = [...text.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)];
  const candidates: PriceCandidate[] = [];

  krwMatches.slice(0, 8).forEach((match, index) => {
    const price = Number(match[1].replace(/,/g, ""));
    const context = surroundingText(text, match.index || 0);
    if (!price || !contextMatchesIdentity(context, urls[index], identity)) return;
    candidates.push(makeFallbackCandidate(identity, price, "KRW", urls[index], context));
  });

  usdMatches.slice(0, 8).forEach((match, index) => {
    const price = Number(match[1]);
    const context = surroundingText(text, match.index || 0);
    if (!price || !contextMatchesIdentity(context, urls[index], identity)) return;
    candidates.push(makeFallbackCandidate(identity, price, "USD", urls[index], context));
  });

  return candidates;
}

function surroundingText(text: string, index: number) {
  return text.slice(Math.max(0, index - 240), Math.min(text.length, index + 240));
}

function contextMatchesIdentity(context: string, url: string | undefined, identity: CardIdentity) {
  const haystack = `${context} ${url || ""}`.toLowerCase();
  const condition = conditionSearchTerm(identity.targetCondition).toLowerCase();
  const normalizedCondition = condition.replace(/\s+/g, "");
  const number = identity.number.toLowerCase();
  const compactNumber = number.replace("/", "");
  const setCode = setCodeFromIdentity(identity).toLowerCase();
  const setName = identity.setName.toLowerCase();
  const rarity = identity.rarity.toLowerCase();
  const hasCondition =
    identity.targetCondition === "raw" ||
    haystack.includes(condition) ||
    haystack.replace(/\s+/g, "").includes(normalizedCondition);
  const hasNumber =
    number === "unknown" ||
    haystack.includes(number) ||
    haystack.includes(compactNumber) ||
    haystack.includes(number.replace("/", "-"));
  const hasName = identityNameCandidates(identity).some((name) => cardNameMatchesTitle(haystack, name));
  const requiresVariantSignal = isStandardTcgWithNumber(identity) && identity.targetCondition !== "raw";
  const hasRarity = rarity === "unknown rarity" || haystack.includes(rarity);
  const hasSet =
    !setName ||
    setName === "unknown set" ||
    haystack.includes(setCode) ||
    haystack.includes(setName) ||
    setName
      .split(/[^a-z0-9가-힣ぁ-ゟ゠-ヿ一-龯]+/)
      .filter((token) => token.length >= 3)
      .some((token) => haystack.includes(token));
  const hasVariantSignal = !requiresVariantSignal || hasRarity || hasSet;

  return hasCondition && hasNumber && hasName && hasVariantSignal;
}

function makeFallbackCandidate(
  identity: CardIdentity,
  price: number,
  currency: string,
  url: string | undefined,
  sourceText: string
): PriceCandidate {
  const fallbackUrl =
    url || "https://www.google.com/search?q=" + encodeURIComponent(identity.searchQueries[0]);
  return {
    title: `${identity.name} ${conditionSearchTerm(identity.targetCondition)} candidate`,
    market: guessMarket(fallbackUrl),
    url: fallbackUrl,
    price,
    currency,
    approximateKrw: convertToKrw(price, currency),
    saleType: /sold|거래|체결|판매완료|last sale|completed/i.test(sourceText) ? "sold" : "listing",
    condition: identity.targetCondition,
    language: identity.language,
    exactMatch: true,
    excludeReason: "",
    marketSearchQuery: stripConditionTerms(identity.searchQueries[0] || identity.name),
    matchScore: 100,
    numberMatch: true,
    conditionMatch: true
  };
}

function guessMarket(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes("kream")) return "KREAM";
  if (lower.includes("ebay")) return "eBay";
  if (lower.includes("pricecharting")) return "PriceCharting";
  if (lower.includes("sportscardinvestor")) return "Sports Card Investor";
  if (lower.includes("scrydex")) return "Scrydex";
  if (lower.includes("bunjang")) return "Bunjang";
  return "Web";
}

function applyKnownCardCorrections(identity: CardIdentity): CardIdentity {
  return applyGenericImageEvidenceCorrections(identity);
}

function applyGenericImageEvidenceCorrections(identity: CardIdentity): CardIdentity {
  const image = identity.imageBasedIdentity;
  const label = identity.labelBasedIdentity;
  if (!image && !label) return identity;

  const primary = identity.evidencePriority === "label" && label ? label : image || label;
  if (!primary) return identity;

  const productLine = identity.productLine || primary.productLine;
  const gradingCompany = identity.gradingCompany || primary.gradingCompany;
  const grade = identity.grade || primary.grade;
  const targetCondition =
    gradingCompany === "PSA" && grade === "10" && identity.targetCondition !== "raw"
      ? "psa10"
      : identity.targetCondition;
  const name = isUnknownText(identity.name) ? primary.name || identity.name : identity.name;
  const setName =
    identity.setName === "Unknown set" && productLine
      ? productLineDisplayName(productLine)
      : identity.setName === "Unknown set" && primary.setName !== "Unknown set"
        ? primary.setName
        : identity.setName;
  const rarity =
    identity.rarity === "Unknown rarity" && primary.rarity !== "Unknown rarity"
      ? primary.rarity
      : identity.rarity;
  const language =
    identity.language === "Unknown" && primary.language !== "Unknown" ? primary.language : identity.language;
  const number = identity.number === "Unknown" && primary.number !== "Unknown" ? primary.number : identity.number;
  const year = identity.year || primary.year;
  const certNumber = identity.certNumber || primary.certNumber;
  const condition = conditionSearchTerm(targetCondition);
  const displayProductLine = productLineSearchLabel(productLine, setName);

  return {
    ...identity,
    name,
    language,
    setName,
    number,
    rarity,
    productLine,
    year,
    gradingCompany,
    grade,
    certNumber,
    targetCondition,
    confidence: Math.max(identity.confidence, primary.confidence || 0),
    searchQueries: uniqueNonEmpty([
      ...identity.searchQueries,
      ...(label?.searchQueries || []),
      ...(image?.searchQueries || []),
      joinSearchParts([year, "Pokemon", displayProductLine, name, condition]),
      joinSearchParts(["Pokemon", displayProductLine, name, condition]),
      joinSearchParts([name, displayProductLine, "Pokemon"]),
      certNumber ? joinSearchParts([gradingCompany || "PSA", certNumber, name]) : ""
    ]).slice(0, 18)
  };
}

function isUnknownText(value: string | undefined) {
  return !value || /^unknown\b/i.test(value) || /^unidentified\b/i.test(value);
}

function productLineDisplayName(productLine: string | undefined) {
  const label = productLineSearchLabel(productLine, "Unknown set");
  return label ? `Pokemon ${label}` : "Unknown set";
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error("이미지 데이터 형식이 올바르지 않습니다.");
  }
  return {
    mimeType: match[1],
    base64: match[2]
  };
}

function parseJsonObject(text: string | undefined) {
  if (!text) {
    throw new Error("AI 응답이 비어 있습니다.");
  }

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
    }
    return JSON.parse(match[0]);
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
