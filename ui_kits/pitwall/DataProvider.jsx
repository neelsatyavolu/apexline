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
  const STARTUP_NEWS_RETRY_MS = 800;
  const STARTUP_WAIT_MAX_ATTEMPTS = 3;
  const SEEDED_CONSTRUCTOR_ROWS = (window.PW_DATA?.constructors || []).map((row) => ({ ...row }));

  function ensureLoadingStyles() {
    if (document.getElementById("pw-startup-loading-styles")) return;
    const el = document.createElement("style");
    el.id = "pw-startup-loading-styles";
    el.textContent = `
    .startup-load { min-height: 100vh; display: grid; place-items: center; padding: 32px; background: #07090d; color: var(--text-primary); }
    .startup-load__panel { width: min(400px, 100%); text-align: center; }
    .startup-load__mark { width: 56px; height: 56px; margin: 0 auto 18px; border-radius: 16px; display: block; box-shadow: 0 12px 32px rgba(0,0,0,.35); }
    .startup-load__kicker { color: var(--accent); font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
    .startup-load__title { margin: 10px 0 8px; font-family: var(--font-display); font-size: var(--text-3xl); line-height: 1.05; color: var(--text-strong); }
    .startup-load__copy { margin: 0 auto; max-width: 34ch; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.45; }
    .startup-load__bar { position: relative; height: 3px; margin: 22px auto 20px; overflow: hidden; border-radius: var(--radius-pill); background: rgba(255,255,255,.08); }
    .startup-load__bar span { position: absolute; inset: 0 auto 0 0; width: 38%; border-radius: inherit; background: var(--accent); animation: pwStartupLoad 1.05s ease-in-out infinite; }
    .startup-load__steps { display: grid; gap: 8px; margin: 0 auto; width: min(280px, 100%); text-align: left; }
    .startup-load__step { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,.34); font-size: var(--text-sm); transition: color .2s ease; }
    .startup-load__step.is-active { color: var(--text-strong); }
    .startup-load__step.is-done { color: rgba(255,255,255,.48); }
    .startup-load__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }
    .startup-load__step.is-active .startup-load__dot { background: var(--accent); box-shadow: 0 0 12px rgba(232,0,32,.55); }
    .startup-load__error { margin-top: 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; text-align: left; color: var(--text-secondary); font-size: var(--text-sm); }
    .startup-load__retry { border: 1px solid var(--border-default); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text-primary); padding: 8px 12px; font: inherit; cursor: pointer; }
    .startup-load__retry:hover { border-color: var(--accent-border); color: var(--text-strong); }
    @keyframes pwStartupLoad { 0% { transform: translateX(-105%); } 55%,100% { transform: translateX(260%); } }
    `;
    document.head.appendChild(el);
  }

  function PitWallLoadingScreen({ error, onRetry }) {
    ensureLoadingStyles();
    const [stepIndex, setStepIndex] = React.useState(0);
    React.useEffect(() => {
      const timer = setInterval(() => setStepIndex((index) => (index + 1) % LOADING_STEPS.length), 850);
      return () => clearInterval(timer);
    }, []);
    return (
      <div className="startup-load">
        <section className="startup-load__panel" aria-live="polite" aria-busy="true">
          <img className="startup-load__mark" src="../../assets/logo-mark.svg" alt="" />
          <div className="startup-load__kicker">Apexline</div>
          <h1 className="startup-load__title">Loading live F1 data</h1>
          <p className="startup-load__copy">Race, standings, and news stay hidden until this snapshot is fresh.</p>
          <div className="startup-load__bar"><span /></div>
          <div className="startup-load__steps">
            {LOADING_STEPS.map((step, index) => (
              <div className={"startup-load__step" + (index < stepIndex ? " is-done" : index === stepIndex ? " is-active" : "")} key={step}>
                <span className="startup-load__dot" />{step}
              </div>
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
              ...(tile.lockAspect === true ? { lockAspect: true } : {}),
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

  function profilePatchIncludesImage(patch) {
    return Boolean(patch && Object.prototype.hasOwnProperty.call(patch, "profileImageUrl"));
  }

  function shouldMigrateProfileImage(local, persisted) {
    return Boolean(local?.profileImageUrl && !persisted?.profileImageUrl);
  }

  function normalizeProfilePatch(patch = {}) {
    const normalized = normalizeProfile(patch);
    return Object.fromEntries(
      Object.keys(normalized)
        .filter((key) => Object.prototype.hasOwnProperty.call(patch, key))
        .map((key) => [key, normalized[key]])
    );
  }

  function persistProfile(profile, options = {}) {
    const next = normalizeProfile(profile);
    localStorage.setItem("pw-profile", JSON.stringify(next));
    if (window.pitwall?.profile?.set) {
      const payload = options.patch
        ? normalizeProfilePatch(options.patch)
        : options.includeProfileImage
          ? next
          : Object.fromEntries(Object.entries(next).filter(([key]) => key !== "profileImageUrl"));
      window.pitwall.profile.set(payload).catch(() => {});
    }
  }

  function buildByCode(drivers) {
    return Object.fromEntries((drivers || []).map((driver) => [driver.code, driver]));
  }

  function mergeRowsByKey(baseRows, incomingRows, key, options = {}) {
    const baseList = baseRows || [];
    const base = new Map(baseList.filter((row) => row?.[key]).map((row) => [row[key], row]));
    const seen = new Set();
    const merged = (incomingRows || []).map((row) => {
      const rowKey = row?.[key];
      if (!rowKey) return null;
      seen.add(rowKey);
      return { ...(base.get(rowKey) || {}), ...row };
    }).filter(Boolean);
    if (options.includeMissing === false) return merged;
    return merged.concat(baseList.filter((row) => row?.[key] && !seen.has(row[key])));
  }

  function constructorMetadataRows(seedRows, baseRows) {
    return mergeRowsByKey(seedRows, baseRows, "abbr");
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
    if (incoming.targetFingerprint && incoming.targetFingerprint !== current.targetFingerprint) return false;
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
    const constructorBaseRows = constructorMetadataRows(SEEDED_CONSTRUCTOR_ROWS, base?.constructors);
    const merged = normalizeScheduleData({
      ...EMPTY_DATA,
      ...(base || {}),
      ...(incoming || {}),
      drivers: incoming?.drivers?.length ? mergeRowsByKey(base?.drivers, incoming.drivers, "code") : (base?.drivers || []),
      constructors: incoming?.constructors?.length ? mergeRowsByKey(constructorBaseRows, incoming.constructors, "abbr", { includeMissing: false }) : (base?.constructors || []),
      standings: incoming?.standings?.length ? incoming.standings : base?.standings || [],
      driverForm: incoming?.driverForm && Object.keys(incoming.driverForm).length ? incoming.driverForm : base?.driverForm || {},
      formRounds: incoming?.formRounds?.length ? incoming.formRounds : base?.formRounds || [],
      timing: incoming?.timing || base?.timing || [],
      schedule: incoming?.schedule?.length ? incoming.schedule : base?.schedule || [],
      sessions: incoming?.sessions || base?.sessions || [],
      news: incoming?.news?.length ? incoming.news : base?.news || [],
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

  function shouldBypassInitialLiveDataGate(search) {
    const params = new URLSearchParams(search || "");
    if (params.get("screen") !== "weekend") return false;
    return Boolean(params.get("weekendRound") || params.get("weekendSession") || params.get("weekendMode") === "recap");
  }

  function shouldWaitForStartupNews(snapshot) {
    if (!snapshot || snapshot.source === "error") return false;
    if (snapshot.startupReady) return false;
    return true;
  }

  function scheduleBackgroundEnrichmentPoll(snapshot, attempt, setTimer, refresh) {
    if (!snapshot?.enrichmentPending || attempt >= 4) return null;
    return setTimer(() => refresh({ enrichmentAttempt: attempt + 1 }), 2500);
  }

  function DataProvider({ children }) {
    const [data, setData] = React.useState(() => mergeData(EMPTY_DATA, window.PW_DATA || {}));
    const [profile, setProfile] = React.useState(loadProfile);
    const [connection, setConnection] = React.useState({ aiConfigured: false, f1tvConnected: false });
    const hasRuntimeDataBridge = Boolean(window.pitwall?.data?.snapshot);
    const bypassInitialLiveDataGate = hasRuntimeDataBridge && shouldBypassInitialLiveDataGate(window.location.search);
    const [initialDataReady, setInitialDataReady] = React.useState(!hasRuntimeDataBridge || bypassInitialLiveDataGate);
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
      if (!window.pitwall?.data?.snapshot) return null;
      try {
        if (options.initial) setInitialLoadError("");
        const snapshotOptions = {
          startup: Boolean(options.initial),
          ...(options.forceRefresh ? { forceRefresh: true } : {}),
          ...(options.forceCopilotRefresh ? { forceCopilotRefresh: true } : {}),
          ...(options.forceCopilotPageId ? { forceCopilotPageId: options.forceCopilotPageId } : {}),
        };
        const snapshot = await window.pitwall.data.snapshot(snapshotOptions);
        setData((current) => mergeData(current, snapshot));
        if (options.initial && shouldWaitForStartupNews(snapshot)) {
          const attempt = Number(options.startupAttempt) || 0;
          if (attempt < STARTUP_WAIT_MAX_ATTEMPTS) {
            clearTimeout(enrichmentTimerRef.current);
            enrichmentTimerRef.current = setTimeout(
              () => refreshData({ forceRefresh: true, initial: true, startupAttempt: attempt + 1 }),
              STARTUP_NEWS_RETRY_MS,
            );
            return snapshot;
          }
        }
        if (options.initial) {
          setInitialDataReady(true);
        }
        if (snapshot?.enrichmentPending) {
          clearTimeout(enrichmentTimerRef.current);
          enrichmentTimerRef.current = scheduleBackgroundEnrichmentPoll(
            snapshot,
            Number(options.enrichmentAttempt) || 0,
            setTimeout,
            refreshData,
          );
        }
        return snapshot;
      } catch {
        setData((current) => ({ ...current, source: "error", sourceLabel: "Live data unavailable" }));
        if (options.initial) {
          setInitialLoadError("Fresh live data is unavailable right now.");
        }
        return null;
      }
    }

    async function refreshConnections() {
      let aiProbe;
      let f1TvProbe;
      try {
        aiProbe = window.pitwall?.ai?.authStatus?.();
      } catch {}
      try {
        f1TvProbe = window.pitwall?.f1tv?.probeStatus?.({ timeoutMs: 1200 }) || window.pitwall?.f1tv?.status?.();
      } catch {}
      const [aiResult, f1TvResult] = await Promise.allSettled([aiProbe, f1TvProbe]);
      const authStatus = aiResult.status === "fulfilled" ? aiResult.value : null;
      const status = f1TvResult.status === "fulfilled" ? f1TvResult.value : null;
      setConnection({
        aiConfigured: Boolean(authStatus?.codexConnected || authStatus?.grokConnected),
        f1tvConnected: Boolean(status?.authenticated),
      });
    }

    function updateProfile(patch) {
      setProfile((current) => {
        const next = normalizeProfile({ ...current, ...patch });
        persistProfile(next, { patch });
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
            profileImageUrl: persisted.profileImageUrl || local.profileImageUrl,
            livePanelSizes: persisted.livePanelSizes != null ? persisted.livePanelSizes : local.livePanelSizes,
            liveCustomLayouts: persisted.liveCustomLayouts != null ? persisted.liveCustomLayouts : local.liveCustomLayouts,
            videoQuality: persisted.videoQuality != null && persisted.videoQuality !== "" ? persisted.videoQuality : local.videoQuality,
          } : local;
          if (mounted) setProfile(next);
          if (profileHasContent(next)) persistProfile(next, { includeProfileImage: shouldMigrateProfileImage(local, persisted) });
        } catch {}
      })();
      const initialRefreshTimer = bypassInitialLiveDataGate
        ? setTimeout(() => refreshData({ forceRefresh: true, initial: true }), 2500)
        : null;
      if (!bypassInitialLiveDataGate) refreshData({ initial: true });
      refreshConnections();
      const unsubscribeDataUpdated = window.pitwall?.data?.onUpdated?.(() => refreshData());
      const timer = setInterval(refreshData, 1000 * 60 * 3);
      return () => {
        mounted = false;
        clearInterval(timer);
        clearTimeout(initialRefreshTimer);
        clearTimeout(enrichmentTimerRef.current);
        unsubscribeDataUpdated?.();
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
