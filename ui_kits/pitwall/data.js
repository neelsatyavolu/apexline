/* Apexline seed data.
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
    redbull: "https://media.formula1.com/image/upload/c_fit%2Ch_256/q_auto/v1740000001/common/f1/2025/redbullracing/2025redbullracinglogowhite.webp",
    ferrari: "https://media.formula1.com/image/upload/c_fit%2Ch_256/q_auto/v1740000001/common/f1/2025/ferrari/2025ferrarilogolight.webp",
    mercedes: "https://media.formula1.com/image/upload/c_fit%2Ch_256/q_auto/v1740000001/common/f1/2025/mercedes/2025mercedeslogowhite.webp",
    mclaren: "https://media.formula1.com/image/upload/c_fit%2Ch_256/q_auto/v1740000001/common/f1/2025/mclaren/2025mclarenlogowhite.webp",
    aston: "https://media.formula1.com/image/upload/c_fit%2Ch_256/q_auto/v1740000001/common/f1/2025/astonmartin/2025astonmartinlogowhite.webp",
    alpine: "https://media.formula1.com/image/upload/c_fit%2Ch_256/q_auto/v1740000001/common/f1/2025/alpine/2025alpinelogowhite.webp",
    williams: "https://media.formula1.com/image/upload/c_fit%2Ch_256/q_auto/v1740000001/common/f1/2025/williams/2025williamslogowhite.webp",
    rb: "https://media.formula1.com/image/upload/c_fit%2Ch_256/q_auto/v1740000001/common/f1/2025/racingbulls/2025racingbullslogowhite.webp",
    audi: "https://media.formula1.com/image/upload/c_fit%2Ch_256/q_auto/v1740000001/common/f1/2026/audi/2026audilogowhite.webp",
    haas: "https://media.formula1.com/image/upload/c_fit%2Ch_256/q_auto/v1740000001/common/f1/2025/haas/2025haaslogowhite.webp",
    cadillac: "https://media.formula1.com/image/upload/c_fit%2Ch_256/q_auto/v1740000001/common/f1/2026/cadillac/2026cadillaclogowhite.webp",
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
    LIN: "../../assets/drivers/lin-headshot.jpg",
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

  /* ----------------------------------------------------------------------
     Static driver/constructor reference — identity & all-time career facts
     (nationality, DOB, career wins, team base/principals, honours), the kind
     of data F1.com profile pages show. This is static identity data, NOT live
     standings: season points/positions/wins are filled live by the Electron
     bridge (Jolpica/OpenF1) and merged over this reference by buildProfiles().
  ---------------------------------------------------------------------- */
  const DRIVER_BIO = {
    VER: { nat: "Netherlands", flag: "🇳🇱", dob: "30 Sep 1997", pob: "Hasselt, Belgium", since: 2015, gp: 220, careerWins: 65, podiums: 116, poles: 45, fl: 35, titles: 4, careerPts: 3149, bestFinish: "1st", bestGrid: "1st", blurb: "Four-time world champion and the benchmark of his generation — ruthless in wheel-to-wheel combat and devastating in qualifying." },
    HAD: { nat: "France", flag: "🇫🇷", dob: "28 Sep 2004", pob: "Paris, France", since: 2025, gp: 33, careerWins: 0, podiums: 1, poles: 0, fl: 1, titles: 0, careerPts: 122, bestFinish: "3rd", bestGrid: "4th", blurb: "Promoted to the senior Red Bull seat for 2026 after a standout rookie campaign; fast, feisty and still sharpening his racecraft." },
    RUS: { nat: "United Kingdom", flag: "🇬🇧", dob: "15 Feb 1998", pob: "King's Lynn, England", since: 2019, gp: 145, careerWins: 4, podiums: 25, poles: 6, fl: 8, titles: 0, careerPts: 912, bestFinish: "1st", bestGrid: "1st", blurb: "Mercedes' team leader — metronomic over a lap and one of the cleanest racers on the grid." },
    ANT: { nat: "Italy", flag: "🇮🇹", dob: "25 Aug 2006", pob: "Bologna, Italy", since: 2025, gp: 33, careerWins: 0, podiums: 3, poles: 1, fl: 1, titles: 0, careerPts: 181, bestFinish: "2nd", bestGrid: "1st", blurb: "The teenage prodigy of the new Mercedes era; raw speed that already troubles established names." },
    LEC: { nat: "Monaco", flag: "🇲🇨", dob: "16 Oct 1997", pob: "Monte Carlo, Monaco", since: 2018, gp: 165, careerWins: 8, podiums: 46, poles: 27, fl: 9, titles: 0, careerPts: 1432, bestFinish: "1st", bestGrid: "1st", blurb: "Ferrari's qualifying specialist — a single lap from Leclerc remains one of the sport's great spectacles." },
    HAM: { nat: "United Kingdom", flag: "🇬🇧", dob: "07 Jan 1985", pob: "Stevenage, England", since: 2007, gp: 370, careerWins: 105, podiums: 202, poles: 104, fl: 67, titles: 7, careerPts: 4901, bestFinish: "1st", bestGrid: "1st", blurb: "Seven-time world champion and the sport's record-breaker, now chasing one more title in red." },
    NOR: { nat: "United Kingdom", flag: "🇬🇧", dob: "13 Nov 1999", pob: "Bristol, England", since: 2019, gp: 150, careerWins: 14, podiums: 51, poles: 16, fl: 12, titles: 1, careerPts: 1284, bestFinish: "1st", bestGrid: "1st", blurb: "Reigning world champion. Carries the #1 with a relaxed exterior and a relentless competitive core." },
    PIA: { nat: "Australia", flag: "🇦🇺", dob: "06 Apr 2001", pob: "Melbourne, Australia", since: 2023, gp: 70, careerWins: 8, podiums: 29, poles: 7, fl: 5, titles: 0, careerPts: 712, bestFinish: "1st", bestGrid: "1st", blurb: "Ice-cool and methodical, Piastri has turned title contender in only his third season." },
    STR: { nat: "Canada", flag: "🇨🇦", dob: "29 Oct 1998", pob: "Montreal, Canada", since: 2017, gp: 185, careerWins: 0, podiums: 3, poles: 1, fl: 0, titles: 0, careerPts: 324, bestFinish: "3rd", bestGrid: "1st", blurb: "A wet-weather specialist whose best days flash genuine front-running pace." },
    ALO: { nat: "Spain", flag: "🇪🇸", dob: "29 Jul 1981", pob: "Oviedo, Spain", since: 2001, gp: 415, careerWins: 32, podiums: 106, poles: 22, fl: 26, titles: 2, careerPts: 2389, bestFinish: "1st", bestGrid: "1st", blurb: "Two-time champion and the grid's elder statesman — still as cunning and quick as drivers half his age." },
    GAS: { nat: "France", flag: "🇫🇷", dob: "07 Feb 1996", pob: "Rouen, France", since: 2017, gp: 170, careerWins: 1, podiums: 5, poles: 0, fl: 3, titles: 0, careerPts: 524, bestFinish: "1st", bestGrid: "2nd", blurb: "Alpine's leader and a proven race-winner who thrives when the strategy gets chaotic." },
    COL: { nat: "Argentina", flag: "🇦🇷", dob: "27 May 2003", pob: "Pilar, Argentina", since: 2024, gp: 42, careerWins: 0, podiums: 0, poles: 0, fl: 0, titles: 0, careerPts: 27, bestFinish: "8th", bestGrid: "6th", blurb: "Argentina's first full-time driver in two decades; aggressive and improving by the round." },
    ALB: { nat: "Thailand", flag: "🇹🇭", dob: "23 Mar 1996", pob: "London, England", since: 2019, gp: 130, careerWins: 0, podiums: 2, poles: 0, fl: 1, titles: 0, careerPts: 351, bestFinish: "3rd", bestGrid: "4th", blurb: "Williams' cornerstone — extracting results the car has no business delivering." },
    SAI: { nat: "Spain", flag: "🇪🇸", dob: "01 Sep 1994", pob: "Madrid, Spain", since: 2015, gp: 220, careerWins: 4, podiums: 27, poles: 6, fl: 3, titles: 0, careerPts: 1289, bestFinish: "1st", bestGrid: "1st", blurb: "A relentless racer and shrewd tactician who brings race-winning pedigree to Grove." },
    LAW: { nat: "New Zealand", flag: "🇳🇿", dob: "11 Feb 2002", pob: "Hastings, New Zealand", since: 2023, gp: 45, careerWins: 0, podiums: 0, poles: 0, fl: 1, titles: 0, careerPts: 61, bestFinish: "6th", bestGrid: "5th", blurb: "Combative and confident, Lawson has fought his way to a full-time Racing Bulls seat." },
    LIN: { nat: "United Kingdom", flag: "🇬🇧", dob: "08 Aug 2007", pob: "London, England", since: 2026, gp: 10, careerWins: 0, podiums: 0, poles: 0, fl: 0, titles: 0, careerPts: 3, bestFinish: "9th", bestGrid: "8th", blurb: "The grid's youngest driver, fast-tracked from the Red Bull junior programme as a teenage rookie." },
    HUL: { nat: "Germany", flag: "🇩🇪", dob: "19 Aug 1987", pob: "Emmerich, Germany", since: 2010, gp: 230, careerWins: 0, podiums: 1, poles: 1, fl: 2, titles: 0, careerPts: 583, bestFinish: "3rd", bestGrid: "1st", blurb: "The midfield's master craftsman, anchoring the works Audi project in its debut season." },
    BOR: { nat: "Brazil", flag: "🇧🇷", dob: "14 Oct 2004", pob: "São Paulo, Brazil", since: 2025, gp: 33, careerWins: 0, podiums: 0, poles: 0, fl: 0, titles: 0, careerPts: 31, bestFinish: "7th", bestGrid: "6th", blurb: "A reigning junior champion bringing real pedigree to Audi's young line-up." },
    OCO: { nat: "France", flag: "🇫🇷", dob: "17 Sep 1996", pob: "Évreux, France", since: 2016, gp: 175, careerWins: 1, podiums: 4, poles: 0, fl: 1, titles: 0, careerPts: 461, bestFinish: "1st", bestGrid: "2nd", blurb: "A tenacious wheel-to-wheel racer and a Grand Prix winner now leading Haas." },
    BEA: { nat: "United Kingdom", flag: "🇬🇧", dob: "08 May 2005", pob: "Chelmsford, England", since: 2024, gp: 35, careerWins: 0, podiums: 0, poles: 0, fl: 0, titles: 0, careerPts: 42, bestFinish: "7th", bestGrid: "5th", blurb: "Composed beyond his years, Bearman impressed on debut and now races full-time for Haas." },
    PER: { nat: "Mexico", flag: "🇲🇽", dob: "26 Jan 1990", pob: "Guadalajara, Mexico", since: 2011, gp: 295, careerWins: 6, podiums: 39, poles: 3, fl: 11, titles: 0, careerPts: 1654, bestFinish: "1st", bestGrid: "1st", blurb: "The tyre-whisperer — Pérez brings race-winning experience to Cadillac's all-new works effort." },
    BOT: { nat: "Finland", flag: "🇫🇮", dob: "28 Aug 1989", pob: "Nastola, Finland", since: 2013, gp: 250, careerWins: 10, podiums: 67, poles: 20, fl: 19, titles: 0, careerPts: 1797, bestFinish: "1st", bestGrid: "1st", blurb: "Ten-time race winner and a relentless qualifier, lending Cadillac hard-earned big-team know-how." },
  };
  const TEAM_INFO = {
    RBR: { full: "Oracle Red Bull Racing", base: "Milton Keynes, United Kingdom", chief: "Laurent Mekies", techChief: "Pierre Waché", chassis: "RB22", power: "Red Bull Ford", firstEntry: 1997, titles: 6, careerWins: 124, poles: 103, fl: 96, bestFinish: "1st", blurb: "The benchmark constructor of the ground-effect era, built around aerodynamic excellence and a ruthless race operation." },
    FER: { full: "Scuderia Ferrari HP", base: "Maranello, Italy", chief: "Frédéric Vasseur", techChief: "Loïc Serra", chassis: "SF-26", power: "Ferrari", firstEntry: 1950, titles: 16, careerWins: 248, poles: 254, fl: 263, bestFinish: "1st", blurb: "The only team to have contested every season of the world championship — F1's most storied and scrutinised name." },
    MER: { full: "Mercedes-AMG Petronas F1 Team", base: "Brackley, United Kingdom", chief: "Toto Wolff", techChief: "James Allison", chassis: "W17", power: "Mercedes", firstEntry: 1970, titles: 8, careerWins: 129, poles: 142, fl: 105, bestFinish: "1st", blurb: "The dominant force of the hybrid era, now rebuilding around a youthful line-up and a new technical cycle." },
    MCL: { full: "McLaren Formula 1 Team", base: "Woking, United Kingdom", chief: "Andrea Stella", techChief: "Rob Marshall", chassis: "MCL40", power: "Mercedes", firstEntry: 1966, titles: 9, careerWins: 196, poles: 165, fl: 175, bestFinish: "1st", blurb: "Reborn as the team to beat — a relentless development curve has turned McLaren back into champions." },
    AST: { full: "Aston Martin Aramco F1 Team", base: "Silverstone, United Kingdom", chief: "Andy Cowell", techChief: "Adrian Newey", chassis: "AMR26", power: "Honda", firstEntry: 2021, titles: 0, careerWins: 0, poles: 1, fl: 3, bestFinish: "2nd", blurb: "A heavily-invested project pairing a new Honda works deal with the most decorated designer in the sport." },
    ALP: { full: "BWT Alpine F1 Team", base: "Enstone, United Kingdom", chief: "Steve Nielsen", techChief: "David Sanchez", chassis: "A526", power: "Mercedes", firstEntry: 1986, titles: 2, careerWins: 35, poles: 20, fl: 16, bestFinish: "1st", blurb: "The Enstone squad — title-winners in a former life — now a Mercedes customer chasing a midfield revival." },
    WIL: { full: "Atlassian Williams Racing", base: "Grove, United Kingdom", chief: "James Vowles", techChief: "Pat Fry", chassis: "FW48", power: "Mercedes", firstEntry: 1978, titles: 9, careerWins: 114, poles: 128, fl: 133, bestFinish: "1st", blurb: "A nine-time champions' name on a determined climb back toward the front under James Vowles." },
    RB: { full: "Visa Cash App Racing Bulls", base: "Faenza, Italy", chief: "Alan Permane", techChief: "Tim Goss", chassis: "VCARB 03", power: "Red Bull Ford", firstEntry: 2006, titles: 0, careerWins: 1, poles: 1, fl: 2, bestFinish: "1st", blurb: "Red Bull's sister team and proving ground, sharpening the next generation of talent in the midfield." },
    AUD: { full: "Audi F1 Team", base: "Hinwil, Switzerland", chief: "Jonathan Wheatley", techChief: "James Key", chassis: "A26", power: "Audi", firstEntry: 1993, titles: 0, careerWins: 1, poles: 1, fl: 5, bestFinish: "1st", blurb: "The Sauber operation transformed into a full Audi works entry — a long-game project arriving in force for 2026." },
    HAS: { full: "MoneyGram Haas F1 Team", base: "Kannapolis, United States", chief: "Ayao Komatsu", techChief: "Andrea De Zordo", chassis: "VF-26", power: "Ferrari", firstEntry: 2016, titles: 0, careerWins: 0, poles: 1, fl: 2, bestFinish: "4th", blurb: "The grid's leanest operation, punching above its budget with Ferrari power and a young driver pairing." },
    CAD: { full: "Cadillac F1 Team", base: "Fishers, Indiana, United States", chief: "Graeme Lowdon", techChief: "Nick Chester", chassis: "C26", power: "Ferrari", firstEntry: 2026, titles: 0, careerWins: 0, poles: 0, fl: 0, bestFinish: "12th", blurb: "Formula 1's newest works team — General Motors' American entry, debuting with a veteran driver line-up." },
  };

  // Merge live season numbers (data.standings / data.constructors) over the
  // static reference above. Re-run by DataProvider on every live snapshot, so
  // the Drivers/Teams screens always reflect real championship data when live;
  // with no live data yet, season numbers are 0/null (never faked).
  function buildProfiles(data) {
    data = data || {};
    const driverList = (data.drivers && data.drivers.length) ? data.drivers : drivers;
    const standingList = data.standings || [];
    const standMap = new Map(standingList.map((s) => [s.code, s]));
    const driverForm = data.driverForm || {};
    const formRounds = Array.isArray(data.formRounds) ? data.formRounds : [];
    const driverProfiles = Object.fromEntries(driverList.map((d) => {
      const s = standMap.get(d.code) || {};
      return [d.code, {
        ...d,
        ...(DRIVER_BIO[d.code] || {}),
        form: driverForm[d.code] || [],
        seasonPts: s.pts || 0,
        seasonPos: s.pos || null,
        seasonWins: s.wins || 0,
      }];
    }));
    const teamList = (data.constructors && data.constructors.length) ? data.constructors : constructors;
    const teamProfiles = teamList.map((c) => {
      const roster = driverList.filter((d) => d.abbr === c.abbr).map((d) => d.code);
      return {
        ...c,
        ...(TEAM_INFO[c.abbr] || {}),
        drivers: roster,
        seasonPts: c.pts || 0,
        seasonPos: c.pos || null,
      };
    }).sort((a, b) => (a.seasonPos || 99) - (b.seasonPos || 99) || (b.seasonPts || 0) - (a.seasonPts || 0));
    return { driverProfiles, teamProfiles, formRounds };
  }
  window.PW_BUILD_PROFILES = buildProfiles;

  const __seed = buildProfiles({ drivers, standings: [], constructors });

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
    presets: ["Intelligent", "Apexline Classic", "Battle Mode", "Data Overload", "Minimal Clean"],
    copilot: null,
    driverForm: {},
    driverProfiles: __seed.driverProfiles,
    teamProfiles: __seed.teamProfiles,
    formRounds: __seed.formRounds,
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
