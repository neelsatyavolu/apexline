/* PitWall Leaderboards & Standings. window.PW.Leaderboards */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Card, Badge, Icon, SegmentedControl, DriverTag, GapDelta, Avatar, Button, Tag } = NS;
  const D = window.PW_DATA;

  const STYLE_ID = "pw-lb-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .lb { display: flex; flex-direction: column; gap: var(--space-9); }
    .lb__toolbar { display: flex; align-items: center; gap: var(--space-6); flex-wrap: wrap; }
    .lb__filters { margin-left: auto; display: flex; gap: var(--space-4); }
    .lb__mode { display: inline-flex; align-items: center; gap: var(--space-4); color: var(--text-tertiary); font-size: var(--text-sm); }
    .lb__grid { display: grid; grid-template-columns: 1.7fr 1fr; gap: var(--space-9); align-items: start; }

    .table { width: 100%; }
    .table__head { display: grid; grid-template-columns: 56px 1fr 90px 70px 80px; gap: var(--space-6); padding: var(--space-5) var(--space-7); font-size: var(--text-2xs); font-weight: 600; text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--text-tertiary); border-bottom: 1px solid var(--border-default); }
    .table__head span:nth-child(3), .table__head span:nth-child(4), .table__head span:nth-child(5) { text-align: right; }
    .trow { display: grid; grid-template-columns: 56px 1fr 90px 70px 80px; gap: var(--space-6); align-items: center; padding: var(--space-6) var(--space-7); border-bottom: 1px solid var(--border-subtle); transition: background var(--dur-fast) var(--ease-standard); }
    .trow:hover { background: var(--surface-hover); }
    .trow[data-focus="true"] { background: var(--accent-quiet); box-shadow: inset 3px 0 0 var(--accent); }
    .trow__pos { display: flex; align-items: center; gap: var(--space-4); }
    .trow__posnum { font-family: var(--font-display); font-weight: 800; font-size: var(--text-xl); color: var(--text-strong); width: 26px; }
    .trow__pts { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-lg); color: var(--text-primary); text-align: right; font-variant-numeric: tabular-nums; }
    .trow__wins { font-family: var(--font-mono); font-size: var(--text-md); color: var(--text-secondary); text-align: right; }
    .trow__delta { text-align: right; display: flex; justify-content: flex-end; }
    .trow--leader { background: linear-gradient(90deg, var(--accent-soft), transparent 40%); }
    .trow__bar { height: 5px; border-radius: var(--radius-pill); background: var(--_c); margin-top: 5px; }

    .cwrap { display: flex; flex-direction: column; gap: 2px; }
    .crow { display: grid; grid-template-columns: 40px 1fr 70px; gap: var(--space-6); align-items: center; padding: var(--space-6) var(--space-7); border-radius: var(--radius-sm); }
    .crow:hover { background: var(--surface-hover); }
    .crow__id { display: flex; align-items: center; gap: var(--space-6); min-width: 0; }
    .crow__name { font-weight: 600; color: var(--text-primary); font-size: var(--text-md); }
    .crow__bar { height: 6px; border-radius: var(--radius-pill); margin-top: 5px; }
    .crow__pts { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); text-align: right; }
    .crow__pos { font-family: var(--font-display); font-weight: 800; font-size: var(--text-lg); color: var(--text-tertiary); text-align: center; }
    `;
    document.head.appendChild(el);
  }

  function Leaderboards() {
    const { data: D, dataSource } = window.PW.usePitWall();
    const [view, setView] = React.useState("drivers");
    const [teamFilter, setTeamFilter] = React.useState(null);
    const [showH2H, setShowH2H] = React.useState(false);
    const [focusCode] = React.useState(() => {
      const code = localStorage.getItem("pw-search-focus");
      if (code) localStorage.removeItem("pw-search-focus");
      return code;
    });
    const seasonSummary = D.seasonSummary || {};
    const teamTags = D.constructors.map((team) => [team.abbr, team.name, team.color]).slice(0, 8);
    const rawDriverRows = teamFilter ? D.standings.filter((s) => D.byCode[s.code]?.abbr === teamFilter) : D.standings;
    const driverRows = focusCode && rawDriverRows.some((s) => s.code === focusCode)
      ? [...rawDriverRows.filter((s) => s.code === focusCode), ...rawDriverRows.filter((s) => s.code !== focusCode)]
      : rawDriverRows;
    const constructorRows = teamFilter ? D.constructors.filter((c) => c.abbr === teamFilter) : D.constructors;
    const maxPts = D.standings[0]?.pts || 1;
    const maxCpts = Math.max(1, ...D.constructors.map((c) => c.pts || 0));

    return (
      <div className="lb">
        <div className="lb__toolbar">
          <SegmentedControl value={view} onChange={setView} accent options={[
            { value: "drivers", label: "Drivers" },
            { value: "constructors", label: "Constructors" },
          ]} />
          <Badge tone="outline">{seasonSummary.season || new Date().getFullYear()} · Round {seasonSummary.round || "—"} · {dataSource}</Badge>
          {teamFilter && <span className="lb__mode"><Icon name="filter" size={13} /> {D.constructors.find((c) => c.abbr === teamFilter)?.name}</span>}
          <div className="lb__filters">
            <Button variant="secondary" size="sm" iconLeft={<Icon name="filter" size={14} />}>{seasonSummary.season || "Season"}</Button>
            <Button variant={showH2H ? "quiet" : "ghost"} size="sm" onClick={() => setShowH2H(!showH2H)} iconLeft={<Icon name="chart" size={14} />}>Head-to-head</Button>
          </div>
        </div>

        <div className="lb__grid">
          {view === "drivers" ? (
            <Card padding="none">
              <div className="table">
                <div className="table__head"><span>Pos</span><span>Driver</span><span>Points</span><span>Wins</span><span>Move</span></div>
                {driverRows.map((s) => {
                  const d = D.byCode[s.code];
                  return (
                    <div className={"trow" + (s.pos === 1 ? " trow--leader" : "")} key={s.code} data-focus={focusCode === s.code}>
                      <div className="trow__pos"><span className="trow__posnum">{s.pos}</span></div>
                      <div>
                        <DriverTag code={s.code} name={d?.name || s.code} number={d?.num} team={d?.color || "var(--accent)"} />
                        <div className="trow__bar" style={{ "--_c": d?.color || "var(--accent)", width: (s.pts / maxPts * 100) + "%" }} />
                      </div>
                      <span className="trow__pts">{s.pts}</span>
                      <span className="trow__wins">{s.wins}</span>
                      <span className="trow__delta">
                        {s.delta !== 0 ? <GapDelta value={Math.abs(s.delta)} trend={s.delta > 0 ? "gain" : "loss"} size="sm" /> : <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>–</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card padding="tight">
              <div className="cwrap">
                {constructorRows.map((c) => (
                  <div className="crow" key={c.abbr}>
                    <span className="crow__pos">{c.pos}</span>
                    <div>
                      <div className="crow__id">
                        <Avatar initials={c.abbr} square ring={c.color || "var(--accent)"} src={c.logo} size="sm" />
                        <span className="crow__name">{c.name}</span>
                      </div>
                      <div className="crow__bar" style={{ background: c.color, width: (c.pts / maxCpts * 100) + "%" }} />
                    </div>
                    <span className="crow__pts">{c.pts}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Right rail: head-to-head + gaps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-9)" }}>
            <Card title={showH2H ? "Head-to-head" : "Title fight"} subtitle={showH2H ? "Selected comparison" : "Top 2 · points gap"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {(showH2H && driverRows.length >= 2 ? driverRows.slice(0, 2) : D.standings.slice(0, 2)).map((s, i) => {
                  const d = D.byCode[s.code] || {};
                  const driverImage = d.remoteImage || d.image;
                  return (
                    <div key={s.code} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar initials={s.code} number={d.num} ring={d.color || "var(--accent)"} src={driverImage} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.name || s.code}</div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{d.team}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 22, color: i === 0 ? "var(--accent)" : "var(--text-primary)" }}>{s.pts}</div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0 2px", borderTop: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Gap</span>
                  <GapDelta value={D.standings.length > 1 ? (D.standings[0].pts - D.standings[1].pts) + " pts" : "—"} trend="loss" size="md" />
                </div>
              </div>
            </Card>

            <Card title="Filter by team" padding="default">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Tag selected={!teamFilter} onClick={() => setTeamFilter(null)}>All</Tag>
                {teamTags.map(([abbr, label, swatch]) => (
                  <Tag key={abbr} swatch={swatch} selected={teamFilter === abbr} onClick={() => setTeamFilter(abbr)}>{label}</Tag>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.Leaderboards = Leaderboards;
})();
