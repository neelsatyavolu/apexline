/* Apexline runtime data/profile provider. window.PW.DataProvider */
(function () {
  const DEFAULT_PROFILE = {
    name: "",
    profileImageUrl: "",
    favoriteDrivers: [],
    favoriteTeams: [],
    livePanelSizes: null,
    liveCustomLayouts: null,
  };
  const EMPTY_DATA = {
    drivers: [],
    byCode: {},
    timing: [],
    standings: [],
    constructors: [],
    driverProfiles: {},
    teamProfiles: [],
    driverForm: {},
    formRounds: [],
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

  const LOADING_STEPS = [
    "Loading championship standings",
    "Loading race schedule",
    "Loading track weather",
    "Loading F1 news",
    "Checking Apexline connections",
  ];

  function ensureLoadingStyles() {
    if (document.getElementById("pw-startup-loading-styles")) return;
    const el = document.createElement("style");
    el.id = "pw-startup-loading-styles";
    el.textContent = `
    .startup-load { min-height: 100vh; display: grid; place-items: center; padding: 44px; background:
      radial-gradient(circle at 18% 18%, rgba(232,0,32,.16), transparent 30%),
      linear-gradient(135deg, #080b11 0%, #111821 52%, #090c12 100%); color: var(--text-primary); }
    .startup-load__panel { width: min(560px, 100%); border: 1px solid var(--border-default); border-radius: var(--radius-lg); background: rgba(13,18,27,.86); box-shadow: 0 24px 80px rgba(0,0,0,.45); padding: 30px; }
    .startup-load__kicker { color: var(--accent); font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
    .startup-load__title { margin: 10px 0 8px; font-family: var(--font-display); font-size: var(--text-4xl); line-height: 1; color: var(--text-strong); }
    .startup-load__copy { margin: 0; color: var(--text-secondary); font-size: var(--text-md); line-height: 1.45; }
    .startup-load__bar { position: relative; height: 8px; margin: 24px 0 20px; overflow: hidden; border-radius: var(--radius-pill); background: var(--bg-sunken); }
    .startup-load__bar span { position: absolute; inset: 0 auto 0 0; width: 42%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), #ffffff); animation: pwStartupLoad 1.15s ease-in-out infinite; }
    .startup-load__steps { display: grid; gap: 10px; margin-top: 6px; }
    .startup-load__step { display: flex; align-items: center; gap: 10px; color: var(--text-secondary); font-size: var(--text-sm); }
    .startup-load__dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 18px rgba(232,0,32,.55); animation: pwStartupPulse 1s ease-in-out infinite; }
    .startup-load__error { margin-top: 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; color: var(--text-secondary); font-size: var(--text-sm); }
    .startup-load__retry { border: 1px solid var(--border-default); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text-primary); padding: 8px 12px; font: inherit; cursor: pointer; }
    .startup-load__retry:hover { border-color: var(--accent-border); color: var(--text-strong); }
    @keyframes pwStartupLoad { 0% { transform: translateX(-105%); } 55%,100% { transform: translateX(245%); } }
    @keyframes pwStartupPulse { 0%,100% { opacity: .45; transform: scale(.88); } 50% { opacity: 1; transform: scale(1); } }
    `;
    document.head.appendChild(el);
  }

  function PitWallLoadingScreen({ error, onRetry }) {
    ensureLoadingStyles();
    return (
      <div className="startup-load">
        <section className="startup-load__panel" aria-live="polite" aria-busy="true">
          <div className="startup-load__kicker">Apexline is warming up</div>
          <h1 className="startup-load__title">Fetching the live paddock picture.</h1>
          <p className="startup-load__copy">Hang tight while Apexline pulls fresh F1 data before opening the dashboard.</p>
          <div className="startup-load__bar"><span /></div>
          <div className="startup-load__steps">
            {LOADING_STEPS.map((step) => (
              <div className="startup-load__step" key={step}><span className="startup-load__dot" />{step}</div>
            ))}
          </div>
          {error ? (
            <div className="startup-load__error">
              <span>{error}</span>
              <button className="startup-load__retry" type="button" onClick={onRetry}>Retry</button>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

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
  function clampProfileTickerRows(value) {
    return clampProfilePanelSize(value || 3, 1, 3);
  }

  function normalizeLivePanelSizes(saved) {
    if (!saved || typeof saved !== "object") return null;
    return {
      timingWidth: clampProfilePanelSize(saved.timingWidth || 340, 260, 560),
      insightsHeight: clampProfilePanelSize(saved.insightsHeight || 280, 180, 460),
      focusOnboardHeight: clampProfilePanelSize(saved.focusOnboardHeight || 220, 150, 380),
      broadcastTickerRows: clampProfileTickerRows(saved.broadcastTickerRows),
      battleSplit: clampProfilePanelPct(saved.battleSplit || 50, 28, 72),
      quadCol: clampProfilePanelPct(saved.quadCol || 50, 28, 72),
      quadRow: clampProfilePanelPct(saved.quadRow || 50, 28, 72),
      dataColA: clampProfilePanelPct(saved.dataColA || 33, 20, 60),
      dataColB: clampProfilePanelPct(saved.dataColB || 33, 18, 60),
      dataRow: clampProfilePanelPct(saved.dataRow || 50, 28, 72),
    };
  }

  function normalizeProfileImageUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.length > 3 * 1024 * 1024) return "";
    if (/^(https?:|file:)/i.test(text)) return text;
    if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(text)) return text;
    return /^[./][^<>"]+\.(?:png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(text) ? text : "";
  }

  function normalizeVideoQuality(value) {
    const text = String(value || "").trim().toLowerCase();
    return ["max", "high", "medium", "low"].includes(text) ? text : "";
  }

  function normalizeProfileCustomTileSource(raw = {}) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.type === "timing") return { type: "timing" };
    if (raw.type === "onboard" && typeof raw.code === "string" && raw.code) return { type: "onboard", code: raw.code.slice(0, 16) };
    if (raw.type === "channel" && typeof raw.feedId === "string" && raw.feedId) return { type: "channel", feedId: raw.feedId.slice(0, 80) };
    return null;
  }

  function profileCustomTileSourceKey(source) {
    if (!source) return "";
    if (source.type === "timing") return "timing";
    if (source.type === "onboard") return "onboard:" + source.code;
    if (source.type === "channel") return "channel:" + source.feedId;
    return "";
  }

  function clampProfileCustomTileGeometry(rect = {}) {
    const numeric = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const round = (value) => Math.round(value * 10) / 10;
    const w = round(Math.min(100, Math.max(12, numeric(rect.w, 32))));
    const h = round(Math.min(100, Math.max(12, numeric(rect.h, 32))));
    const x = round(Math.min(100 - w, Math.max(0, numeric(rect.x, 0))));
    const y = round(Math.min(100 - h, Math.max(0, numeric(rect.y, 0))));
    return { x, y, w, h };
  }

  function normalizeProfileCustomLayouts(raw) {
    if (!raw || typeof raw !== "object") return null;
    const seenLayoutIds = new Set();
    const layouts = (Array.isArray(raw.layouts) ? raw.layouts : [])
      .filter((layout) => layout && typeof layout === "object" && typeof layout.id === "string" && layout.id)
      .filter((layout) => (seenLayoutIds.has(layout.id) ? false : (seenLayoutIds.add(layout.id), true)))
      .slice(0, 24)
      .map((layout) => {
        const seenSources = new Set();
        const tiles = (Array.isArray(layout.tiles) ? layout.tiles : [])
          .slice(0, 64)
          .map((tile) => {
            const source = normalizeProfileCustomTileSource(tile?.source);
            const sourceKey = profileCustomTileSourceKey(source);
            if (!source || seenSources.has(sourceKey)) return null;
            seenSources.add(sourceKey);
            return {
              id: typeof tile.id === "string" && tile.id ? tile.id.slice(0, 80) : "t-" + sourceKey,
              source,
              ...clampProfileCustomTileGeometry(tile),
              tickerRows: clampProfilePanelSize(tile.tickerRows || 0, 0, 4),
              tickerHeight: clampProfilePanelSize(tile.tickerHeight || 140, 64, 320),
            };
          })
          .filter(Boolean);
        return {
          id: layout.id.slice(0, 80),
          name: String(layout.name || "").trim().slice(0, 80) || "Custom layout",
          tiles,
        };
      });
    return { layouts };
  }

  function normalizeProfile(profile = {}) {
    return {
      name: String(profile.name || ""),
      profileImageUrl: normalizeProfileImageUrl(profile.profileImageUrl),
      favoriteDrivers: Array.isArray(profile.favoriteDrivers) ? profile.favoriteDrivers : [],
      favoriteTeams: Array.isArray(profile.favoriteTeams) ? profile.favoriteTeams : [],
      livePanelSizes: normalizeLivePanelSizes(profile.livePanelSizes),
      liveCustomLayouts: normalizeProfileCustomLayouts(profile.liveCustomLayouts),
      videoQuality: normalizeVideoQuality(profile.videoQuality),
    };
  }

  function profileHasContent(profile) {
    return Boolean(profile?.name || profile?.profileImageUrl || profile?.favoriteDrivers?.length || profile?.favoriteTeams?.length || profile?.livePanelSizes || profile?.liveCustomLayouts || profile?.videoQuality);
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

  function copilotDailyUpdatedAtMs(daily) {
    const value = Date.parse(daily?.updatedAt || daily?.generatedAt || daily?.progress?.updatedAt || "");
    return Number.isFinite(value) ? value : 0;
  }

  function copilotDailyProgressRank(daily) {
    if (daily?.status === "ready") return Number.MAX_SAFE_INTEGER;
    const progress = daily?.progress || {};
    const items = Array.isArray(progress.items) ? progress.items : [];
    const itemRank = items.reduce((rank, item) => {
      if (item?.status === "computed") return Math.max(rank, (rank || 0) + 2);
      if (item?.status === "thinking" || item?.status === "failed") return Math.max(rank, (rank || 0) + 1);
      return rank;
    }, 0);
    const completedRank = Math.max(0, Number(progress.completedPages || 0) || 0) * 2;
    return Math.max(itemRank, completedRank);
  }

  function shouldKeepCurrentCopilotDaily(current, incoming) {
    if (!current || !incoming) return false;
    const currentTime = copilotDailyUpdatedAtMs(current);
    const incomingTime = copilotDailyUpdatedAtMs(incoming);
    if (currentTime && incomingTime && incomingTime < currentTime) return true;
    if (currentTime && incomingTime && incomingTime > currentTime) return false;
    return copilotDailyProgressRank(incoming) < copilotDailyProgressRank(current);
  }

  function mergeCopilotData(base, incoming) {
    if (!incoming) return base || null;
    if (!base) return incoming;
    if (!incoming.daily) return { ...base, ...incoming, daily: base.daily };
    const daily = shouldKeepCurrentCopilotDaily(base.daily, incoming.daily) ? base.daily : incoming.daily;
    return { ...base, ...incoming, daily };
  }

  function isCancelledF12026RaceName(value) {
    const text = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return /\bbahrain grand prix\b/.test(text) || /\bsaudi arabian grand prix\b/.test(text);
  }

  function normalizeScheduleRoundOrder(schedule) {
    const rows = Array.isArray(schedule) ? schedule.slice() : [];
    if (!rows.some((race) => isCancelledF12026RaceName(race?.name || race?.raceName))) return rows;
    return rows
      .filter((race) => !isCancelledF12026RaceName(race?.name || race?.raceName))
      .map((race, index) => ({ ...race, rnd: index + 1 }));
  }

  function isF12026ScheduleData(data) {
    const season = Number(data?.seasonSummary?.year || data?.seasonSummary?.season || data?.season);
    if (season) return season === 2026;
    return (data?.schedule || []).some((race) => {
      const startsAt = Date.parse(race?.startsAt || race?.dateStart || race?.date_start || "");
      return Number.isFinite(startsAt) && new Date(startsAt).getUTCFullYear() === 2026;
    });
  }

  function normalizeScheduleData(data) {
    if (!isF12026ScheduleData(data)) return data;
    const schedule = normalizeScheduleRoundOrder(data.schedule);
    if (schedule === data.schedule) return data;
    const currentRace = schedule.find((race) => data.race?.startsAt && race.startsAt === data.race.startsAt)
      || schedule.find((race) => data.race?.name && race.name === data.race.name)
      || schedule.find((race) => race.status === "live")
      || schedule.find((race) => race.status === "upcoming")
      || schedule.at(-1);
    return {
      ...data,
      schedule,
      sessions: currentRace?.sessions || data.sessions || [],
      race: { ...(data.race || {}), round: currentRace?.rnd || data.race?.round || 0 },
      seasonSummary: { ...(data.seasonSummary || {}), round: currentRace?.rnd || data.seasonSummary?.round || 0, totalRounds: schedule.length || data.seasonSummary?.totalRounds || 0 },
    };
  }

  function mergeData(base, incoming) {
    const merged = normalizeScheduleData({
      ...EMPTY_DATA,
      ...(base || {}),
      ...(incoming || {}),
      drivers: incoming?.drivers?.length ? mergeRowsByKey(base?.drivers, incoming.drivers, "code") : (base?.drivers || []),
      constructors: incoming?.constructors?.length ? mergeRowsByKey(base?.constructors, incoming.constructors, "abbr") : (base?.constructors || []),
      standings: incoming?.standings?.length ? incoming.standings : base?.standings || [],
      driverForm: incoming?.driverForm || base?.driverForm || {},
      formRounds: incoming?.formRounds?.length ? incoming.formRounds : base?.formRounds || [],
      timing: incoming?.timing || base?.timing || [],
      schedule: incoming?.schedule?.length ? incoming.schedule : base?.schedule || [],
      sessions: incoming?.sessions || base?.sessions || [],
      news: incoming?.news || base?.news || [],
      insights: incoming?.insights || base?.insights || [],
      battlePairs: incoming?.battlePairs || base?.battlePairs || [],
      strategyContext: incoming?.strategyContext || base?.strategyContext || null,
      presets: incoming?.presets?.length ? incoming.presets : (base?.presets || []),
      copilot: mergeCopilotData(base?.copilot, incoming?.copilot),
      race: { ...EMPTY_DATA.race, ...(base?.race || {}), ...(incoming?.race || {}) },
      seasonSummary: { ...EMPTY_DATA.seasonSummary, ...(base?.seasonSummary || {}), ...(incoming?.seasonSummary || {}) },
    });
    merged.byCode = incoming?.byCode || buildByCode(merged.drivers);
    // Re-derive driver/team profiles by merging live season numbers over the
    // static career/bio reference (see buildProfiles in data.js). Runs on every
    // snapshot so the Drivers/Teams screens always reflect the latest live data.
    if (typeof window.PW_BUILD_PROFILES === "function") {
      const built = window.PW_BUILD_PROFILES(merged);
      merged.driverProfiles = built.driverProfiles;
      merged.teamProfiles = built.teamProfiles;
      merged.formRounds = built.formRounds;
    }
    Object.assign(window.PW_DATA, merged);
    return merged;
  }

  function DataProvider({ children }) {
    const [data, setData] = React.useState(() => mergeData(EMPTY_DATA, window.PW_DATA || {}));
    const [profile, setProfile] = React.useState(loadProfile);
    const [connection, setConnection] = React.useState({ aiConfigured: false, f1tvConnected: false });
    const hasRuntimeDataBridge = Boolean(window.pitwall?.data?.snapshot);
    const [initialDataReady, setInitialDataReady] = React.useState(!hasRuntimeDataBridge);
    const [initialLoadError, setInitialLoadError] = React.useState("");
    const enrichmentTimerRef = React.useRef(null);

    const profileComplete = Boolean(
      profile.name.trim() &&
      profile.favoriteDrivers.length &&
      profile.favoriteTeams.length &&
      connection.aiConfigured &&
      connection.f1tvConnected
    );

    const dataSource = data.sourceLabel || (data.source === "live" ? "Live data" : "Waiting for live data");

    async function refreshData(options = {}) {
      if (!window.pitwall?.data?.snapshot) return;
      try {
        if (options.initial) setInitialLoadError("");
        const snapshot = options.forceRefresh
          ? await window.pitwall.data.snapshot({ forceRefresh: true, forceCopilotRefresh: Boolean(options.forceCopilotRefresh) })
          : await window.pitwall.data.snapshot();
        setData((current) => mergeData(current, snapshot));
        if (options.initial) setInitialDataReady(true);
        if (snapshot?.enrichmentPending) {
          clearTimeout(enrichmentTimerRef.current);
          enrichmentTimerRef.current = setTimeout(refreshData, 2500);
        }
      } catch {
        setData((current) => ({ ...current, source: "error", sourceLabel: "Live data unavailable" }));
        if (options.initial) setInitialLoadError("Fresh live data is unavailable right now.");
      }
    }

    async function refreshConnections() {
      const next = { aiConfigured: false, f1tvConnected: false };
      try {
        const authStatus = await window.pitwall?.ai?.authStatus?.().catch(() => null);
        next.aiConfigured = Boolean(authStatus?.codexConnected || authStatus?.grokConnected);
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
            liveCustomLayouts: persisted.liveCustomLayouts != null ? persisted.liveCustomLayouts : local.liveCustomLayouts,
            videoQuality: persisted.videoQuality != null && persisted.videoQuality !== "" ? persisted.videoQuality : local.videoQuality,
          } : local;
          if (mounted) setProfile(next);
          if (profileHasContent(next)) persistProfile(next);
        } catch {}
      })();
      refreshData({ forceRefresh: true, initial: true });
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
    if (!initialDataReady) {
      return <PitWallContext.Provider value={value}><PitWallLoadingScreen error={initialLoadError} onRetry={() => refreshData({ forceRefresh: true, initial: true })} /></PitWallContext.Provider>;
    }
    return <PitWallContext.Provider value={value}>{children}</PitWallContext.Provider>;
  }

  function usePitWall() {
    return React.useContext(PitWallContext);
  }

  window.PW = window.PW || {};
  window.PW.DataProvider = DataProvider;
  window.PW.usePitWall = usePitWall;
})();
