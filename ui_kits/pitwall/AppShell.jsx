/* PitWall AppShell — sidebar + topbar chrome for non-live screens.
   Exposes window.PW.AppShell. Reads window.PitWallDesignSystem_698fe6. */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Icon, Badge, Avatar } = NS;

  const STYLE_ID = "pw-shell-styles";
  {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = `
    .pw-app { display: grid; grid-template-columns: var(--sidebar-w) 1fr; height: 100%; background: var(--bg-app); color: var(--text-primary); font-family: var(--font-sans); }
    /* Sidebar */
    .pw-side { display: flex; flex-direction: column; background: var(--bg-base); border-right: 1px solid var(--border-subtle); min-height: 0; }
    .pw-side__brand { display: flex; align-items: center; gap: var(--space-5); min-height: 96px; padding: 52px var(--space-7) 16px; overflow: hidden; }
    .pw-app--fullscreen .pw-side__brand { min-height: var(--topbar-h); padding: 0 var(--space-7); }
    .pw-side__mark { width: 28px; height: 28px; border-radius: 7px; flex: none; }
    .pw-side__wm { font-family: var(--font-sans); font-weight: 800; font-size: 20px; letter-spacing: 0; color: var(--text-strong); line-height: 1; white-space: nowrap; }
    .pw-side__wm i { font-style: normal; color: var(--accent); }
    .pw-side__nav { display: flex; flex-direction: column; gap: 1px; padding: var(--space-6) var(--space-6); overflow-y: auto; flex: 1; min-height: 0; }
    .pw-side__sec { font-size: var(--text-2xs); font-weight: 600; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); padding: var(--space-7) var(--space-5) var(--space-4); }
    .pw-navitem { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-5) var(--space-6); border-radius: var(--radius-sm); color: var(--text-secondary); cursor: pointer; font-size: var(--text-md); font-weight: 500; border: 1px solid transparent; transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard); position: relative; }
    .pw-navitem:hover { background: var(--surface-hover); color: var(--text-primary); }
    .pw-navitem[data-active="true"] { background: var(--accent-quiet); color: var(--text-strong); }
    .pw-navitem[data-active="true"]::before { content: ""; position: absolute; left: -6px; top: 8px; bottom: 8px; width: 3px; border-radius: var(--radius-pill); background: var(--accent); box-shadow: 0 0 10px var(--blue-glow); }
    .pw-navitem__count { margin-left: auto; font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); }
    .pw-navitem__live { margin-left: auto; }
    .pw-side__foot { border-top: 1px solid var(--border-subtle); padding: var(--space-6); display: flex; align-items: center; gap: var(--space-6); }
    .pw-side__user { display: flex; flex-direction: column; min-width: 0; }
    .pw-side__uname { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
    .pw-side__umeta { font-size: var(--text-2xs); color: var(--text-tertiary); }

    /* Main */
    .pw-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--bg-base); background-image: var(--grad-hero); }
    .pw-top { position: relative; z-index: 100; display: flex; align-items: center; gap: var(--space-7); height: var(--topbar-h); padding: 0 var(--space-9); border-bottom: 1px solid var(--border-subtle); background: color-mix(in srgb, var(--bg-base) 78%, transparent); backdrop-filter: blur(var(--blur-md, 14px)); flex: none; color-scheme: dark; }
    .pw-top__title { font-family: var(--font-sans); font-weight: 700; font-size: var(--text-xl); color: var(--text-strong); letter-spacing: 0; }
    .pw-top__crumb { font-size: var(--text-sm); color: var(--text-tertiary); }
    .pw-top__search { position: relative; display: flex; align-items: center; gap: var(--space-5); height: var(--size-control-sm); padding: 0 var(--space-7); background: var(--bg-sunken); border: 1px solid var(--border-default); border-radius: var(--radius-pill); color: var(--text-tertiary); font-size: var(--text-sm); min-width: 260px; cursor: text; }
    .pw-top__searchbox { appearance: none; -webkit-appearance: none; flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; outline: 0; background: transparent !important; box-shadow: none; color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 500; line-height: 1; }
    .pw-top__searchbox::placeholder { color: var(--text-disabled); }
    .pw-top__search kbd { margin-left: auto; font-family: var(--font-mono); font-size: 10px; background: var(--surface-raised); border: 1px solid var(--border-default); border-radius: var(--radius-xs); padding: 1px 5px; color: var(--text-tertiary); }
    .pw-searchpop { position: absolute; top: calc(100% + 8px); left: 0; width: min(420px, 76vw); z-index: 80; border-radius: var(--radius-md); background: var(--surface-overlay); border: 1px solid var(--border-default); box-shadow: var(--shadow-lg); overflow: hidden; }
    .pw-searchpop__row { display: grid; grid-template-columns: 26px 1fr auto; align-items: center; gap: var(--space-5); padding: var(--space-6) var(--space-7); cursor: pointer; }
    .pw-searchpop__row:hover { background: var(--surface-hover); }
    .pw-searchpop__title { color: var(--text-primary); font-weight: 600; font-size: var(--text-sm); }
    .pw-searchpop__meta { color: var(--text-tertiary); font-size: var(--text-2xs); margin-top: 2px; }
    .pw-searchpop__empty { padding: var(--space-7); color: var(--text-tertiary); font-size: var(--text-sm); }
    .pw-top__actions { display: flex; align-items: center; gap: var(--space-4); margin-left: auto; }
    .pw-top__actionwrap { position: relative; display: inline-flex; }
    .pw-top__icon { appearance: none; -webkit-appearance: none; display: inline-grid; place-items: center; width: 34px; height: 34px; padding: 0; border-radius: var(--radius-sm); border: 1px solid var(--border-default); background: var(--surface-raised); box-shadow: var(--inset-top-light); color: var(--text-secondary); cursor: pointer; position: relative; font: inherit; }
    .pw-top__icon:hover { background: var(--surface-hover); border-color: var(--border-strong); color: var(--text-primary); }
    .pw-top__icon[data-active="true"] { background: var(--accent-quiet); color: var(--text-accent); }
    .pw-top__dot { position: absolute; top: 7px; right: 8px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); border: 1.5px solid var(--bg-base); }
    .pw-top-pop { position: absolute; top: 42px; right: 0; width: 280px; z-index: 90; border-radius: var(--radius-md); background: var(--surface-overlay); border: 1px solid var(--border-default); box-shadow: var(--shadow-lg); padding: var(--space-6); }
    .pw-top-pop__t { font-weight: 700; color: var(--text-primary); font-size: var(--text-sm); margin-bottom: var(--space-5); }
    .pw-top-pop__item { display: flex; gap: var(--space-5); padding: var(--space-5) 0; border-top: 1px solid var(--border-subtle); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.35; }
    .pw-top-pop__item:first-of-type { border-top: 0; }
    .pw-body { flex: 1; overflow-y: auto; min-height: 0; }
    .pw-body__inner { padding: var(--space-10) var(--space-12); margin: 0; }
    `;
  }

  const NAV = [
    { sec: "Race" },
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "weekend", label: "Weekend", icon: "flag" },
    { id: "live", label: "Live Racing", icon: "play" },
    { id: "trackmap", label: "Track Map", icon: "pin" },
    { id: "leaderboards", label: "Leaderboards", icon: "trophy" },
    { id: "schedule", label: "Schedule", icon: "calendar", countKey: "schedule" },
    { sec: "The Grid" },
    { id: "drivers", label: "Drivers", icon: "user" },
    { id: "teams", label: "Teams", icon: "grid" },
    { sec: "Explore" },
    { id: "news", label: "News", icon: "news", countKey: "news" },
    { id: "analytics", label: "Analytics", icon: "chart" },
    { id: "copilot", label: "AI Copilot", icon: "sparkles", badge: "AI" },
    { sec: "App" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  function Sidebar({ active, onNavigate }) {
    const { data, profile, connection } = window.PW.usePitWall();
    const name = profile.name.trim();
    const initials = name ? name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "PW";
    const meta = [
      connection.f1tvConnected ? "F1 TV connected" : "F1 TV needed",
      connection.aiConfigured ? "AI ready" : "AI needed",
    ].join(" · ");
    const currentLiveSession = data.sessions.find((session) => session.status === "live") || data.schedule.find((race) => race.status === "live");
    const hasCurrentLiveSession = Boolean(data.race?.lap || currentLiveSession);
    const liveRound = data.schedule.find((race) => race.status === "live") || data.schedule.find((race) => race.status === "upcoming");
    function navCount(item) {
      if (item.countKey === "schedule") return liveRound?.rnd ? "R" + liveRound.rnd : "";
      if (item.countKey === "news") return data.news.length ? String(data.news.length) : "";
      return item.count;
    }

    return (
      <aside className="pw-side">
        <div className="pw-side__brand">
          <img className="pw-side__mark" src="../../assets/logo-mark.svg" alt="" />
          <div className="pw-side__wm">PIT<i>WALL</i></div>
        </div>
        <nav className="pw-side__nav">
          {NAV.map((n, i) =>
            n.sec ? (
              <div key={"s" + i} className="pw-side__sec">{n.sec}</div>
            ) : (
              <div key={n.id} className="pw-navitem" data-active={active === n.id} onClick={() => onNavigate(n.id)}>
                <Icon name={n.icon} size={17} />
                <span>{n.label}</span>
                {n.id === "live" && hasCurrentLiveSession && <span className="pw-navitem__live"><Badge tone="live">LIVE</Badge></span>}
                {n.badge && <span className="pw-navitem__live"><Badge tone="accent">{n.badge}</Badge></span>}
                {navCount(n) && <span className="pw-navitem__count">{navCount(n)}</span>}
              </div>
            )
          )}
        </nav>
        <div className="pw-side__foot">
          <Avatar initials={initials} size="md" />
          <div className="pw-side__user">
            <span className="pw-side__uname">{name || "Set up profile"}</span>
            <span className="pw-side__umeta">{meta}</span>
          </div>
          <span onClick={() => onNavigate("settings")} style={{ marginLeft: "auto", color: "var(--text-tertiary)", cursor: "pointer", display: "inline-flex" }}>
            <Icon name="settings" size={15} />
          </span>
        </div>
      </aside>
    );
  }

  function Topbar({ title, crumb, actions, onSearchResult }) {
    const [query, setQuery] = React.useState("");
    const [openPanel, setOpenPanel] = React.useState(null);
    const { data: D, dataSource } = window.PW.usePitWall();
    const q = query.trim().toLowerCase();
    const results = q ? [
      ...(D.drivers || []).map((d) => ({ icon: "user", title: d.name, meta: d.team + " · " + d.code, screen: "drivers", driverCode: d.code })),
      ...(D.constructors || []).map((c) => ({ icon: "trophy", title: c.name, meta: "Constructor · " + c.abbr, screen: "teams", teamAbbr: c.abbr })),
      ...(D.schedule || []).map((r) => ({ icon: "calendar", title: r.name, meta: r.circuit + " · " + r.date, screen: "schedule" })),
      ...(D.news || []).map((n) => ({ icon: "news", title: n.title, meta: n.source + " · " + n.tag, screen: "news" })),
      { icon: "sparkles", title: "Ask AI Copilot", meta: "Strategy, gaps, projections", screen: "copilot" },
      { icon: "play", title: "Live Racing", meta: "Open timing and video grid", screen: "live" },
    ].filter((item) => (item.title + " " + item.meta).toLowerCase().includes(q)).slice(0, 6) : [];

    function choose(result) {
      setQuery("");
      setOpenPanel(null);
      if (onSearchResult) onSearchResult(result);
    }

    return (
      <header className="pw-top">
        <div>
          <span className="pw-top__title">{title}</span>
          {crumb && <span className="pw-top__crumb">&nbsp;&nbsp;{crumb}</span>}
        </div>
        <div className="pw-top__search">
          <Icon name="search" size={14} />
          <input className="pw-top__searchbox" value={query} placeholder="Search drivers, races…" onFocus={() => setOpenPanel("search")}
            onChange={(e) => { setQuery(e.target.value); setOpenPanel("search"); }}
            onKeyDown={(e) => { if (e.key === "Enter" && results[0]) choose(results[0]); if (e.key === "Escape") setOpenPanel(null); }} />
          <kbd>⌘K</kbd>
          {openPanel === "search" && q && (
            <div className="pw-searchpop">
              {results.length ? results.map((r, i) => (
                <div className="pw-searchpop__row" key={i} onMouseDown={(e) => { e.preventDefault(); choose(r); }}>
                  <Icon name={r.icon} size={15} />
                  <span><span className="pw-searchpop__title">{r.title}</span><span className="pw-searchpop__meta">{r.meta}</span></span>
                  <Icon name="chevronRight" size={13} />
                </div>
              )) : <div className="pw-searchpop__empty">No matching PitWall results.</div>}
            </div>
          )}
        </div>
        <div className="pw-top__actions">
          {actions}
          <span className="pw-top__actionwrap">
            <button className="pw-top__icon" data-active={openPanel === "alerts"} onClick={() => setOpenPanel(openPanel === "alerts" ? null : "alerts")} aria-label="Notifications"><Icon name="bell" size={17} /><span className="pw-top__dot" /></button>
            {openPanel === "alerts" && (
              <div className="pw-top-pop">
                <div className="pw-top-pop__t">Notifications</div>
                <div className="pw-top-pop__item"><Icon name="zap" size={14} /> {dataSource}</div>
                <div className="pw-top-pop__item"><Icon name="calendar" size={14} /> {D.race?.name ? `${D.race.name} schedule loaded.` : "Schedule waiting for live data."}</div>
              </div>
            )}
          </span>
          <span className="pw-top__actionwrap">
            <button className="pw-top__icon" data-active={openPanel === "bookmarks"} onClick={() => setOpenPanel(openPanel === "bookmarks" ? null : "bookmarks")} aria-label="Bookmarks"><Icon name="bookmark" size={17} /></button>
            {openPanel === "bookmarks" && (
              <div className="pw-top-pop">
                <div className="pw-top-pop__t">Bookmarks</div>
                <div className="pw-top-pop__item"><Icon name="news" size={14} /> Bookmark real source articles from News.</div>
                <div className="pw-top-pop__item"><Icon name="chart" size={14} /> Saved analytics live in this browser profile.</div>
              </div>
            )}
          </span>
        </div>
      </header>
    );
  }

  function AppShell({ active, onNavigate, title, crumb, actions, onSearchResult, children }) {
    const [isFullScreen, setIsFullScreen] = React.useState(false);

    React.useEffect(() => {
      const windowState = window.pitwall?.windowState;
      if (!windowState) return undefined;
      let mounted = true;
      windowState.get()
        .then((state) => {
          if (mounted) setIsFullScreen(Boolean(state?.isFullScreen));
        })
        .catch(() => {});
      const unsubscribe = windowState.onChange((state) => {
        if (mounted) setIsFullScreen(Boolean(state?.isFullScreen));
      });
      return () => {
        mounted = false;
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }, []);

    return (
      <div className={"pw-app" + (isFullScreen ? " pw-app--fullscreen" : "")}>
        <Sidebar active={active} onNavigate={onNavigate} />
        <main className="pw-main">
          <Topbar title={title} crumb={crumb} actions={actions} onSearchResult={onSearchResult} />
          <div className="pw-body">
            <div className="pw-body__inner">{children}</div>
          </div>
        </main>
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.AppShell = AppShell;
  window.PW.Sidebar = Sidebar;
  window.PW.Topbar = Topbar;
})();
