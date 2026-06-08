const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..");
const assetDir = path.join(root, "updates-site/public/assets");
app.on("window-all-closed", (event) => event.preventDefault());

const screens = [
  { id: "trackmap", title: "Track Map", crumb: "Circuit & live positions", file: "apexline-screen-track-map.png", wait: ".tm-screen" },
  { id: "copilot", title: "AI Copilot", crumb: "Race intelligence", file: "apexline-screen-ai-copilot-next-weekend.png", wait: ".cop", after: "nextWeekend" },
  { id: "analytics", title: "Analytics", crumb: "Monaco Race comparison", file: "apexline-screen-analytics-ant-ham-monaco.png", wait: ".an", after: "analytics" },
  { id: "news", title: "News", crumb: "Live feed", file: "apexline-screen-news.png", wait: ".news2" },
  { id: "drivers", title: "Drivers", crumb: "2026 grid", file: "apexline-screen-drivers.png", wait: ".dv" },
  { id: "teams", title: "Teams", crumb: "Constructors", file: "apexline-screen-teams.png", wait: ".tm" },
  { id: "schedule", title: "Schedule", crumb: "2026 Season", file: "apexline-screen-schedule.png", wait: ".sched" },
  { id: "leaderboards", title: "Leaderboards", crumb: "2026 Championship", file: "apexline-screen-leaderboards.png", wait: ".lb" },
  { id: "weekend", title: "Weekend", crumb: "Race weekend", file: "apexline-screen-weekend.png", wait: ".wk" },
];

function fileUrl(...parts) {
  return pathToFileURL(path.join(root, ...parts)).href;
}

