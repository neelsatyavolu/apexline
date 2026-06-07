/* PitWall stream sync helpers. window.PW_SYNC */
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
    (players || []).forEach((player) => {
      if (!player) return;
      const decision = replaySync(masterTime, player.currentTime, options);
      if (decision.action === "seek") player.currentTime = finite(masterTime, 0);
      player.playbackRate = decision.playbackRate;
      updates.push({ player, decision });
    });
    return updates;
  }

  window.PW_SYNC = { replaySync, liveSync, syncReplayPlayers };
})();
