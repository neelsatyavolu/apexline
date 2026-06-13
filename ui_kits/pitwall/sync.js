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
      return {
        mode: "replay",
        masterTime: Math.max(0, finite(message.masterTime, finite(state.masterTime, 0))),
        playing: message.playing !== false,
        sequence: finite(message.sequence, 0),
        sentAt: finite(message.sentAt, Date.now()),
      };
    },
    liveDecision(message = {}, state = {}) {
      const targetLatency = finite(message.targetLatency, finite(state.targetLatency, 8));
      return {
        mode: "live",
        targetLatency,
        playing: message.playing !== false,
        sequence: finite(message.sequence, 0),
        sentAt: finite(message.sentAt, Date.now()),
        ...liveSync(finite(state.liveLatency, targetLatency), targetLatency),
      };
    },
  };

  window.PW_SYNC = { replaySync, liveSync, syncReplayPlayers, partySync };
})();
