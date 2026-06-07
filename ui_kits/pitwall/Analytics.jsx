/* PitWall Analytics & Deep Dives. window.PW.Analytics */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Card, Badge, Icon, SegmentedControl, Button, Select, TyreBadge, StatTile, Avatar } = NS;

  const STYLE_ID = "pw-an-styles";
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `
    .an {
      --font-display: "DIN Condensed", "Avenir Next Condensed", "Saira SemiCondensed", "Saira", system-ui, sans-serif;
      --font-sans: "Avenir Next", "SF Compact", "Saira", system-ui, -apple-system, "Segoe UI", sans-serif;
      --font-mono: "SF Mono", "SFNS Mono", "JetBrains Mono", ui-monospace, Menlo, monospace;
      display: flex;
      flex-direction: column;
      gap: var(--space-9);
      font-family: var(--font-sans);
    }
    .an button, .an select { font-family: inherit; }
    .an__query { display: grid; grid-template-columns: 1.1fr 0.9fr 1.25fr auto; gap: var(--space-6); align-items: end; padding: var(--space-7); border-radius: var(--radius-md); background: var(--surface-card); border: 1px solid var(--border-default); }
    .an__field { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
    .an__fieldlabel { display: inline-flex; align-items: center; gap: var(--space-4); font-size: var(--text-2xs); font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: var(--tracking-caps); }
    .an__status { display: flex; align-items: center; gap: var(--space-5); min-height: 28px; color: var(--text-tertiary); font-size: var(--text-sm); }
    .an__entity-panel { display: grid; grid-template-columns: 160px 1fr; gap: var(--space-7); align-items: start; padding: var(--space-7); border-radius: var(--radius-md); background: var(--surface-card); border: 1px solid var(--border-subtle); }
    .an__scope-copy { color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.45; }
    .an__entity-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(154px, 1fr)); gap: var(--space-5); }
    .an__entity { min-height: 54px; appearance: none; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-sunken); color: var(--text-primary); display: grid; grid-template-columns: 32px 1fr; gap: var(--space-5); align-items: center; padding: var(--space-5); text-align: left; cursor: pointer; transition: var(--tr-control); }
    .an__entity:hover { border-color: var(--border-strong); background: var(--surface-hover); }
    .an__entity[data-selected="true"] { border-color: var(--_team, var(--accent)); background: color-mix(in srgb, var(--_team, var(--accent)) 18%, var(--surface-card)); box-shadow: inset 3px 0 0 var(--_team, var(--accent)); }
    .an__entity b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-display); font-size: var(--text-md); font-weight: 800; }
    .an__entity small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-tertiary); font-size: var(--text-xs); }
    .an__kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-7); }
    .an__grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(320px, 1fr); gap: var(--space-9); align-items: start; }
    .an__stack { display: flex; flex-direction: column; gap: var(--space-9); }
    .an-empty { min-height: 160px; display: grid; place-items: center; color: var(--text-tertiary); font-size: var(--text-sm); border: 1px dashed var(--border-default); border-radius: var(--radius-sm); }

    .sector { display: flex; align-items: flex-end; gap: var(--space-8); height: 250px; padding-top: var(--space-7); }
    .sector__col { flex: 1; min-width: 58px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: var(--space-5); }
    .sector__bars { height: 100%; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 5px; }
    .sector__bar { width: 16px; min-height: 10px; border-radius: 4px 4px 0 0; }
    .sector__x { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-tertiary); }
    .sector__legend { display: flex; gap: var(--space-7); padding-top: var(--space-6); margin-top: var(--space-6); border-top: 1px solid var(--border-subtle); color: var(--text-secondary); font-size: var(--text-sm); }
    .sector__dot { width: 10px; height: 10px; border-radius: 3px; background: var(--text-secondary); }
    .sector-detail { display: flex; flex-direction: column; gap: var(--space-5); }
    .sector-detail__row { display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: var(--space-6); align-items: stretch; padding: var(--space-5); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-sunken); }
    .sector-detail__label { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-width: 0; }
    .sector-detail__label b { font-family: var(--font-display); font-size: var(--text-xl); color: var(--text-primary); }
    .sector-detail__label small { color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.25; }
    .sector-detail__drivers { display: grid; grid-template-columns: repeat(auto-fit, minmax(112px, 1fr)); gap: var(--space-4); min-width: 0; }
    .sector-detail__driver { min-width: 0; padding: var(--space-4); border: 1px solid var(--border-subtle); border-left: 3px solid var(--_team, var(--accent)); border-radius: var(--radius-sm); background: var(--surface-card); }
    .sector-detail__driver[data-fastest="true"] { border-color: var(--_team, var(--accent)); background: color-mix(in srgb, var(--_team, var(--accent)) 16%, var(--surface-card)); }
    .sector-detail__top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); min-width: 0; }
    .sector-detail__code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); font-weight: 800; font-family: var(--font-display); }
    .sector-detail__delta { flex-shrink: 0; color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 800; }
    .sector-detail__driver[data-fastest="true"] .sector-detail__delta { color: var(--accent); }
    .sector-detail__time { display: block; margin-top: 3px; color: var(--text-primary); font-family: var(--font-mono); font-size: var(--text-md); font-weight: 800; font-variant-numeric: tabular-nums; }

    .compare { display: flex; flex-direction: column; gap: var(--space-7); }
    .compare__drivers { display: flex; justify-content: space-between; align-items: center; }
    .compare__driver { display: flex; align-items: center; gap: var(--space-5); min-width: 0; }
    .compare__driver b { color: var(--text-primary); }
    .compare__row { display: grid; grid-template-columns: 1fr 74px 1fr; gap: var(--space-6); align-items: center; }
    .compare__metric { text-align: center; font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; }
    .compare__val { display: block; font-family: var(--font-mono); font-weight: 700; font-size: var(--text-lg); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .compare__track { height: 7px; border-radius: var(--radius-pill); background: var(--bg-sunken); overflow: hidden; position: relative; margin-top: 5px; }
    .compare__fill { position: absolute; top: 0; bottom: 0; }

    .stint { display: grid; grid-template-columns: 74px 1fr; gap: var(--space-6); align-items: center; padding: var(--space-5) 0; }
    .stint__driver { display: flex; align-items: center; gap: var(--space-5); color: var(--text-primary); font-weight: 800; font-family: var(--font-display); }
    .stint__bars { display: flex; gap: 4px; min-width: 0; height: 26px; }
    .stint__seg { min-width: 26px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: rgba(0,0,0,0.66); font-family: var(--font-mono); font-size: 10px; font-weight: 800; }

    .results { display: flex; flex-direction: column; gap: 2px; }
    .results__row { display: grid; grid-template-columns: 38px 1fr 72px 74px; gap: var(--space-5); align-items: center; padding: var(--space-5) var(--space-6); border-radius: var(--radius-sm); }
    .results__row:hover { background: var(--surface-hover); }
    .results__pos { font-family: var(--font-display); font-weight: 800; color: var(--text-tertiary); }
    .results__num { font-family: var(--font-mono); font-weight: 700; color: var(--text-primary); text-align: right; font-variant-numeric: tabular-nums; }
    .an__presets { display: flex; flex-direction: column; gap: var(--space-4); }
    .an__preset { width: 100%; appearance: none; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--text-secondary); display: grid; grid-template-columns: 18px 1fr 16px; gap: var(--space-5); align-items: center; padding: var(--space-5) var(--space-6); text-align: left; cursor: pointer; }
    .an__preset:hover { background: var(--surface-hover); color: var(--text-primary); }
    @media (max-width: 1180px) {
      .an__query, .an__grid, .an__entity-panel { grid-template-columns: 1fr; }
      .an__kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    `;

  const standardSessions = ["Practice 1", "Practice 2", "Practice 3", "Sprint", "Qualifying", "Race"];
  const tyreColors = {
    soft: "var(--tyre-soft)",
    medium: "var(--tyre-medium)",
    hard: "var(--tyre-hard)",
    intermediate: "var(--tyre-inter)",
    wet: "var(--tyre-wet)",
    unknown: "var(--ink-300)",
  };

  function num(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function avg(values) {
    const clean = values.filter((value) => value != null && Number.isFinite(value));
    return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
  }

  function formatLap(value) {
    const seconds = num(value);
    if (seconds == null) return "--";
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, "0")}`;
  }

  function formatDelta(value) {
    const seconds = num(value);
    if (seconds == null) return "--";
    return `${seconds >= 0 ? "+" : ""}${seconds.toFixed(3)}s`;
  }

  function formatSector(value) {
    const seconds = num(value);
    return seconds == null ? "--" : `${seconds.toFixed(3)}s`;
  }

  function formatMargin(value) {
    const seconds = num(value);
    return seconds == null ? "--" : `${seconds.toFixed(3)}s`;
  }

  function formatSpeed(value) {
    const speed = num(value);
    return speed == null ? "--" : `${Math.round(speed)}`;
  }

  function formatDeg(value) {
    const slope = num(value);
    return slope == null ? "--" : `${Math.max(0, slope).toFixed(2)}`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function racesFromData(D) {
    if (D.schedule?.length) return D.schedule;
    return [{
      rnd: "current",
      name: D.race?.name || "Current session",
      circuit: D.race?.circuit || "",
      loc: D.race?.loc || "",
      meetingKey: "",
      sessions: D.sessions?.length ? D.sessions : standardSessions.map((kind) => ({ kind })),
    }];
  }

  function sessionKindLabel(sessionItem) {
    return sessionItem?.kind || sessionItem?.session_name || sessionItem?.name || sessionItem || "";
  }

  function sessionsForRace(race, D) {
    const sessions = race?.sessions?.length ? race.sessions : D.sessions;
    return (sessions?.length ? sessions : standardSessions.map((kind) => ({ kind })))
      .map(sessionKindLabel)
      .filter(Boolean);
  }

  function sessionMetaForKind(race, kind) {
    return (race?.sessions || []).find((sessionItem) => {
      const label = sessionKindLabel(sessionItem);
      return String(label) === String(kind);
    }) || null;
  }

  function defaultAnalyticsRace(races) {
    const list = races || [];
    const hasSessionStatus = (race, status) => (race.sessions || []).some((sessionItem) => sessionItem.status === status);
    const live = list.find((race) => race.status === "live" || hasSessionStatus(race, "live"));
    if (live) return live;
    const current = list.find((race) => hasSessionStatus(race, "done") && (hasSessionStatus(race, "upcoming") || hasSessionStatus(race, "unknown")));
    if (current) return current;
    const done = list.filter((race) => race.status === "done" || hasSessionStatus(race, "done")).at(-1);
    return done || list.find((race) => race.status === "upcoming" || hasSessionStatus(race, "upcoming")) || list[0] || {};
  }

  function defaultAnalyticsSessionKind(race, D) {
    const sessions = race?.sessions?.length ? race.sessions : D.sessions;
    const list = sessions?.length ? sessions : standardSessions.map((kind) => ({ kind }));
    const live = list.find((sessionItem) => sessionItem.status === "live");
    const done = list.filter((sessionItem) => sessionItem.status === "done").at(-1);
    return sessionKindLabel(live || done || list[0]) || "Race";
  }

  function sessionStartsInFuture(sessionItem) {
    const startsAt = Date.parse(sessionItem?.startsAt || "");
    if (Number.isFinite(startsAt) && startsAt > Date.now() + 60000) return true;
    return sessionItem?.status === "upcoming" && Number.isFinite(startsAt);
  }

  function formatSessionStart(sessionItem) {
    const startsAt = Date.parse(sessionItem?.startsAt || "");
    if (!Number.isFinite(startsAt)) return "";
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(startsAt);
  }

  function fallbackRows(D) {
    const driverRows = D.standings?.length
      ? D.standings.map((row) => ({ code: row.code, position: row.pos, championshipPoints: row.pts, wins: row.wins }))
      : (D.drivers || []).map((driver, index) => ({ code: driver.code, position: index + 1 }));
    return driverRows.map((row) => {
      const driver = D.byCode?.[row.code] || D.drivers?.find((item) => item.code === row.code) || {};
      return {
        code: row.code,
        number: driver.num,
        name: driver.name || row.code,
        team: driver.team || "",
        teamAbbr: driver.abbr || "",
        color: driver.color || "var(--accent)",
        image: driver.image || "",
        position: row.position,
        championshipPoints: row.championshipPoints,
        wins: row.wins,
        laps: 0,
        fastestLap: null,
        avgLap: null,
        sectors: { s1: null, s2: null, s3: null },
        topSpeed: null,
        tyreDeg: null,
        stints: [],
        pitStops: 0,
        pitLoss: null,
        overtakes: 0,
      };
    });
  }

  function mergeRows(rows, D) {
    return (rows || []).map((row) => {
      const driver = D.byCode?.[row.code] || {};
      return {
        ...row,
        name: row.name || driver.name || row.code,
        team: row.team || driver.team || "",
        teamAbbr: row.teamAbbr || driver.abbr || "",
        color: row.color || driver.color || "var(--accent)",
        image: row.image || driver.image || "",
        number: row.number || driver.num,
      };
    });
  }

  function metricShare(a, b, lowerBetter) {
    const left = num(a);
    const right = num(b);
    if (left == null || right == null || left === right) return 50;
    const scale = Math.max(Math.abs(left), Math.abs(right), 1);
    const diff = lowerBetter ? right - left : left - right;
    return clamp(50 + (diff / scale) * 80, 12, 88);
  }

  function bestRow(rows, key, higherBetter = false) {
    const clean = rows.filter((row) => num(row[key]) != null);
    if (!clean.length) return null;
    return clean.sort((a, b) => higherBetter ? num(b[key]) - num(a[key]) : num(a[key]) - num(b[key]))[0];
  }

  function Analytics() {
    const { data: D, dataSource } = window.PW.usePitWall();
    const [analyticsLibrary, setAnalyticsLibrary] = React.useState(null);
    const [libraryLoading, setLibraryLoading] = React.useState(false);
    const analyticsSeason = D.seasonSummary?.season || new Date().getFullYear();
    const libraryRaces = analyticsLibrary?.races || [];
    const races = React.useMemo(() => {
      const liveRaces = racesFromData(D);
      return libraryRaces.length ? libraryRaces : liveRaces;
    }, [D, libraryRaces]);
    const defaultRace = defaultAnalyticsRace(races);
    const defaultRound = String(defaultRace?.rnd || "");
    const [selectedRound, setSelectedRound] = React.useState(defaultRound);
    const selectedRace = races.find((race) => String(race.rnd) === String(selectedRound)) || races[0] || {};
    const sessionKinds = sessionsForRace(selectedRace, D);
    const defaultSessionKind = defaultAnalyticsSessionKind(selectedRace, D);
    const [selectedSessionKind, setSelectedSessionKind] = React.useState(defaultSessionKind);
    const selectedSessionMeta = sessionMetaForKind(selectedRace, selectedSessionKind);
    const [comparisonScope, setComparisonScope] = React.useState("pair");
    const defaultCodes = (D.standings?.length ? D.standings.map((row) => row.code) : D.drivers.map((driver) => driver.code)).slice(0, 2);
    const [selectedDriverCodes, setSelectedDriverCodes] = React.useState(defaultCodes);
    const [selectedTeam, setSelectedTeam] = React.useState(D.constructors?.[0]?.abbr || "");
    const [sessionData, setSessionData] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const [insight, setInsight] = React.useState(null);
    const loadRequestRef = React.useRef(0);
    const autoSelectedRoundRef = React.useRef(true);
    const autoSelectedSessionRef = React.useRef(true);

    React.useEffect(() => {
      let cancelled = false;
      async function loadLibrary() {
        if (!window.pitwall?.analytics?.library) return;
        setLibraryLoading(true);
        try {
          const library = await window.pitwall.analytics.library({ season: analyticsSeason });
          if (!cancelled) setAnalyticsLibrary(library);
        } catch (libraryError) {
          if (!cancelled) setError((current) => current || libraryError?.message || "Race weekend library unavailable.");
        } finally {
          if (!cancelled) setLibraryLoading(false);
        }
      }
      loadLibrary();
      return () => {
        cancelled = true;
      };
    }, [analyticsSeason]);

    React.useEffect(() => {
      const hasSelectedRound = races.some((race) => String(race.rnd) === String(selectedRound));
      if (defaultRound && autoSelectedRoundRef.current && selectedRound !== defaultRound) {
        setSelectedRound(defaultRound);
      } else if (defaultRound && (!selectedRound || !hasSelectedRound)) {
        autoSelectedRoundRef.current = true;
        setSelectedRound(defaultRound);
      }
    }, [defaultRound, selectedRound, races.length]);

    React.useEffect(() => {
      if (!sessionKinds.length) return;
      if (autoSelectedSessionRef.current && selectedSessionKind !== defaultSessionKind) {
        setSelectedSessionKind(defaultSessionKind);
      } else if (!sessionKinds.includes(selectedSessionKind)) {
        autoSelectedSessionRef.current = true;
        setSelectedSessionKind(defaultSessionKind);
      }
    }, [defaultSessionKind, sessionKinds.join("|"), selectedSessionKind]);

    React.useEffect(() => {
      const validCodes = new Set((D.drivers || []).map((driver) => driver.code));
      setSelectedDriverCodes((current) => {
        const kept = current.filter((code) => validCodes.has(code));
        return kept.length ? kept : defaultCodes;
      });
      if (!selectedTeam && D.constructors?.[0]?.abbr) setSelectedTeam(D.constructors[0].abbr);
    }, [D.drivers.length, D.standings.length, D.constructors.length]);

    async function loadSession() {
      const requestId = loadRequestRef.current + 1;
      loadRequestRef.current = requestId;
      const isCurrentLoad = () => loadRequestRef.current === requestId;
      const loadMeetingKey = selectedRace.meetingKey;
      const loadSessionKind = selectedSessionKind;
      const loadSessionMeta = selectedSessionMeta;
      const loadSeason = analyticsSeason;
      setInsight(null);
      setError("");
      if (!window.pitwall?.analytics?.session) {
        setSessionData(null);
        setLoading(false);
        setError("Session analytics are available in the Electron app.");
        return;
      }
      if (!loadMeetingKey) {
        setSessionData(null);
        setLoading(false);
        setError(window.pitwall?.analytics?.library && (libraryLoading || !analyticsLibrary)
          ? "Loading race weekend sessions..."
          : "OpenF1 meeting data is unavailable for this weekend.");
        return;
      }
      if (sessionStartsInFuture(loadSessionMeta)) {
        const startText = formatSessionStart(loadSessionMeta);
        setSessionData(null);
        setLoading(false);
        setError(`This session has not started yet${startText ? ` (${startText})` : ""}. Analytics will load after OpenF1 publishes timing data.`);
        return;
      }
      setLoading(true);
      setSessionData(null);
      try {
        const data = await window.pitwall.analytics.session({
          meetingKey: loadMeetingKey,
          sessionKind: loadSessionKind,
          season: loadSeason,
        });
        if (!isCurrentLoad()) return;
        setSessionData(data);
        if (data.errors?.length && !data.drivers?.length) setError(data.errors[0]);
      } catch (loadError) {
        if (!isCurrentLoad()) return;
        setSessionData(null);
        setError(loadError.message || "Session analytics are unavailable.");
      } finally {
        if (isCurrentLoad()) setLoading(false);
      }
    }

    React.useEffect(() => {
      loadRequestRef.current += 1;
      setSessionData(null);
      setError("");
      setInsight(null);
      setLoading(false);
    }, [selectedRound, selectedSessionKind, selectedRace.meetingKey]);

    function handleScope(nextScope) {
      setComparisonScope(nextScope);
      setSelectedDriverCodes((current) => {
        const pool = (D.standings?.length ? D.standings.map((row) => row.code) : D.drivers.map((driver) => driver.code));
        const kept = current.length ? current : pool;
        if (nextScope === "single") return kept.slice(0, 1);
        if (nextScope === "pair") return kept.slice(0, 2);
        if (nextScope === "multi") return kept.slice(0, 4);
        return kept;
      });
    }

    function toggleDriver(code) {
      setSelectedDriverCodes((current) => {
        if (comparisonScope === "single") return [code];
        const limit = comparisonScope === "pair" ? 2 : 5;
        if (current.includes(code)) {
          const next = current.filter((item) => item !== code);
          return next.length ? next : [code];
        }
        return [...current, code].slice(-limit);
      });
    }

    async function runContextQuery() {
      const query = `${selectedRace.name || "Selected weekend"} ${selectedSessionKind} ${selectedDriverCodes.join(" vs ")}`;
      if (!window.pitwall?.history?.query) {
        setInsight({ title: query, body: "Historical context is available in the Electron app." });
        return;
      }
      try {
        const historical = await window.pitwall.history.query({ query, mode: "analytics", season: analyticsSeason });
        setInsight({ title: query, body: historical.summary });
      } catch (queryError) {
        setInsight({ title: query, body: queryError.message || "Historical context is unavailable." });
      }
    }

    const allRows = mergeRows(sessionData?.drivers?.length ? sessionData.drivers : fallbackRows(D), D);
    const rowByCode = new Map(allRows.map((row) => [row.code, row]));
    const selectedCodes = comparisonScope === "team"
      ? D.drivers.filter((driver) => driver.abbr === selectedTeam).map((driver) => driver.code)
      : selectedDriverCodes;
    const selectedRows = selectedCodes.map((code) => rowByCode.get(code)).filter(Boolean);
    const chartRows = selectedRows.length ? selectedRows : allRows.slice(0, 5);
    const fastest = bestRow(selectedRows, "fastestLap");
    const avgPace = avg(selectedRows.map((row) => row.avgLap));
    const topSpeed = bestRow(selectedRows, "topSpeed", true);
    const tyreDeg = avg(selectedRows.map((row) => row.tyreDeg));
    const raceOptions = races.map((race) => ({ value: String(race.rnd), label: `${race.rnd === "current" ? "" : "R" + race.rnd + " · "}${race.name}` }));
    const sessionOptions = sessionKinds.map((kind) => ({ value: kind, label: kind }));
    const selectedTeamInfo = D.constructors.find((team) => team.abbr === selectedTeam) || {};
    const metricRows = [
      { label: "Best", key: "fastestLap", format: formatLap, lower: true },
      { label: "Avg Lap", key: "avgLap", format: formatLap, lower: true },
      { label: "Top Speed", key: "topSpeed", format: formatSpeed, lower: false },
      { label: "Pit Loss", key: "pitLoss", format: formatDelta, lower: true },
      { label: "Overtakes", key: "overtakes", format: (value) => num(value) == null ? "--" : String(value), lower: false },
    ];
    const sectorValues = chartRows.flatMap((row) => [row.sectors?.s1, row.sectors?.s2, row.sectors?.s3].map(num)).filter((value) => value != null);
    const sectorFast = sectorValues.length ? Math.min(...sectorValues) : null;
    const sectorSlow = sectorValues.length ? Math.max(...sectorValues) : null;
    const sectorComparisonRows = [
      { label: "S1", key: "s1" },
      { label: "S2", key: "s2" },
      { label: "S3", key: "s3" },
    ].map((sector) => {
      const entries = chartRows
        .map((row) => ({ row, value: num(row.sectors?.[sector.key]) }))
        .filter((entry) => entry.value != null)
        .sort((a, b) => a.value - b.value);
      const fastest = entries[0] || null;
      const fastestDelta = entries.length > 1 ? entries[1].value - entries[0].value : null;
      return {
        ...sector,
        fastest,
        fastestDelta,
        entries: entries.map((entry) => ({
          ...entry,
          delta: fastest ? entry.value - fastest.value : null,
        })),
      };
    });
    const hasSectorComparison = sectorComparisonRows.some((row) => row.entries.length);
    const maxStintLap = Math.max(1, ...chartRows.flatMap((row) => (row.stints || []).map((stint) => num(stint.lapEnd) || 0)));
    const dataBadge = sessionData?.source
      ? `${sessionData.source} · ${sessionData.session?.name || selectedSessionKind}`
      : analyticsLibrary?.source ? `${analyticsLibrary.source} · ${analyticsLibrary.season}` : dataSource;
    const statusText = error || (libraryLoading
      ? "Loading race weekend sessions..."
      : loading ? "Loading OpenF1 analytics..."
        : sessionData ? `${selectedRows.length || chartRows.length} selected · ${selectedRace.circuit || selectedRace.loc || "session data"}`
          : "Choose a weekend and session, then Load analytics.");

    return (
      <div className="an">
        <div className="an__query">
          <div className="an__field">
            <span className="an__fieldlabel"><Icon name="calendar" size={13} /> Weekend</span>
            <Select value={String(selectedRound)} onChange={(round) => {
              autoSelectedRoundRef.current = false;
              autoSelectedSessionRef.current = true;
              setSelectedRound(round);
            }} options={raceOptions} />
          </div>
          <div className="an__field">
            <span className="an__fieldlabel"><Icon name="timer" size={13} /> Session</span>
            <Select value={selectedSessionKind} onChange={(kind) => {
              autoSelectedSessionRef.current = false;
              setSelectedSessionKind(kind);
            }} options={sessionOptions} />
          </div>
          <div className="an__field">
            <span className="an__fieldlabel"><Icon name="chart" size={13} /> Compare</span>
            <SegmentedControl value={comparisonScope} onChange={handleScope} options={[
              { value: "single", label: "1 Driver" },
              { value: "pair", label: "2 Drivers" },
              { value: "multi", label: "3+ Drivers" },
              { value: "team", label: "Team" },
            ]} />
          </div>
          <Button variant="primary" onClick={loadSession} loading={loading || libraryLoading} iconLeft={<Icon name="chart" size={15} />}>Load</Button>
        </div>

        <div className="an__entity-panel">
          <div>
            <Badge tone="outline">{dataBadge}</Badge>
            <div className="an__status">
              <Icon name={error ? "alert" : "zap"} size={14} />
              <span>{statusText}</span>
            </div>
          </div>
          <div className="an__entity-grid">
            {comparisonScope === "team" ? D.constructors.map((team) => (
              <button className="an__entity" data-selected={selectedTeam === team.abbr} key={team.abbr} onClick={() => setSelectedTeam(team.abbr)} style={{ "--_team": team.color || "var(--accent)" }}>
                <Avatar initials={team.abbr} square ring={team.color || "var(--accent)"} src={team.logo} size="sm" />
                <span><b>{team.abbr}</b><small>{team.name}</small></span>
              </button>
            )) : D.drivers.map((driver) => (
              <button className="an__entity" data-selected={selectedDriverCodes.includes(driver.code)} key={driver.code} onClick={() => toggleDriver(driver.code)} style={{ "--_team": driver.color || "var(--accent)" }}>
                <Avatar initials={driver.code} number={driver.num} ring={driver.color || "var(--accent)"} src={driver.image} size="sm" />
                <span><b>{driver.code}</b><small>{driver.team}</small></span>
              </button>
            ))}
          </div>
        </div>

        <div className="an__kpis">
          <StatTile label="Fastest lap" value={formatLap(fastest?.fastestLap)} foot={<span style={{ fontSize: 12, color: "var(--t-fastest)" }}>{fastest?.code || "--"}</span>} icon={<Icon name="stopwatch" size={12} />} />
          <StatTile label="Avg pace" value={formatLap(avgPace)} foot={<span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{selectedRows.length ? "best five clean laps" : "session"}</span>} icon={<Icon name="gauge" size={12} />} />
          <StatTile label="Top speed" value={formatSpeed(topSpeed?.topSpeed)} foot={<span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>km/h · {topSpeed?.code || "--"}</span>} icon={<Icon name="zap" size={12} />} />
          <StatTile label="Tyre deg" value={formatDeg(tyreDeg)} accent foot={<span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>s/lap</span>} icon={<Icon name="droplet" size={12} />} />
        </div>

        <div className="an__grid">
          <div className="an__stack">
            <Card title="Sector pace comparison" subtitle={[selectedRace.name, selectedSessionKind, selectedTeamInfo.name].filter(Boolean).join(" · ")} aside={<Badge tone="outline">{sessionData?.counts?.laps || 0} laps</Badge>}>
              {sectorValues.length ? (
                <>
                  <div className="sector">
                    {chartRows.map((row) => {
                      const sectors = [row.sectors?.s1, row.sectors?.s2, row.sectors?.s3];
                      return (
                        <div className="sector__col" key={row.code}>
                          <div className="sector__bars">
                            {sectors.map((sector, index) => {
                              const value = num(sector);
                              const height = value == null || sectorFast === sectorSlow ? 28 : 30 + ((sectorSlow - value) / Math.max(0.001, sectorSlow - sectorFast)) * 70;
                              const strongest = value != null && value === Math.min(...sectors.map(num).filter((item) => item != null));
                              return <div className="sector__bar" key={index} style={{ height: `${height}%`, background: strongest ? row.color : `color-mix(in srgb, ${row.color} 48%, var(--bg-sunken))` }} />;
                            })}
                          </div>
                          <span className="sector__x">{row.code}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="sector__legend">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span className="sector__dot" />S1</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span className="sector__dot" />S2</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span className="sector__dot" />S3</span>
                    <span style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>Taller = faster sector</span>
                  </div>
                </>
              ) : <div className="an-empty">Sector data unavailable for this selection</div>}
            </Card>

            <Card title="Sector numbers" subtitle="Best sector times · delta to fastest">
              {hasSectorComparison ? (
                <div className="sector-detail">
                  {sectorComparisonRows.map((sector) => (
                    <div className="sector-detail__row" key={sector.key}>
                      <div className="sector-detail__label">
                        <b>{sector.label}</b>
                        <small>{sector.fastest ? `${sector.fastest.row.code}${sector.fastestDelta == null ? " fastest" : ` by ${formatMargin(sector.fastestDelta)}`}` : "No data"}</small>
                      </div>
                      <div className="sector-detail__drivers">
                        {sector.entries.map((entry) => (
                          <div className="sector-detail__driver" data-fastest={entry.delta === 0} key={`${sector.key}-${entry.row.code}`} style={{ "--_team": entry.row.color || "var(--accent)" }}>
                            <div className="sector-detail__top">
                              <span className="sector-detail__code">{entry.row.code}</span>
                              <span className="sector-detail__delta">{entry.delta === 0 ? "FASTEST" : formatDelta(entry.delta)}</span>
                            </div>
                            <span className="sector-detail__time">{formatSector(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="an-empty">Sector timing numbers unavailable for this selection</div>}
            </Card>

            <Card title="Tyre strategy" subtitle={[selectedSessionKind, sessionData?.session?.circuit].filter(Boolean).join(" · ")}>
              {chartRows.some((row) => row.stints?.length) ? (
                <div>
                  {chartRows.map((row) => (
                    <div className="stint" key={row.code}>
                      <div className="stint__driver"><span style={{ width: 4, height: 22, borderRadius: 4, background: row.color }} />{row.code}</div>
                      <div className="stint__bars">
                        {(row.stints || []).map((stint, index) => {
                          const lapStart = num(stint.lapStart) || 1;
                          const lapEnd = num(stint.lapEnd) || lapStart;
                          const laps = Math.max(1, lapEnd - lapStart + 1);
                          const compound = tyreColors[stint.compound] ? stint.compound : "unknown";
                          return <div className="stint__seg" key={index} style={{ width: `${Math.max(8, laps / maxStintLap * 100)}%`, background: tyreColors[compound] }}>{laps}L</div>;
                        })}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                    <TyreBadge compound="soft" size="sm" /><TyreBadge compound="medium" size="sm" /><TyreBadge compound="hard" size="sm" />
                  </div>
                </div>
              ) : <div className="an-empty">Stint data unavailable for this selection</div>}
            </Card>
          </div>

          <div className="an__stack">
            <Card title="Head-to-head" subtitle={selectedRows.slice(0, 2).map((row) => row.code).join(" vs ") || "Select drivers"}>
              {selectedRows.length >= 2 ? (
                <div className="compare">
                  <div className="compare__drivers">
                    <div className="compare__driver"><Avatar initials={selectedRows[0].code} number={selectedRows[0].number} ring={selectedRows[0].color} src={selectedRows[0].image} size="sm" /><b>{selectedRows[0].code}</b></div>
                    <div className="compare__driver"><b>{selectedRows[1].code}</b><Avatar initials={selectedRows[1].code} number={selectedRows[1].number} ring={selectedRows[1].color} src={selectedRows[1].image} size="sm" /></div>
                  </div>
                  {metricRows.map((metric) => {
                    const left = selectedRows[0][metric.key];
                    const right = selectedRows[1][metric.key];
                    const share = metricShare(left, right, metric.lower);
                    return (
                      <div className="compare__row" key={metric.key}>
                        <div style={{ textAlign: "right" }}>
                          <span className="compare__val" style={{ color: share >= 50 ? "var(--accent)" : "var(--text-secondary)" }}>{metric.format(left)}</span>
                          <div className="compare__track"><span className="compare__fill" style={{ right: "50%", width: `${share / 2}%`, background: selectedRows[0].color }} /></div>
                        </div>
                        <span className="compare__metric">{metric.label}</span>
                        <div>
                          <span className="compare__val" style={{ color: share < 50 ? "var(--accent)" : "var(--text-secondary)" }}>{metric.format(right)}</span>
                          <div className="compare__track"><span className="compare__fill" style={{ left: "50%", width: `${(100 - share) / 2}%`, background: selectedRows[1].color }} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="an-empty">Select two drivers</div>}
            </Card>

            <Card title="Session result" subtitle={sessionData?.session?.location || selectedRace.loc || "Selected weekend"} padding="tight">
              <div className="results">
                {chartRows.map((row) => (
                  <div className="results__row" key={row.code}>
                    <span className="results__pos">{row.position || "--"}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <Avatar initials={row.code} number={row.number} ring={row.color} src={row.image} size="sm" />
                      <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{row.code}</span>
                    </div>
                    <span className="results__num">{formatLap(row.fastestLap)}</span>
                    <span className="results__num">{row.laps || "--"} laps</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Analysis presets" aside={<Icon name="bookmark" size={15} />} padding="tight">
              <div className="an__presets">
                <button className="an__preset" onClick={() => { handleScope("pair"); setSelectedDriverCodes((D.standings || []).slice(0, 2).map((row) => row.code)); }}><Icon name="chart" size={14} /><span>Championship top two</span><Icon name="chevronRight" size={13} /></button>
                <button className="an__preset" onClick={() => { handleScope("multi"); setSelectedDriverCodes((D.standings || []).slice(0, 3).map((row) => row.code)); }}><Icon name="gauge" size={14} /><span>Top three pace</span><Icon name="chevronRight" size={13} /></button>
                <button className="an__preset" onClick={() => { handleScope("team"); setSelectedTeam(D.constructors?.[0]?.abbr || selectedTeam); }}><Icon name="filter" size={14} /><span>Leading constructor</span><Icon name="chevronRight" size={13} /></button>
                <button className="an__preset" onClick={runContextQuery}><Icon name="sparkles" size={14} /><span>Historical context</span><Icon name="chevronRight" size={13} /></button>
              </div>
              {insight && <div style={{ margin: "12px", paddingTop: 12, borderTop: "1px solid var(--border-subtle)", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.45 }}><b style={{ color: "var(--text-primary)" }}>{insight.title}</b><br />{insight.body}</div>}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.Analytics = Analytics;
})();