function fixtureScript() {
  return `
  (function () {
    const base = window.PW_DATA || {};
    const order = ["ANT", "HAM", "VER", "LEC", "NOR", "PIA", "RUS", "HAD", "ALO", "STR", "SAI", "ALB", "GAS", "COL", "LAW", "LIN", "HUL", "BOR", "OCO", "BEA", "PER", "BOT"];
    const pointMap = { ANT: 156, HAM: 141, VER: 132, LEC: 124, NOR: 118, PIA: 110, RUS: 98, HAD: 74, ALO: 42, STR: 38, SAI: 35, ALB: 32, GAS: 24, COL: 19, LAW: 15, LIN: 12, HUL: 10, BOR: 8, OCO: 6, BEA: 5, PER: 3, BOT: 1 };
    function svgData(svg) {
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }
    function portraitSvg(driver) {
      const color = driver.color || "#2d7bff";
      const code = driver.code || "";
      const number = driver.num || "";
      return svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 640"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#171b24"/><stop offset="1" stop-color="#05070b"/></linearGradient><radialGradient id="glow" cx="62%" cy="20%" r="68%"><stop stop-color="' + color + '" stop-opacity=".55"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></radialGradient></defs><rect width="520" height="640" fill="url(#bg)"/><rect width="520" height="640" fill="url(#glow)"/><path d="M86 640c18-128 78-210 174-210s156 82 174 210H86Z" fill="#151b26"/><path d="M130 640V500c0-62 48-112 130-112s130 50 130 112v140" fill="' + color + '" opacity=".9"/><path d="M168 640V506c0-44 34-80 92-80s92 36 92 80v134" fill="#202735"/><circle cx="260" cy="248" r="104" fill="#d7b18c"/><path d="M163 238c12-96 66-144 166-104 34 14 54 46 50 102-42-18-96-28-216 2Z" fill="#171b24"/><path d="M180 240c28 18 52 20 84 10 38-12 70-8 96 10" fill="none" stroke="#0b0d12" stroke-width="14" stroke-linecap="round" opacity=".45"/><circle cx="220" cy="254" r="8" fill="#10141d"/><circle cx="302" cy="254" r="8" fill="#10141d"/><path d="M225 304c28 20 64 20 92 0" fill="none" stroke="#7d4f43" stroke-width="10" stroke-linecap="round"/><path d="M132 544h256" stroke="#f4f6fb" stroke-width="36" stroke-linecap="round"/><text x="260" y="558" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="54" font-weight="900" fill="#0b0d12">' + code + '</text><text x="260" y="622" text-anchor="middle" font-family="Menlo,Consolas,monospace" font-size="42" font-weight="800" fill="#f4f6fb">#' + number + '</text></svg>');
    }
    function logoSvg(team) {
      const color = team.color || "#2d7bff";
      const abbr = team.abbr || "";
      return svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 340"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#151a23"/><stop offset="1" stop-color="#07090e"/></linearGradient><radialGradient id="glow" cx="70%" cy="30%" r="70%"><stop stop-color="' + color + '" stop-opacity=".45"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></radialGradient></defs><rect width="760" height="340" rx="42" fill="url(#bg)"/><rect width="760" height="340" fill="url(#glow)"/><g opacity=".14" stroke="#f4f6fb"><path d="M0 82h760M0 170h760M0 258h760"/><path d="M130 0v340M260 0v340M390 0v340M520 0v340M650 0v340"/></g><path d="M110 214h410l70-72h72" fill="none" stroke="' + color + '" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/><path d="M188 214l68-80h170l72 80" fill="#10141d" stroke="#f4f6fb" stroke-width="18" stroke-linejoin="round"/><circle cx="224" cy="224" r="36" fill="#0b0d12" stroke="#f4f6fb" stroke-width="12"/><circle cx="492" cy="224" r="36" fill="#0b0d12" stroke="#f4f6fb" stroke-width="12"/><text x="64" y="112" font-family="Arial Black,Arial,sans-serif" font-size="76" font-weight="900" fill="#f4f6fb">' + abbr + '</text><text x="64" y="154" font-family="Menlo,Consolas,monospace" font-size="24" font-weight="800" fill="' + color + '">CONSTRUCTOR</text></svg>');
    }
    function newsSvg(title, color) {
      return svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#151923"/><stop offset=".55" stop-color="#0b0f16"/><stop offset="1" stop-color="#05070b"/></linearGradient><radialGradient id="glow" cx="74%" cy="22%" r="70%"><stop stop-color="' + color + '" stop-opacity=".62"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></radialGradient></defs><rect width="1280" height="720" fill="url(#bg)"/><rect width="1280" height="720" fill="url(#glow)"/><g opacity=".16" stroke="#f4f6fb"><path d="M0 560h1280M0 470h1280M0 380h1280M0 290h1280"/><path d="M160 0v720M320 0v720M480 0v720M640 0v720M800 0v720M960 0v720M1120 0v720"/></g><path d="M174 444h566l112-118h146" fill="none" stroke="' + color + '" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/><path d="M270 444l96-132h236l108 132" fill="#111722" stroke="#f4f6fb" stroke-width="24" stroke-linejoin="round"/><circle cx="334" cy="466" r="48" fill="#0b0d12" stroke="#f4f6fb" stroke-width="16"/><circle cx="684" cy="466" r="48" fill="#0b0d12" stroke="#f4f6fb" stroke-width="16"/><path d="M98 620c176-120 386-126 610-42 176 66 310 32 474-110" fill="none" stroke="' + color + '" stroke-width="24" stroke-linecap="round" opacity=".65"/><rect x="88" y="84" width="14" height="552" rx="7" fill="' + color + '"/><text x="136" y="176" font-family="Arial Black,Arial,sans-serif" font-size="72" font-weight="900" fill="#f4f6fb">APEXLINE</text><text x="136" y="250" font-family="Menlo,Consolas,monospace" font-size="34" font-weight="800" fill="#c8d0df">' + title + '</text></svg>');
    }
    const drivers = order.map((code) => {
      const d = (base.byCode && base.byCode[code]) || (base.drivers || []).find((item) => item.code === code) || { code, name: code, team: "", num: "" };
      const richImage = portraitSvg(d);
      return { ...d, remoteImage: d.remoteImage || richImage, image: d.image || richImage, color: d.color || "var(--accent)" };
    });
    const byCode = Object.fromEntries(drivers.map((driver) => [driver.code, driver]));
    const standings = drivers.map((driver, index) => ({ pos: index + 1, position: index + 1, code: driver.code, pts: pointMap[driver.code] || Math.max(1, 70 - index * 3), wins: index < 2 ? 2 : index === 2 ? 1 : 0 }));
    const constructors = (base.constructors || []).map((team, index) => ({ ...team, logo: team.logo || logoSvg(team), pos: index + 1, pts: [256, 242, 206, 190, 72, 66, 27, 43, 11, 18, 4][index] || Math.max(1, 40 - index * 3) }));
    const monacoSessions = [
      { kind: "Practice 1", day: "FRI", time: "04:30", status: "done", startsAt: "2026-05-22T11:30:00Z" },
      { kind: "Practice 2", day: "FRI", time: "08:00", status: "done", startsAt: "2026-05-22T15:00:00Z" },
      { kind: "Practice 3", day: "SAT", time: "03:30", status: "done", startsAt: "2026-05-23T10:30:00Z" },
      { kind: "Qualifying", day: "SAT", time: "07:00", status: "done", startsAt: "2026-05-23T14:00:00Z" },
      { kind: "Race", day: "SUN", time: "06:00", status: "done", startsAt: "2026-05-24T13:00:00Z" },
    ];
    const spanishSessions = [
      { kind: "Practice 1", day: "FRI", time: "04:30", status: "upcoming", startsAt: "2026-06-12T11:30:00Z" },
      { kind: "Practice 2", day: "FRI", time: "08:00", status: "upcoming", startsAt: "2026-06-12T15:00:00Z" },
      { kind: "Practice 3", day: "SAT", time: "03:30", status: "upcoming", startsAt: "2026-06-13T10:30:00Z" },
      { kind: "Qualifying", day: "SAT", time: "07:00", status: "upcoming", startsAt: "2026-06-13T14:00:00Z" },
      { kind: "Race", day: "SUN", time: "06:00", status: "upcoming", startsAt: "2026-06-14T13:00:00Z" },
    ];
    const monaco = { rnd: 8, name: "Monaco Grand Prix", circuit: "Circuit de Monaco", loc: "Monte Carlo, Monaco", date: "May 24", winner: "ANT", status: "done", meetingKey: "monaco-2026", startsAt: "2026-05-24T13:00:00Z", sessions: monacoSessions };
    const spain = { rnd: 9, name: "Spanish Grand Prix", circuit: "Circuit de Barcelona-Catalunya", loc: "Barcelona, Spain", date: "Jun 14", status: "upcoming", meetingKey: "spain-2026", startsAt: "2026-06-14T13:00:00Z", sessions: spanishSessions };
    const canada = { rnd: 10, name: "Canadian Grand Prix", circuit: "Circuit Gilles Villeneuve", loc: "Montreal, Canada", date: "Jun 28", status: "upcoming", startsAt: "2026-06-28T18:00:00Z", sessions: [{ kind: "Practice 1", day: "FRI", time: "10:30", status: "upcoming", startsAt: "2026-06-26T17:30:00Z" }, { kind: "Qualifying", day: "SAT", time: "14:00", status: "upcoming", startsAt: "2026-06-27T21:00:00Z" }, { kind: "Race", day: "SUN", time: "11:00", status: "upcoming", startsAt: "2026-06-28T18:00:00Z" }] };
    const miami = { rnd: 6, name: "Miami Grand Prix", circuit: "Miami International Autodrome", loc: "Miami, United States", date: "May 3", winner: "HAM", status: "done", startsAt: "2026-05-03T20:00:00Z", sessions: [{ kind: "Race", day: "SUN", time: "13:00", status: "done", startsAt: "2026-05-03T20:00:00Z" }] };
    const emilia = { rnd: 7, name: "Emilia-Romagna Grand Prix", circuit: "Imola", loc: "Imola, Italy", date: "May 17", winner: "VER", status: "done", startsAt: "2026-05-17T13:00:00Z", sessions: [{ kind: "Race", day: "SUN", time: "06:00", status: "done", startsAt: "2026-05-17T13:00:00Z" }] };
    const austria = { rnd: 11, name: "Austrian Grand Prix", circuit: "Red Bull Ring", loc: "Spielberg, Austria", date: "Jul 5", status: "upcoming", startsAt: "2026-07-05T13:00:00Z", sessions: [{ kind: "Race", day: "SUN", time: "06:00", status: "upcoming", startsAt: "2026-07-05T13:00:00Z" }] };
    const british = { rnd: 12, name: "British Grand Prix", circuit: "Silverstone Circuit", loc: "Silverstone, United Kingdom", date: "Jul 12", status: "upcoming", startsAt: "2026-07-12T14:00:00Z", sessions: [{ kind: "Race", day: "SUN", time: "07:00", status: "upcoming", startsAt: "2026-07-12T14:00:00Z" }] };
    const compounds = ["medium", "hard", "medium", "soft", "hard", "medium", "soft", "medium", "hard", "soft", "medium"];
    const timing = drivers.map((driver, index) => ({
      pos: index + 1,
      code: driver.code,
      gap: index === 0 ? "LEADER" : "+" + (index * 1.827 + 0.613).toFixed(3),
      interval: index === 0 ? "LEADER" : "+" + (0.55 + (index % 6) * 0.31).toFixed(3),
      last: "1:" + String(16 + (index % 5)).padStart(2, "0") + "." + String(240 + index * 23).slice(0, 3),
      best: "1:" + String(15 + (index % 4)).padStart(2, "0") + "." + String(105 + index * 17).slice(0, 3),
      comp: compounds[index % compounds.length],
      age: 8 + (index % 20),
      sectors: { s1: index % 5 === 0 ? "purple" : "green", s2: index % 3 === 0 ? "green" : "neutral", s3: index % 4 === 0 ? "green" : "neutral" },
      telemetry: { speed: 282 - (index % 8) * 3, gear: 6 + (index % 2), throttle: 82 - (index % 4) * 5, brake: index % 4 === 0 ? 9 : 0 },
    }));
    const newsPhotos = {
      monaco: "https://commons.wikimedia.org/wiki/Special:FilePath/F1_2011_Barcelona_test_-_Vettel.jpg?width=1280",
      spain: "https://commons.wikimedia.org/wiki/Special:FilePath/F1_2012_Barcelona_test_-_Mercedes_car.jpg?width=1280",
      constructors: "https://commons.wikimedia.org/wiki/Special:FilePath/2019_Formula_One_tests_Barcelona%2C_Norris_%2840287124563%29.jpg?width=1280",
      market: "https://commons.wikimedia.org/wiki/Special:FilePath/2020_Formula_One_tests_Barcelona%2C_Williams_FW43%2C_Russell.jpg?width=1280",
      strategy: "https://commons.wikimedia.org/wiki/Special:FilePath/2020_Formula_One_tests_Barcelona%2C_Alfa_Romeo_C39%2C_R%C3%A4ikk%C3%B6nen.jpg?width=1280",
    };
    const news = [
      { id: "monaco-pace", title: "Apexline race notebook: Monaco pace trends", source: "Apexline", tag: "Analysis", time: "2h", color: "#2d7bff", image: newsPhotos.monaco, images: [newsPhotos.monaco], lead: "Mercedes traction and Ferrari race pace shape the post-Monaco comparison as ANT and HAM split the strongest signals.", body: "The Monaco read rewards clean air more than peak speed, but the telemetry still shows a meaningful split. ANT carried the better average pace through the middle sector while HAM held the top-speed edge and gained most of his racecraft score in traffic. The result is a tidy preview for Barcelona, where tyre stress and sector-three traction should matter more than street-circuit positioning." },
      { id: "spain-guide", title: "Spanish Grand Prix weekend guide", source: "Apexline", tag: "Schedule", time: "4h", color: "#55d6be", image: newsPhotos.spain, images: [newsPhotos.spain], lead: "The next weekend moves to Barcelona with qualifying balance, long-run degradation, and medium-stint warmup in focus.", body: "Barcelona is the first clean aero reference after Monaco. Apexline's seeded preview puts tyre life and high-load stability at the center of the weekend, especially for Mercedes and Ferrari. The opening practice sessions should show whether ANT can keep the medium tyre alive or whether HAM's top-speed advantage becomes easier to convert into race pressure." },
      { id: "constructor-form", title: "Constructor form check after Monaco", source: "Apexline", tag: "Standings", time: "Yesterday", color: "#f6c85f", image: newsPhotos.constructors, images: [newsPhotos.constructors], lead: "The front of the constructor table remains compressed after a strategy-heavy street race.", body: "Red Bull, Mercedes, Ferrari, and McLaren remain close enough that one noisy weekend can change the order. The biggest split is not raw points, but how each team is making them: Mercedes through consistency, Ferrari through qualifying peaks, McLaren through tyre life, and Red Bull through high-speed balance." },
      { id: "driver-market", title: "Driver market watch: young talent edition", source: "Apexline", tag: "Paddock", time: "Yesterday", color: "#e7323f", image: newsPhotos.market, images: [newsPhotos.market], lead: "A quick scan of rookie form and teammate deltas across the grid.", body: "The rookie class is no longer just a development story. ANT leads the seeded standings, HAD has made Red Bull's second seat look unusually stable, and LIN gives Racing Bulls a data-rich comparison point. Apexline keeps those gaps visible without turning the race window into a rumor feed." },
      { id: "strategy-pulse", title: "Strategy pulse: Barcelona tyre windows", source: "Apexline", tag: "Strategy", time: "Yesterday", color: "#9b72ff", image: newsPhotos.strategy, images: [newsPhotos.strategy], lead: "Medium-to-hard timing is the likely decision point for the next race weekend.", body: "The seeded model gives teams one obvious fork: protect the medium tyre and delay the stop, or chase track position before the hard tyre reaches its peak. That should make the first stint more readable than Monaco, where traffic distorted almost every clean comparison." },
    ];
    const copilot = {
      daily: {
        status: "ready",
        generatedOn: "Jun 8",
        generatedAt: "2026-06-08T15:00:00Z",
        attemptedOn: "Jun 8",
        pages: [
          { id: "drivers-championship", title: "Driver championship picture", kicker: "Automatic standings read", summary: "ANT leads the seeded snapshot with HAM within one race swing.", bullets: ["Top two separated by 15 points.", "VER remains in range if Barcelona favors high-speed balance."], visualization: null, predictions: { available: false } },
          { id: "constructors-championship", title: "Constructor championship picture", kicker: "Automatic standings read", summary: "Mercedes and Ferrari are close enough that Barcelona can flip the lead.", bullets: ["McLaren remains strong on tyre life.", "Red Bull's floor-speed package keeps them within range."], visualization: null, predictions: { available: false } },
          { id: "current-weekend", title: "Current weekend recap", kicker: "Monaco review", summary: "The Monaco race was decided by track position, stint patience, and late tyre management.", bullets: ["ANT's second stint was cleaner across S2.", "HAM's peak pace was stronger but less consistent in traffic."], visualization: { kind: "strategy", label: "Street circuit pressure", value: 74 }, predictions: { available: false } },
          { id: "next-weekend", title: "Next weekend: Spanish Grand Prix", kicker: "Barcelona preview", summary: "Barcelona should reward stable aero load, clean tyre warmup, and medium-stint consistency.", bullets: ["Watch ANT vs HAM on long-run degradation.", "Ferrari needs cleaner sector-three traction to protect qualifying gains.", "Mercedes can pressure the undercut if track temperatures stay high."], visualization: { kind: "strategy", title: "Barcelona race plan", subtitle: "AI strategy rows from seeded timing, weather, and news context", rows: [{ code: "ANT", label: "Protect medium tyre, extend stint one", currentCompound: "MEDIUM", tyreAge: 8, pitStops: 1, confidence: 0.82, stints: [{ compound: "MEDIUM", laps: 25 }, { compound: "HARD", laps: 41 }], recommendation: "Delay stop if clean air remains above 2.5s." }, { code: "HAM", label: "Undercut pressure window", currentCompound: "MEDIUM", tyreAge: 8, pitStops: 2, confidence: 0.76, stints: [{ compound: "MEDIUM", laps: 18 }, { compound: "HARD", laps: 30 }, { compound: "SOFT", laps: 18 }], recommendation: "Attack if track temp stays above 36C." }, { code: "VER", label: "High-speed balance threat", currentCompound: "HARD", tyreAge: 5, pitStops: 1, confidence: 0.69, stints: [{ compound: "HARD", laps: 34 }, { compound: "MEDIUM", laps: 32 }], recommendation: "Overcut gains if sector two grip holds." }], notes: ["Medium warmup is the first-stint swing factor.", "Sector three traction protects the undercut.", "Clean air remains worth more than peak speed."] }, predictions: { available: true, title: "Barcelona projection", summary: "Seeded projection from schedule, standings, timing and news coverage.", winner: [{ code: "ANT", confidence: 0.78, probability: 0.31, reason: "Best degradation profile in the seeded long-run read." }, { code: "HAM", confidence: 0.74, probability: 0.27, reason: "Top-speed edge creates the strongest undercut lane." }, { code: "VER", confidence: 0.68, probability: 0.20, reason: "High-speed balance keeps Red Bull in range." }], podium: [{ code: "ANT", confidence: 0.84, probability: 0.71, reason: "P1 projection from tyre consistency." }, { code: "HAM", confidence: 0.80, probability: 0.66, reason: "P2 projection with strong sector-three traction." }, { code: "VER", confidence: 0.72, probability: 0.58, reason: "P3 projection from high-speed baseline." }], leaderboard: [{ code: "ANT", probability: 0.31, reason: "Win lane" }, { code: "HAM", probability: 0.27, reason: "Podium lane" }, { code: "VER", probability: 0.20, reason: "High-speed threat" }, { code: "LEC", probability: 0.14, reason: "Qualifying threat" }, { code: "NOR", probability: 0.08, reason: "Tyre-life upside" }], watchlist: [{ label: "HAM sector-three traction", confidence: 0.77, prediction: "If rear temps stay stable, HAM pressures the undercut from lap 18." }, { label: "ANT tyre warmup", confidence: 0.82, prediction: "ANT keeps the medium alive longest if the opening stint stays clean." }, { label: "Ferrari qualifying delta", confidence: 0.63, prediction: "LEC needs front-row track position to convert peak pace." }], caveat: "Screenshot data is deterministic for the public landing page." } },
          { id: "ask-copilot", title: "Ask Copilot", summary: "Ask grounded questions about the loaded snapshot.", bullets: [], visualization: null, predictions: { available: false } },
        ],
      },
    };
    function analyticsRow(code, index) {
      const driver = byCode[code] || { code, team: "", abbr: "", color: "var(--accent)" };
      const baseLap = code === "ANT" ? 75.214 : code === "HAM" ? 75.301 : 75.9 + index * 0.19;
      return {
        code,
        position: index + 1,
        number: driver.num,
        name: driver.name,
        team: driver.team,
        teamAbbr: driver.abbr,
        color: driver.color || "var(--accent)",
        fastestLap: baseLap,
        avgLap: baseLap + (code === "HAM" ? 0.18 : 0.11),
        topSpeed: code === "HAM" ? 289 : code === "ANT" ? 286 : 282 - index,
        tyreDeg: code === "ANT" ? 0.045 : code === "HAM" ? 0.061 : 0.075 + index / 300,
        pitLoss: code === "ANT" ? 21.4 : code === "HAM" ? 21.9 : 22.5 + index / 10,
        laps: 78,
        sectors: { s1: baseLap / 3 - 0.13, s2: baseLap / 3 + (code === "ANT" ? -0.22 : 0.03), s3: baseLap / 3 + (code === "HAM" ? -0.16 : 0.04) },
        stints: [{ lapStart: 1, lapEnd: 31, compound: "MEDIUM" }, { lapStart: 32, lapEnd: 78, compound: "HARD" }],
        lapTrace: Array.from({ length: 12 }, (_, lap) => ({ lap: lap + 1, duration: baseLap + Math.sin(lap / 2) * 0.22 + (lap % 4) * 0.025 })),
        tyreCurve: Array.from({ length: 12 }, (_, lap) => ({ tyreAge: lap + 1, duration: baseLap + lap * (code === "ANT" ? 0.028 : 0.039) })),
        consistency: { medianLap: baseLap + 0.18, bestFiveAvg: baseLap + 0.08, spread: code === "ANT" ? 0.42 : 0.57, cleanLapCount: 46 - index },
        racecraft: { positionDelta: code === "HAM" ? 2 : code === "ANT" ? 1 : 0, overtakes: code === "HAM" ? 3 : 1, pitStops: 1 },
      };
    }
    const analyticsRows = ["ANT", "HAM", "VER", "LEC", "NOR"].map(analyticsRow);
    const formRounds = [
      { rnd: 4, gp: "Japanese GP", loc: "Suzuka" },
      { rnd: 5, gp: "Chinese GP", loc: "Shanghai" },
      { rnd: 6, gp: "Miami GP", loc: "Miami" },
      { rnd: 7, gp: "Emilia-Romagna GP", loc: "Imola" },
      { rnd: 8, gp: "Monaco GP", loc: "Monte Carlo" },
    ];
    const driverForm = Object.fromEntries(drivers.map((driver, index) => [
      driver.code,
      [index + 4, index + 3, index + 2, index + 1, index === 0 ? 1 : index === 1 ? 2 : index + 1].map((pos) => Math.min(20, pos)),
    ]));
    driverForm.ANT = [2, 1, 4, 2, 1];
    driverForm.HAM = [4, 3, 1, 5, 2];
    driverForm.VER = [1, 5, 2, 1, 3];
    driverForm.LEC = [5, 2, 3, 4, 4];
    const schedule = [miami, emilia, monaco, spain, canada, austria, british];
    window.PW_DATA = {
      ...base,
      source: "screenshot",
      sourceLabel: "Apexline screenshot fixture",
      drivers,
      byCode,
      standings,
      constructors,
      timing,
      schedule,
      sessions: spanishSessions,
      news,
      copilot,
      driverForm,
      formRounds,
      battlePairs: [
        { a: "ANT", b: "HAM", title: "Tyre stress delta", body: "ANT has a small consistency edge; HAM carries stronger peak-speed upside.", gap: "+0.087" },
        { a: "LEC", b: "VER", title: "Qualifying pressure", body: "LEC can challenge if Ferrari keeps rear traction stable." },
      ],
      insights: [
        { kind: "strategy", title: "Barcelona preview", body: "Medium-stint degradation is the swing factor for ANT versus HAM." },
        { kind: "battle", title: "Monaco comparison", body: "ANT's average pace beat HAM by 0.18s in the seeded Monaco race read." },
      ],
      strategyContext: { summary: "Barcelona preview seeded from deterministic site capture data." },
      race: { name: spain.name, circuit: spain.circuit, loc: spain.loc, round: 9, lap: 0, laps: 66, startsAt: spain.startsAt, weather: { air: "24", track: "37", cond: "Clear", rain: "0%", wind: "8 km/h", humidity: "52%" } },
      seasonSummary: { season: "2026", round: 9, totalRounds: 22 },
      errors: [],
    };
    window.pitwall = {
      profile: { get: async () => ({ name: "Apexline", favoriteDrivers: ["ANT", "HAM"], favoriteTeams: ["MER", "FER"] }), set: async () => true },
      windowState: { get: async () => ({ isFullScreen: false }), onChange: () => () => {} },
      ai: { authStatus: async () => ({ codexConnected: true }), ask: async () => ({ summary: "Barcelona rewards stable aero load and tyre consistency." }) },
      f1tv: { probeStatus: async () => ({ authenticated: true }), status: async () => ({ authenticated: true }) },
      analytics: {
        library: async () => ({ source: "Apexline fixture", season: "2026", races: [monaco] }),
        session: async () => ({ source: "Apexline fixture", session: { name: "Race", circuit: "Circuit de Monaco", location: "Monte Carlo, Monaco" }, counts: { laps: 390 }, weather: { air: "24 C", track: "38 C", cond: "Clear", rain: "0%", wind: "7 km/h", humidity: "49%" }, drivers: analyticsRows }),
      },
      history: { query: async () => ({ title: "Monaco context", body: "Street-circuit track position made clean-air pace especially valuable." }) },
    };
    localStorage.setItem("pw-profile", JSON.stringify({ name: "Apexline", favoriteDrivers: ["ANT", "HAM"], favoriteTeams: ["MER", "FER"] }));
  })();`;
}

