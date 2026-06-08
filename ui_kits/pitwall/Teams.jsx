/* PitWall Teams — selectable constructor profiles, F1-site style. window.PW.Teams */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Card, Badge, Icon, Avatar, StatTile } = NS;

  const STYLE_ID = "pw-teams-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .tm { display: grid; grid-template-columns: 300px 1fr; gap: var(--space-9); align-items: start; }

    .tm-rail { display: flex; flex-direction: column; gap: var(--space-6); }
    .tm-rail__list { display: flex; flex-direction: column; gap: 2px; }
    .tm-row { display: grid; grid-template-columns: 24px 30px 1fr auto; align-items: center; gap: var(--space-6); padding: var(--space-5) var(--space-6); border-radius: var(--radius-sm); cursor: pointer; border: 1px solid transparent; position: relative; transition: background var(--dur-fast) var(--ease-standard); }
    .tm-row:hover { background: var(--surface-hover); }
    .tm-row[data-active="true"] { background: var(--surface-raised); border-color: var(--border-default); }
    .tm-row[data-active="true"]::before { content: ""; position: absolute; left: 0; top: 7px; bottom: 7px; width: 3px; border-radius: var(--radius-pill); background: var(--_c); }
    .tm-row__pos { font-family: var(--font-display); font-weight: 800; font-size: var(--text-md); color: var(--text-tertiary); text-align: center; }
    .tm-row__name { font-weight: 600; color: var(--text-primary); font-size: var(--text-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tm-row__pts { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-sm); color: var(--text-secondary); }

    .tm-detail { display: flex; flex-direction: column; gap: var(--space-9); min-width: 0; }
    .tm-hero { position: relative; overflow: hidden; border-radius: var(--radius-lg); border: 1px solid var(--border-default); background: var(--bg-sunken); min-height: 200px; display: flex; align-items: center; }
    .tm-hero__wash { position: absolute; inset: 0; background: linear-gradient(105deg, color-mix(in srgb, var(--_c) 40%, transparent), transparent 64%); }
    .tm-hero__bar { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--_c); }
    .tm-hero__body { position: relative; z-index: 2; padding: var(--space-9) var(--space-10); display: flex; flex-direction: column; gap: var(--space-6); flex: 1; }
    .tm-hero__crumb { display: flex; align-items: center; gap: var(--space-5); }
    .tm-hero__name { font-family: var(--font-display); font-weight: 800; font-size: clamp(30px, 3.4vw, 46px); line-height: 1; color: var(--text-strong); letter-spacing: -0.01em; }
    .tm-hero__full { font-size: var(--text-md); color: var(--text-tertiary); }
    .tm-hero__logo { position: absolute; right: var(--space-10); top: 50%; transform: translateY(-50%); height: 84px; width: auto; z-index: 1; opacity: 0.96; filter: drop-shadow(0 6px 24px rgba(0,0,0,0.5)); }

    .tm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-6); }
    .tm-cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-9); align-items: start; }
    .tm-info { display: flex; flex-direction: column; }
    .tm-info__row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-6); padding: var(--space-6) 0; border-top: 1px solid var(--border-subtle); }
    .tm-info__row:first-child { border-top: 0; }
    .tm-info__k { font-size: var(--text-sm); color: var(--text-tertiary); }
    .tm-info__v { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); text-align: right; }
    .tm-blurb { font-size: var(--text-md); line-height: 1.55; color: var(--text-secondary); max-width: 62ch; text-wrap: pretty; }

    .tm-driver { display: grid; grid-template-columns: 52px 1fr auto; align-items: center; gap: var(--space-6); padding: var(--space-6); border-radius: var(--radius-sm); cursor: pointer; transition: background var(--dur-fast) var(--ease-standard); }
    .tm-driver:hover { background: var(--surface-hover); }
    .tm-driver__name { font-weight: 600; color: var(--text-primary); font-size: var(--text-md); }
    .tm-driver__meta { font-size: var(--text-2xs); color: var(--text-tertiary); }
    .tm-driver__pts { text-align: right; }
    .tm-driver__ptsval { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-lg); color: var(--text-primary); }
    .tm-driver__ptslab { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: var(--tracking-caps); }
    .tm-empty { padding: var(--space-10); color: var(--text-tertiary); font-size: var(--text-sm); text-align: center; }
    `;
    document.head.appendChild(el);
  }

  function Teams({ onNavigate }) {
    const { data: D, dataSource } = window.PW.usePitWall();
    const teams = D.teamProfiles || [];
    const profiles = D.driverProfiles || {};
    const [sel, setSel] = React.useState(() => {
      const focus = localStorage.getItem("pw-team-focus");
      if (focus) localStorage.removeItem("pw-team-focus");
      return focus && teams.some((t) => t.abbr === focus) ? focus : (teams[0] && teams[0].abbr);
    });

    const t = teams.find((x) => x.abbr === sel) || teams[0] || {};

    if (!t.abbr) {
      return <div className="tm-empty">Constructor data is waiting for live data.</div>;
    }

    const roster = (t.drivers || []).map((c) => profiles[c]).filter(Boolean);
    const career = [
      { label: "World Titles", value: t.titles, icon: "star" },
      { label: "Race Wins", value: t.careerWins, icon: "trophy" },
      { label: "Pole Positions", value: t.poles, icon: "zap" },
      { label: "Fastest Laps", value: t.fl, icon: "timer" },
    ];

    function openDriver(code) {
      localStorage.setItem("pw-search-focus", code);
      if (onNavigate) onNavigate("drivers");
    }

    return (
      <div className="tm">
        {/* Rail */}
        <div className="tm-rail">
          <Badge tone="outline">{teams.length} constructors · {dataSource}</Badge>
          <Card padding="tight">
            <div className="tm-rail__list">
              {teams.map((row) => (
                <div className="tm-row" key={row.abbr} data-active={row.abbr === sel} style={{ "--_c": row.color }} onClick={() => setSel(row.abbr)}>
                  <span className="tm-row__pos">{row.seasonPos}</span>
                  <Avatar initials={row.abbr} src={row.logo} ring={row.color} square size="sm" />
                  <span className="tm-row__name">{row.name}</span>
                  <span className="tm-row__pts">{row.seasonPts}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Detail */}
        <div className="tm-detail">
          <div className="tm-hero" style={{ "--_c": t.color }}>
            <div className="tm-hero__wash" />
            <div className="tm-hero__bar" />
            <div className="tm-hero__body">
              <div className="tm-hero__crumb">
                {t.seasonPos && <Badge tone="accent">P{t.seasonPos} Constructors</Badge>}
                <Badge tone="outline">{t.power}</Badge>
              </div>
              <div className="tm-hero__name">{t.name}</div>
              <div className="tm-hero__full">{t.full}</div>
            </div>
            {t.logo && <img className="tm-hero__logo" src={t.logo} alt={t.name} />}
          </div>

          <p className="tm-blurb">{t.blurb}</p>

          {/* Season strip */}
          <div className="tm-grid">
            <StatTile label="Championship" value={t.seasonPos ? "P" + t.seasonPos : "—"} display icon={<Icon name="trophy" size={14} />} accent />
            <StatTile label="Points 2026" value={t.seasonPts} icon={<Icon name="zap" size={14} />} />
            <StatTile label="First Entry" value={t.firstEntry} display icon={<Icon name="calendar" size={14} />} />
            <StatTile label="Best Finish" value={t.bestFinish} display icon={<Icon name="arrowUp" size={14} />} />
          </div>

          <div className="tm-cols">
            {/* Team info */}
            <Card title="Team profile" subtitle="Constructor details">
              <div className="tm-info">
                <div className="tm-info__row"><span className="tm-info__k">Full name</span><span className="tm-info__v">{t.full}</span></div>
                <div className="tm-info__row"><span className="tm-info__k">Base</span><span className="tm-info__v">{t.base}</span></div>
                <div className="tm-info__row"><span className="tm-info__k">Team Principal</span><span className="tm-info__v">{t.chief}</span></div>
                <div className="tm-info__row"><span className="tm-info__k">Technical Chief</span><span className="tm-info__v">{t.techChief}</span></div>
                <div className="tm-info__row"><span className="tm-info__k">Power Unit</span><span className="tm-info__v">{t.power}</span></div>
                <div className="tm-info__row"><span className="tm-info__k">Chassis</span><span className="tm-info__v">{t.chassis}</span></div>
              </div>
            </Card>

            {/* Career */}
            <Card title="Constructor honours" subtitle="All-time record">
              <div className="tm-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                {career.map((c) => (
                  <StatTile key={c.label} label={c.label} value={c.value} icon={<Icon name={c.icon} size={14} />} />
                ))}
              </div>
            </Card>
          </div>

          {/* Roster */}
          <Card title="2026 driver line-up" subtitle="Tap a driver to open their profile" padding="tight">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              {roster.map((d) => (
                <div className="tm-driver" key={d.code} style={{ "--_c": d.color }} onClick={() => openDriver(d.code)}>
                  <Avatar initials={d.code} src={d.remoteImage || d.image} ring={d.color} number={d.num} size="lg" />
                  <span>
                    <div className="tm-driver__name">{d.name}</div>
                    <div className="tm-driver__meta">{d.nat} · #{d.num} · P{d.seasonPos} championship</div>
                  </span>
                  <span className="tm-driver__pts">
                    <div className="tm-driver__ptsval">{d.seasonPts}</div>
                    <div className="tm-driver__ptslab">pts</div>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.Teams = Teams;
})();
