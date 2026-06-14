/* Apexline Dashboard screen. window.PW.Dashboard */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Card, Badge, Icon, Countdown, StatTile, DriverTag, GapDelta, Button, Avatar } = NS;
  const D = window.PW_DATA;

  const STYLE_ID = "pw-dash-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .dash { display: flex; flex-direction: column; gap: var(--space-10); }
    .dash__grid { display: grid; grid-template-columns: 1.55fr 1fr; gap: var(--space-9); align-items: start; }
    .dash__col { display: flex; flex-direction: column; gap: var(--space-9); min-width: 0; }

    /* Hero next-race */
    .hero { position: relative; overflow: hidden; border-radius: var(--radius-lg); border: 1px solid var(--border-default); background:
      linear-gradient(120% 120% at 88% -10%, var(--accent-soft), transparent 55%), var(--surface-card); padding: var(--space-10); }
    .hero__eyebrow { display: flex; align-items: center; gap: var(--space-6); font-size: var(--text-2xs); font-weight: 600; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); }
    .hero__round { color: var(--accent); }
    .hero__name { font-family: var(--font-display); font-weight: 800; font-size: var(--text-5xl); letter-spacing: -0.02em; line-height: 1; margin: var(--space-6) 0 var(--space-5); color: var(--text-strong); }
    .hero__circuit { display: flex; align-items: center; gap: var(--space-5); color: var(--text-secondary); font-size: var(--text-md); }
    .hero__cd { margin-top: var(--space-10); display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-9); flex-wrap: wrap; }
    .hero__sessions { display: flex; gap: var(--space-4); }
    .sess { display: flex; flex-direction: column; gap: 3px; padding: var(--space-5) var(--space-7); border-radius: var(--radius-sm); background: var(--surface-raised); border: 1px solid var(--border-subtle); min-width: 62px; }
    .sess[data-live="true"] { border-color: var(--accent-border); background: var(--accent-quiet); }
    .sess[data-done="true"] { opacity: 0.5; }
    .sess__k { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
    .sess__t { font-family: var(--font-mono); font-size: var(--text-md); font-weight: 600; color: var(--text-primary); }

    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-7); }

    .stand { display: flex; flex-direction: column; }
    .stand__row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: var(--space-7); padding: var(--space-5) var(--space-7); border-radius: var(--radius-sm); }
    .stand__row:hover { background: var(--surface-hover); }
    .stand__pts { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .stand__delta { width: 30px; text-align: right; }

    .weather { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-6); }
    .wx { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-6); border-radius: var(--radius-sm); background: var(--surface-raised); border: 1px solid var(--border-subtle); }
    .wx__icon { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: var(--radius-sm); background: var(--bg-sunken); color: var(--accent); flex: none; }
    .wx__v { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-lg); color: var(--text-primary); }
    .wx__l { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }

    .news { display: flex; flex-direction: column; gap: 1px; }
    .news__item { display: flex; gap: var(--space-7); padding: var(--space-7); border-radius: var(--radius-sm); cursor: pointer; }
    .news__item:hover { background: var(--surface-hover); }
    .news__spine { width: 3px; border-radius: var(--radius-pill); flex: none; }
    .news__body { min-width: 0; }
    .news__meta { display: flex; align-items: center; gap: var(--space-5); margin-bottom: 4px; }
    .news__src { font-size: var(--text-2xs); color: var(--text-tertiary); }
    .news__title { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); line-height: 1.32; text-wrap: pretty; }
    .fav { display: flex; align-items: center; gap: var(--space-7); padding: var(--space-6) var(--space-7); border-radius: var(--radius-sm); background: var(--surface-raised); border: 1px solid var(--border-subtle); }
    .fav__last { margin-left: auto; text-align: right; }
    .fav__pos { font-family: var(--font-display); font-weight: 800; font-size: var(--text-2xl); color: var(--text-strong); line-height: 1; }
    .fav__lbl { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
    .empty-live { padding: var(--space-8); color: var(--text-tertiary); font-size: var(--text-sm); text-align: center; }
    `;
    document.head.appendChild(el);
  }

  function dashboardSessionCandidate(session) {
    const status = String(session?.status || "").toLowerCase();
    if (status === "live" || status === "upcoming" || status === "scheduled") return true;
    if (status === "done" || status === "completed") return false;
    const startsAt = Date.parse(session?.startsAt || session?.dateStart || session?.date_start || "");
    return Number.isFinite(startsAt) && startsAt > Date.now();
  }

  function dashboardNextSession(D) {
    const currentSession = (D.sessions || []).find((session) => String(session?.status || "").toLowerCase() === "live") ||
      (D.sessions || []).find(dashboardSessionCandidate);
    if (currentSession) {
      return { race: D.race || {}, session: currentSession, startsAt: currentSession.startsAt || D.race?.startsAt || "" };
    }

    const race = (D.schedule || []).find((item) => (item.sessions || []).some(dashboardSessionCandidate)) ||
      (D.schedule || []).find((item) => ["live", "upcoming", "scheduled"].includes(String(item?.status || "").toLowerCase()));
    const session = (race?.sessions || []).find((item) => String(item?.status || "").toLowerCase() === "live") ||
      (race?.sessions || []).find(dashboardSessionCandidate) ||
      null;
    const startsAt = session?.startsAt || race?.startsAt || D.race?.startsAt || "";
    return startsAt ? { race: race || D.race || {}, session, startsAt } : null;
  }

  function dashboardCountdownLabel(nextSession) {
    return nextSession?.session?.kind ? `${nextSession.session.kind} starts in` : nextSession?.startsAt ? "Starts in" : "Schedule status";
  }

  function dashboardTrackConditionsSubtitle(race) {
    const weatherLoc = race?.weatherLoc && race.weatherLoc !== "Latest session" ? race.weatherLoc : "";
    return [race?.circuit || weatherLoc || race?.loc, "OpenF1"].filter(Boolean).join(" · ");
  }

  function Dashboard({ onNavigate }) {
    const { data: D, profile, dataSource, refreshData } = window.PW.usePitWall();
    const top5 = D.standings.slice(0, 5);
    const wx = D.race.weather || {};
    const favoriteDriverCode = profile.favoriteDrivers[0];
    const favoriteTeamAbbr = profile.favoriteTeams[0];
    const favoriteStanding = D.standings.find((row) => row.code === favoriteDriverCode);
    const favoriteDriver = favoriteDriverCode ? D.byCode[favoriteDriverCode] : null;
    const favoriteTeam = favoriteTeamAbbr ? D.constructors.find((c) => c.abbr === favoriteTeamAbbr) : null;
    const titleGap = top5.length > 1 ? Math.max(0, top5[0].pts - top5[1].pts) : 0;
    const racesLeft = Math.max(0, (D.seasonSummary.totalRounds || D.schedule.length || 0) - (D.seasonSummary.round || 0));
    const nextSession = dashboardNextSession(D);
    const startsAt = nextSession?.startsAt || "";
    return (
      <div className="dash">
        <div className="dash__grid">
          <div className="dash__col">
            {/* HERO */}
            <section className="hero">
              <div className="hero__eyebrow">
                <span>{startsAt ? "Next race" : "Latest session"}</span><span className="hero__round">Round {D.race.round || "—"} / {D.seasonSummary.totalRounds || "—"}</span>
              </div>
              <h1 className="hero__name">{D.race.name || "Formula 1"}</h1>
              <div className="hero__circuit">
                <Icon name="pin" size={15} /> {[D.race.circuit, D.race.loc].filter(Boolean).join(" · ") || dataSource}
              </div>
              <div className="hero__cd">
                <div>
                  <div className="fav__lbl" style={{ marginBottom: 8 }}>{dashboardCountdownLabel(nextSession)}</div>
                  {startsAt ? <Countdown to={startsAt} size="md" /> : <Badge tone="outline">{dataSource}</Badge>}
                </div>
                <div className="hero__sessions">
                  {D.sessions.length ? D.sessions.map((s) => (
                    <div className="sess" key={s.kind} data-live={s.status === "live"} data-done={s.status === "done"}>
                      <span className="sess__k">{s.kind.replace("Practice", "FP")}</span>
                      <span className="sess__t">{s.time}</span>
                    </div>
                  )) : <div className="empty-live">Waiting for session times.</div>}
                </div>
              </div>
            </section>

            {/* KPIs */}
            <div className="kpis">
              <StatTile label="Your driver" value={favoriteStanding ? "P" + favoriteStanding.pos : "Pick"} display accent foot={<span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{favoriteDriver ? `${favoriteDriver.name} · ${favoriteStanding?.pts || 0} pts` : "Choose in Settings"}</span>} icon={<Icon name="star" size={12} />} />
              <StatTile label="Title gap" value={titleGap || "—"} unit={titleGap ? "pts" : ""} foot={top5.length > 1 ? <GapDelta value={top5[1].code + " chasing"} trend="gain" /> : <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>Standings loading</span>} icon={<Icon name="trophy" size={12} />} />
              <StatTile label="Races left" value={racesLeft || "—"} foot={<span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{D.seasonSummary.totalRounds ? `${D.seasonSummary.totalRounds} round season` : dataSource}</span>} icon={<Icon name="calendar" size={12} />} />
            </div>

            {/* NEWS */}
            <Card title="Latest" subtitle="From live F1 sources" aside={<Button variant="quiet" size="sm" onClick={() => onNavigate && onNavigate("news")} iconRight={<Icon name="chevronRight" size={14} />}>All news</Button>} padding="tight">
              <div className="news">
                {D.news.length ? D.news.slice(0, 5).map((n, i) => (
                  <div className="news__item" key={n.id || i} onClick={() => n.url && window.open(n.url, "_blank", "noopener")}>
                    <span className="news__spine" style={{ background: n.color }} />
                    <div className="news__body">
                      <div className="news__meta">
                        <Badge tone={n.tag === "Breaking" ? "danger" : "outline"}>{n.tag}</Badge>
                        <span className="news__src">{n.source} · {n.time}</span>
                      </div>
                      <div className="news__title">{n.title}</div>
                    </div>
                  </div>
                )) : <div className="empty-live">No live news loaded yet. <Button variant="ghost" size="sm" onClick={refreshData}>Refresh</Button></div>}
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="dash__col">
            <Card title="Drivers' Championship" aside={<Badge tone="accent">{D.seasonSummary.season}</Badge>} padding="tight">
              <div className="stand">
                {top5.length ? top5.map((s) => {
                  const d = D.byCode[s.code];
                  return (
                    <div className="stand__row" key={s.code}>
                      <DriverTag position={s.pos} code={s.code} name={d?.name || s.code} team={d?.color || "var(--accent)"} />
                      <span className="stand__pts">{s.pts}</span>
                      <span className="stand__delta">
                        {s.delta !== 0 ? <GapDelta value={Math.abs(s.delta)} trend={s.delta > 0 ? "gain" : "loss"} size="sm" /> : <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 12 }}>–</span>}
                      </span>
                    </div>
                  );
                }) : <div className="empty-live">Current standings loading.</div>}
              </div>
            </Card>

            <Card title="Track conditions" subtitle={dashboardTrackConditionsSubtitle(D.race)} padding="default">
              <div className="weather">
                <div className="wx"><span className="wx__icon"><Icon name="thermometer" size={17} /></span><div><div className="wx__v">{wx.air != null && wx.air !== "" ? wx.air + "°" : "—"}</div><div className="wx__l">Air temp</div></div></div>
                <div className="wx"><span className="wx__icon"><Icon name="gauge" size={17} /></span><div><div className="wx__v">{wx.track != null && wx.track !== "" ? wx.track + "°" : "—"}</div><div className="wx__l">Track</div></div></div>
                <div className="wx"><span className="wx__icon"><Icon name="droplet" size={17} /></span><div><div className="wx__v">{wx.rain || "—"}</div><div className="wx__l">Rain</div></div></div>
                <div className="wx"><span className="wx__icon"><Icon name="wind" size={17} /></span><div><div className="wx__v">{wx.wind ? wx.wind.split(" ")[0] : "—"}</div><div className="wx__l">Wind km/h</div></div></div>
              </div>
            </Card>

            <Card title="Your favorites" aside={<Icon name="star" size={15} />} padding="tight">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {favoriteDriver ? <div className="fav">
                  <Avatar initials={favoriteDriver.code} number={favoriteDriver.num} ring={favoriteDriver.color} src={favoriteDriver.remoteImage || favoriteDriver.image} />
                  <div><div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{favoriteDriver.name}</div><div className="fav__lbl">{favoriteDriver.team}</div></div>
                  <div className="fav__last"><div className="fav__pos">{favoriteStanding ? "P" + favoriteStanding.pos : "—"}</div><div className="fav__lbl">championship</div></div>
                </div> : <div className="empty-live">Choose favorite drivers in Settings.</div>}
                {favoriteTeam ? <div className="fav">
                  <Avatar initials={favoriteTeam.abbr} square ring={favoriteTeam.color} src={favoriteTeam.logo} />
                  <div><div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{favoriteTeam.name}</div><div className="fav__lbl">Constructor · P{favoriteTeam.pos}</div></div>
                  <div className="fav__last"><div className="fav__pos">{favoriteTeam.pts}</div><div className="fav__lbl">points</div></div>
                </div> : <div className="empty-live">Choose favorite constructors in Settings.</div>}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.Dashboard = Dashboard;
})();
