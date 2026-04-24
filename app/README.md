# 고몽스캐너 (GoMong Scanner) — Design Prototype

포켓몬 카드 사진/텍스트로 현재 시세를 빠르게 확인하는 AI 기반 시세 스캐너 앱의 **하이파이 디자인 프로토타입**.

## 📁 파일 구조

```
/
├── index.html              ← Design Canvas (여러 화면 나란히 보기)
├── prototype.html          ← 풀 플로우 단독 프로토타입 (모바일 1:1)
├── design-canvas.jsx       ← 캔버스 스타터 (수정 X)
│
├── src/
│   ├── tokens.jsx          ← 디자인 토큰 (색/타입/spacing/shadow)
│   │
│   ├── components/         ← 재사용 컴포넌트 (UI Kit)
│   │   ├── StatusBar.jsx   ← iOS 스타일 상태바 (9:41, 배터리)
│   │   ├── TabBar.jsx      ← 하단 탭바 (Scan / Search / Library)
│   │   ├── Button.jsx      ← Primary / Ghost / Icon
│   │   ├── Chip.jsx        ← Single/PSA 태그 · 레어도 칩
│   │   ├── Card.jsx        ← 카드 썸네일 + 홀로그래픽 효과
│   │   ├── ScanFrame.jsx   ← 카메라 뷰 스캔 프레임 (코너 + 레이저)
│   │   ├── PriceBar.jsx    ← 가격 범위 슬라이더 (min ~ mid ~ max)
│   │   └── MarketRow.jsx   ← 마켓별 시세 행 (KREAM/eBay/…)
│   │
│   ├── screens/            ← 화면 단위 컴포넌트
│   │   ├── Home.jsx        ← 홈 = 카메라 스캐너 뷰
│   │   ├── Scanning.jsx    ← AI 분석 애니메이션 (단계 비주얼라이저)
│   │   ├── Result.jsx      ← 시세 결과
│   │   ├── Search.jsx      ← 텍스트 검색 + 자동완성
│   │   └── Collection.jsx  ← 보관함 (카드 그리드)
│   │
│   ├── data/
│   │   └── mock.jsx        ← 목 카드/가격 데이터
│   │
│   └── App.jsx             ← 플로우 라우터 (화면 전환 상태 관리)
│
└── assets/                 ← (차후 실제 이미지 드롭)
```

## 🎨 디자인 시스템

- **모드**: 다크 (기본), 라이트 아님
- **타이포**: Pretendard + JetBrains Mono (가격/번호)
- **포인트 컬러**:
  - `--gomong-yellow`: `#FFCB05` (주요 CTA, 강조)
  - 홀로 그라디언트: 바이올렛 #A78BFA → 핑크 #F472B6 → 블루 #60A5FA
- **뉴트럴**: oklch 기반 다크 스케일 (`--bg-0` ~ `--bg-3`, `--fg-0` ~ `--fg-3`)
- 토큰은 전부 `src/tokens.jsx` 안의 `TOKENS` 객체 + `<style>` CSS 변수로 노출

## 🧭 주요 화면 플로우

1. **Home (스캐너)** → 카드를 프레임 안에 맞춤 → 셔터
2. **Scanning** → AI 단계 애니메이션 (인식 → 정규화 → 마켓 수집 → 완료)
3. **Result** → 카드 히어로 + 시세 범위 바 + 중간값 + 마켓 리스트 + 저장
4. **Search** → 텍스트 입력 (Single/PSA 토글) → Result
5. **Collection** → 저장된 카드 그리드 + 총 컬렉션 가치

## 🛠 바이브코딩 인수인계 메모

- `src/components/*` 는 **순수 프레젠테이션 컴포넌트** — props만 받고 렌더. 실제 API 붙일 때 수정 불필요.
- `src/screens/*` 은 **상태 + 레이아웃** 담당. 여기서 API fetch/스테이트 훅 붙이면 됨.
- `src/App.jsx` 의 `screen` state를 React Router로 치환 가능.
- `src/data/mock.jsx` 는 그대로 API 응답 스키마의 레퍼런스로 사용.
- 모든 사이즈는 `390 × 844` (iPhone 14 Pro 프레임) 기준.
- 홀로그래픽 카드 효과는 CSS `background: conic-gradient + mix-blend-mode`. 실제 카드 이미지 올리면 아래에 깔아도 자연스러움.

## ⚠️ IP 주의

포켓몬 캐릭터 / 카드 아트는 **플레이스홀더**로 표현. 실제 이미지는 사용자 업로드 or 퍼블릭 API 에셋으로 교체 예정. 브랜드명 "고몽스캐너" 및 UI 는 자체 오리지널.
