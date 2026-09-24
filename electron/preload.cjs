const { contextBridge, ipcRenderer } = require("electron");

async function getDrmStatus() {
  const cdm = await ipcRenderer.invoke("pitwall:f1tv:cdm").catch(() => ({
    configured: false,
    version: "",
    path: "",
    source: "",
  }));
  const emeAvailable = typeof navigator.requestMediaKeySystemAccess === "function";
  if (!emeAvailable) {
    return {
      emeAvailable: false,
      widevine: false,
      cdm,
      reason: "Encrypted Media Extensions are not available in this Electron runtime.",
    };
  }
  const config = [{
    initDataTypes: ["cenc"],
    audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
    videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
  }];
  try {
    await navigator.requestMediaKeySystemAccess("com.widevine.alpha", config);
    return {
      emeAvailable: true,
      widevine: true,
      cdm,
      keySystem: "com.widevine.alpha",
      reason: "",
    };
  } catch (error) {
    return {
      emeAvailable: true,
      widevine: false,
      cdm,
      keySystem: "com.widevine.alpha",
      reason: error?.message || "Widevine is not available in this Electron runtime.",
    };
  }
}

contextBridge.exposeInMainWorld("pitwall", {
  platform: process.platform,
  appMode: "electron",
  keys: {
    get: (provider) => ipcRenderer.invoke("pitwall:key:get", provider),
    set: (provider, value) => ipcRenderer.invoke("pitwall:key:set", provider, value),
    delete: (provider) => ipcRenderer.invoke("pitwall:key:delete", provider),
  },
  profile: {
    get: () => ipcRenderer.invoke("pitwall:profile:get"),
    set: (profile) => ipcRenderer.invoke("pitwall:profile:set", profile),
  },
  f1tv: {
    status: () => ipcRenderer.invoke("pitwall:f1tv:status"),
    probeStatus: (options = {}) => ipcRenderer.invoke("pitwall:f1tv:probeStatus", options),
    login: (options = {}) => ipcRenderer.invoke("pitwall:f1tv:login", options),
    browse: () => ipcRenderer.invoke("pitwall:f1tv:browse"),
    browseSession: (options = {}) => ipcRenderer.invoke("pitwall:f1tv:browseSession", options),
    library: (options = {}) => ipcRenderer.invoke("pitwall:f1tv:library", options),
    streams: () => ipcRenderer.invoke("pitwall:f1tv:streams"),
    resolveContent: (options = {}) => ipcRenderer.invoke("pitwall:f1tv:resolveContent", options),
    mediaFetch: (request = {}) => ipcRenderer.invoke("pitwall:f1tv:mediaFetch", request),
    drmStatus: getDrmStatus,
    logout: () => ipcRenderer.invoke("pitwall:f1tv:logout"),
  },
  data: {
    snapshot: (options = {}) => ipcRenderer.invoke("pitwall:data:snapshot", options),
    onUpdated: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = () => callback();
      ipcRenderer.on("pitwall:data:updated", listener);
      return () => ipcRenderer.removeListener("pitwall:data:updated", listener);
    },
    liveTiming: (options = {}) => ipcRenderer.invoke("pitwall:data:liveTiming", options),
    liveTimingResync: () => ipcRenderer.invoke("pitwall:data:liveTimingResync"),
    replayTiming: (options = {}) => ipcRenderer.invoke("pitwall:data:replayTiming", options),
    replayTimingAvailability: (options = {}) => ipcRenderer.invoke("pitwall:data:replayTimingAvailability", options),
    trackMapReplayTiming: (options = {}) => ipcRenderer.invoke("pitwall:data:trackMapReplayTiming", options),
  },
  ai: {
    authStatus: () => ipcRenderer.invoke("pitwall:ai:authStatus"),
    authStart: (provider) => ipcRenderer.invoke("pitwall:ai:authStart", provider),
    authSubmitCode: (provider, code) => ipcRenderer.invoke("pitwall:ai:authSubmitCode", provider, code),
    authDisconnect: (provider) => ipcRenderer.invoke("pitwall:ai:authDisconnect", provider),
    preferredModel: {
      get: () => ipcRenderer.invoke("pitwall:ai:preferredModel:get"),
      set: (value) => ipcRenderer.invoke("pitwall:ai:preferredModel:set", value),
    },
    ask: (options = {}) => ipcRenderer.invoke("pitwall:ai:ask", options),
  },
  history: {
    query: (options = {}) => ipcRenderer.invoke("pitwall:history:query", options),
  },
  social: {
    bootstrap: (options = {}) => ipcRenderer.invoke("pitwall:social:bootstrap", options),
    friends: (options = {}) => ipcRenderer.invoke("pitwall:social:friends", options),
    addFriend: (options = {}) => ipcRenderer.invoke("pitwall:social:addFriend", options),
    roomCreate: (options = {}) => ipcRenderer.invoke("pitwall:social:roomCreate", options),
    roomJoin: (options = {}) => ipcRenderer.invoke("pitwall:social:roomJoin", options),
    ablyToken: (options = {}) => ipcRenderer.invoke("pitwall:social:ablyToken", options),
    chatHistory: (options = {}) => ipcRenderer.invoke("pitwall:social:chatHistory", options),
    chatSave: (options = {}) => ipcRenderer.invoke("pitwall:social:chatSave", options),
  },
  analytics: {
    library: (options = {}) => ipcRenderer.invoke("pitwall:analytics:library", options),
    session: (options = {}) => ipcRenderer.invoke("pitwall:analytics:session", options),
  },
  notifications: {
    schedule: (options = {}) => ipcRenderer.invoke("pitwall:notify:schedule", options),
    cancel: (id) => ipcRenderer.invoke("pitwall:notify:cancel", id),
  },
  windowState: {
    get: () => ipcRenderer.invoke("pitwall:window:state"),
    onChange: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("pitwall:window:state", listener);
      return () => ipcRenderer.removeListener("pitwall:window:state", listener);
    },
  },
  debug: {
    log: (area, payload = {}) => ipcRenderer.invoke("pitwall:debug:log", area, payload),
    path: () => ipcRenderer.invoke("pitwall:debug:path"),
  },
  external: {
    openExternal: (url) => ipcRenderer.invoke("pitwall:external:open", url),
  },
  usageStats: {
    get: () => ipcRenderer.invoke("pitwall:usageStats:get"),
    set: (enabled) => ipcRenderer.invoke("pitwall:usageStats:set", enabled),
  },
  updates: {
    check: () => ipcRenderer.invoke("pitwall:updates:check"),
    open: (url) => ipcRenderer.invoke("pitwall:updates:open", url),
    install: (url) => ipcRenderer.invoke("pitwall:updates:install", url),
  },
});