function harnessHtml(screen) {
  const scripts = [
    "theme",
    "data",
    "sync",
    "trackmap-circuits",
    "DataProvider",
    "AppShell",
    "Dashboard",
    "Weekend",
    "Leaderboards",
    "TrackMap",
    "Drivers",
    "Teams",
    "Schedule",
    "News",
    "Analytics",
    "Copilot",
  ];
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <base href="${pathToFileURL(path.join(root, "dist/pitwall/index.html")).href}">
  <link rel="stylesheet" href="${fileUrl("styles.css")}">
  <style>
    html, body, #root { margin: 0; width: 100%; height: 100%; background: #05070b; overflow: hidden; }
    body { color-scheme: dark; }
    * { animation-duration: 0s !important; transition-duration: 0s !important; }
    .pw-app { grid-template-columns: 1fr !important; }
    .pw-side { display: none !important; }
    .pw-top { height: 62px !important; padding: 0 30px !important; }
    .pw-body__inner { padding: 30px 34px !important; }
    .pw-top__search { min-width: 340px; }
    .tm-hero__logo { height: 140px !important; width: 300px !important; object-fit: contain; }
    .pw-body { scrollbar-width: none; }
    .pw-body::-webkit-scrollbar { display: none; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="${fileUrl("node_modules/react/umd/react.development.js")}"></script>
  <script src="${fileUrl("node_modules/react-dom/umd/react-dom.development.js")}"></script>
  <script src="${fileUrl("node_modules/hls.js/dist/hls.min.js")}"></script>
  <script src="${fileUrl("node_modules/shaka-player/dist/shaka-player.compiled.js")}"></script>
  <script src="${fileUrl("_ds_bundle.js")}"></script>
  <script src="${fileUrl("dist/pitwall/theme.js")}"></script>
  <script src="${fileUrl("dist/pitwall/data.js")}"></script>
  <script>${fixtureScript()}</script>
  ${scripts.filter((name) => name !== "theme" && name !== "data").map((name) => `<script src="${fileUrl("dist/pitwall", `${name}.js`)}"></script>`).join("\n  ")}
  <script>
    const Screen = window.PW.${screen.id === "trackmap" ? "TrackMap" : screen.id.charAt(0).toUpperCase() + screen.id.slice(1)};
    ReactDOM.createRoot(document.getElementById("root")).render(
      React.createElement(window.PW.DataProvider, null,
        React.createElement(window.PW.AppShell, {
          active: "${screen.id}",
          onNavigate: function () {},
          title: ${JSON.stringify(screen.title)},
          crumb: ${JSON.stringify(screen.crumb)},
        }, React.createElement(Screen))
      )
    );
  </script>
</body>
</html>`;
}

async function waitFor(win, selector, timeout = 9000) {
  const deadline = Date.now() + timeout;
  let state = {};
  while (Date.now() < deadline) {
    state = await win.webContents.executeJavaScript(`({
      ok: Boolean(document.querySelector(${JSON.stringify(selector)})),
      text: document.body.innerText.slice(0, 500),
      errors: Array.from(document.querySelectorAll(".startup-load__error")).map((el) => el.textContent).join(" ")
    })`, true);
    if (state.ok) return state;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for ${selector}: ${JSON.stringify(state)}`);
}

