// ============================================================
// App — 화면 전환 플로우 컨트롤러
// ============================================================
// 현재 state 기반 라우팅. 실제 앱에선 React Router로 대체.
// ============================================================

function App({ initialScreen = "home" }) {
  const [screen, setScreen] = React.useState(initialScreen);
  const [saved, setSaved] = React.useState(false);

  const go = (s) => setScreen(s);

  return (
    <div className="gm-frame" style={{
      position: "relative", width: "100%", height: "100%",
      background: "var(--gm-bg0)", overflow: "hidden",
      borderRadius: "inherit",
    }}>
      {screen === "home" && (
        <Home
          onCapture={() => go("scanning")}
          onOpenSearch={() => go("search")}
          onOpenUpload={() => go("scanning")}
        />
      )}
      {screen === "scanning" && (
        <Scanning onDone={() => go("result")} />
      )}
      {screen === "result" && (
        <Result
          saved={saved}
          onSave={() => setSaved(s => !s)}
          onBack={() => go("home")}
        />
      )}
      {screen === "search" && (
        <Search
          onBack={() => go("home")}
          onSubmit={() => go("scanning")}
        />
      )}
      {screen === "collection" && (
        <Collection
          onOpenCard={() => go("result")}
          onBack={() => go("home")}
        />
      )}

      {/* 탭바 — 스캐닝 중엔 숨김 */}
      {screen !== "scanning" && (
        <TabBar
          active={screen === "home" ? "scan" : screen === "collection" ? "collection" : screen === "search" ? "search" : "scan"}
          onChange={(k) => go(k === "scan" ? "home" : k)}
        />
      )}
    </div>
  );
}

Object.assign(window, { App });
