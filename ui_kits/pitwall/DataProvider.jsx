/* PitWall runtime data/profile provider. window.PW.DataProvider */
(function () {
  const DEFAULT_PROFILE = {
    name: "",
    favoriteDrivers: [],
    favoriteTeams: [],
    livePanelSizes: null,
  };
  const EMPTY_DATA = {
    drivers: [],
    byCode: {},
    timing: [],
    standings: [],
    constructors: [],
    schedule: [],
    sessions: [],
    news: [],
    insights: [],
    battlePairs: [],
    strategyContext: null,
    presets: [],
    copilot: null,
    race: { name: "Formula 1", circuit: "", loc: "", round: 0, weather: {} },
    seasonSummary: { season: String(new Date().getFullYear()), round: 0, totalRounds: 0 },
    source: "loading",
    sourceLabel: "Loading live data",
    fetchedAt: "",
    errors: [],
  };

  const PitWallContext = React.createContext({
    data: window.PW_DATA || EMPTY_DATA,
    profile: DEFAULT_PROFILE,
    connection: { aiConfigured: false, f1tvConnected: false },
    dataSource: "Loading live data",
    updateProfile: () => {},
    refreshData: () => {},
    refreshConnections: () => {},
  });

  function safeJson(value, fallback) {
    try { return JSON.parse(value); }
    catch { return fallback; }
  }

  function loadProfile() {
    return normalizeProfile({ ...DEFAULT_PROFILE, ...safeJson(localStorage.getItem("pw-profile") || "{}", {}) });
  }

  function clampProfilePanelSize(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.max(min, Math.min(max, Math.round(numeric)));
  }

  function clampProfilePanelPct(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 50;
    return Math.max(min, Math.min(max, Math.round(numeric * 10) / 10));
  }

  function normalizeLivePanelSizes(saved) {
    if (!saved || typeof saved !== "object") return null;
    return {
      timingWidth: clampProfilePanelSize(saved.timingWidth || 340, 260, 560),
      insightsHeight: clampProfilePanelSize(saved.insightsHeight || 280, 180, 460),
      focusOnboardHeight: clampProfilePanelSize(saved.focusOnboardHeight || 220, 150, 380),
      battleSplit: clampProfilePanelPct(saved.battleSplit || 50, 28, 72),
      quadCol: clampProfilePanelPct(saved.quadCol || 50, 28, 72),
      quadRow: clampProfilePanelPct(saved.quadRow || 50, 28, 72),
      dataColA: clampProfilePanelPct(saved.dataColA || 33, 20, 60),
      dataColB: clampProfilePanelPct(saved.dataColB || 33, 18, 60),
      dataRow: clampProfilePanelPct(saved.dataRow || 50, 28, 72),
    };
  }

  function normalizeProfile(profile = {}) {
    return {
      name: String(profile.name || ""),
      favoriteDrivers: Array.isArray(profile.favoriteDrivers) ? profile.favoriteDrivers : [],
      favoriteTeams: Array.isArray(profile.favoriteTeams) ? profile.favoriteTeams : [],
      livePanelSizes: normalizeLivePanelSizes(profile.livePanelSizes),
    };
  }

  function profileHasContent(profile) {
    return Boolean(profile?.name || profile?.favoriteDrivers?.length || profile?.favoriteTeams?.length || profile?.livePanelSizes);
  }

  function persistProfile(profile) {
    const next = normalizeProfile(profile);
    localStorage.setItem("pw-profile", JSON.stringify(next));
    if (window.pitwall?.profile?.set) {
      window.pitwall.profile.set(next).catch(() => {});
    }
  }

  function buildByCode(drivers) {
    return Object.fromEntries((drivers || []).map((driver) => [driver.code, driver]));
  }

  function mergeRowsByKey(baseRows, incomingRows, key) {
    const base = new Map((baseRows || []).map((row) => [row[key], row]));
    return (incomingRows || []).map((row) => ({ ...(base.get(row[key]) || {}), ...row }));
  }

  function mergeData(base, incoming) {
    const merged = {
      ...EMPTY_DATA,
      ...(base || {}),
      ...(incoming || {}),
      drivers: incoming?.drivers?.length ? mergeRowsByKey(base?.drivers, incoming.drivers, "code") : (base?.drivers || []),
      constructors: incoming?.constructors?.length ? mergeRowsByKey(base?.constructors, incoming.constructors, "abbr") : (base?.constructors || []),
      standings: incoming?.standings || base?.standings || [],
      timing: incoming?.timing || base?.timing || [],
      schedule: incoming?.schedule || base?.schedule || [],
      sessions: incoming?.sessions || base?.sessions || [],
      news: incoming?.news || base?.news || [],
      insights: incoming?.insights || base?.insights || [],
      battlePairs: incoming?.battlePairs || base?.battlePairs || [],
      strategyContext: incoming?.strategyContext || base?.strategyContext || null,
      presets: incoming?.presets?.length ? incoming.presets : (base?.presets || []),
      copilot: incoming?.copilot || base?.copilot || null,
      race: { ...EMPTY_DATA.race, ...(base?.race || {}), ...(incoming?.race || {}) },
      seasonSummary: { ...EMPTY_DATA.seasonSummary, ...(base?.seasonSummary || {}), ...(incoming?.seasonSummary || {}) },
    };
    merged.byCode = incoming?.byCode || buildByCode(merged.drivers);
    Object.assign(window.PW_DATA, merged);
    return merged;
  }

  function DataProvider({ children }) {
    const [data, setData] = React.useState(() => mergeData(EMPTY_DATA, window.PW_DATA || {}));
    const [profile, setProfile] = React.useState(loadProfile);
    const [connection, setConnection] = React.useState({ aiConfigured: false, f1tvConnected: false });
    const enrichmentTimerRef = React.useRef(null);

    const profileComplete = Boolean(
      profile.name.trim() &&
      profile.favoriteDrivers.length &&
      profile.favoriteTeams.length &&
      connection.aiConfigured &&
      connection.f1tvConnected
    );

    const dataSource = data.sourceLabel || (data.source === "live" ? "Live data" : "Waiting for live data");

    async function refreshData() {
      if (!window.pitwall?.data?.snapshot) return;
      try {
        const snapshot = await window.pitwall.data.snapshot();
        setData((current) => mergeData(current, snapshot));
        if (snapshot?.enrichmentPending) {
          clearTimeout(enrichmentTimerRef.current);
          enrichmentTimerRef.current = setTimeout(refreshData, 2500);
        }
      } catch {
        setData((current) => ({ ...current, source: "error", sourceLabel: "Live data unavailable" }));
      }
    }

    async function refreshConnections() {
      const next = { aiConfigured: false, f1tvConnected: false };
      try {
        const keys = window.pitwall?.keys;
        const authStatus = await window.pitwall?.ai?.authStatus?.().catch(() => null);
        if (keys) {
          const [anthropic, openai] = await Promise.all([keys.get("anthropic"), keys.get("openai")]);
          next.aiConfigured = Boolean(anthropic || openai || authStatus?.codexConnected || authStatus?.grokConnected);
        } else {
          next.aiConfigured = Boolean(authStatus?.codexConnected || authStatus?.grokConnected);
        }
      } catch {}
      try {
        const status = await (window.pitwall?.f1tv?.probeStatus?.({ timeoutMs: 1200 }) || window.pitwall?.f1tv?.status?.());
        next.f1tvConnected = Boolean(status?.authenticated);
      } catch {}
      setConnection(next);
    }

    function updateProfile(patch) {
      setProfile((current) => {
        const next = normalizeProfile({ ...current, ...patch });
        persistProfile(next);
        return next;
      });
    }

    React.useEffect(() => {
      let mounted = true;
      (async () => {
        if (!window.pitwall?.profile?.get) return;
        try {
          const persisted = normalizeProfile(await window.pitwall.profile.get());
          const local = loadProfile();
          const next = profileHasContent(persisted) ? {
            ...local,
            ...persisted,
            livePanelSizes: persisted.livePanelSizes != null ? persisted.livePanelSizes : local.livePanelSizes,
          } : local;
          if (mounted) setProfile(next);
          if (profileHasContent(next)) persistProfile(next);
        } catch {}
      })();
      refreshData();
      refreshConnections();
      const timer = setInterval(refreshData, 1000 * 60 * 3);
      return () => {
        mounted = false;
        clearInterval(timer);
        clearTimeout(enrichmentTimerRef.current);
      };
    }, []);

    const value = {
      data,
      profile,
      connection,
      profileComplete,
      dataSource,
      updateProfile,
      refreshData,
      refreshConnections,
    };
    return <PitWallContext.Provider value={value}>{children}</PitWallContext.Provider>;
  }

  function usePitWall() {
    return React.useContext(PitWallContext);
  }

  window.PW = window.PW || {};
  window.PW.DataProvider = DataProvider;
  window.PW.usePitWall = usePitWall;
})();