async function runAfter(win, mode) {
  if (mode === "nextWeekend") {
    await win.webContents.executeJavaScript(`
      Array.from(document.querySelectorAll(".cop-tab")).find((el) => /Next weekend/i.test(el.textContent))?.click();
    `, true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await win.webContents.executeJavaScript(`document.querySelector(".pw-body")?.scrollTo(0, 420);`, true);
    await new Promise((resolve) => setTimeout(resolve, 120));
    return;
  }
  if (mode === "analytics") {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await win.webContents.executeJavaScript(`
      Array.from(document.querySelectorAll("button")).find((el) => /^Load$/.test(el.textContent.trim()))?.click();
    `, true);
    await waitFor(win, ".compare__val", 6000);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

async function waitForImages(win, timeout = 7000) {
  const deadline = Date.now() + timeout;
  let state = {};
  while (Date.now() < deadline) {
    state = await win.webContents.executeJavaScript(`(() => {
      const images = Array.from(document.images);
      const visible = images.filter((img) => img.offsetWidth > 0 && img.offsetHeight > 0);
      const loaded = visible.filter((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
      return { total: visible.length, loaded: loaded.length };
    })()`, true);
    if (!state.total || state.loaded >= state.total) return state;
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  return state;
}

async function capture(screen) {
  const harnessPath = path.join("/private/tmp", `apexline-screen-${screen.id}-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(harnessPath, harnessHtml(screen));
  const win = new BrowserWindow({
    width: 1920,
    height: 1200,
    show: false,
    backgroundColor: "#05070b",
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });
  try {
    await win.loadFile(harnessPath);
    const state = await waitFor(win, screen.wait);
    await runAfter(win, screen.after);
    if (screen.after !== "nextWeekend") {
      await win.webContents.executeJavaScript(`document.querySelector(".pw-body")?.scrollTo(0, 0);`, true);
    }
    await waitForImages(win);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const image = await win.webContents.capturePage();
    const outPath = path.join(assetDir, screen.file);
    fs.mkdirSync(assetDir, { recursive: true });
    fs.writeFileSync(outPath, image.toPNG());
    return { screen: screen.id, file: path.relative(root, outPath), bytes: image.toPNG().length, state };
  } finally {
    win.destroy();
    try { fs.unlinkSync(harnessPath); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

async function run() {
  await app.whenReady();
  const requested = new Set(process.argv.slice(2));
  const selectedScreens = requested.size ? screens.filter((screen) => requested.has(screen.id)) : screens;
  const results = [];
  for (const screen of selectedScreens) {
    results.push(await capture(screen));
  }
  console.log(JSON.stringify(results.map(({ screen, file, bytes }) => ({ screen, file, bytes })), null, 2));
  app.exit(0);
}

run().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  app.exit(1);
});
