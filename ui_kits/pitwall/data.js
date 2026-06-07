/* PitWall seed data.
   Runtime standings, schedule, timing, weather, and news are fetched by Electron. */
(function () {
  const T = {
    redbull: "var(--team-redbull)", ferrari: "var(--team-ferrari)",
    mercedes: "var(--team-mercedes)", mclaren: "var(--team-mclaren)",
    aston: "var(--team-aston)", alpine: "var(--team-alpine)",
    williams: "var(--team-williams)", rb: "var(--team-racingbulls)",
    audi: "var(--team-audi)", haas: "var(--team-haas)",
    cadillac: "var(--team-cadillac)",
  };
  const TEAM_HEX = {
    redbull: "#3671c6", ferrari: "#e80020",
    mercedes: "#27f4d2", mclaren: "#ff8000",
    aston: "#229971", alpine: "#00a1e8",
    williams: "#64c4ff", rb: "#6692ff",
    audi: "#c8ccce", haas: "#b6babd",
    cadillac: "#d3a13b",
  };
  const TEAM_KEY = {
    RBR: "redbull", FER: "ferrari", MER: "mercedes", MCL: "mclaren",
    AST: "aston", ALP: "alpine", WIL: "williams", RB: "rb",
    AUD: "audi", HAS: "haas", CAD: "cadillac",
  };
  const LOGO = {
    redbull: "https://media.formula1.com/image/upload/c_fit%2Ch_64/q_auto/v1740000001/common/f1/2025/redbullracing/2025redbullracinglogowhite.webp",
    ferrari: "https://media.formula1.com/image/upload/c_fit%2Ch_64/q_auto/v1740000001/common/f1/2025/ferrari/2025ferrarilogolight.webp",
    mercedes: "https://media.formula1.com/image/upload/c_fit%2Ch_64/q_auto/v1740000001/common/f1/2025/mercedes/2025mercedeslogowhite.webp",
    mclaren: "https://media.formula1.com/image/upload/c_fit%2Ch_64/q_auto/v1740000001/common/f1/2025/mclaren/2025mclarenlogowhite.webp",
    aston: "https://media.formula1.com/image/upload/c_fit%2Ch_64/q_auto/v1740000001/common/f1/2025/astonmartin/2025astonmartinlogowhite.webp",
    alpine: "https://media.formula1.com/image/upload/c_fit%2Ch_64/q_auto/v1740000001/common/f1/2025/alpine/2025alpinelogowhite.webp",
    williams: "https://media.formula1.com/image/upload/c_fit%2Ch_64/q_auto/v1740000001/common/f1/2025/williams/2025williamslogowhite.webp",
    rb: "https://media.formula1.com/image/upload/c_fit%2Ch_64/q_auto/v1740000001/common/f1/2025/racingbulls/2025racingbullslogowhite.webp",
    audi: "https://media.formula1.com/image/upload/c_fit%2Ch_64/q_auto/v1740000001/common/f1/2026/audi/2026audilogowhite.webp",
    haas: "https://media.formula1.com/image/upload/c_fit%2Ch_64/q_auto/v1740000001/common/f1/2025/haas/2025haaslogowhite.webp",
    cadillac: "https://media.formula1.com/image/upload/c_fit%2Ch_64/q_auto/v1740000001/common/f1/2026/cadillac/2026cadillaclogowhite.webp",
  };
  const IMG = {
    VER: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/redbullracing/maxver01/2026redbullracingmaxver01right.webp",
    HAD: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/redbullracing/isahad01/2026redbullracingisahad01right.webp",
    RUS: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/mercedes/georus01/2026mercedesgeorus01right.webp",
    ANT: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp",
    LEC: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/ferrari/chalec01/2026ferrarichalec01right.webp",
    HAM: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/ferrari/lewham01/2026ferrarilewham01right.webp",
    NOR: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp",
    PIA: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01right.webp",
    STR: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01right.webp",
    ALO: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01right.webp",
    GAS: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/alpine/piegas01/2026alpinepiegas01right.webp",
    COL: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp",
    ALB: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/williams/alealb01/2026williamsalealb01right.webp",
    SAI: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/williams/carsai01/2026williamscarsai01right.webp",
    LAW: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01right.webp",
    LIN: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp",
    HUL: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp",
    BOR: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp",
    OCO: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/haas/estoco01/2026haasestoco01right.webp",
    BEA: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/haas/olibea01/2026haasolibea01right.webp",
    PER: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp",
    BOT: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp",
  };
  function driverPortrait(code, num, teamKey) {
    const accent = TEAM_HEX[teamKey] || "#2f7bff";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="bg" x1="12" y1="8" x2="86" y2="92" gradientUnits="userSpaceOnUse">
          <stop stop-color="#1d2636"/>
          <stop offset="1" stop-color="#070a10"/>
        </linearGradient>
        <linearGradient id="visor" x1="18" y1="40" x2="80" y2="56" gradientUnits="userSpaceOnUse">
          <stop stop-color="#121826"/>
          <stop offset="1" stop-color="#02040a"/>
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="48" fill="url(#bg)"/>
      <circle cx="48" cy="48" r="43" fill="${accent}" opacity=".18"/>
      <path d="M15 92c5-17 17-26 33-26s28 9 33 26H15z" fill="#202838"/>
      <path d="M10 51c0-29 15-47 38-47s38 18 38 47c0 23-16 39-38 39S10 74 10 51z" fill="#edf3f8"/>
      <path d="M14 48c5-21 17-33 34-33s29 12 34 33H14z" fill="${accent}"/>
      <path d="M14 45c9-8 20-12 34-12s25 4 34 12l-6 22H20l-6-22z" fill="url(#visor)"/>
      <path d="M24 58h48" stroke="#ffffff" stroke-opacity=".18" stroke-width="4" stroke-linecap="round"/>
      <path d="M42 5h12v82H42z" fill="#ffffff" opacity=".9"/>
      <path d="M42 5h12v82H42z" fill="${accent}" opacity=".35"/>
      <path d="M14 68c8 14 20 21 34 21s26-7 34-21" fill="none" stroke="#161d2a" stroke-width="8" stroke-linecap="round" opacity=".45"/>
    </svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  const makeDriver = (code, name, num, team, color, abbr, teamLogo) => ({
    code, name, num, team, color, abbr, image: driverPortrait(code, num, TEAM_KEY[abbr]), remoteImage: IMG[code], teamLogo,
  });
  const drivers = [
    makeDriver("VER", "Max Verstappen", 3, "Red Bull Racing", T.redbull, "RBR", LOGO.redbull),
    makeDriver("HAD", "Isack Hadjar", 6, "Red Bull Racing", T.redbull, "RBR", LOGO.redbull),
    makeDriver("RUS", "George Russell", 63, "Mercedes", T.mercedes, "MER", LOGO.mercedes),
    makeDriver("ANT", "Kimi Antonelli", 12, "Mercedes", T.mercedes, "MER", LOGO.mercedes),
    makeDriver("LEC", "Charles Leclerc", 16, "Ferrari", T.ferrari, "FER", LOGO.ferrari),
    makeDriver("HAM", "Lewis Hamilton", 44, "Ferrari", T.ferrari, "FER", LOGO.ferrari),
    makeDriver("NOR", "Lando Norris", 1, "McLaren", T.mclaren, "MCL", LOGO.mclaren),
    makeDriver("PIA", "Oscar Piastri", 81, "McLaren", T.mclaren, "MCL", LOGO.mclaren),
    makeDriver("STR", "Lance Stroll", 18, "Aston Martin", T.aston, "AST", LOGO.aston),
    makeDriver("ALO", "Fernando Alonso", 14, "Aston Martin", T.aston, "AST", LOGO.aston),
    makeDriver("GAS", "Pierre Gasly", 10, "Alpine", T.alpine, "ALP", LOGO.alpine),
    makeDriver("COL", "Franco Colapinto", 43, "Alpine", T.alpine, "ALP", LOGO.alpine),
    makeDriver("ALB", "Alexander Albon", 23, "Williams", T.williams, "WIL", LOGO.williams),
    makeDriver("SAI", "Carlos Sainz", 55, "Williams", T.williams, "WIL", LOGO.williams),
    makeDriver("LAW", "Liam Lawson", 30, "Racing Bulls", T.rb, "RB", LOGO.rb),
    makeDriver("LIN", "Arvid Lindblad", 41, "Racing Bulls", T.rb, "RB", LOGO.rb),
    makeDriver("HUL", "Nico Hulkenberg", 27, "Audi", T.audi, "AUD", LOGO.audi),
    makeDriver("BOR", "Gabriel Bortoleto", 5, "Audi", T.audi, "AUD", LOGO.audi),
    makeDriver("OCO", "Esteban Ocon", 31, "Haas F1 Team", T.haas, "HAS", LOGO.haas),
    makeDriver("BEA", "Oliver Bearman", 87, "Haas F1 Team", T.haas, "HAS", LOGO.haas),
    makeDriver("PER", "Sergio Perez", 11, "Cadillac", T.cadillac, "CAD", LOGO.cadillac),
    makeDriver("BOT", "Valtteri Bottas", 77, "Cadillac", T.cadillac, "CAD", LOGO.cadillac),
  ];
  const constructors = [
    { pos: 0, abbr: "RBR", name: "Red Bull Racing", color: T.redbull, logo: LOGO.redbull, pts: 0, delta: 0 },
    { pos: 0, abbr: "MER", name: "Mercedes", color: T.mercedes, logo: LOGO.mercedes, pts: 0, delta: 0 },
    { pos: 0, abbr: "FER", name: "Ferrari", color: T.ferrari, logo: LOGO.ferrari, pts: 0, delta: 0 },
    { pos: 0, abbr: "MCL", name: "McLaren", color: T.mclaren, logo: LOGO.mclaren, pts: 0, delta: 0 },
    { pos: 0, abbr: "AST", name: "Aston Martin", color: T.aston, logo: LOGO.aston, pts: 0, delta: 0 },
    { pos: 0, abbr: "ALP", name: "Alpine", color: T.alpine, logo: LOGO.alpine, pts: 0, delta: 0 },
    { pos: 0, abbr: "WIL", name: "Williams", color: T.williams, logo: LOGO.williams, pts: 0, delta: 0 },
    { pos: 0, abbr: "RB", name: "Racing Bulls", color: T.rb, logo: LOGO.rb, pts: 0, delta: 0 },
    { pos: 0, abbr: "AUD", name: "Audi", color: T.audi, logo: LOGO.audi, pts: 0, delta: 0 },
    { pos: 0, abbr: "HAS", name: "Haas F1 Team", color: T.haas, logo: LOGO.haas, pts: 0, delta: 0 },
    { pos: 0, abbr: "CAD", name: "Cadillac", color: T.cadillac, logo: LOGO.cadillac, pts: 0, delta: 0 },
  ];
  const byCode = Object.fromEntries(drivers.map((driver) => [driver.code, driver]));

  window.PW_DATA = {
    source: "seed",
    sourceLabel: "Waiting for live data",
    fetchedAt: "",
    errors: [],
    drivers,
    byCode,
    timing: [],
    standings: [],
    constructors,
    schedule: [],
    sessions: [],
    news: [],
    insights: [],
    strategyContext: null,
    presets: ["Driver Focus", "Pit Wall Classic", "Battle Mode", "Data Overload", "Minimal Clean"],
    copilot: null,
    seasonSummary: { season: String(new Date().getFullYear()), round: 0, totalRounds: 0 },
    race: {
      name: "Formula 1",
      circuit: "",
      loc: "",
      lap: 0,
      laps: 0,
      round: 0,
      startsAt: "",
      weather: { air: "", track: "", cond: "", rain: "", wind: "" },
    },
  };
})();
