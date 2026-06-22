/* Apexline theme tokens. window.PW_THEME
   Each theme retints BOTH the accent ramp AND the dark surface ladder, so the
   whole cockpit shifts hue (cool blue-black -> violet-black -> warm brown-black),
   not just buttons & focus rings. Borders stay neutral-white rgba for legibility. */
(function () {
  const THEME_OPTIONS = [
    { value: "dark", label: "Default" },
    { value: "purple", label: "Purple" },
    { value: "ember", label: "Ember" },
  ];
  const THEME_TOKENS = {
    dark: {
      primary: "#2d7bff",
      primaryHover: "#4d92ff",
      primaryPress: "#1f63db",
      accent: "#2d7bff",
      accentHover: "#4d92ff",
      accentPress: "#1f63db",
      accentQuiet: "rgba(45, 123, 255, 0.14)",
      accentQuietHover: "rgba(45, 123, 255, 0.22)",
      accentSoft: "rgba(45, 123, 255, 0.09)",
      accentBorder: "rgba(45, 123, 255, 0.40)",
      accentGlow: "rgba(45, 123, 255, 0.55)",
      // cool blue-black surface ladder (canonical)
      bg0: "#08090c", bg1: "#0b0d12", bg2: "#13161d",
      bg3: "#1d222d", bg4: "#242a36", bg5: "#2e3441",
      sunken: "#0a0c11", surfaceActive: "#2a3140", surfaceOverlay: "#1b202a",
      scrim: "rgba(5, 6, 9, 0.66)",
      gradHero: "radial-gradient(120% 90% at 12% -20%, rgba(45,123,255,0.16), transparent 60%)",
    },
    purple: {
      primary: "#8b5cf6",
      primaryHover: "#a78bfa",
      primaryPress: "#7c3aed",
      accent: "#b15cff",
      accentHover: "#c084fc",
      accentPress: "#9333ea",
      accentQuiet: "rgba(177, 92, 255, 0.15)",
      accentQuietHover: "rgba(177, 92, 255, 0.24)",
      accentSoft: "rgba(177, 92, 255, 0.10)",
      accentBorder: "rgba(177, 92, 255, 0.42)",
      accentGlow: "rgba(177, 92, 255, 0.56)",
      // violet-black surface ladder
      bg0: "#0a080e", bg1: "#0f0b16", bg2: "#181221",
      bg3: "#241c31", bg4: "#2c2239", bg5: "#372c47",
      sunken: "#0c0913", surfaceActive: "#2e2640", surfaceOverlay: "#201a2c",
      scrim: "rgba(8, 5, 12, 0.66)",
      gradHero: "radial-gradient(120% 90% at 12% -20%, rgba(177,92,255,0.16), transparent 60%)",
    },
    ember: {
      primary: "#ff7a33",
      primaryHover: "#ff955c",
      primaryPress: "#e8631f",
      accent: "#ff9426",
      accentHover: "#ffac52",
      accentPress: "#ec7a14",
      accentQuiet: "rgba(255, 148, 38, 0.15)",
      accentQuietHover: "rgba(255, 148, 38, 0.24)",
      accentSoft: "rgba(255, 148, 38, 0.10)",
      accentBorder: "rgba(255, 148, 38, 0.42)",
      accentGlow: "rgba(255, 148, 38, 0.55)",
      // warm brown-black surface ladder
      bg0: "#0d0907", bg1: "#140f0a", bg2: "#1e1812",
      bg3: "#2b2117", bg4: "#352a1d", bg5: "#423424",
      sunken: "#100b08", surfaceActive: "#382c20", surfaceOverlay: "#271f16",
      scrim: "rgba(10, 6, 4, 0.66)",
      gradHero: "radial-gradient(120% 90% at 12% -20%, rgba(255,148,38,0.15), transparent 60%)",
    },
  };

  function applyThemePreference(theme) {
    const themeKey = THEME_TOKENS[theme] ? theme : "dark";
    const t = THEME_TOKENS[themeKey];
    const root = document.documentElement;
    root.dataset.theme = themeKey;
    const set = (k, v) => root.style.setProperty(k, v);

    // ---- accent ramp ----
    set("--primary", t.primary);
    set("--primary-hover", t.primaryHover);
    set("--primary-press", t.primaryPress);
    set("--accent", t.accent);
    set("--accent-hover", t.accentHover);
    set("--accent-press", t.accentPress);
    set("--accent-quiet", t.accentQuiet);
    set("--accent-quiet-hover", t.accentQuietHover);
    set("--accent-soft", t.accentSoft);
    set("--accent-border", t.accentBorder);
    set("--blue-glow", t.accentGlow);
    set("--focus-ring", t.accent);

    // ---- surface ladder (semantic aliases like --bg-app / --surface-card
    //      reference these and re-resolve automatically) ----
    set("--bg-0", t.bg0);
    set("--bg-1", t.bg1);
    set("--bg-2", t.bg2);
    set("--bg-3", t.bg3);
    set("--bg-4", t.bg4);
    set("--bg-5", t.bg5);
    set("--bg-sunken", t.sunken);
    set("--surface-active", t.surfaceActive);
    set("--surface-overlay", t.surfaceOverlay);
    set("--scrim", t.scrim);
    set("--grad-hero", t.gradHero);
  }

  function applySavedThemePreference() {
    try {
      const saved = JSON.parse(localStorage.getItem("pw-settings") || "{}");
      applyThemePreference(saved.theme);
    } catch {
      applyThemePreference("dark");
    }
  }

  window.PW_THEME = { THEME_OPTIONS, THEME_TOKENS, applyThemePreference, applySavedThemePreference };
  applySavedThemePreference();
})();
