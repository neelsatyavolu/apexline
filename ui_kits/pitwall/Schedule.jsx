/* PitWall Schedule & Calendar. window.PW.Schedule */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Card, Badge, Icon, Countdown, Button, DriverTag, FlagStatus } = NS;
  const D = window.PW_DATA;

  const STYLE_ID = "pw-sched-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .sched { display: grid; grid-template-columns: 1fr 340px; gap: var(--space-9); align-items: start; }
    .sched__list { display: flex; flex-direction: column; gap: var(--space-6); }
    .race { display: grid; grid-template-columns: 64px 1fr auto; gap: var(--space-8); align-items: center; padding: var(--space-8); border-radius: var(--radius-md); background: var(--surface-card); border: 1px solid var(--border-subtle); transition: var(--tr-surface); cursor: pointer; }
    .race:hover { background: var(--surface-hover); border-color: var(--border-default); }
    .race[data-selected="true"] { border-color: var(--accent-border); box-shadow: var(--glow-accent); }
    .race[data-live="true"] { border-color: var(--accent-border); background: linear-gradient(100% 100% at 0 0, var(--accent-soft), var(--surface-card) 50%); }
    .race[data-done="true"] { opacity: 0.66; }
    .race__rnd { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-subtle); }
    .race__rndn { font-family: var(--font-display); font-weight: 800; font-size: var(--text-2xl); color: var(--text-strong); line-height: 1; }
    .race__rndl { font-size: 9px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.08em; }
    .race__name { font-family: var(--font-display); font-weight: 700; font-size: var(--text-xl); color: var(--text-primary); letter-spacing: -0.01em; }
    .race__meta { display: flex; align-items: center; gap: var(--space-5); margin-top: 3px; color: var(--text-tertiary); font-size: var(--text-sm); }
    .race__right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .race__date { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-lg); color: var(--text-primary); }
    .sessrow { display: flex; align-items: center; justify-content: space-between; padding: var(--space-6) var(--space-7); border-radius: var(--radius-sm); }
    .sessrow:hover { background: var(--surface-hover); }
    .sessrow[data-live="true"] { background: var(--accent-quiet); }
    .sessrow__k { display: flex; align-items: center; gap: var(--space-6); }
    .sessrow__day { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-tertiary); width: 28px; }
    .sessrow__name { font-weight: 500; color: var(--text-primary); font-size: var(--text-md); }
    .sessrow__t { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .tz { display: flex; align-items: center; gap: var(--space-5); font-size: var(--text-xs); color: var(--text-tertiary); }
    `;
    document.head.appendChild(el);
  }

  function Schedule({ onNavigate } = {}) {
    const { data: D, dataSource } = window.PW.usePitWall();
    const liveRound = D.schedule.find((r) => r.status === "live") || D.schedule.find((r) => r.status === "upcoming") || D.schedule[0] || {};
    const [selectedRound, setSelectedRound] = React.useState(liveRound.rnd);
    const [reminders, setReminders] = React.useState([liveRound.rnd]);
    const selectedRace = D.schedule.find((r) => r.rnd === selectedRound) || liveRound;
    const selectedSessions = selectedRace.sessions || [];
    const nextSession = selectedSessions.find((s) => s.status === "live") || selectedSessions.find((s) => s.status === "upcoming") || selectedSessions[0];
    const countdownTo = nextSession?.startsAt || selectedRace.startsAt;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";

    function toggleReminder(round) {
      const race = D.schedule.find((item) => item.rnd === round) || selectedRace;
      setReminders((current) => {
        const exists = current.includes(round);
        if (!exists && window.pitwall?.notifications?.schedule) {
          const firstUpcoming = (race.sessions || []).find((session) => session.status !== "done" && session.startsAt);
          const startsAt = firstUpcoming?.startsAt || race.startsAt;
          if (startsAt) {
            window.pitwall.notifications.schedule({
              id: `race-${round}`,
              title: "PitWall race reminder",
              body: `${race.name || "Formula 1"}${firstUpcoming?.kind ? " - " + firstUpcoming.kind : ""} starts soon.`,
              at: startsAt,
            }).catch(() => {});
          }
        }
        return exists ? current.filter((r) => r !== round) : [...current, round];
      });
    }

    function openWeekendRecap(race) {
      const params = new URLSearchParams(window.location.search || "");
      params.set("screen", "weekend");
      if (race?.rnd) params.set("weekendRound", String(race.rnd));
      params.set("weekendMode", "recap");
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash || ""}`);
      if (onNavigate) onNavigate("weekend");
    }

    return (
      <div className="sched">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, margin: 0, color: "var(--text-strong)" }}>{D.seasonSummary.season} Calendar</h2>
            <Badge tone="accent">{D.seasonSummary.round || "—"} / {D.seasonSummary.totalRounds || D.schedule.length || "—"} rounds</Badge>
            <div style={{ marginLeft: "auto" }}>
              <Button variant={reminders.includes(selectedRound) ? "quiet" : "secondary"} size="sm" onClick={() => toggleReminder(selectedRound)} iconLeft={<Icon name="bell" size={14} />}>
                {reminders.includes(selectedRound) ? "Reminder on" : "Remind me"}
              </Button>
            </div>
          </div>
          <div className="sched__list">
            {D.schedule.length ? D.schedule.map((r) => (
              <div className="race" key={r.rnd} data-live={r.status === "live"} data-done={r.status === "done"} data-selected={selectedRound === r.rnd} onClick={() => openWeekendRecap(r)}>
                <div className="race__rnd"><span className="race__rndn">{r.rnd}</span><span className="race__rndl">Round</span></div>
                <div>
                  <div className="race__name">{r.name}</div>
                  <div className="race__meta"><Icon name="pin" size={13} /> {r.circuit} · {r.loc}</div>
                </div>
                <div className="race__right">
                  {reminders.includes(r.rnd) && <Badge tone="accent">REMINDER</Badge>}
                  {r.status === "live" ? <Badge tone="live">RACE LIVE</Badge>
                    : r.status === "done" ? <Badge tone="neutral">Won · {r.winner}</Badge>
                    : <span className="race__date">{r.date}</span>}
                  {r.status !== "done" && <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{r.date} · local time</span>}
                </div>
              </div>
            )) : <div className="race"><div /><div><div className="race__name">Live calendar unavailable</div><div className="race__meta">{dataSource}</div></div></div>}
          </div>
        </div>

        {/* Right rail: next session + weekend schedule */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-9)" }}>
          <Card title={selectedRace.status === "done" ? "Completed round" : "Next session"} subtitle={[selectedRace.name, nextSession?.kind].filter(Boolean).join(" · ")} aside={selectedRace.status === "live" ? <FlagStatus status="green" label="Live" /> : <Badge tone="outline">R{selectedRace.rnd || "—"}</Badge>}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
              {selectedRace.status === "done" ? <Badge tone="neutral">Completed</Badge> : countdownTo ? <Countdown to={countdownTo} size="sm" /> : <Badge tone="outline">{dataSource}</Badge>}
              <div className="tz"><Icon name="timer" size={13} /> {selectedRace.date || "Date pending"} · {timeZone}</div>
            </div>
          </Card>

          <Card title="Race weekend" subtitle={(selectedRace.loc || "Selected round") + " · your timezone"} padding="tight">
            <div style={{ display: "flex", flexDirection: "column" }}>
              {selectedRace.sessions?.length ? selectedRace.sessions.map((s) => (
                <div className="sessrow" key={s.kind} data-live={s.status === "live"}>
                  <div className="sessrow__k">
                    <span className="sessrow__day">{s.day}</span>
                    <span className="sessrow__name">{s.kind}</span>
                    {s.status === "live" && <Badge tone="live">LIVE</Badge>}
                    {s.status === "done" && <Icon name="check" size={14} />}
                  </div>
                  <span className="sessrow__t">{s.time}</span>
                </div>
              )) : <div className="sessrow"><span className="sessrow__name">Session times unavailable</span><span className="sessrow__t">—</span></div>}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.Schedule = Schedule;
})();
