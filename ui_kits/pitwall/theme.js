/* Apexline theme tokens. window.PW_THEME */
(function () {
  const THEME_OPTIONS = [
    { value: "dark", label: "Default" },
    { value: "purple", label: "Purple" },
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
    },
  };

  function applyThemePreference(theme) {
    const themeKey = THEME_TOKENS[theme] ? theme : "dark";
    const tokens = THEME_TOKENS[themeKey];
    const root = document.documentElement;
    root.dataset.theme = themeKey;
    root.style.setProperty("--primary", tokens.primary);
    root.style.setProperty("--primary-hover", tokens.primaryHover);
    root.style.setProperty("--primary-press", tokens.primaryPress);
    root.style.setProperty("--accent", tokens.accent);
    root.style.setProperty("--accent-hover", tokens.accentHover);
    root.style.setProperty("--accent-press", tokens.accentPress);
    root.style.setProperty("--accent-quiet", tokens.accentQuiet);
    root.style.setProperty("--accent-quiet-hover", tokens.accentQuietHover);
    root.style.setProperty("--accent-soft", tokens.accentSoft);
    root.style.setProperty("--accent-border", tokens.accentBorder);
    root.style.setProperty("--blue-glow", tokens.accentGlow);
    root.style.setProperty("--focus-ring", tokens.accent);
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
