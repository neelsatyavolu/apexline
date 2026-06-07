public enum ProbeScript {
    public static let source = """
    (() => {
      const post = (payload) => {
        try {
          window.webkit.messageHandlers.pitwallProbe.postMessage({
            timestamp: new Date().toISOString(),
            ...payload
          });
        } catch (_) {}
      };

      const configs = [{
        initDataTypes: ['sinf', 'skd'],
        videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }]
      }];

      const keySystems = ['com.apple.fps.1_0', 'com.apple.fps'];
      keySystems.forEach(async (keySystem) => {
        try {
          await navigator.requestMediaKeySystemAccess(keySystem, configs);
          post({ type: 'eme', keySystem, status: 'available' });
        } catch (error) {
          post({ type: 'eme', keySystem, status: 'unavailable', message: String(error) });
        }
      });

      const observedVideos = new WeakSet();
      const frameTrackingVideos = new WeakSet();
      const frameMetadata = new WeakMap();

      const finiteNumberOrNull = (value) => Number.isFinite(value) ? value : null;

      const trackVideoFrames = (video) => {
        if (frameTrackingVideos.has(video)) {
          return;
        }
        frameTrackingVideos.add(video);

        if (typeof video.requestVideoFrameCallback !== 'function') {
          post({ type: 'videoFrame', status: 'unavailable' });
          return;
        }

        const onFrame = (_now, metadata) => {
          frameMetadata.set(video, {
            presentedFrames: metadata.presentedFrames,
            mediaTime: metadata.mediaTime
          });
          video.requestVideoFrameCallback(onFrame);
        };

        video.requestVideoFrameCallback(onFrame);
      };

      const observeVideo = () => {
        const video = document.querySelector('video');
        if (!video) {
          post({ type: 'video', status: 'missing' });
          return;
        }

        const report = () => {
          const rect = video.getBoundingClientRect();
          const style = window.getComputedStyle(video);
          const frames = frameMetadata.get(video) || {};

          post({
            type: 'video',
            status: 'observed',
            readyState: video.readyState,
            networkState: video.networkState,
            paused: video.paused,
            muted: video.muted,
            currentTime: finiteNumberOrNull(video.currentTime),
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            clientWidth: video.clientWidth,
            clientHeight: video.clientHeight,
            rectWidth: finiteNumberOrNull(rect.width),
            rectHeight: finiteNumberOrNull(rect.height),
            decodedFrameCount: typeof video.webkitDecodedFrameCount === 'number' ? video.webkitDecodedFrameCount : null,
            droppedFrameCount: typeof video.webkitDroppedFrameCount === 'number' ? video.webkitDroppedFrameCount : null,
            presentedFrames: typeof frames.presentedFrames === 'number' ? frames.presentedFrames : null,
            mediaTime: finiteNumberOrNull(frames.mediaTime),
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            error: video.error ? video.error.message : null
          });
        };

        if (!observedVideos.has(video)) {
          observedVideos.add(video);
          ['play', 'playing', 'pause', 'waiting', 'error', 'timeupdate'].forEach((name) => {
            video.addEventListener(name, report);
          });
          trackVideoFrames(video);
        }
        report();
      };

      observeVideo();
      setInterval(observeVideo, 5000);
    })();
    """
}
