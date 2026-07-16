/* Apexline Settings. window.PW.Settings */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Card, Badge, Icon, Switch, Input, Button, SegmentedControl, Avatar, Tabs } = NS;
  const D = window.PW_DATA;
  const AI_MODEL_STORAGE = "pw-ai-model";
  const SYNC_STORAGE_KEY = "pw-sync-settings";
  const DEFAULT_WORLD_SYNC_TARGET = 36;
  const DEFAULT_AI_MODEL = "codex:gpt-5.5";
  const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
  const AI_MODEL_OPTIONS = [
    { value: "codex:gpt-5.6-sol", label: "GPT-5.6 Sol" },
    { value: "codex:gpt-5.6-terra", label: "GPT-5.6 Terra" },
    { value: "codex:gpt-5.6-luna", label: "GPT-5.6 Luna" },
    { value: "codex:gpt-5.5", label: "GPT-5.5" },
    { value: "grok:grok-4.5", label: "Grok 4.5" },
  ];
  const VIDEO_QUALITY_OPTIONS = [
    { value: "max", label: "Max" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];
  const { THEME_OPTIONS, applyThemePreference } = window.PW_THEME;

  const STYLE_ID = "pw-set-styles";
  {
    let el = document.getElementById(STYLE_ID);
    if (!el) { el = document.createElement("style"); el.id = STYLE_ID; document.head.appendChild(el); }
    el.textContent = `
    .set { display: grid; grid-template-columns: 200px 1fr; gap: var(--space-10); align-items: start; }
    .set__nav { display: flex; flex-direction: column; gap: 2px; position: sticky; top: 0; }
    .set__navitem { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-6) var(--space-7); border-radius: var(--radius-sm); color: var(--text-secondary); font-size: var(--text-md); font-weight: 500; cursor: pointer; }
    .set__navitem:hover { background: var(--surface-hover); color: var(--text-primary); }
    .set__navitem[data-active="true"] { background: var(--accent-quiet); color: var(--text-strong); }
    .set__col { display: flex; flex-direction: column; gap: var(--space-9); max-width: 720px; }
    .row { display: flex; align-items: center; gap: var(--space-7); padding: var(--space-7) 0; border-bottom: 1px solid var(--border-subtle); }
    .row:last-child { border-bottom: 0; }
    .row__txt { flex: 1; min-width: 0; }
    .row__t { font-size: var(--text-md); font-weight: 500; color: var(--text-primary); }
    .row__s { font-size: var(--text-sm); color: var(--text-tertiary); margin-top: 2px; line-height: 1.4; }
    .provider { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-7); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--surface-raised); }
    .provider__logo { width: 38px; height: 38px; border-radius: var(--radius-sm); display: grid; place-items: center; flex: none; color: var(--provider-logo-fg, #fff); background: var(--provider-logo-bg, #111827); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); }
    .provider__logo svg { width: 24px; height: 24px; display: block; fill: currentColor; }
    .provider__logo--codex { --provider-logo-bg: #fff; --provider-logo-fg: #0f172a; }
    .provider__logo--grok { --provider-logo-bg: #050505; --provider-logo-fg: #fff; }
    .f1-login { overflow: hidden; border-radius: var(--radius-md); background: #1a1a1d; border: 1px solid var(--border-subtle); }
    .f1-login__main { padding: var(--space-9); }
    .f1-login__top { display: flex; align-items: center; gap: var(--space-7); margin-bottom: var(--space-8); }
    .f1-login__logo { width: 104px; height: 54px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; gap: 8px; background: #242427; font-family: var(--font-display); font-weight: 900; color: #fff; flex: none; }
    .f1-login__logo span:first-child { color: #ff1717; font-style: italic; }
    .f1-login__copy { flex: 1; min-width: 0; }
    .f1-login__title { color: var(--text-primary); font-size: var(--text-lg); font-weight: 650; }
    .f1-login__sub { color: var(--text-tertiary); font-size: var(--text-sm); margin-top: 2px; }
    .f1-login__status { margin-left: auto; display: flex; align-items: center; gap: var(--space-4); }
    .f1-login__fields { display: grid; gap: var(--space-7); }
    .friends-add-form { align-items: end; }
    .f1-login__actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-5); margin-top: var(--space-8); }
    .f1-login__note { margin-top: var(--space-6); color: var(--text-tertiary); font-size: var(--text-sm); min-height: 20px; }
    .ai-flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-5); }
    .ai-step { padding: var(--space-7); border-radius: var(--radius-md); background: var(--surface-raised); border: 1px solid var(--border-subtle); position: relative; }
    .ai-step__n { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--accent); font-weight: 700; }
    .ai-step__t { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); margin: 6px 0 4px; }
    .ai-step__d { font-size: var(--text-sm); color: var(--text-tertiary); line-height: 1.4; }
    .ai-step__arrow { position: absolute; right: -13px; top: 50%; transform: translateY(-50%); color: var(--border-strong); z-index: 2; }
    .profile-photo { display: flex; align-items: center; gap: var(--space-7); min-width: 260px; }
    .profile-photo__body { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
    .profile-photo__actions { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
    .profile-photo__input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    .profile-photo__msg { font-size: var(--text-2xs); color: var(--text-tertiary); min-height: 16px; }

    /* Favorites */
    .fav-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-9); align-items: start; }
    .fav-col__hd { display: flex; align-items: center; gap: var(--space-5); margin-bottom: var(--space-6); }
    .fav-col__hd h4 { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); margin: 0; }
    .fav-col__count { margin-left: auto; font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); }
    .fav-ranked { display: flex; flex-direction: column; gap: var(--space-4); margin-bottom: var(--space-8); }
    .fav-rank { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-5) var(--space-6); border-radius: var(--radius-md); background: var(--surface-raised); border: 1px solid var(--border-subtle); }
    .fav-rank[data-drag="true"] { cursor: grab; }
    .fav-rank__num { display: grid; place-items: center; width: 24px; height: 24px; flex: none; border-radius: var(--radius-sm); background: var(--accent-quiet); color: var(--text-accent); font-family: var(--font-display); font-weight: 800; font-size: var(--text-sm); }
    .fav-rank__num[data-gold="true"] { background: linear-gradient(135deg, #ffd84d, #e0a92e); color: #3a2a05; }
    .fav-rank__id { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .fav-rank__name { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); line-height: 1.2; }
    .fav-rank__sub { font-size: var(--text-2xs); color: var(--text-tertiary); }
    .fav-rank__ctrls { display: flex; align-items: center; gap: 2px; }
    .fav-rank__btn { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: var(--radius-xs); color: var(--text-tertiary); cursor: pointer; border: 0; background: transparent; transition: var(--tr-control); }
    .fav-rank__btn:hover { background: var(--surface-hover); color: var(--text-primary); }
    .fav-rank__btn[disabled] { opacity: 0.25; pointer-events: none; }
    .fav-rank__btn--remove:hover { background: var(--danger-quiet); color: var(--danger); }
    .fav-empty { padding: var(--space-9); border-radius: var(--radius-md); border: 1px dashed var(--border-default); text-align: center; color: var(--text-tertiary); font-size: var(--text-sm); }
    .fav-pool__label { font-size: var(--text-2xs); font-weight: 600; text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--text-tertiary); margin-bottom: var(--space-5); }
    .fav-pool { display: flex; flex-wrap: wrap; gap: var(--space-4); }
    .fav-chip { display: inline-flex; align-items: center; gap: var(--space-4); height: 30px; padding: 0 var(--space-5) 0 var(--space-4); border-radius: var(--radius-pill); background: var(--surface-card); border: 1px solid var(--border-default); color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 500; cursor: pointer; transition: var(--tr-control); }
    .fav-chip:hover { background: var(--surface-hover); border-color: var(--accent-border); color: var(--text-primary); }
    .fav-chip__swatch { width: 9px; height: 9px; border-radius: 3px; flex: none; }
    .fav-chip__add { color: var(--text-tertiary); display: inline-flex; }
    `;
  }

  const SECTIONS = [
    { id: "ai", label: "AI providers", icon: "sparkles" },
    { id: "favorites", label: "Favorites", icon: "star" },
    { id: "friends", label: "Friends", icon: "radio" },
    { id: "account", label: "Account", icon: "user" },
    { id: "appearance", label: "Appearance", icon: "layers" },
    { id: "notifications", label: "Notifications", icon: "bell" },
    { id: "updates", label: "Updates", icon: "arrowDown" },
    { id: "layouts", label: "Layout defaults", icon: "grid" },
  ];
  const DEFAULT_PREFS = {
    theme: "dark",
    reduceMotion: false,
    defaultPreset: "Intelligent",
    rememberLayout: true,
    telemetryDefault: true,
    videoQuality: "medium",
    f1LiveLatency: DEFAULT_WORLD_SYNC_TARGET,
    notifications: {
      lightsOut: true,
    },
  };

  function clampSyncLatency(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(8, Math.min(90, Math.round(number * 10) / 10)) : DEFAULT_WORLD_SYNC_TARGET;
  }

  function adjustDependentSyncTargets(targets, delta) {
    const next = { ...(targets || {}) };
    Object.keys(next).forEach((key) => {
      if (key !== "WORLD") next[key] = clampSyncLatency(Number(next[key]) + delta);
    });
    return next;
  }

  function updateWorldSyncPreference(value) {
    const worldTarget = clampSyncLatency(value);
    try {
      const saved = JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY) || "{}");
      const targets = saved.targets && typeof saved.targets === "object" ? saved.targets : {};
      const previousWorld = clampSyncLatency(saved.worldTarget == null ? targets.WORLD : saved.worldTarget);
      const shiftedTargets = adjustDependentSyncTargets(targets, worldTarget - previousWorld);
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({
        ...saved,
        worldTarget,
        targets: { ...shiftedTargets, WORLD: worldTarget },
      }));
    } catch {
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({ worldTarget, targets: { WORLD: worldTarget } }));
    }
  }

  function RankList({ items, onMove, onRemove, kind }) {
    if (items.length === 0) {
      return <div className="fav-empty">No {kind} picked yet — add some below.</div>;
    }
    return (
      <div className="fav-ranked">
        {items.map((it, i) => (
          <div className="fav-rank" key={it.key}>
            <span className="fav-rank__num" data-gold={i === 0}>{i + 1}</span>
            {it.avatar}
            <span className="fav-rank__id">
              <span className="fav-rank__name">{it.name}</span>
              <span className="fav-rank__sub">{it.sub}</span>
            </span>
            <span className="fav-rank__ctrls">
              <button className="fav-rank__btn" disabled={i === 0} aria-label="Move up" onClick={() => onMove(i, -1)}><Icon name="arrowUp" size={15} /></button>
              <button className="fav-rank__btn" disabled={i === items.length - 1} aria-label="Move down" onClick={() => onMove(i, 1)}><Icon name="arrowDown" size={15} /></button>
              <button className="fav-rank__btn fav-rank__btn--remove" aria-label="Remove" onClick={() => onRemove(it.key)}><Icon name="close" size={15} /></button>
            </span>
          </div>
        ))}
      </div>
    );
  }

  function ProviderLogo({ provider }) {
    if (provider === "grok") {
      return (
        <span className="provider__logo provider__logo--grok" aria-hidden="true">
          <svg viewBox="0 0 841.89 595.28" focusable="false">
            <path d="m557.09 211.99 8.31 326.37h66.56l8.32-445.18zM640.28 56.91H538.72L379.35 284.53l50.78 72.52zM201.61 538.36h101.56l50.79-72.52-50.79-72.53zM201.61 211.99l228.52 326.37h101.56L303.17 211.99z" />
          </svg>
        </span>
      );
    }
    return (
      <span className={"provider__logo provider__logo--" + provider} aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" />
        </svg>
      </span>
    );
  }

  function Settings() {
    const { data: D, profile, updateProfile, refreshConnections } = window.PW.usePitWall();
    const [sec, setSec] = React.useState("ai");
    const [model, setModel] = React.useState(() => {
      const saved = localStorage.getItem(AI_MODEL_STORAGE) || DEFAULT_AI_MODEL;
      return AI_MODEL_OPTIONS.some((option) => option.value === saved) ? saved : DEFAULT_AI_MODEL;
    });
    const [userName, setUserName] = React.useState(profile.name || "");
    const [profileImageUrl, setProfileImageUrl] = React.useState(profile.profileImageUrl || "");
    const [profileImageMessage, setProfileImageMessage] = React.useState("");
    const [favDrivers, setFavDrivers] = React.useState(profile.favoriteDrivers || []);
    const [favTeams, setFavTeams] = React.useState(profile.favoriteTeams || []);
    const profileImageInputRef = React.useRef(null);
    function normalizePresetName(name) {
      return name === "Driver Focus" ? "Intelligent" : name;
    }
    function normalizeVideoQualitySetting(value) {
      return VIDEO_QUALITY_OPTIONS.some((option) => option.value === value) ? value : DEFAULT_PREFS.videoQuality;
    }

    const [appPrefs, setAppPrefs] = React.useState(() => {
      try {
        const saved = { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem("pw-settings") || "{}")) };
        const videoQuality = normalizeVideoQualitySetting(profile.videoQuality || saved.videoQuality);
        return { ...saved, defaultPreset: normalizePresetName(saved.defaultPreset), videoQuality, f1LiveLatency: clampSyncLatency(saved.f1LiveLatency) };
      }
      catch { return DEFAULT_PREFS; }
    });
    const [oauthStatus, setOauthStatus] = React.useState({ codexConnected: false, grokConnected: false });
    const [oauthBusy, setOauthBusy] = React.useState("");
    const [oauthCode, setOauthCode] = React.useState("");
    const [oauthCodeBusy, setOauthCodeBusy] = React.useState(false);
    const [keyStatus, setKeyStatus] = React.useState("");
    const [f1Email, setF1Email] = React.useState("");
    const [f1Password, setF1Password] = React.useState("");
    const [f1Status, setF1Status] = React.useState({ authenticated: false, cookieCount: 0 });
    const [f1Busy, setF1Busy] = React.useState(false);
    const [f1Message, setF1Message] = React.useState("");
    const [socialIdentity, setSocialIdentity] = React.useState(null);
    const [socialFriends, setSocialFriends] = React.useState([]);
    const [friendCodeInput, setFriendCodeInput] = React.useState("");
    const [friendStatus, setFriendStatus] = React.useState("Friends sync when the Apexline social backend is reachable.");
    const [updateStatus, setUpdateStatus] = React.useState({ status: "idle", currentVersion: "", update: null, message: "" });
    const [updateBusy, setUpdateBusy] = React.useState(false);
    const [f1LiveLatencyDraft, setF1LiveLatencyDraft] = React.useState(() => String(appPrefs.f1LiveLatency));
    const [modelPrefReady, setModelPrefReady] = React.useState(false);

    React.useEffect(() => {
      let active = true;
      (async () => {
        try {
          const saved = await window.pitwall?.ai?.preferredModel?.get?.();
          if (active && AI_MODEL_OPTIONS.some((option) => option.value === saved)) setModel(saved);
        } catch {}
        if (active) setModelPrefReady(true);
      })();
      return () => { active = false; };
    }, []);

    React.useEffect(() => {
      localStorage.setItem("pw-settings", JSON.stringify(appPrefs));
      applyThemePreference(appPrefs.theme);
    }, [appPrefs]);

    React.useEffect(() => {
      if (!modelPrefReady) return;
      localStorage.setItem(AI_MODEL_STORAGE, model);
      window.pitwall?.ai?.preferredModel?.set?.(model).catch(() => {});
    }, [model, modelPrefReady]);

    React.useEffect(() => {
      setUserName(profile.name || "");
      setProfileImageUrl(profile.profileImageUrl || "");
      setFavDrivers(profile.favoriteDrivers || []);
      setFavTeams(profile.favoriteTeams || []);
    }, [profile.name, profile.profileImageUrl, (profile.favoriteDrivers || []).join("|"), (profile.favoriteTeams || []).join("|")]);

    React.useEffect(() => {
      setF1LiveLatencyDraft(String(appPrefs.f1LiveLatency));
    }, [appPrefs.f1LiveLatency]);

    React.useEffect(() => {
      updateProfile({ name: userName, profileImageUrl, favoriteDrivers: favDrivers, favoriteTeams: favTeams });
    }, [userName, profileImageUrl, favDrivers.join("|"), favTeams.join("|")]);

    React.useEffect(() => {
      if (!profile.videoQuality) return;
      setAppPrefs((prefs) => {
        const videoQuality = normalizeVideoQualitySetting(profile.videoQuality);
        return prefs.videoQuality === videoQuality ? prefs : { ...prefs, videoQuality };
      });
    }, [profile.videoQuality]);

    React.useEffect(() => {
      updateProfile({ videoQuality: appPrefs.videoQuality });
    }, [appPrefs.videoQuality]);

    React.useEffect(() => {
      let cancelled = false;
      async function loadSocial() {
        if (!window.pitwall?.social?.bootstrap) return;
        try {
          const identity = await window.pitwall.social.bootstrap({ profile });
          if (cancelled) return;
          setSocialIdentity(identity);
          setFriendStatus(identity?.offline ? "Social backend is offline; your local friend code is ready." : "Friends ready.");
          const list = await window.pitwall.social.friends({ userId: identity.userId }).catch(() => null);
          if (!cancelled && Array.isArray(list?.friends)) setSocialFriends(list.friends);
        } catch (error) {
          if (!cancelled) setFriendStatus(error?.message || "Friends are unavailable.");
        }
      }
      loadSocial();
      return () => { cancelled = true; };
    }, [profile.name, profile.profileImageUrl]);

    function setPref(key, value) {
      setAppPrefs((prefs) => ({ ...prefs, [key]: value }));
    }

    function commitF1LiveLatency(value) {
      const nextValue = clampSyncLatency(value);
      updateWorldSyncPreference(nextValue);
      setF1LiveLatencyDraft(String(nextValue));
      setAppPrefs((prefs) => ({ ...prefs, f1LiveLatency: nextValue }));
    }

    async function refreshFriends() {
      if (!socialIdentity?.userId || !window.pitwall?.social?.friends) return;
      try {
        const list = await window.pitwall.social.friends({ userId: socialIdentity.userId });
        setSocialFriends(Array.isArray(list?.friends) ? list.friends : []);
        setFriendStatus("Friends refreshed.");
      } catch (error) {
        setFriendStatus(error?.message || "Could not refresh friends.");
      }
    }

    async function addFriendByCode() {
      const friendCode = friendCodeInput.trim().toUpperCase();
      if (!friendCode || !window.pitwall?.social?.addFriend) return;
      try {
        const result = await window.pitwall.social.addFriend({ userId: socialIdentity?.userId, friendCode });
        setFriendStatus(result?.message || (result?.ok ? "Friend added." : "Friend request unavailable."));
        setFriendCodeInput("");
        refreshFriends();
      } catch (error) {
        setFriendStatus(error?.message || "Could not add friend.");
      }
    }

    function setNotification(key, value) {
      setAppPrefs((prefs) => ({ ...prefs, notifications: { ...prefs.notifications, [key]: value } }));
    }

    function selectProfileImage(event) {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!/^image\//i.test(file.type || "")) {
        setProfileImageMessage("Choose a PNG, JPG, GIF, WebP, or SVG image.");
        return;
      }
      if (file.size > PROFILE_IMAGE_MAX_BYTES) {
        setProfileImageMessage("Choose an image under 2 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setProfileImageUrl(String(reader.result || ""));
        setProfileImageMessage("Profile photo updated.");
      };
      reader.onerror = () => setProfileImageMessage("Could not read that image.");
      reader.readAsDataURL(file);
    }

    function keyStore() {
      if (window.pitwall && window.pitwall.keys) return window.pitwall.keys;
      return {
        get: async (provider) => localStorage.getItem("pw-key-" + provider) || "",
        set: async (provider, value) => { localStorage.setItem("pw-key-" + provider, value); return true; },
        delete: async (provider) => { localStorage.removeItem("pw-key-" + provider); return true; },
      };
    }

    function aiAuth() {
      return window.pitwall?.ai || null;
    }

    function providerLabel(provider) {
      if (provider === "codex") return "ChatGPT";
      if (provider === "grok") return "Grok";
      return "AI provider";
    }

    function f1TvAuth() {
      return window.pitwall && window.pitwall.f1tv ? window.pitwall.f1tv : null;
    }

    function f1TvLoginMessage(status) {
      if (status.subscriptionActive === false) return "F1 TV is signed in, but the subscription is not active for playback. Activate it, then sign in again.";
      if (status.authenticated) return "F1 TV playback token connected.";
      if (/subscription is not active|inactive|entitlement|rights/i.test(String(status.credentialError || ""))) return `F1 TV subscription is not active: ${status.credentialError}`;
      if (status.credentialError) return `F1 TV email/password sign-in did not return a playback token: ${status.credentialError}`;
      if (status.browserSession) return "Browser signed in. The playback token is still missing, so use email/password sign-in for streams.";
      return "Sign-in window closed before a playback token was detected.";
    }

    function updateApi() {
      return window.pitwall?.updates || null;
    }

    async function checkForUpdates() {
      const updates = updateApi();
      if (!updates?.check) {
        setUpdateStatus({ status: "unavailable", currentVersion: "", update: null, message: "Open Apexline as the macOS app to check for updates." });
        return;
      }
      setUpdateBusy(true);
      try {
        const status = await updates.check();
        setUpdateStatus(status || { status: "unavailable", currentVersion: "", update: null, message: "Update feed did not return a status." });
      } catch {
        setUpdateStatus({ status: "error", currentVersion: "", update: null, message: "Could not reach the Vercel update feed." });
      } finally {
        setUpdateBusy(false);
      }
    }

    async function installUpdateAndRestart() {
      const url = updateStatus.update?.url;
      if (!url) return;
      setUpdateBusy(true);
      setUpdateStatus((current) => ({ ...current, message: "Downloading update. Apexline will restart when installation is ready." }));
      try {
        await updateApi()?.install?.(url);
        setUpdateStatus((current) => ({ ...current, message: "Installing update and restarting Apexline." }));
      } catch (error) {
        setUpdateStatus((current) => ({ ...current, message: error?.message || "Could not install the update." }));
        setUpdateBusy(false);
      }
    }

    React.useEffect(() => {
      let mounted = true;
      aiAuth()?.authStatus?.()
        .then((status) => mounted && setOauthStatus(status || { codexConnected: false, grokConnected: false }))
        .catch(() => {});
      return () => { mounted = false; };
    }, []);

    React.useEffect(() => {
      let mounted = true;
      keyStore().get("f1tv-email").then((email) => {
        if (mounted && email) setF1Email(email);
      }).catch(() => {});
      const auth = f1TvAuth();
      if (auth) {
        auth.status().then((status) => {
          if (mounted) setF1Status(status);
        }).catch(() => {});
      }
      return () => { mounted = false; };
    }, []);

    React.useEffect(() => {
      checkForUpdates();
    }, []);

    async function connectOAuthProvider(provider) {
      const auth = aiAuth();
      if (!auth?.authStart) {
        setKeyStatus("Open the macOS app to connect OAuth providers");
        return;
      }
      setOauthBusy(provider);
      setOauthCode("");
      setKeyStatus(`Opening ${providerLabel(provider)} sign-in… paste the code from the browser if asked.`);
      try {
        const status = await auth.authStart(provider);
        setOauthStatus(status || { codexConnected: false, grokConnected: false });
        setOauthCode("");
        setKeyStatus(`${providerLabel(provider)} connected`);
        refreshConnections();
        setTimeout(() => setKeyStatus(""), 1800);
      } catch (error) {
        setKeyStatus(error.message || `Could not connect ${providerLabel(provider)}`);
      } finally {
        setOauthBusy("");
        setOauthCodeBusy(false);
      }
    }

    async function submitOAuthCode(provider) {
      const auth = aiAuth();
      if (!auth?.authSubmitCode) {
        setKeyStatus("Open the macOS app to paste an OAuth code");
        return;
      }
      const code = oauthCode.trim();
      if (!code) {
        setKeyStatus("Paste the authorization code from the browser first");
        return;
      }
      setOauthCodeBusy(true);
      setKeyStatus(`Submitting ${providerLabel(provider)} code…`);
      try {
        await auth.authSubmitCode(provider, code);
        setKeyStatus("Code accepted — finishing sign-in…");
      } catch (error) {
        setKeyStatus(error.message || `Could not submit ${providerLabel(provider)} code`);
        setOauthCodeBusy(false);
      }
    }

    async function disconnectOAuthProvider(provider) {
      const auth = aiAuth();
      if (!auth?.authDisconnect) {
        setOauthStatus((current) => ({ ...current, [`${provider}Connected`]: false }));
        return;
      }
      setOauthBusy(provider);
      try {
        const status = await auth.authDisconnect(provider);
        setOauthStatus(status || { codexConnected: false, grokConnected: false });
        setKeyStatus(`${providerLabel(provider)} disconnected`);
        refreshConnections();
        setTimeout(() => setKeyStatus(""), 1800);
      } catch {
        setKeyStatus(`Could not disconnect ${providerLabel(provider)}`);
      } finally {
        setOauthBusy("");
      }
    }

    async function signInF1Tv(mode) {
      const auth = f1TvAuth();
      if (!auth) {
        setF1Message("Open Apexline as the macOS app to connect F1 TV.");
        return;
      }
      setF1Busy(true);
      setF1Message(mode === "embedded" ? "Opening F1 TV login..." : "Requesting F1 TV playback token...");
      try {
        const status = await window.pitwall.f1tv.login({
          mode,
          email: f1Email,
          password: mode === "credentials" ? f1Password : "",
        });
        setF1Status(status);
        setF1Password("");
        setF1Message(f1TvLoginMessage(status));
        refreshConnections();
      } catch {
        setF1Message("Could not open F1 TV sign-in.");
      } finally {
        setF1Busy(false);
      }
    }

    async function signOutF1Tv() {
      const auth = f1TvAuth();
      if (!auth) {
        setF1Status({ authenticated: false, cookieCount: 0 });
        return;
      }
      setF1Busy(true);
      try {
        const status = await auth.logout();
        setF1Status(status);
        setF1Message("F1 TV session cleared.");
        refreshConnections();
      } catch {
        setF1Message("Could not clear the F1 TV session.");
      } finally {
        setF1Busy(false);
      }
    }

    function move(list, setList) {
      return (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        const next = list.slice();
        [next[i], next[j]] = [next[j], next[i]];
        setList(next);
      };
    }
    const moveDriver = move(favDrivers, setFavDrivers);
    const moveTeam = move(favTeams, setFavTeams);
    const f1SignedIn = Boolean(f1Status.authenticated);
    const f1BrowserSignedIn = Boolean(!f1SignedIn && f1Status.browserSession);
    const f1BadgeLabel = f1SignedIn ? "Ready" : f1BrowserSignedIn ? "Browser signed in" : "Offline";
    const f1BadgeTone = f1SignedIn ? "success" : f1BrowserSignedIn ? "warning" : "neutral";
    const f1Note = f1SignedIn
      ? "F1 TV playback token is stored in Keychain and ready for streams."
      : f1BrowserSignedIn
        ? "F1 TV browser is signed in, but the playback token is still missing. Use email/password sign-in so Apexline can load streams."
        : "No F1 TV playback token connected. MultiViewer uses its own app profile.";
    return (
      <div className="set">
        <nav className="set__nav">
          {SECTIONS.map((s) => (
            <div className="set__navitem" key={s.id} data-active={sec === s.id} onClick={() => setSec(s.id)}>
              <Icon name={s.icon} size={16} />{s.label}
            </div>
          ))}
        </nav>

        <div className="set__col">
          {sec === "ai" && (
            <>
              <Card title="AI provider" subtitle="Apexline uses your own accounts. OAuth sessions stay in the macOS Keychain.">
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="provider">
                    <ProviderLogo provider="codex" />
                    <div style={{ flex: 1 }}>
                      <div className="row__t">ChatGPT (Codex)</div>
                      <div className="row__s">{oauthStatus.codexConnected ? "Connected · Codex OAuth" : "Not connected"}</div>
                    </div>
                    <Badge tone={oauthStatus.codexConnected ? "success" : "neutral"} dot>{oauthStatus.codexConnected ? "Active" : "OAuth"}</Badge>
                    <Button variant={oauthStatus.codexConnected ? "ghost" : "secondary"} disabled={oauthBusy === "codex"} onClick={() => oauthStatus.codexConnected ? disconnectOAuthProvider("codex") : connectOAuthProvider("codex")}>{oauthStatus.codexConnected ? "Disconnect" : "Connect"}</Button>
                  </div>
                  <div className="provider">
                    <ProviderLogo provider="grok" />
                    <div style={{ flex: 1 }}>
                      <div className="row__t">Grok</div>
                      <div className="row__s">{oauthStatus.grokConnected ? "Connected · xAI OAuth" : "Not connected"}</div>
                    </div>
                    <Badge tone={oauthStatus.grokConnected ? "success" : "neutral"} dot>{oauthStatus.grokConnected ? "Active" : "OAuth"}</Badge>
                    <Button variant={oauthStatus.grokConnected ? "ghost" : "secondary"} disabled={oauthBusy === "grok"} onClick={() => oauthStatus.grokConnected ? disconnectOAuthProvider("grok") : connectOAuthProvider("grok")}>{oauthStatus.grokConnected ? "Disconnect" : "Connect"}</Button>
                  </div>
                  {oauthBusy && (
                    <div className="friends-add-form" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
                      <Input
                        label="Authorization code"
                        value={oauthCode}
                        placeholder="Paste code or full callback URL from the browser"
                        onChange={(e) => setOauthCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitOAuthCode(oauthBusy);
                          }
                        }}
                      />
                      <Button variant="secondary" disabled={oauthCodeBusy || !oauthCode.trim()} onClick={() => submitOAuthCode(oauthBusy)}>
                        {oauthCodeBusy ? "Submitting…" : "Submit code"}
                      </Button>
                    </div>
                  )}
                  {keyStatus && <Badge tone="success">{keyStatus}</Badge>}
                </div>
              </Card>

              <Card title="Preferred model" subtitle="Used for battle detection, strategy & projections">
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <SegmentedControl value={model} onChange={setModel} accent options={AI_MODEL_OPTIONS} />
                  <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                    Structured JSON output mode · teaching system prompt enabled.
                  </span>
                </div>
              </Card>

              <Card title="How Apexline's AI works" subtitle="Hybrid: the app computes the precise numbers, the model reasons about strategy">
                <div className="ai-flow">
                  {[
                    { n: "01", t: "Telemetry in", d: "OpenF1 stream: gaps, sectors, tyres, DRS." },
                    { n: "02", t: "App computes", d: "Swift calculates deltas, deg rates, projections." },
                    { n: "03", t: "Prompt + JSON", d: "Structured data + F1 system prompt → your model." },
                    { n: "04", t: "Insights out", d: "JSON + commentary drives alerts & onboard pairs." },
                  ].map((s, i) => (
                    <div className="ai-step" key={i}>
                      <span className="ai-step__n">{s.n}</span>
                      <div className="ai-step__t">{s.t}</div>
                      <div className="ai-step__d">{s.d}</div>
                      {i < 3 && <span className="ai-step__arrow"><Icon name="chevronRight" size={16} /></span>}
                    </div>
                  ))}
                </div>
                <div className="row">
                  <div className="row__txt"><div className="row__t">Auto-apply intelligent onboard pairs</div><div className="row__s">When a battle is detected, load both onboards into Battle Mode automatically.</div></div>
                  <Switch defaultChecked />
                </div>
                <div className="row">
                  <div className="row__txt"><div className="row__t">Stream telemetry to model</div><div className="row__s">Send computed (not raw) data on a 5-second cadence during live sessions.</div></div>
                  <Switch defaultChecked />
                </div>
              </Card>
            </>
          )}

          {sec === "favorites" && (() => {
            const driverPool = D.drivers.filter((d) => !favDrivers.includes(d.code));
            const teamPool = D.constructors.filter((c) => !favTeams.includes(c.abbr));
            const driverItems = favDrivers.map((code) => {
              const d = D.byCode[code];
              if (!d) return null;
              return { key: code, name: d.name, sub: d.team + " · #" + d.num,
                avatar: <Avatar initials={d.code} number={d.num} ring={d.color} src={d.remoteImage || d.image} size="md" /> };
            }).filter(Boolean);
            const teamItems = favTeams.map((abbr) => {
              const c = D.constructors.find((x) => x.abbr === abbr);
              if (!c) return null;
              return { key: abbr, name: c.name, sub: "Constructor · P" + c.pos,
                avatar: <Avatar initials={c.abbr} square ring={c.color} src={c.logo} size="md" /> };
            }).filter(Boolean);
            return (
              <Card title="Favorites" subtitle="Rank your drivers and teams. Highlights, news and the dashboard prioritize your top picks — #1 leads everywhere.">
                <div className="fav-grid">
                  {/* Drivers */}
                  <div>
                    <div className="fav-col__hd">
                      <Icon name="user" size={16} />
                      <h4>Drivers</h4>
                      <span className="fav-col__count">{favDrivers.length} ranked</span>
                    </div>
                    <RankList items={driverItems} kind="drivers" onMove={moveDriver}
                      onRemove={(k) => setFavDrivers(favDrivers.filter((c) => c !== k))} />
                    {driverPool.length > 0 && (
                      <>
                        <div className="fav-pool__label">Add a driver</div>
                        <div className="fav-pool">
                          {driverPool.map((d) => (
                            <button className="fav-chip" key={d.code} onClick={() => setFavDrivers([...favDrivers, d.code])}>
                              <span className="fav-chip__swatch" style={{ background: d.color }} />
                              {d.code}
                              <span className="fav-chip__add"><Icon name="plus" size={13} /></span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Teams */}
                  <div>
                    <div className="fav-col__hd">
                      <Icon name="trophy" size={16} />
                      <h4>Teams</h4>
                      <span className="fav-col__count">{favTeams.length} ranked</span>
                    </div>
                    <RankList items={teamItems} kind="teams" onMove={moveTeam}
                      onRemove={(k) => setFavTeams(favTeams.filter((a) => a !== k))} />
                    {teamPool.length > 0 && (
                      <>
                        <div className="fav-pool__label">Add a team</div>
                        <div className="fav-pool">
                          {teamPool.map((c) => (
                            <button className="fav-chip" key={c.abbr} onClick={() => setFavTeams([...favTeams, c.abbr])}>
                              <span className="fav-chip__swatch" style={{ background: c.color }} />
                              {c.name}
                              <span className="fav-chip__add"><Icon name="plus" size={13} /></span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })()}

          {sec === "friends" && (
            <Card title="Friends" subtitle="Add Apexline friends for Watch Party chat and synced sessions.">
              <div className="row" style={{ paddingTop: 0 }}>
                <div className="row__txt">
                  <div className="row__t">Your friend code</div>
                  <div className="row__s">Share this with people you want to watch live races or replays with.</div>
                </div>
                <div className="profile-photo__body">
                  <div className="f1-login__title">{socialIdentity?.friendCode || "Pending"}</div>
                  <div className="profile-photo__msg">{friendStatus}</div>
                </div>
              </div>
              <div className="row">
                <div className="row__txt">
                  <div className="row__t">Add friend</div>
                  <div className="row__s">Friend identities are Apexline-local and separate from F1 TV or AI accounts.</div>
                </div>
                <div className="f1-login__fields friends-add-form" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                  <Input label="Friend code" value={friendCodeInput} placeholder="AB12CD34" onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())} />
                  <Button variant="secondary" onClick={addFriendByCode}>Add</Button>
                </div>
              </div>
              <div className="row">
                <div className="row__txt">
                  <div className="row__t">Accepted friends</div>
                  <div className="row__s">{socialFriends.length ? `${socialFriends.length} friend${socialFriends.length === 1 ? "" : "s"} available for Watch Party invites.` : "No friends added yet."}</div>
                </div>
                <Button variant="ghost" onClick={refreshFriends}>Refresh</Button>
              </div>
              {socialFriends.map((item, index) => (
                <div className="row" key={item.friend?.userId || index}>
                  <div className="row__txt">
                    <div className="row__t">{item.friend?.displayName || "Apexline fan"}</div>
                    <div className="row__s">{item.status || "accepted"}</div>
                  </div>
                  <Button variant="ghost" disabled>Remove</Button>
                </div>
              ))}
            </Card>
          )}

          {sec === "account" && (
            <Card title="F1 TV account" subtitle="Required to watch live streams. The sign-in session stays inside this Mac app.">
              <div className="row" style={{ paddingTop: 0 }}>
                <div className="row__txt">
                  <div className="row__t">Your name</div>
                  <div className="row__s">Used for greetings and local personalization only.</div>
                </div>
                <Input label="Display name" value={userName} placeholder="Enter your name" onChange={(e) => setUserName(e.target.value)} />
              </div>
              <div className="row">
                <div className="row__txt">
                  <div className="row__t">Profile picture</div>
                  <div className="row__s">Shown in the Apexline sidebar and stored with this local app profile.</div>
                </div>
                <div className="profile-photo">
                  <Avatar initials={(userName || "PW").trim().slice(0, 2).toUpperCase()} src={profileImageUrl} size="lg" />
                  <div className="profile-photo__body">
                    <div className="profile-photo__actions">
                      <input id="profile-image-input" className="profile-photo__input" ref={profileImageInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={selectProfileImage} />
                      <Button variant="secondary" onClick={() => profileImageInputRef.current?.click()}>Choose photo</Button>
                      {profileImageUrl && <Button variant="ghost" onClick={() => { setProfileImageUrl(""); setProfileImageMessage("Profile photo cleared."); }}>Clear photo</Button>}
                    </div>
                    <div className="profile-photo__msg">{profileImageMessage || "PNG, JPG, GIF, WebP, or SVG under 2 MB."}</div>
                  </div>
                </div>
              </div>
              <div className="f1-login">
                <div className="f1-login__main">
                  <div className="f1-login__top">
                    <div className="f1-login__logo"><span>F1</span><b>TV</b></div>
                    <div className="f1-login__copy">
                      <div className="f1-login__title">F1 TV</div>
                      <div className="f1-login__sub">Sign in with your F1 TV account. MultiViewer uses its own app profile, so sign in here too.</div>
                    </div>
                    <div className="f1-login__status">
                      {(f1SignedIn || f1BrowserSignedIn) && <Button variant="ghost" disabled={f1Busy} onClick={signOutF1Tv}>Sign out</Button>}
                      <Badge tone={f1BadgeTone} dot>{f1BadgeLabel}</Badge>
                    </div>
                  </div>
                  {!f1SignedIn && (
                    <>
                      <div className="f1-login__fields">
                        <Input label="Email" value={f1Email} placeholder="Email" onChange={(e) => setF1Email(e.target.value)} />
                        <Input label="Password" type="password" value={f1Password} placeholder="Password" onChange={(e) => setF1Password(e.target.value)} />
                      </div>
                      <div className="f1-login__actions">
                        <Button variant="secondary" disabled={f1Busy} onClick={() => signInF1Tv("credentials")}>{f1Busy ? "Opening..." : "SIGN IN"}</Button>
                      </div>
                    </>
                  )}
                  <div className="f1-login__note">{f1Message || f1Note}</div>
                </div>
              </div>
              <div className="row"><div className="row__txt"><div className="row__t">Unofficial companion app</div><div className="row__s">Apexline requires an active F1 TV subscription. Not affiliated with Formula 1.</div></div></div>
            </Card>
          )}

          {sec === "appearance" && (
            <Card title="Appearance" subtitle="Theme & display">
              <div className="row"><div className="row__txt"><div className="row__t">Theme</div><div className="row__s">Changes primary actions, accents, borders, and focus color.</div></div>
                <SegmentedControl value={appPrefs.theme} onChange={(value) => setPref("theme", value)} options={THEME_OPTIONS} /></div>
              <div className="row"><div className="row__txt"><div className="row__t">Reduce motion</div><div className="row__s">Minimize pulses and transitions.</div></div><Switch checked={appPrefs.reduceMotion} onChange={(value) => setPref("reduceMotion", value)} /></div>
            </Card>
          )}

          {sec === "notifications" && (
            <Card title="Notifications" subtitle="What Apexline pings you about">
              {[
                ["lightsOut", "Race reminders", "5 minutes before selected race starts"],
              ].map((r) => (
                <div className="row" key={r[0]}><div className="row__txt"><div className="row__t">{r[1]}</div><div className="row__s">{r[2]}</div></div><Switch checked={appPrefs.notifications[r[0]]} onChange={(value) => setNotification(r[0], value)} /></div>
              ))}
            </Card>
          )}

          {sec === "updates" && (
            <Card title="Updates" subtitle="Checks the public Vercel release feed without exposing the private source repo.">
              <div className="row" style={{ paddingTop: 0 }}>
                <div className="row__txt">
                  <div className="row__t">Installed version</div>
                  <div className="row__s">{updateStatus.currentVersion ? "Version " + updateStatus.currentVersion : "Version is available in the packaged macOS app."}</div>
                </div>
                <Badge tone={updateStatus.status === "available" ? "warning" : updateStatus.status === "current" ? "success" : "neutral"} dot>
                  {updateStatus.status === "available" ? "Update" : updateStatus.status === "current" ? "Current" : "Feed"}
                </Badge>
              </div>
              <div className="row">
                <div className="row__txt">
                  <div className="row__t">{updateStatus.update ? "Version " + updateStatus.update.version + " available" : "Vercel update feed"}</div>
                  <div className="row__s">{updateStatus.message || "Apexline checks for a newer signed or manually installed macOS build."}</div>
                </div>
                <Button variant="ghost" disabled={updateBusy} onClick={checkForUpdates}>{updateBusy ? "Checking..." : "Check"}</Button>
                {updateStatus.update && <Button variant="secondary" disabled={updateBusy} onClick={installUpdateAndRestart}>Install & Restart</Button>}
              </div>
              {updateStatus.update?.notes && (
                <div className="row">
                  <div className="row__txt">
                    <div className="row__t">Release notes</div>
                    <div className="row__s">{updateStatus.update.notes}</div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {sec === "layouts" && (
            <Card title="Layout defaults" subtitle="Your starting Live Racing layout">
              <div className="row"><div className="row__txt"><div className="row__t">Default preset</div><div className="row__s">Applied when you enter Live Racing.</div></div>
                <SegmentedControl value={appPrefs.defaultPreset} onChange={(value) => setPref("defaultPreset", value)} options={[{ value: "Intelligent", label: "Intelligent" }, { value: "Battle Mode", label: "Battle" }, { value: "Data Overload", label: "Data" }]} /></div>
              <div className="row"><div className="row__txt"><div className="row__t">Remember last layout</div><div className="row__s">Restore your panes, sidebars & sizes next session.</div></div><Switch checked={appPrefs.rememberLayout} onChange={(value) => setPref("rememberLayout", value)} /></div>
              <div className="row"><div className="row__txt"><div className="row__t">Video quality</div><div className="row__s">Max for very strong connections, High for 200 Mbps+, Medium for around 100 Mbps, Low for around 50 Mbps.</div></div>
                <SegmentedControl value={appPrefs.videoQuality} onChange={(value) => setPref("videoQuality", value)} options={VIDEO_QUALITY_OPTIONS} /></div>
              <div className="row"><div className="row__txt"><div className="row__t">F1 Live sync latency</div><div className="row__s">Baseline delay behind live edge. Other stream targets keep their relative offset when this changes.</div></div><Input label="Seconds" type="number" value={f1LiveLatencyDraft} onChange={(e) => setF1LiveLatencyDraft(e.target.value)} onBlur={(e) => commitF1LiveLatency(e.target.value)} /></div>
              <div className="row"><div className="row__txt"><div className="row__t">Telemetry overlay by default</div><div className="row__s">Show speed, gear, throttle, and gap on every new pane.</div></div><Switch checked={appPrefs.telemetryDefault} onChange={(value) => setPref("telemetryDefault", value)} /></div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.Settings = Settings;
})();
