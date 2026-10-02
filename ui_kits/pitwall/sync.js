/* Apexline stream sync helpers. window.PW_SYNC */
(function () {
  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function replaySync(masterTime, playerTime, options = {}) {
    const drift = finite(playerTime, 0) - finite(masterTime, 0);
    const seekThreshold = finite(options.seekThreshold, 0.5);
    const rateThreshold = finite(options.rateThreshold, 0.075);
    if (Math.abs(drift) > seekThreshold) return { action: "seek", playbackRate: 1, drift };
    if (drift > rateThreshold) return { action: "rate", playbackRate: 0.8, drift };
    if (drift < -rateThreshold) return { action: "rate", playbackRate: 1.2, drift };
    return { action: "hold", playbackRate: 1, drift };
  }

  function liveSync(liveLatency, targetLatency, epsilon = 0.075) {
    const delta = finite(liveLatency, 0) - finite(targetLatency, 0);
    if (delta > epsilon) return { playbackRate: 1.2, delta };
    if (delta < -epsilon) return { playbackRate: 0.8, delta };
    return { playbackRate: 1, delta };
  }

  // Live follower vs master by playhead wall-clock (UTC) time, like MultiViewer's
  // actual-latency sync. Each F1 TV feed has its own CDN live edge, so matching
  // edge-relative latency leaves onboards seconds off the main feed.
  // offsetSeconds > 0 keeps the follower that much behind the master.
  function liveUtcAlign(masterUtcMs, followerUtcMs, offsetSeconds, options = {}) {
    const master = Number(masterUtcMs);
    const follower = Number(followerUtcMs);
    if (masterUtcMs == null || followerUtcMs == null || !Number.isFinite(master) || !Number.isFinite(follower)) {
      return { action: "none", drift: null, playbackRate: 1 };
    }
    const drift = Math.round(follower - (master - finite(offsetSeconds, 0) * 1000)) / 1000;
    if (Math.abs(drift) > finite(options.maxDrift, 90)) return { action: "none", drift, playbackRate: 1 };
    const seekThreshold = finite(options.seekThreshold, 0.5);
    const rateThreshold = finite(options.rateThreshold, 0.1);
    if (Math.abs(drift) > seekThreshold) return { action: "seek", drift, playbackRate: 1 };
    if (drift > rateThreshold) return { action: "rate", drift, playbackRate: 0.9 };
    if (drift < -rateThreshold) return { action: "rate", drift, playbackRate: 1.1 };
    return { action: "hold", drift, playbackRate: 1 };
  }

  function syncReplayPlayers(players, masterTime, options = {}) {
    const updates = [];
    (players || []).forEach((entry) => {
      const player = entry?.player || entry;
      if (!player) return;
      const targetTime = entry?.player ? finite(entry.targetTime, finite(masterTime, 0)) : finite(masterTime, 0);
      const decision = replaySync(targetTime, player.currentTime, options);
      if (decision.action === "seek") player.currentTime = targetTime;
      player.playbackRate = decision.playbackRate;
      updates.push({ player, targetTime, decision });
    });
    return updates;
  }

  const partySync = {
    shouldApply(message = {}, state = {}) {
      const sequence = finite(message.sequence, 0);
      const lastSequence = finite(state.lastSequence, 0);
      if (sequence <= lastSequence) return false;
      const expected = String(state.contentFingerprint || "");
      const incoming = String(message.contentFingerprint || "");
      return !expected || !incoming || expected === incoming;
    },
    replayDecision(message = {}, state = {}) {
      const sentAt = finite(message.sentAt, Date.now());
      const playing = message.playing !== false;
      const elapsed = playing ? Math.max(0, (Date.now() - sentAt) / 1000) : 0;
      const masterTime = Math.max(0, finite(message.masterTime, finite(state.masterTime, 0)) + elapsed);
      // Hosts re-publish periodically; only seek guests that actually drifted
      // (exact frame when paused) so in-sync guests don't hitch every update.
      const localTime = Number(state.localTime);
      const threshold = playing ? finite(state.seekThreshold, 0.5) : 0.1;
      const shouldSeek = state.localTime == null || !Number.isFinite(localTime) || Math.abs(localTime - masterTime) > threshold;
      return {
        mode: "replay",
        masterTime,
        playing,
        shouldSeek,
        sequence: finite(message.sequence, 0),
        sentAt,
      };
    },
    liveDecision(message = {}, state = {}) {
      const targetLatency = finite(message.targetLatency, finite(state.targetLatency, 8));
      // actualLatency = host's now − main-feed frame timestamp: where the host's
      // picture is, independent of each viewer's CDN live edge.
      const actualLatency = message.actualLatency == null ? null : finite(message.actualLatency, null);
      return {
        mode: "live",
        targetLatency,
        actualLatency,
        playing: message.playing !== false,
        sequence: finite(message.sequence, 0),
        sentAt: finite(message.sentAt, Date.now()),
        ...liveSync(finite(state.liveLatency, targetLatency), targetLatency),
      };
    },
  };

  window.PW_SYNC = { replaySync, liveSync, liveUtcAlign, syncReplayPlayers, partySync };
})();
