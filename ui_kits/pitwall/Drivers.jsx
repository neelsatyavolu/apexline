/* Apexline Drivers — selectable driver profiles, F1-site style. window.PW.Drivers */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Card, Badge, Icon, SegmentedControl, Avatar, Button, StatTile } = NS;

  const STYLE_ID = "pw-drivers-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .dv { display: grid; grid-template-columns: 320px 1fr; gap: var(--space-9); align-items: start; }

    /* Roster rail */
    .dv-rail { display: flex; flex-direction: column; gap: var(--space-6); position: sticky; top: 0; }
    .dv-rail__head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); }
    .dv-rail__list { display: flex; flex-direction: column; gap: 2px; max-height: calc(100vh - 230px); overflow-y: auto; margin: 0 calc(var(--space-6) * -1); padding: 0 var(--space-6); }
    .dv-row { display: grid; grid-template-columns: 26px 34px 1fr auto; align-items: center; gap: var(--space-6); padding: var(--space-5) var(--space-6); border-radius: var(--radius-sm); cursor: pointer; border: 1px solid transparent; position: relative; transition: background var(--dur-fast) var(--ease-standard); }
    .dv-row:hover { background: var(--surface-hover); }
    .dv-row[data-active="true"] { background: var(--surface-raised); border-color: var(--border-default); }
    .dv-row[data-active="true"]::before { content: ""; position: absolute; left: 0; top: 7px; bottom: 7px; width: 3px; border-radius: var(--radius-pill); background: var(--_c); }
    .dv-row__pos { font-family: var(--font-display); font-weight: 800; font-size: var(--text-md); color: var(--text-tertiary); text-align: center; }
    .dv-row__name { font-weight: 600; color: var(--text-primary); font-size: var(--text-sm); line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dv-row__team { font-size: var(--text-2xs); color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dv-row__pts { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-sm); color: var(--text-secondary); font-variant-numeric: tabular-nums; }

    /* Detail */
    .dv-detail { display: flex; flex-direction: column; gap: var(--space-9); min-width: 0; }
    .dv-hero { position: relative; overflow: hidden; border-radius: var(--radius-lg); border: 1px solid var(--border-default); background: var(--bg-sunken); min-height: 256px; display: flex; }
    .dv-hero__wash { position: absolute; inset: 0; background: linear-gradient(105deg, color-mix(in srgb, var(--_c) 42%, transparent), transparent 62%); }
    .dv-hero__num { position: absolute; right: 230px; top: 50%; transform: translateY(-50%); font-family: var(--font-display); font-weight: 800; font-size: 230px; line-height: 0.8; color: color-mix(in srgb, var(--_c) 26%, transparent); letter-spacing: -0.04em; pointer-events: none; user-select: none; }
    .dv-hero__body { position: relative; z-index: 2; padding: var(--space-9) var(--space-10); display: flex; flex-direction: column; justify-content: center; gap: var(--space-6); flex: 1; max-width: 60%; }
    .dv-hero__crumb { display: flex; align-items: center; gap: var(--space-5); }
    .dv-hero__code { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-sm); letter-spacing: 0.12em; color: var(--_c); }
    .dv-hero__name { font-family: var(--font-display); font-weight: 800; font-size: clamp(34px, 4vw, 52px); line-height: 0.98; color: var(--text-strong); letter-spacing: -0.01em; }
    .dv-hero__name small { display: block; font-size: 0.42em; font-weight: 600; letter-spacing: 0.02em; color: var(--text-tertiary); margin-top: 6px; }
    .dv-hero__team { display: inline-flex; align-items: center; gap: var(--space-5); }
    .dv-hero__teamlogo { height: 22px; width: auto; }
    .dv-hero__teamname { font-weight: 600; color: var(--text-secondary); font-size: var(--text-md); }
    .dv-hero__img { position: absolute; right: 0; bottom: 0; height: 100%; width: 280px; z-index: 1; object-fit: cover; object-position: top center; -webkit-mask-image: linear-gradient(90deg, transparent, #000 24%); mask-image: linear-gradient(90deg, transparent, #000 24%); filter: saturate(1.05); }
    .dv-hero__fav { position: absolute; top: var(--space-7); right: var(--space-7); z-index: 3; }

    .dv-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-6); }
    .dv-cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-9); align-items: start; }

    .dv-form { display: flex; flex-direction: column; gap: 2px; }
    .dv-form__row { display: grid; grid-template-columns: 54px 1fr 44px; align-items: center; gap: var(--space-6); padding: var(--space-5) var(--space-4); border-radius: var(--radius-xs); }
    .dv-form__row:hover { background: var(--surface-hover); }
    .dv-form__rnd { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); }
    .dv-form__gp { font-size: var(--text-sm); color: var(--text-secondary); }
    .dv-form__pos { justify-self: end; min-width: 32px; height: 32px; padding: 0 8px; border-radius: var(--radius-sm); display: inline-grid; place-items: center; font-family: var(--font-mono); font-weight: 700; font-size: var(--text-sm); }
    .dv-form__empty { padding: var(--space-8); color: var(--text-tertiary); font-size: var(--text-sm); text-align: center; }

    .dv-info { display: flex; flex-direction: column; }
    .dv-info__row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-6); padding: var(--space-6) 0; border-top: 1px solid var(--border-subtle); }
    .dv-info__row:first-child { border-top: 0; }
    .dv-info__k { font-size: var(--text-sm); color: var(--text-tertiary); }
    .dv-info__v { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
    .dv-blurb { font-size: var(--text-md); line-height: 1.55; color: var(--text-secondary); max-width: 62ch; text-wrap: pretty; }
    .dv-empty { padding: var(--space-10); color: var(--text-tertiary); font-size: var(--text-sm); text-align: center; }
    `;
    document.head.appendChild(el);
  }

  // medal / points / out-of-points coloring for a finishing position
  function posStyle(p) {
    if (p === "NC" || p == null) return { background: "var(--surface-sunken, var(--bg-sunken))", color: "var(--text-tertiary)" };
    const n = Number(p);
    if (n === 1) return { background: "color-mix(in srgb, #e7c66b 22%, transparent)", color: "#f0d98a" };
    if (n <= 3) return { background: "color-mix(in srgb, #c8d2dc 18%, transparent)", color: "#d9e2ea" };
    if (n <= 10) return { background: "var(--accent-quiet)", color: "var(--text-accent)" };
    return { background: "var(--bg-sunken)", color: "var(--text-tertiary)" };
  }

  function Drivers() {
    const { data: D, profile, updateProfile } = window.PW.usePitWall();
    const profiles = D.driverProfiles || {};
    const order = D.standings && D.standings.length
      ? D.standings.map((s) => s.code).filter((c) => profiles[c])
      : Object.keys(profiles);
    const [sort, setSort] = React.useState("champ");
    const [sel, setSel] = React.useState(() => {
      const focus = localStorage.getItem("pw-search-focus");
      if (focus) localStorage.removeItem("pw-search-focus");
      return focus && profiles[focus] ? focus : order[0];
    });

    const list = React.useMemo(() => {
      const rows = order.map((code, i) => ({ ...profiles[code], champPos: i + 1 }));
      if (sort === "number") return [...rows].sort((a, b) => a.num - b.num);
      if (sort === "team") return [...rows].sort((a, b) => (a.team || "").localeCompare(b.team || "") || a.champPos - b.champPos);
      return rows;
    }, [sort, order, profiles]);

    const d = profiles[sel] || profiles[order[0]] || {};

    if (!d.code) {
      return <div className="dv-empty">Driver roster is waiting for live data.</div>;
    }

    const favSet = new Set(profile.favoriteDrivers || []);
    const isFav = favSet.has(d.code);
    const rounds = D.formRounds || [];
    const form = d.form || [];
    const hasRecentForm = rounds.length > 0 && form.some((value) => value != null && value !== "");
    const nameParts = (d.name || "").split(" ");
    const career = [
      { label: "Grands Prix", value: d.gp, icon: "flag" },
      { label: "Career Wins", value: d.careerWins, icon: "trophy" },
      { label: "Podiums", value: d.podiums, icon: "trophy" },
      { label: "Pole Positions", value: d.poles, icon: "zap" },
      { label: "Fastest Laps", value: d.fl, icon: "timer" },
      { label: "World Titles", value: d.titles, icon: "star" },
      { label: "Highest Finish", value: d.bestFinish, display: true, icon: "arrowUp" },
      { label: "Highest Grid", value: d.bestGrid, display: true, icon: "grid" },
    ];

    function toggleFav() {
      const next = isFav ? (profile.favoriteDrivers || []).filter((c) => c !== d.code) : [...(profile.favoriteDrivers || []), d.code];
      updateProfile({ favoriteDrivers: next });
    }

    return (
      <div className="dv">
        {/* Roster rail */}
        <div className="dv-rail">
          <div className="dv-rail__head">
            <Badge tone="outline">{order.length} drivers</Badge>
            <SegmentedControl value={sort} onChange={setSort} size="sm" options={[
              { value: "champ", label: "Points" },
              { value: "number", label: "No." },
              { value: "team", label: "Team" },
            ]} />
          </div>
          <Card padding="tight">
            <div className="dv-rail__list">
              {list.map((row) => (
                <div className="dv-row" key={row.code} data-active={row.code === sel} style={{ "--_c": row.color }} onClick={() => setSel(row.code)}>
                  <span className="dv-row__pos">{row.champPos}</span>
                  <Avatar initials={row.code} src={row.remoteImage || row.image} ring={row.color} size="sm" />
                  <span style={{ minWidth: 0 }}>
                    <div className="dv-row__name">{row.name}</div>
                    <div className="dv-row__team">{row.team}</div>
                  </span>
                  <span className="dv-row__pts">{row.seasonPts}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Detail */}
        <div className="dv-detail">
          <div className="dv-hero" style={{ "--_c": d.color }}>
            <div className="dv-hero__wash" />
            <div className="dv-hero__num">{d.num}</div>
            <div className="dv-hero__body">
              <div className="dv-hero__crumb">
                <span className="dv-hero__code">{d.code}</span>
                <Badge tone="outline">{d.nat}</Badge>
                {d.seasonPos && <Badge tone="accent">P{d.seasonPos}</Badge>}
              </div>
              <div className="dv-hero__name">{nameParts[0]}<small style={{ fontSize: "0.62em", color: "var(--text-strong)" }}>{nameParts.slice(1).join(" ")}</small></div>
              <div className="dv-hero__team">
                {d.teamLogo && <img className="dv-hero__teamlogo" src={d.teamLogo} alt="" />}
                <span className="dv-hero__teamname">{d.team}</span>
              </div>
            </div>
            {d.remoteImage && <img className="dv-hero__img" src={d.remoteImage} alt={d.name} />}
            <div className="dv-hero__fav">
              <Button variant={isFav ? "primary" : "secondary"} size="sm" onClick={toggleFav} iconLeft={<Icon name="star" size={14} />}>{isFav ? "Following" : "Follow"}</Button>
            </div>
          </div>

          <p className="dv-blurb">{d.blurb}</p>

          {/* Season strip */}
          <div className="dv-grid">
            <StatTile label="Championship" value={d.seasonPos ? "P" + d.seasonPos : "—"} display icon={<Icon name="trophy" size={14} />} accent />
            <StatTile label="Points 2026" value={d.seasonPts} icon={<Icon name="zap" size={14} />} />
            <StatTile label="Wins 2026" value={d.seasonWins} icon={<Icon name="flag" size={14} />} />
            <StatTile label="In F1 Since" value={d.since} display icon={<Icon name="calendar" size={14} />} />
          </div>

          {/* Career */}
          <Card title="Career statistics" subtitle="All-time across every championship season">
            <div className="dv-grid">
              {career.map((c) => (
                <StatTile key={c.label} label={c.label} value={c.value} display={c.display} icon={<Icon name={c.icon} size={14} />} />
              ))}
            </div>
          </Card>

          <div className="dv-cols">
            {/* Recent form */}
            <Card title="Recent form" subtitle="Last five rounds · finishing position">
              <div className="dv-form">
                {hasRecentForm ? rounds.map((r, i) => {
                  const p = form[i];
                  return (
                    <div className="dv-form__row" key={r.rnd}>
                      <span className="dv-form__rnd">R{r.rnd}</span>
                      <span className="dv-form__gp">{r.gp} <span style={{ color: "var(--text-tertiary)" }}>· {r.loc}</span></span>
                      <span className="dv-form__pos" style={posStyle(p)}>{p == null ? "—" : p}</span>
                    </div>
                  );
                }) : <div className="dv-form__empty">Waiting for completed race results.</div>}
              </div>
            </Card>

            {/* Personal */}
            <Card title="Personal" subtitle="Driver details">
              <div className="dv-info">
                <div className="dv-info__row"><span className="dv-info__k">Nationality</span><span className="dv-info__v">{d.nat}</span></div>
                <div className="dv-info__row"><span className="dv-info__k">Date of birth</span><span className="dv-info__v">{d.dob}</span></div>
                <div className="dv-info__row"><span className="dv-info__k">Place of birth</span><span className="dv-info__v">{d.pob}</span></div>
                <div className="dv-info__row"><span className="dv-info__k">Car number</span><span className="dv-info__v" style={{ fontFamily: "var(--font-mono)" }}>{d.num}</span></div>
                <div className="dv-info__row"><span className="dv-info__k">Team</span><span className="dv-info__v">{d.team}</span></div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.Drivers = Drivers;
})();
