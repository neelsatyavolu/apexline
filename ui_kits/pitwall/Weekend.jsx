/* PitWall Weekend screen - live timing when a session is running,
   weekend recap between sessions. window.PW.Weekend */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Card, Badge, Icon, Countdown, StatTile, DriverTag, GapDelta, Button,
    Avatar, FlagStatus, TimingRow, TimingRowHeader, SegmentedControl } = NS;

  const STYLE_ID = "pw-weekend-styles";
  const F1_LIVE_TIMING_POLL_INTERVAL_MS = 500;
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .wk { display: flex; flex-direction: column; gap: var(--space-9); }
    .wk__head { display: flex; align-items: center; gap: var(--space-7); flex-wrap: wrap; }
    .wk__title { font-family: var(--font-display); font-weight: 800; font-size: var(--text-2xl); letter-spacing: -0.01em; color: var(--text-strong); margin: 0; }
    .wk__sub { display: flex; align-items: center; gap: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); }
    .wk__toggle { margin-left: auto; }
    .wk__kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-7); }
    .wk__cols { display: grid; grid-template-columns: 1fr 360px; gap: var(--space-9); align-items: start; }
    .wk__rail { display: flex; flex-direction: column; gap: var(--space-9); }
    .wk-lap { display: flex; align-items: center; gap: var(--space-6); width: 100%; }
    .wk-lap__n { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-sm); color: var(--text-primary); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .wk-lap__track { position: relative; flex: 1; height: 6px; border-radius: var(--radius-pill); background: var(--bg-sunken); overflow: hidden; }
    .wk-lap__fill { position: absolute; inset: 0 auto 0 0; border-radius: var(--radius-pill); background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #fff)); box-shadow: 0 0 10px var(--blue-glow); }
    .wk-lap__rem { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); white-space: nowrap; }
    .wk-rc { display: flex; flex-direction: column; gap: var(--space-5); }
    .wk-rc__row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-6); padding: var(--space-5) 0; border-bottom: 1px solid var(--border-subtle); }
    .wk-rc__row:last-child { border-bottom: 0; }
    .wk-rc__k { display: flex; align-items: center; gap: var(--space-5); font-size: var(--text-sm); color: var(--text-secondary); }
    .wk-rc__v { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md); color: var(--text-primary); font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: var(--space-5); }
    .wk-battle { display: flex; align-items: center; gap: var(--space-6); }
    .wk-battle__vs { font-family: var(--font-display); font-weight: 800; font-size: var(--text-sm); color: var(--text-tertiary); }
    .wk-battle__gap { margin-left: auto; text-align: right; }
    .wk-wx { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-6); }
    .wk-wx__c { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-6); border-radius: var(--radius-sm); background: var(--surface-raised); border: 1px solid var(--border-subtle); }
    .wk-wx__ic { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: var(--radius-sm); background: var(--bg-sunken); color: var(--accent); flex: none; }
    .wk-wx__v { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-lg); color: var(--text-primary); }
    .wk-wx__l { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
    .wk-hero { position: relative; overflow: hidden; border-radius: var(--radius-lg); border: 1px solid var(--border-default); background: linear-gradient(120% 120% at 90% -10%, var(--accent-soft), transparent 55%), var(--surface-card); padding: var(--space-10); }
    .wk-hero__eyebrow { display: flex; align-items: center; gap: var(--space-6); font-size: var(--text-2xs); font-weight: 600; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); }
    .wk-hero__round { color: var(--accent); }
    .wk-hero__name { font-family: var(--font-display); font-weight: 800; font-size: var(--text-5xl); letter-spacing: -0.02em; line-height: 1; margin: var(--space-6) 0 var(--space-5); color: var(--text-strong); }
    .wk-hero__circuit { display: flex; align-items: center; gap: var(--space-5); color: var(--text-secondary); font-size: var(--text-md); }
    .wk-hero__cd { margin-top: var(--space-10); display: flex; align-items: flex-end; gap: var(--space-10); flex-wrap: wrap; }
    .wk-hero__cdl { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
    .wk-steps { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: var(--space-5); overflow-x: auto; padding-bottom: 2px; }
    .wk-step { appearance: none; -webkit-appearance: none; min-width: 140px; display: flex; flex-direction: column; gap: var(--space-5); padding: var(--space-7); border-radius: var(--radius-md); background: var(--surface-card); border: 1px solid var(--border-subtle); color: inherit; text-align: left; font: inherit; cursor: pointer; }
    .wk-step[data-next="true"] { border-color: var(--accent-border); background: linear-gradient(160% 120% at 0 0, var(--accent-soft), var(--surface-card) 60%); }
    .wk-step[data-selected="true"] { border-color: var(--accent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent), 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent); }
    .wk-step[data-done="true"] { opacity: 0.92; }
    .wk-step__top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); }
    .wk-step__k { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
    .wk-step__day { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); }
    .wk-step__mid { display: flex; align-items: center; gap: var(--space-5); }
    .wk-step__time { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md); color: var(--text-primary); }
    .wk-step__note { font-size: var(--text-2xs); color: var(--text-tertiary); }
    .wk-step__check { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--accent-quiet); color: var(--accent); flex: none; }
    .wk-grid { display: flex; flex-direction: column; }
    .wk-grow { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: var(--space-7); padding: var(--space-5) var(--space-7); border-radius: var(--radius-sm); }
    .wk-grow:hover { background: var(--surface-hover); }
    .wk-grow[data-pole="true"] { background: var(--accent-quiet); }
    .wk-grow__time { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .wk-grow__gap { width: 72px; text-align: right; font-family: var(--font-mono); font-size: var(--text-sm); color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
    .wk-grow__gap[data-pole="true"] { color: var(--accent); font-weight: 700; letter-spacing: 0.04em; }
    .wk-recap-scroll { overflow-x: auto; }
    .wk-recap-table { display: flex; flex-direction: column; min-width: 760px; }
    .wk-recap-head, .wk-recap-row { display: grid; grid-template-columns: 44px minmax(190px, 1fr) 96px 92px 92px 64px 104px; gap: var(--space-6); align-items: center; }
    .wk-recap-head { padding: var(--space-5) var(--space-7); border-bottom: 1px solid var(--border-default); color: var(--text-tertiary); font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
    .wk-recap-row { padding: var(--space-5) var(--space-7); border-bottom: 1px solid var(--border-subtle); border-radius: var(--radius-sm); }
    .wk-recap-row:hover { background: var(--surface-hover); }
    .wk-recap-row[data-leader="true"] { background: var(--accent-quiet); }
    .wk-recap-pos, .wk-recap-mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .wk-recap-pos { color: var(--text-tertiary); font-size: var(--text-sm); font-weight: 700; }
    .wk-recap-mono { color: var(--text-primary); font-size: var(--text-sm); font-weight: 650; white-space: nowrap; }
    .wk-recap-meta { color: var(--text-tertiary); font-size: var(--text-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wk-recap-detail { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-6); padding: var(--space-6) var(--space-7); border-top: 1px solid var(--border-default); background: var(--bg-sunken); }
    .wk-recap-stat { min-width: 0; }
    .wk-recap-stat__k { font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 4px; }
    .wk-recap-stat__v { font-family: var(--font-mono); color: var(--text-primary); font-weight: 700; font-size: var(--text-md); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wk-recap-stat__n { color: var(--text-tertiary); font-size: var(--text-xs); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wk-story { display: flex; gap: var(--space-6); padding: var(--space-6); border-radius: var(--radius-sm); background: var(--surface-raised); border: 1px solid var(--border-subtle); }
    .wk-story__ic { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: var(--radius-sm); background: var(--accent-quiet); color: var(--accent); flex: none; }
    .wk-story__tag { font-size: var(--text-2xs); font-weight: 600; text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--text-tertiary); margin-bottom: 3px; }
    .wk-story__txt { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.42; text-wrap: pretty; }
    .wk-sr { display: flex; flex-direction: column; }
    .wk-sr__row { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-6) var(--space-7); border-radius: var(--radius-sm); }
    .wk-sr__row:hover { background: var(--surface-hover); }
    .wk-sr__k { width: 76px; font-size: var(--text-sm); font-weight: 500; color: var(--text-primary); }
    .wk-sr__note { font-size: var(--text-xs); color: var(--text-tertiary); margin-left: auto; }
    .wk-sr__time { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    @media (max-width: 1120px) { .wk__kpis { grid-template-columns: repeat(2, 1fr); } .wk__cols { grid-template-columns: 1fr; } .wk-recap-detail { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    `;
    document.head.appendChild(el);
  }

  function pickRace(D, requestedRound) {
    const schedule = D.schedule || [];
    const requested = requestedRound ? schedule.find((race) => String(race.rnd || "") === String(requestedRound)) : null;
    return requested ||
      schedule.find((race) => race.status === "live") ||
      schedule.find((race) => race.status === "upcoming") ||
      schedule.at(-1) ||
      { name: D.race?.name || "Formula 1", circuit: D.race?.circuit || "", loc: D.race?.loc || "", rnd: D.race?.round || 0, sessions: D.sessions || [], startsAt: D.race?.startsAt || "" };
  }

  function pickSession(selectedRace, D, requestedSessionKind) {
    const sessions = selectedRace.sessions?.length ? selectedRace.sessions : (D.sessions || []);
    const requested = requestedSessionKind ? sessions.find((s) => raceMatchText(s.kind) === raceMatchText(requestedSessionKind)) : null;
    return requested || sessions.find((s) => s.status === "live") || sessions.find((s) => s.status === "upcoming") || sessions[0] || null;
  }

  function timingRows(D) {
    if (D.timing?.length) return D.timing;
    return (D.standings || []).map((row) => ({
      pos: row.pos,
      code: row.code,
      last: "",
      state: null,
      gap: row.pos === 1 ? "LEADER" : row.pts + " pts",
      interval: row.pos === 1 ? "LEADER" : "",
      trend: "flat",
      comp: "",
      age: "",
      pits: "",
    }));
  }

  function recapDefaultSessionKind(sessions, selectedRaceSession) {
    const live = sessions.find((s) => s.status === "live");
    const done = sessions.filter((s) => s.status === "done").at(-1);
    return live?.kind || done?.kind || selectedRaceSession?.kind || sessions[0]?.kind || "";
  }

  function sessionHasStarted(session, nowMs) {
    if (!session) return true;
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const startsAt = Date.parse(session.startsAt || session.dateStart || session.date_start || "");
    if (Number.isFinite(startsAt) && startsAt > now) return false;
    if (Number.isFinite(startsAt) && startsAt <= now) return true;
    const status = raceMatchText(session.status);
    if (status === "done" || status === "live" || status === "completed") return true;
    if (status === "upcoming" || status === "scheduled") return false;
    return true;
  }

  function raceMatchText(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function stableRandomValue(seed, code) {
    const text = `${seed || "session"}:${code || ""}`;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function pendingSessionRows(D, selectedSession, fallbackRows) {
    const byCode = D.byCode || {};
    const seen = new Set();
    const addDriver = (driver = {}) => {
      const code = driver.code || driver.abbr || driver.shortName || "";
      if (!code || seen.has(code)) return null;
      seen.add(code);
      const details = byCode[code] || {};
      return {
        pos: null,
        code,
        name: driver.name || details.name || code,
        number: driver.num || driver.number || details.num,
        color: driver.color || details.color || "var(--accent)",
        time: "—",
        gap: "—",
        interval: "—",
        laps: "—",
        fastestLap: "—",
        detail: "session pending",
        placeholder: true,
      };
    };
    const drivers = [
      ...(D.drivers || []),
      ...(D.standings || []).map((row) => ({ ...row, ...(byCode[row.code] || {}) })),
      ...(fallbackRows || []),
    ].map(addDriver).filter(Boolean);
    const seed = [selectedSession?.kind, selectedSession?.startsAt, selectedSession?.status].filter(Boolean).join("|");
    return drivers.sort((a, b) => stableRandomValue(seed, b.code) - stableRandomValue(seed, a.code) || a.code.localeCompare(b.code));
  }

  function matchAnalyticsLibraryRace(selectedRace, analyticsLibrary) {
    const races = analyticsLibrary?.races || [];
    if (!races.length) return null;
    const round = String(selectedRace?.rnd || "");
    if (round) {
      const roundMatch = races.find((race) => String(race.rnd || "") === round);
      if (roundMatch) return roundMatch;
    }
    const selectedText = raceMatchText([selectedRace?.name, selectedRace?.circuit, selectedRace?.loc].filter(Boolean).join(" "));
    if (!selectedText) return null;
    return races.find((race) => {
      const raceText = raceMatchText([race.name, race.circuit, race.loc].filter(Boolean).join(" "));
      return raceText && (raceText.includes(selectedText) || selectedText.includes(raceText));
    }) || null;
  }

  function formatSeconds(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds)) return "—";
    const whole = Math.floor(seconds);
    const millis = Math.round((seconds - whole) * 1000);
    const sec = String(whole % 60).padStart(2, "0");
    const min = Math.floor(whole / 60) % 60;
    const hour = Math.floor(whole / 3600);
    return hour ? `${hour}:${String(min).padStart(2, "0")}:${sec}.${String(millis).padStart(3, "0")}` : `${min}:${sec}.${String(millis).padStart(3, "0")}`;
  }

  function resultMetric(...values) {
    for (const value of values) {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) return seconds;
    }
    return null;
  }

  function computedGapValue(driver, leader, previous) {
    const driverTime = resultMetric(driver?.resultDuration, driver?.fastestLap);
    const leaderTime = resultMetric(leader?.resultDuration, leader?.fastestLap);
    const previousTime = resultMetric(previous?.resultDuration, previous?.fastestLap);
    return {
      gap: driverTime != null && leaderTime != null ? Math.max(0, driverTime - leaderTime) : null,
      interval: driverTime != null && previousTime != null ? Math.max(0, driverTime - previousTime) : null,
    };
  }

  function numericGap(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^[-+]?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
    return null;
  }

  function formatGap(value, index) {
    if (index === 0) return "LEADER";
    const numeric = numericGap(value);
    if (numeric != null) return `+${numeric.toFixed(3)}s`;
    return value != null && value !== "" ? String(value) : "—";
  }

  function formatInterval(current, previous, index) {
    if (index === 0) return "LEADER";
    const currentGap = numericGap(current);
    const previousGap = numericGap(previous) || 0;
    return currentGap != null ? `+${Math.max(0, currentGap - previousGap).toFixed(3)}s` : "—";
  }

  function sessionResultRows(D, analytics, fallbackRows, selectedSession) {
    if (!sessionHasStarted(selectedSession)) return pendingSessionRows(D, selectedSession, fallbackRows);
    const drivers = analytics?.drivers || [];
    if (drivers.length) {
      const sessionLabel = String([analytics?.session?.name, analytics?.session?.type].filter(Boolean).join(" ")).toLowerCase();
      const useLapOrder = /practice|qualifying/.test(sessionLabel);
      const ordered = drivers.slice().sort((a, b) => {
        const aMetric = resultMetric(a.resultDuration, a.fastestLap);
        const bMetric = resultMetric(b.resultDuration, b.fastestLap);
        if (a.position && b.position) return a.position - b.position;
        if (useLapOrder && aMetric != null && bMetric != null) return aMetric - bMetric;
        if (aMetric != null && bMetric != null) return aMetric - bMetric;
        return String(a.code || "").localeCompare(String(b.code || ""));
      });
      return ordered.map((driver, index) => {
        const previous = ordered[index - 1];
        const leader = ordered[0];
        const computed = computedGapValue(driver, leader, previous);
        const previousComputed = previous ? computedGapValue(previous, leader, ordered[index - 2]) : {};
        const rawGap = numericGap(driver.gapToLeader);
        const previousRawGap = numericGap(previous?.gapToLeader);
        const gapValue = rawGap != null && rawGap > 0 ? rawGap : (computed.gap != null ? computed.gap : driver.gapToLeader);
        const previousGapValue = previousRawGap != null && previousRawGap > 0 ? previousRawGap : (previousComputed.gap != null ? previousComputed.gap : previous?.gapToLeader);
        const timeMetric = resultMetric(driver.resultDuration, driver.fastestLap);
        const fastestLapMetric = resultMetric(driver.fastestLap);
        return {
          pos: driver.position || index + 1,
          code: driver.code,
          name: driver.name || driver.code,
          number: driver.number,
          color: driver.color || D.byCode[driver.code]?.color || "var(--accent)",
          time: formatSeconds(timeMetric),
          gap: formatGap(gapValue, index),
          interval: computed.interval != null && (previousGapValue == null || gapValue == null)
            ? formatGap(computed.interval, index)
            : formatInterval(gapValue, previousGapValue, index),
          laps: driver.laps || "—",
          fastestLap: formatSeconds(fastestLapMetric),
          detail: [driver.stints?.length ? `${driver.stints.length} stint${driver.stints.length === 1 ? "" : "s"}` : "", driver.pitStops ? `${driver.pitStops} pit` : "", driver.overtakes ? `${driver.overtakes} moves` : ""].filter(Boolean).join(" · ") || "session data",
        };
      });
    }
    if (analytics) return [];
    return (fallbackRows || []).map((row, index) => {
      const driver = D.byCode[row.code] || {};
      return {
        pos: row.pos || index + 1,
        code: row.code,
        name: driver.name || row.code,
        number: driver.num,
        color: driver.color || "var(--accent)",
        time: row.last || (row.pts != null ? row.pts + " pts" : "—"),
        gap: index === 0 ? "LEADER" : row.gap || "—",
        interval: index === 0 ? "LEADER" : row.interval || "—",
        laps: row.laps || row.age || "—",
        fastestLap: row.last || "—",
        detail: D.timing?.length ? "live timing" : "standings fallback",
      };
    });
  }

  function recapMetrics(analytics, resultRows, selectedSession, dataSource) {
    const totalLaps = resultRows.reduce((sum, row) => sum + (Number(row.laps) || 0), 0);
    const fastest = resultRows.find((row) => row.fastestLap && row.fastestLap !== "—");
    const weather = analytics?.weather || {};
    return [
      { k: "Rows", v: resultRows.length || "—", n: analytics?.source || dataSource },
      { k: "Fastest", v: fastest?.fastestLap || "—", n: fastest?.code || selectedSession?.kind || "session" },
      { k: "Laps", v: totalLaps || "—", n: "loaded across field" },
      { k: "Track", v: weather.track != null && weather.track !== "" ? `${weather.track}°` : "—", n: weather.cond || dataSource },
    ];
  }

  function weatherValue(value, fallback) {
    return value != null && value !== "" ? value : fallback;
  }

  function WeatherGrid({ weather }) {
    const wx = weather || {};
    return (
      <div className="wk-wx">
        <div className="wk-wx__c"><span className="wk-wx__ic"><Icon name="thermometer" size={17} /></span><div><div className="wk-wx__v">{weatherValue(wx.air, "n/a")}{wx.air !== "" && wx.air != null ? "°" : ""}</div><div className="wk-wx__l">Air temp</div></div></div>
        <div className="wk-wx__c"><span className="wk-wx__ic"><Icon name="gauge" size={17} /></span><div><div className="wk-wx__v">{weatherValue(wx.track, "n/a")}{wx.track !== "" && wx.track != null ? "°" : ""}</div><div className="wk-wx__l">Track</div></div></div>
        <div className="wk-wx__c"><span className="wk-wx__ic"><Icon name="droplet" size={17} /></span><div><div className="wk-wx__v">{weatherValue(wx.rain, "n/a")}</div><div className="wk-wx__l">Rain</div></div></div>
        <div className="wk-wx__c"><span className="wk-wx__ic"><Icon name="wind" size={17} /></span><div><div className="wk-wx__v">{String(weatherValue(wx.wind, "n/a")).split(" ")[0]}</div><div className="wk-wx__l">Wind km/h</div></div></div>
      </div>
    );
  }

  function LiveTiming({ D, selectedRace, selectedRaceSession, rows, onGoLive, dataSource, raceWeather, raceStatus }) {
    const [selected, setSelected] = React.useState(rows[0]?.code || "");
    const leaderRow = rows[0] || {};
    const leader = D.byCode[leaderRow.code] || {};
    const second = rows[1] || {};
    const laps = Number(D.race?.laps || 0);
    const lap = Number(D.race?.lap || 0);
    const remaining = laps && lap ? Math.max(0, laps - lap) : null;
    const pct = laps && lap ? Math.min(100, Math.round((lap / laps) * 100)) : (selectedRaceSession?.status === "live" ? 45 : 0);
    const fastest = rows.find((row) => row.last) || leaderRow;
    const battlePair = D.battlePairs?.[0] || null;
    const battleA = battlePair ? D.byCode[battlePair.a] || {} : D.byCode[leaderRow.code] || {};
    const battleB = battlePair ? D.byCode[battlePair.b] || {} : D.byCode[second.code] || {};
    const weather = raceWeather || D.race?.weather || {};
    const statusLabel = raceStatus || weather.cond || "Status";

    return (
      <>
        <div className="wk__kpis">
          <StatTile label="Session leader" value={leaderRow.code || "n/a"} display accent
            foot={<span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{leader.name || dataSource}</span>}
            icon={<Icon name="flag" size={12} />} />
          <StatTile label="Fastest loaded lap" value={fastest.last || "n/a"} display
            foot={<span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{fastest.code || "OpenF1"} · latest timing</span>}
            icon={<Icon name="stopwatch" size={12} />} />
          <StatTile label="Closest interval" value={second.interval || second.gap || "n/a"}
            foot={<GapDelta value={battlePair ? battlePair.gap.toFixed(1) + "s" : "watching"} trend={battlePair ? "gain" : "flat"} size="sm" />}
            icon={<Icon name="timer" size={12} />} />
          <StatTile label="Timing rows" value={rows.length || "n/a"}
            foot={<span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{remaining != null ? remaining + " laps to go" : dataSource}</span>}
            icon={<Icon name="calendar" size={12} />} />
        </div>

        <div className="wk__cols">
          <Card padding="tight" title="Live Timing" subtitle="Full field · gap to leader & interval" aside={<Badge tone={selectedRaceSession?.status === "live" ? "live" : "outline"}>{selectedRaceSession?.kind || "Latest"}</Badge>}>
            <div className="wk-lap" style={{ padding: "0 var(--space-6) var(--space-6)" }}>
              <span className="wk-lap__n">{laps && lap ? `LAP ${lap} / ${laps}` : selectedRaceSession?.kind || "SESSION"}</span>
              <span className="wk-lap__track"><span className="wk-lap__fill" style={{ width: pct + "%" }} /></span>
              <span className="wk-lap__rem">{remaining != null ? remaining + " to go" : dataSource}</span>
            </div>
            <TimingRowHeader />
            {rows.length ? rows.map((t) => {
              const d = D.byCode[t.code] || {};
              return (
                <TimingRow key={t.code} position={t.pos} code={t.code} name={d.name || t.code} team={d.color || "var(--accent)"}
                  lastLap={t.last} lapState={t.state} gap={t.gap} interval={t.interval} gapTrend={t.trend}
                  compound={t.comp} tyreAge={t.age} pits={t.pits}
                  selected={selected === t.code} onClick={() => setSelected(t.code)} />
              );
            }) : <div className="wk-story" style={{ margin: "var(--space-6)" }}><span className="wk-story__ic"><Icon name="timer" size={16} /></span><div><div className="wk-story__tag">Timing</div><div className="wk-story__txt">Live timing will appear when OpenF1 has a current session.</div></div></div>}
          </Card>

          <div className="wk__rail">
            <Card title="Race control" aside={<FlagStatus status={weather.cond === "Rain" ? "yellow" : "green"} label={statusLabel} />}>
              <div className="wk-rc">
                <div className="wk-rc__row"><span className="wk-rc__k"><Icon name="flag" size={15} /> Session</span><span className="wk-rc__v">{selectedRaceSession?.kind || "n/a"}</span></div>
                <div className="wk-rc__row"><span className="wk-rc__k"><Icon name="timer" size={15} /> Starts</span><span className="wk-rc__v">{selectedRaceSession?.time || selectedRace.date || "n/a"}</span></div>
                <div className="wk-rc__row"><span className="wk-rc__k"><Icon name="trophy" size={15} /> Leader</span><span className="wk-rc__v">{leaderRow.code || "n/a"} {leaderRow.code && <Avatar initials={leaderRow.code} number={leader.num} ring={leader.color} src={leader.remoteImage || leader.image} size="sm" />}</span></div>
                <div className="wk-rc__row"><span className="wk-rc__k"><Icon name="stopwatch" size={15} /> Source</span><span className="wk-rc__v">{D.source || "seed"}</span></div>
              </div>
              <Button variant="primary" size="sm" iconLeft={<Icon name="play" size={14} />} onClick={onGoLive} style={{ width: "100%", marginTop: "var(--space-7)" }}>
                Open broadcast view
              </Button>
            </Card>

            <Card title="Battle watch" subtitle={battlePair ? "Detected from timing intervals" : "Waiting for close interval"} aside={<Badge tone={battlePair ? "accent" : "outline"}>{battlePair ? "LIVE" : "WATCH"}</Badge>}>
              <div className="wk-battle">
                <Avatar initials={battlePair?.a || leaderRow.code || "P1"} number={battleA.num} ring={battleA.color || "var(--accent)"} src={battleA.remoteImage || battleA.image} />
                <span className="wk-battle__vs">VS</span>
                <Avatar initials={battlePair?.b || second.code || "P2"} number={battleB.num} ring={battleB.color || "var(--text-tertiary)"} src={battleB.remoteImage || battleB.image} />
                <div className="wk-battle__gap">
                  <GapDelta value={battlePair ? "+" + battlePair.gap.toFixed(1) + "s" : second.interval || "n/a"} trend={battlePair ? "gain" : "flat"} />
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{battlePair ? `${battlePair.a} · ${battlePair.b}` : "closest loaded pair"}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.42, marginTop: "var(--space-6)", textWrap: "pretty" }}>
                {battlePair?.body || "PitWall will highlight a pair when adjacent cars are within the configured battle window."}
              </div>
            </Card>

            <Card title="Track conditions" subtitle={[D.race?.weatherLoc || selectedRace.loc, "OpenF1"].filter(Boolean).join(" · ")}>
              <WeatherGrid weather={weather} />
            </Card>
          </div>
        </div>
      </>
    );
  }

  function storylines(D, selectedRace, rows) {
    const stories = [];
    if (D.news?.[0]) {
      stories.push({ icon: "news", tag: D.news[0].source || "News", text: D.news[0].title });
    }
    if (D.battlePairs?.[0]) {
      stories.push({ icon: "zap", tag: "Battle", text: D.battlePairs[0].body });
    }
    if (D.race?.weather?.cond) {
      stories.push({ icon: "droplet", tag: "Weather", text: `Latest OpenF1 conditions: ${D.race.weather.cond}. Air ${weatherValue(D.race.weather.air, "n/a")}, track ${weatherValue(D.race.weather.track, "n/a")}.` });
    }
    if (rows[0]) {
      const driver = D.byCode[rows[0].code] || {};
      stories.push({ icon: "trophy", tag: "Form", text: `${driver.name || rows[0].code} leads the currently loaded ${D.timing?.length ? "timing" : "standings"} feed.` });
    }
    if (!stories.length) {
      stories.push({ icon: "timer", tag: "Data", text: "Live weekend data is loading from OpenF1." });
    }
    return stories.slice(0, 4);
  }

  function Recap({ D, selectedRace, selectedRaceSession, rows, onGoLive, dataSource, requestedSessionKind }) {
    const sessions = selectedRace.sessions?.length ? selectedRace.sessions : (D.sessions || []);
    const requestedRecapSession = requestedSessionKind ? sessions.find((s) => raceMatchText(s.kind) === raceMatchText(requestedSessionKind)) : null;
    const defaultSessionKind = requestedRecapSession?.kind || recapDefaultSessionKind(sessions, selectedRaceSession);
    const [selectedSessionKind, setSelectedSessionKind] = React.useState(defaultSessionKind);
    const selectedRecapSession = sessions.find((s) => s.kind === selectedSessionKind) || selectedRaceSession || sessions[0] || null;
    const analyticsSeason = D.seasonSummary?.season || new Date().getFullYear();
    const [analyticsLibrary, setAnalyticsLibrary] = React.useState(null);
    const [libraryLoading, setLibraryLoading] = React.useState(false);
    const libraryRace = matchAnalyticsLibraryRace(selectedRace, analyticsLibrary);
    const recapMeetingKey = selectedRace.meetingKey || libraryRace?.meetingKey || "";
    const analyticsKey = [recapMeetingKey || "", selectedRace.name || "", selectedRace.startsAt || "", selectedSessionKind].join(":");
    const [analyticsState, setAnalyticsState] = React.useState({ key: "", loading: false, data: null, error: "" });
    const countdownTarget = selectedRaceSession?.startsAt || selectedRace.startsAt || D.race?.startsAt || "";
    const selectedAnalytics = analyticsState.key === analyticsKey ? analyticsState.data : null;
    const selectedSessionStarted = sessionHasStarted(selectedRecapSession);
    const resultRows = sessionResultRows(D, selectedAnalytics, rows, selectedRecapSession);
    const metrics = recapMetrics(selectedAnalytics, resultRows, selectedRecapSession, dataSource);

    React.useEffect(() => {
      if (!sessions.some((s) => s.kind === selectedSessionKind)) setSelectedSessionKind(defaultSessionKind);
    }, [defaultSessionKind, selectedSessionKind, sessions.map((s) => s.kind).join("|")]);

    React.useEffect(() => {
      if (selectedRace.meetingKey || !window.pitwall?.analytics?.library) {
        setAnalyticsLibrary(null);
        setLibraryLoading(false);
        return;
      }
      let active = true;
      setLibraryLoading(true);
      window.pitwall.analytics.library({ season: analyticsSeason }).then((library) => {
        if (active) setAnalyticsLibrary(library);
      }).catch(() => {
        if (active) setAnalyticsLibrary(null);
      }).finally(() => {
        if (active) setLibraryLoading(false);
      });
      return () => { active = false; };
    }, [selectedRace.meetingKey, analyticsSeason]);

    React.useEffect(() => {
      if (!selectedSessionStarted || !recapMeetingKey || !selectedSessionKind || !window.pitwall?.analytics?.session) {
        setAnalyticsState({
          key: analyticsKey,
          loading: libraryLoading,
          data: null,
          error: selectedSessionStarted && libraryLoading ? "Loading race weekend sessions..." : "",
        });
        return;
      }
      let active = true;
      setAnalyticsState((current) => ({
        key: analyticsKey,
        loading: true,
        data: current.key === analyticsKey ? current.data : null,
        error: "",
      }));
      window.pitwall.analytics.session({
        meetingKey: recapMeetingKey,
        sessionKind: selectedSessionKind,
        season: analyticsSeason,
        raceName: selectedRace.name || "",
        raceStartsAt: selectedRace.startsAt || "",
        sessionStartsAt: selectedRecapSession?.startsAt || "",
      }).then((data) => {
        if (active) setAnalyticsState({ key: analyticsKey, loading: false, data, error: "" });
      }).catch(() => {
        if (active) setAnalyticsState({ key: analyticsKey, loading: false, data: null, error: "Session result feed unavailable" });
      });
      return () => { active = false; };
    }, [selectedSessionStarted, recapMeetingKey, selectedSessionKind, analyticsSeason, libraryLoading, selectedRace.name, selectedRace.startsAt, selectedRecapSession?.startsAt]);

    return (
      <>
        <section className="wk-hero">
          <div className="wk-hero__eyebrow">
            <span>Race weekend</span>
            <span className="wk-hero__round">Round {selectedRace.rnd || D.race?.round || D.seasonSummary?.round || "n/a"} / {D.seasonSummary?.totalRounds || D.schedule?.length || "n/a"}</span>
            <Badge tone="outline">{selectedRaceSession?.status === "live" ? "Session live" : "Between sessions"}</Badge>
          </div>
          <h1 className="wk-hero__name">{selectedRace.name || D.race?.name || "Formula 1 weekend"}</h1>
          <div className="wk-hero__circuit"><Icon name="pin" size={15} /> {[selectedRace.circuit || D.race?.circuit, selectedRace.loc || D.race?.loc].filter(Boolean).join(" · ") || dataSource}</div>
          <div className="wk-hero__cd">
            <div>
              <div className="wk-hero__cdl">{selectedRaceSession?.kind ? selectedRaceSession.kind + " starts in" : "Next session"}</div>
              {countdownTarget ? <Countdown to={countdownTarget} size="md" /> : <Badge tone="outline">{dataSource}</Badge>}
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Button variant="primary" size="md" iconLeft={<Icon name="play" size={15} />} onClick={onGoLive}>Watch live</Button>
            </div>
          </div>
        </section>

        <div className="wk-steps">
          {sessions.length ? sessions.map((s) => {
            const next = s.status === "live" || s.kind === selectedRaceSession?.kind;
            return (
              <button type="button" className="wk-step" key={s.kind} data-done={s.status === "done"} data-next={next} data-selected={s.kind === selectedSessionKind} onClick={() => setSelectedSessionKind(s.kind)}>
                <div className="wk-step__top">
                  <span className="wk-step__k">{s.kind}</span>
                  {s.kind === selectedSessionKind ? <Badge tone="accent">SELECTED</Badge> : s.status === "done" ? <span className="wk-step__check"><Icon name="check" size={13} /></span> : <Badge tone={s.status === "live" ? "live" : "outline"}>{s.status === "live" ? "LIVE" : "NEXT"}</Badge>}
                </div>
                <div className="wk-step__day">{[s.day, s.time].filter(Boolean).join(" · ") || "Time pending"}</div>
                <div className="wk-step__mid">
                  <Icon name={s.status === "done" ? "check" : "calendar"} size={15} />
                  <span className="wk-step__time">{s.time || "n/a"}</span>
                </div>
                <div className="wk-step__note">{s.status === "done" ? "Completed" : s.status === "live" ? "Session running" : "Upcoming"}</div>
              </button>
            );
          }) : <div className="wk-step" data-next="true"><div className="wk-step__top"><span className="wk-step__k">Calendar</span><Badge tone="outline">WAIT</Badge></div><div className="wk-step__day">{dataSource}</div><div className="wk-step__note">Session times unavailable.</div></div>}
        </div>

        <div className="wk__cols">
          <Card padding="tight" title="Session leaderboard" subtitle={[selectedSessionKind || selectedRecapSession?.kind || "Session", selectedAnalytics?.source || (D.timing?.length ? "Live timing fallback" : "Standings fallback")].filter(Boolean).join(" · ")}
            aside={<Badge tone={analyticsState.loading ? "outline" : selectedAnalytics?.drivers?.length ? "accent" : "outline"}>{analyticsState.loading ? "LOADING" : selectedRecapSession?.status || "recap"}</Badge>}>
            <div className="wk-recap-scroll">
              <div className="wk-recap-table">
                <div className="wk-recap-head">
                  <span>Pos</span><span>Driver</span><span>Time</span><span>Gap</span><span>Interval</span><span>Laps</span><span>Data</span>
                </div>
                {resultRows.length ? resultRows.map((g, index) => (
                  <div className="wk-recap-row" key={`${g.code}-${index}`} data-leader={index === 0 && !g.placeholder}>
                    <span className="wk-recap-pos">{g.pos || index + 1}</span>
                    <DriverTag code={g.code} name={g.name || g.code} number={g.number} team={g.color || "var(--accent)"} compact />
                    <span className="wk-recap-mono">{g.time}</span>
                    <span className="wk-recap-mono">{g.gap}</span>
                    <span className="wk-recap-mono">{g.interval}</span>
                    <span className="wk-recap-mono">{g.laps}</span>
                    <span className="wk-recap-meta">{g.detail}</span>
                  </div>
                )) : <div className="wk-story" style={{ margin: "var(--space-6)" }}><span className="wk-story__ic"><Icon name="trophy" size={16} /></span><div><div className="wk-story__tag">Results</div><div className="wk-story__txt">{analyticsState.error || "Waiting for selected session results."}</div></div></div>}
              </div>
            </div>
            <div className="wk-recap-detail">
              {metrics.map((metric) => (
                <div className="wk-recap-stat" key={metric.k}>
                  <div className="wk-recap-stat__k">{metric.k}</div>
                  <div className="wk-recap-stat__v">{metric.v}</div>
                  <div className="wk-recap-stat__n">{metric.n}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="wk__rail">
            <Card title="Weekend recap" subtitle="Live sources" padding="tight">
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", padding: "var(--space-6)" }}>
                {storylines(D, selectedRace, rows).map((s, i) => (
                  <div className="wk-story" key={i}>
                    <span className="wk-story__ic"><Icon name={s.icon} size={16} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="wk-story__tag">{s.tag}</div>
                      <div className="wk-story__txt">{s.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Session plan" subtitle="Weekend schedule" padding="tight">
              <div className="wk-sr">
                {sessions.length ? sessions.map((s) => (
                  <div className="wk-sr__row" key={s.kind}>
                    <span className="wk-sr__k">{s.kind}</span>
                    <Icon name={s.status === "done" ? "check" : s.status === "live" ? "radio" : "calendar"} size={14} />
                    <span className="wk-sr__time">{s.time || "n/a"}</span>
                    <span className="wk-sr__note">{s.day || s.status}</span>
                  </div>
                )) : <div className="wk-sr__row"><span className="wk-sr__k">Feed</span><Icon name="timer" size={14} /><span className="wk-sr__time">n/a</span><span className="wk-sr__note">{dataSource}</span></div>}
              </div>
            </Card>

            <Card title="Sunday outlook" subtitle={[D.race?.weatherLoc || selectedRace.loc || D.race?.loc, "OpenF1"].filter(Boolean).join(" · ")}>
              <WeatherGrid weather={D.race?.weather} />
            </Card>
          </div>
        </div>
      </>
    );
  }

  function Weekend({ onGoLive }) {
    const { data: D, dataSource } = window.PW.usePitWall();
    const query = new URLSearchParams(window.location.search || "");
    const requestedRound = query.get("weekendRound") || "";
    const requestedSessionKind = query.get("weekendSession") || "";
    const requestedMode = query.get("weekendMode") || "";
    const selectedRace = pickRace(D, requestedRound);
    const selectedRaceSession = pickSession(selectedRace, D, requestedSessionKind);
    const hasLiveTiming = Boolean(selectedRaceSession?.status === "live");
    const [liveTimingData, setLiveTimingData] = React.useState(null);
    const liveTimingInFlightRef = React.useRef(false);
    const liveTimingRequestIdRef = React.useRef(0);
    const rows = hasLiveTiming && liveTimingData?.timing?.length ? liveTimingData.timing : timingRows(D);
    const liveDataSource = liveTimingData?.sourceLabel || liveTimingData?.message || dataSource;
    const liveWeather = liveTimingData?.weather && Object.values(liveTimingData.weather).some((value) => value !== "" && value !== null && value !== undefined)
      ? liveTimingData.weather
      : null;
    const liveRaceStatus = liveTimingData?.raceStatus
      || liveTimingData?.sessionStatus
      || liveTimingData?.sessionClock?.trackStatus?.message
      || liveTimingData?.sessionClock?.trackStatus?.status
      || liveTimingData?.sessionClock?.status
      || "";
    const [mode, setMode] = React.useState(requestedMode === "recap" ? "recap" : hasLiveTiming ? "live" : "recap");

    React.useEffect(() => {
      setMode(requestedMode === "recap" ? "recap" : hasLiveTiming ? "live" : "recap");
    }, [hasLiveTiming, requestedMode]);

    React.useEffect(() => {
      if (!hasLiveTiming || !window.pitwall?.data?.liveTiming) {
        setLiveTimingData(null);
        return undefined;
      }
      let cancelled = false;
      const loadLiveTiming = async () => {
        if (liveTimingInFlightRef.current) return;
        const requestId = liveTimingRequestIdRef.current + 1;
        liveTimingRequestIdRef.current = requestId;
        liveTimingInFlightRef.current = requestId;
        try {
          const data = await window.pitwall.data.liveTiming({ source: "f1", targetLatencySeconds: 0 });
          if (cancelled) return;
          setLiveTimingData((current) => data?.timing?.length ? data : current?.timing?.length ? current : data || null);
        } catch {
          if (!cancelled) setLiveTimingData({ ok: false, timing: [], weather: {}, sourceLabel: "Formula 1 live timing unavailable", message: "Formula 1 live timing is unavailable." });
        } finally {
          if (liveTimingInFlightRef.current === requestId) liveTimingInFlightRef.current = false;
        }
      };
      loadLiveTiming();
      const timer = setInterval(loadLiveTiming, F1_LIVE_TIMING_POLL_INTERVAL_MS);
      return () => {
        cancelled = true;
        liveTimingRequestIdRef.current += 1;
        liveTimingInFlightRef.current = false;
        clearInterval(timer);
      };
    }, [hasLiveTiming, selectedRaceSession?.kind]);

    return (
      <div className="wk">
        <div className="wk__head">
          <div>
            <h2 className="wk__title">{selectedRace.name || D.race?.name || "Formula 1 weekend"}</h2>
            <div className="wk__sub">
              <Icon name="pin" size={13} /> {selectedRace.loc || D.race?.loc || dataSource} · Round {selectedRace.rnd || D.race?.round || D.seasonSummary?.round || "n/a"}
              {mode === "live"
                ? <><span>·</span><Badge tone="live">SESSION LIVE</Badge></>
                : <><span>·</span><Badge tone="outline">Between sessions</Badge></>}
            </div>
          </div>
          <div className="wk__toggle">
            <SegmentedControl accent value={mode} onChange={setMode}
              options={[{ value: "live", label: "Session live" }, { value: "recap", label: "Weekend recap" }]} />
          </div>
        </div>

        {mode === "live"
          ? <LiveTiming D={D} selectedRace={selectedRace} selectedRaceSession={selectedRaceSession} rows={rows} onGoLive={onGoLive} dataSource={liveDataSource} raceWeather={liveWeather} raceStatus={liveRaceStatus} />
          : <Recap D={D} selectedRace={selectedRace} selectedRaceSession={selectedRaceSession} rows={rows} onGoLive={onGoLive} dataSource={dataSource} requestedSessionKind={requestedSessionKind} />}
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.Weekend = Weekend;
})();
