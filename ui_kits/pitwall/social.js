/* Apexline social/watch party client. window.PW_SOCIAL */
(function () {
  const ABLY_CDN = "https://cdn.ably.com/lib/ably.min-1.js";

  function loadAbly() {
    if (window.Ably?.Realtime) return Promise.resolve(window.Ably);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-apexline-ably]");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.Ably));
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = ABLY_CDN;
      script.async = true;
      script.dataset.apexlineAbly = "true";
      script.onload = () => resolve(window.Ably);
      script.onerror = () => reject(new Error("Realtime client unavailable"));
      document.head.appendChild(script);
    });
  }

  function safeText(value, fallback = "") {
    return String(value || fallback).trim().slice(0, 500);
  }

  function contentFingerprint(context = {}) {
    const race = safeText(context.raceName || context.race?.name || "session", "session").toLowerCase();
    const mode = safeText(context.mode || "live", "live").toLowerCase();
    const meeting = safeText(context.meetingKey || context.race?.meetingKey || context.selectedF1TvRace?.meetingKey || "");
    const session = safeText(context.sessionKind || context.f1TvSessionKind || "");
    const content = safeText(context.contentId || context.resolvedF1TvContent?.contentId || "");
    return [mode, meeting || race, session, content].filter(Boolean).join(":").replace(/[^a-z0-9:_-]+/g, "-");
  }

  function createClient() {
    const listeners = new Set();
    let identity = null;
    let room = null;
    let realtime = null;
    let channel = null;
    let lastSequence = 0;

    function emit(event) {
      listeners.forEach((listener) => {
        try { listener(event); } catch {}
      });
    }

    async function call(name, payload = {}) {
      const fn = window.pitwall?.social?.[name];
      if (!fn) throw new Error("Apexline social backend is unavailable.");
      return fn(payload);
    }

    async function bootstrap(profile = {}) {
      identity = await call("bootstrap", { profile });
      emit({ type: "identity", identity });
      return identity;
    }

    async function friends() {
      const data = await call("friends", { userId: identity?.userId });
      emit({ type: "friends", friends: data });
      return data;
    }

    async function connectRoom(nextRoom) {
      room = nextRoom;
      emit({ type: "room", room });
      if (!room?.id) return room;
      try {
        const Ably = await loadAbly();
        const token = await call("ablyToken", { userId: identity?.userId, roomId: room.id });
        realtime?.close?.();
        realtime = new Ably.Realtime({ authCallback: (_params, callback) => callback(null, token) });
        channel = realtime.channels.get(`watch:${room.id}`);
        channel.subscribe("chat", (msg) => emit({ type: "chat", message: msg.data }));
        channel.subscribe("sync", (msg) => emit({ type: "sync", message: msg.data }));
        channel.subscribe("sync-request", (msg) => emit({ type: "sync-request", message: msg.data }));
        channel.subscribe("typing", (msg) => emit({ type: "typing", message: msg.data }));
        channel.presence.enter({ userId: identity?.userId, name: identity?.displayName || "Apexline fan" });
        channel.presence.subscribe(() => channel.presence.get((_, members) => emit({ type: "presence", members: members || [] })));
        chatHistory().then((history) => {
          (history?.messages || []).forEach((message) => emit({ type: "chat", message }));
        }).catch(() => {});
      } catch (error) {
        emit({ type: "status", status: error?.message || "Realtime unavailable" });
      }
      return room;
    }

    async function createRoom(context = {}) {
      return connectRoom(await call("roomCreate", {
        userId: identity?.userId,
        contentFingerprint: contentFingerprint(context),
        label: safeText(context.raceName || context.sessionKind || "Watch party", "Watch party"),
      }));
    }

    async function joinRoom(code) {
      return connectRoom(await call("roomJoin", { userId: identity?.userId, code: safeText(code).toUpperCase() }));
    }

    async function chatHistory() {
      return call("chatHistory", { userId: identity?.userId, roomId: room?.id });
    }

    function sendChat(text) {
      const message = { id: `${Date.now()}:${Math.random()}`, userId: identity?.userId, name: identity?.displayName || "Apexline fan", text: safeText(text), sentAt: Date.now() };
      if (!message.text) return null;
      channel?.publish?.("chat", message);
      window.pitwall?.social?.chatSave?.({ roomId: room?.id, ...message }).catch(() => {});
      emit({ type: "chat", message });
      return message;
    }

    function publishHostSync(state = {}) {
      if (!room?.id) return null;
      const message = { ...state, sequence: Math.max(lastSequence + 1, Number(state.sequence || 0)), sentAt: Date.now() };
      lastSequence = message.sequence;
      channel?.publish?.("sync", message);
      emit({ type: "local-sync", message });
      return message;
    }

    function requestHostSync() {
      if (!room?.id) return null;
      const message = { requesterId: identity?.userId, sentAt: Date.now() };
      channel?.publish?.("sync-request", message);
      return message;
    }

    function publishTyping(typing) {
      if (!room?.id) return null;
      const message = { userId: identity?.userId, name: identity?.displayName || "Apexline fan", typing: Boolean(typing), sentAt: Date.now() };
      channel?.publish?.("typing", message);
      return message;
    }

    function leaveRoom() {
      channel?.presence?.leave?.();
      realtime?.close?.();
      realtime = null;
      channel = null;
      room = null;
      emit({ type: "room", room: null });
    }

    return {
      on(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      bootstrap,
      friends,
      createRoom,
      joinRoom,
      chatHistory,
      sendChat,
      publishHostSync,
      requestHostSync,
      publishTyping,
      leaveRoom,
      contentFingerprint,
      getState: () => ({ identity, room }),
    };
  }

  window.PW_SOCIAL = createClient();
})();
