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
    snapshot: () => ipcRenderer.invoke("pitwall:data:snapshot"),
    liveTiming: (options = {}) => ipcRenderer.invoke("pitwall:data:liveTiming", options),
    replayTiming: (options = {}) => ipcRenderer.invoke("pitwall:data:replayTiming", options),
  },
  ai: {
    authStatus: () => ipcRenderer.invoke("pitwall:ai:authStatus"),
    authStart: (provider) => ipcRenderer.invoke("pitwall:ai:authStart", provider),
    authDisconnect: (provider) => ipcRenderer.invoke("pitwall:ai:authDisconnect", provider),
    ask: (options = {}) => ipcRenderer.invoke("pitwall:ai:ask", options),
  },
  history: {
    query: (options = {}) => ipcRenderer.invoke("pitwall:history:query", options),
  },
  analytics: {
    library: (options = {}) => ipcRenderer.invoke("pitwall:analytics:library", options),
    session: (options = {}) => ipcRenderer.invoke("pitwall:analytics:session", options),
  },
  notifications: {
    schedule: (options = {}) => ipcRenderer.invoke("pitwall:notify:schedule", options),
  },
  debug: {
    log: (area, payload = {}) => ipcRenderer.invoke("pitwall:debug:log", area, payload),
    path: () => ipcRenderer.invoke("pitwall:debug:path"),
  },
  external: {
    openExternal: (url) => ipcRenderer.invoke("pitwall:external:open", url),
  },
});
