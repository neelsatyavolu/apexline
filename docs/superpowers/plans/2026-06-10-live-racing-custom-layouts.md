# Live Racing Custom Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-built "custom" layout mode to Live Racing: a free-form blank canvas where users place, size, and snap any F1 TV feed (plus the app timing tower), with unlimited named saved layouts.

**Architecture:** Everything lives in `ui_kits/pitwall/LiveRacing.jsx` (the established pattern — module-scope pure helpers, inline components, inline CSS string) plus assertions in `scripts/pitwall-smoke-test.cjs`. Tiles are `{id, source, x, y, w, h}` with percent geometry, absolutely positioned in a canvas that replaces the preset grid when a custom layout is active. Saved layouts persist to localStorage `pw-live-custom-layouts` and mirror to the pitwall profile, mirroring the existing `panelSizes` pattern.

**Tech Stack:** React 18 (Babel-standalone, no bundler), hand-rolled pointer-event drag/resize, `node:assert` smoke tests run via `npm run smoke` (extracts named functions from source with `extractNamedFunction` and runs them in a `vm` sandbox).

**Spec:** `docs/superpowers/specs/2026-06-10-live-racing-custom-layouts-design.md`

**Key existing code facts (verified):**
- `LAYOUTS` (preset name → layout type) is at `ui_kits/pitwall/LiveRacing.jsx:554`; `const layout = LAYOUTS[preset];` at `:2551`.
- Pane structure: `{ feed, code, slot, zone, telemetry, focus, broadcast }`; paneIds assigned at `:3768` via `pane.broadcast ? "WORLD" : \`DRIVER-${pane.code}\``.
- `renderLivePane(p)` (`:3785`) resolves `streamUrl={streamSources[key] || resolvedFeedForKey(key, p.code)}` where `key = p.broadcast ? "WORLD" : p.code`. `resolvedFeedForKey` (`:3539`) matches `feed.feedId === key`, so **a channel pane with `code = feedId` resolves with zero changes to stream plumbing**.
- Session feeds: `resolvedF1TvContent.feeds`, each `{ feedId, kind, label, driverCode }`. Main feed picked by `preferredMainF1TvFeed(feeds)` (`:1035`).
- Timing sidebar markup is inline in the body render (`<aside className="live__timing">`, `:4090–4137`).
- Panel-size persistence + profile sync pattern: `:2609–2625` (touched ref + serialized key ref + `window.pitwall.profile.set({ ...profile, livePanelSizes: normalized }).catch(() => {})`).
- `pw-live-layout` is **read** on mount (`:3382–3391`) but never written by the app (only by test probes) — Task 2 adds the write.
- Preset `<select>` is at `:4059`; `presetOptions` at `:3730`.
- Grid renders `{gridPanes.map(renderLivePane)}` (~`:4189`); insights strip renders below for `layout !== "focus"` (~`:4192–4193`).
- Smoke test: `source["LiveRacing.jsx"]` text map; vm sandboxes like `liveTelemetrySandbox` at `scripts/pitwall-smoke-test.cjs:1832`; CSS/UI regex assertions like `:400–405`.

**Line numbers shift as tasks land — always re-locate anchors with `rg -n '<anchor text>'` before editing.**

---

### Task 1: Pure geometry + layout-model helpers (TDD via vm sandbox)

**Files:**
- Test: `scripts/pitwall-smoke-test.cjs` (add after the `liveTelemetrySandbox` assertions — search `rg -n 'formatTelemetryGap' scripts/pitwall-smoke-test.cjs`, insert after the last of those asserts)
- Modify: `ui_kits/pitwall/LiveRacing.jsx` (module scope, immediately after `readLivePanelSizes` — search `rg -n 'function readLivePanelSizes'`)

- [ ] **Step 1: Write the failing smoke assertions**

Add to `scripts/pitwall-smoke-test.cjs`:

```js
const liveCustomLayoutSandbox = vm.runInNewContext(`(() => {
  const CUSTOM_TILE_MIN_PCT = 12;
  const CUSTOM_PRESET_PREFIX = "custom:";
  ${extractNamedFunction(source["LiveRacing.jsx"], "customLayoutPresetId")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "customLayoutIdFromPreset")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "clampCustomTileGeometry")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "customTilesOverlap")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "customTileCollides")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "applyCustomDrag")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "snapCustomEdge")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "snapCustomTileGeometry")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "normalizeCustomTileSource")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "customTileSourceKey")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "customPaneIdForSource")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "normalizeCustomLayouts")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "nextCustomLayoutName")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "defaultCustomTileRect")}
  return { applyCustomDrag, clampCustomTileGeometry, customLayoutIdFromPreset, customLayoutPresetId, customPaneIdForSource, customTileCollides, customTileSourceKey, customTilesOverlap, defaultCustomTileRect, nextCustomLayoutName, normalizeCustomLayouts, normalizeCustomTileSource, snapCustomTileGeometry };
})()`);
assert.deepEqual(
  liveCustomLayoutSandbox.clampCustomTileGeometry({ x: 95, y: -4, w: 30, h: 6 }),
  { x: 70, y: 0, w: 30, h: 12 },
  "Custom tiles should clamp inside the canvas with a minimum size"
);
assert.ok(
  liveCustomLayoutSandbox.customTilesOverlap({ x: 0, y: 0, w: 50, h: 50 }, { x: 49, y: 49, w: 20, h: 20 }),
  "Overlapping custom tiles should be detected"
);
assert.ok(
  !liveCustomLayoutSandbox.customTilesOverlap({ x: 0, y: 0, w: 50, h: 50 }, { x: 50, y: 0, w: 20, h: 20 }),
  "Edge-adjacent custom tiles should not count as overlapping"
);
assert.ok(
  liveCustomLayoutSandbox.customTileCollides({ x: 10, y: 10, w: 20, h: 20 }, [{ x: 25, y: 25, w: 20, h: 20 }]),
  "Collision check should flag any overlap against the other tiles"
);
assert.deepEqual(
  liveCustomLayoutSandbox.applyCustomDrag({ x: 10, y: 10, w: 30, h: 30 }, "move", 5, -3),
  { x: 15, y: 7, w: 30, h: 30 },
  "Move drags should shift the tile origin only"
);
assert.deepEqual(
  liveCustomLayoutSandbox.applyCustomDrag({ x: 10, y: 10, w: 30, h: 30 }, "nw", -2, 4),
  { x: 8, y: 14, w: 32, h: 26 },
  "North-west resize drags should move the origin and counter-adjust the size"
);
assert.deepEqual(
  liveCustomLayoutSandbox.snapCustomTileGeometry({ x: 51.2, y: 10, w: 20, h: 20 }, [{ x: 30, y: 0, w: 20, h: 40 }], 1.5, "move"),
  { x: 50, y: 10, w: 20, h: 20 },
  "Moving custom tiles should snap to neighbor edges within the threshold"
);
assert.deepEqual(
  liveCustomLayoutSandbox.snapCustomTileGeometry({ x: 10, y: 10, w: 39, h: 20 }, [{ x: 50, y: 0, w: 20, h: 40 }], 1.5, "e"),
  { x: 10, y: 10, w: 40, h: 20 },
  "Resizing a custom tile's right edge should snap to a neighbor's left edge"
);
assert.deepEqual(
  liveCustomLayoutSandbox.snapCustomTileGeometry({ x: 10, y: 10, w: 20, h: 20 }, [], 1.5, "move"),
  { x: 10, y: 10, w: 20, h: 20 },
  "Tiles away from any edge should not snap"
);
assert.equal(liveCustomLayoutSandbox.customPaneIdForSource({ type: "onboard", code: "NOR" }), "DRIVER-NOR", "Onboard tiles should reuse the existing driver pane id scheme");
assert.equal(liveCustomLayoutSandbox.customPaneIdForSource({ type: "channel", feedId: "PIT" }), "CHANNEL-PIT", "Channel tiles should get a channel pane id");
assert.equal(liveCustomLayoutSandbox.customPaneIdForSource({ type: "timing" }), "TIMING", "Timing tiles should get the timing pane id");
assert.equal(liveCustomLayoutSandbox.customTileSourceKey({ type: "channel", feedId: "PIT" }), "channel:PIT", "Source keys should be stable per source");
assert.equal(liveCustomLayoutSandbox.customLayoutIdFromPreset(liveCustomLayoutSandbox.customLayoutPresetId("cl-9")), "cl-9", "Custom preset ids should round-trip the layout id");
assert.equal(liveCustomLayoutSandbox.customLayoutIdFromPreset("Intelligent"), "", "Built-in presets should not parse as custom layout ids");
const normalizedCustom = liveCustomLayoutSandbox.normalizeCustomLayouts({
  layouts: [
    { id: "cl-1", name: "  Race day  ", tiles: [
      { id: "t-1", source: { type: "channel", feedId: "WORLD" }, x: 0, y: 0, w: 60, h: 100 },
      { id: "t-2", source: { type: "onboard", code: "VER" }, x: 60, y: 0, w: 50, h: 40 },
      { id: "t-dupe", source: { type: "onboard", code: "VER" }, x: 0, y: 0, w: 20, h: 20 },
      { id: "t-bad", source: { type: "mystery" }, x: 0, y: 0, w: 20, h: 20 },
    ] },
    { id: "cl-1", name: "Duplicate id", tiles: [] },
    { not: "a layout" },
  ],
});
assert.equal(normalizedCustom.layouts.length, 1, "Custom layout normalization should drop duplicate ids and malformed layouts");
assert.equal(normalizedCustom.layouts[0].name, "Race day", "Custom layout names should be trimmed");
assert.deepEqual(normalizedCustom.layouts[0].tiles.map((tile) => tile.id), ["t-1", "t-2"], "Custom layout tiles should drop duplicate sources and unknown source types");
assert.deepEqual(normalizedCustom.layouts[0].tiles[1], { id: "t-2", source: { type: "onboard", code: "VER" }, x: 50, y: 0, w: 50, h: 40 }, "Custom tile geometry should clamp into the canvas");
assert.equal(liveCustomLayoutSandbox.nextCustomLayoutName([]), "Custom layout 1", "First custom layout should get the first default name");
assert.equal(liveCustomLayoutSandbox.nextCustomLayoutName([{ name: "Custom layout 1" }, { name: "Custom layout 3" }]), "Custom layout 4", "Default custom layout names should skip taken names");
assert.deepEqual(
  liveCustomLayoutSandbox.defaultCustomTileRect([]),
  { x: 0, y: 0, w: 32, h: 32 },
  "First custom tile should land in the top-left corner"
);
assert.deepEqual(
  liveCustomLayoutSandbox.defaultCustomTileRect([{ x: 0, y: 0, w: 100, h: 32 }]),
  { x: 0, y: 32, w: 32, h: 32 },
  "New custom tiles should take the first free spot below occupied rows"
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run smoke`
Expected: FAIL — `extractNamedFunction` throws (or assertion error) because `customLayoutPresetId` etc. don't exist yet.

- [ ] **Step 3: Implement the helpers**

In `ui_kits/pitwall/LiveRacing.jsx`, immediately after the `readLivePanelSizes` function (module scope), add:

```js
  const CUSTOM_LAYOUT_STORAGE_KEY = "pw-live-custom-layouts";
  const CUSTOM_TILE_MIN_PCT = 12;
  const CUSTOM_PRESET_PREFIX = "custom:";
  function customLayoutPresetId(layoutId) {
    return CUSTOM_PRESET_PREFIX + layoutId;
  }
  function customLayoutIdFromPreset(preset) {
    return typeof preset === "string" && preset.startsWith(CUSTOM_PRESET_PREFIX) ? preset.slice(CUSTOM_PRESET_PREFIX.length) : "";
  }
  function clampCustomTileGeometry(rect = {}) {
    const numeric = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const round = (value) => Math.round(value * 10) / 10;
    const w = round(Math.min(100, Math.max(CUSTOM_TILE_MIN_PCT, numeric(rect.w, 32))));
    const h = round(Math.min(100, Math.max(CUSTOM_TILE_MIN_PCT, numeric(rect.h, 32))));
    const x = round(Math.min(100 - w, Math.max(0, numeric(rect.x, 0))));
    const y = round(Math.min(100 - h, Math.max(0, numeric(rect.y, 0))));
    return { x, y, w, h };
  }
  function customTilesOverlap(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }
  function customTileCollides(rect, otherTiles = []) {
    return otherTiles.some((tile) => customTilesOverlap(rect, tile));
  }
  function applyCustomDrag(start, mode, dx, dy) {
    if (mode === "move") return { ...start, x: start.x + dx, y: start.y + dy };
    const rect = { ...start };
    if (mode.includes("e")) rect.w = start.w + dx;
    if (mode.includes("s")) rect.h = start.h + dy;
    if (mode.includes("w")) { rect.x = start.x + dx; rect.w = start.w - dx; }
    if (mode.includes("n")) { rect.y = start.y + dy; rect.h = start.h - dy; }
    return rect;
  }
  function snapCustomEdge(value, edges, threshold) {
    let best = null;
    edges.forEach((edge) => {
      const distance = Math.abs(edge - value);
      if (distance <= threshold && (best == null || distance < Math.abs(best - value))) best = edge;
    });
    return best;
  }
  function snapCustomTileGeometry(rect, otherTiles = [], threshold = 1.5, mode = "move") {
    const xEdges = [0, 100];
    const yEdges = [0, 100];
    otherTiles.forEach((tile) => {
      xEdges.push(tile.x, tile.x + tile.w);
      yEdges.push(tile.y, tile.y + tile.h);
    });
    const snapped = { ...rect };
    if (mode === "move") {
      const left = snapCustomEdge(rect.x, xEdges, threshold);
      const right = snapCustomEdge(rect.x + rect.w, xEdges, threshold);
      if (left != null) snapped.x = left;
      else if (right != null) snapped.x = right - rect.w;
      const top = snapCustomEdge(rect.y, yEdges, threshold);
      const bottom = snapCustomEdge(rect.y + rect.h, yEdges, threshold);
      if (top != null) snapped.y = top;
      else if (bottom != null) snapped.y = bottom - rect.h;
      return snapped;
    }
    if (mode.includes("e")) {
      const right = snapCustomEdge(rect.x + rect.w, xEdges, threshold);
      if (right != null) snapped.w = right - rect.x;
    }
    if (mode.includes("s")) {
      const bottom = snapCustomEdge(rect.y + rect.h, yEdges, threshold);
      if (bottom != null) snapped.h = bottom - rect.y;
    }
    if (mode.includes("w")) {
      const left = snapCustomEdge(rect.x, xEdges, threshold);
      if (left != null) { snapped.w = rect.w + (rect.x - left); snapped.x = left; }
    }
    if (mode.includes("n")) {
      const top = snapCustomEdge(rect.y, yEdges, threshold);
      if (top != null) { snapped.h = rect.h + (rect.y - top); snapped.y = top; }
    }
    return snapped;
  }
  function normalizeCustomTileSource(raw = {}) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.type === "timing") return { type: "timing" };
    if (raw.type === "onboard" && typeof raw.code === "string" && raw.code) return { type: "onboard", code: raw.code };
    if (raw.type === "channel" && typeof raw.feedId === "string" && raw.feedId) return { type: "channel", feedId: raw.feedId };
    return null;
  }
  function customTileSourceKey(source) {
    if (!source) return "";
    if (source.type === "timing") return "timing";
    if (source.type === "onboard") return "onboard:" + source.code;
    if (source.type === "channel") return "channel:" + source.feedId;
    return "";
  }
  function customPaneIdForSource(source) {
    if (!source) return "";
    if (source.type === "timing") return "TIMING";
    if (source.type === "onboard") return "DRIVER-" + source.code;
    if (source.type === "channel") return "CHANNEL-" + source.feedId;
    return "";
  }
  function normalizeCustomLayouts(raw) {
    const rawLayouts = Array.isArray(raw?.layouts) ? raw.layouts : [];
    const seenIds = new Set();
    const layouts = rawLayouts
      .filter((layout) => layout && typeof layout === "object" && typeof layout.id === "string" && layout.id)
      .filter((layout) => (seenIds.has(layout.id) ? false : (seenIds.add(layout.id), true)))
      .map((layout) => {
        const seenSources = new Set();
        const tiles = (Array.isArray(layout.tiles) ? layout.tiles : [])
          .map((tile) => {
            const source = normalizeCustomTileSource(tile?.source);
            if (!source) return null;
            const sourceKey = customTileSourceKey(source);
            if (seenSources.has(sourceKey)) return null;
            seenSources.add(sourceKey);
            const id = typeof tile.id === "string" && tile.id ? tile.id : "t-" + sourceKey;
            return { id, source, ...clampCustomTileGeometry(tile) };
          })
          .filter(Boolean);
        const name = typeof layout.name === "string" && layout.name.trim() ? layout.name.trim() : "Custom layout";
        return { id: layout.id, name, tiles };
      });
    return { layouts };
  }
  function nextCustomLayoutName(layouts = []) {
    const names = new Set(layouts.map((layout) => layout.name));
    let index = layouts.length + 1;
    let candidate = `Custom layout ${index}`;
    while (names.has(candidate)) { index += 1; candidate = `Custom layout ${index}`; }
    return candidate;
  }
  function defaultCustomTileRect(existingTiles = []) {
    const w = 32;
    const h = 32;
    for (let y = 0; y + h <= 100; y += 4) {
      for (let x = 0; x + w <= 100; x += 4) {
        const rect = clampCustomTileGeometry({ x, y, w, h });
        if (!customTileCollides(rect, existingTiles)) return rect;
      }
    }
    return null;
  }
  function readCustomLayouts() {
    try {
      return normalizeCustomLayouts(JSON.parse(localStorage.getItem(CUSTOM_LAYOUT_STORAGE_KEY) || "{}"));
    } catch {
      return { layouts: [] };
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run smoke`
Expected: PASS (exit 0).

- [ ] **Step 5: Commit**

```bash
git add scripts/pitwall-smoke-test.cjs ui_kits/pitwall/LiveRacing.jsx
git commit -m "feat: add custom layout geometry and model helpers for Live Racing"
```

---

### Task 2: Custom layout state, persistence, preset plumbing

**Files:**
- Test: `scripts/pitwall-smoke-test.cjs` (same area as Task 1 assertions)
- Modify: `ui_kits/pitwall/LiveRacing.jsx` — state block (`rg -n 'useState\(readLivePanelSizes\)'`), persistence effects (`rg -n 'PANEL_SIZE_STORAGE_KEY, serialized'`), restore effect (`rg -n 'pw-live-layout'`), layout computation (`rg -n 'const layout = LAYOUTS\[preset\]'`), handlers (`rg -n 'function adjustSidecarCount'`)

- [ ] **Step 1: Write the failing source assertions**

Add to `scripts/pitwall-smoke-test.cjs` after the Task 1 block:

```js
assert.match(source["LiveRacing.jsx"], /useState\(readCustomLayouts\)/, "Live Racing should initialize custom layouts from storage");
assert.match(source["LiveRacing.jsx"], /localStorage\.setItem\(CUSTOM_LAYOUT_STORAGE_KEY/, "Custom layouts should persist to localStorage on change");
assert.match(source["LiveRacing.jsx"], /liveCustomLayouts: normalized/, "Custom layouts should mirror to the pitwall profile like panel sizes");
assert.match(source["LiveRacing.jsx"], /localStorage\.setItem\("pw-live-layout"/, "The active preset should persist so custom layouts restore on reopen");
assert.match(source["LiveRacing.jsx"], /const layout = activeCustomLayout \? "custom" : LAYOUTS\[preset\]/, "An active custom layout should switch the layout type to custom");
assert.match(source["LiveRacing.jsx"], /function createCustomLayout/, "Live Racing should support creating custom layouts");
assert.match(source["LiveRacing.jsx"], /function deleteCustomLayout/, "Live Racing should support deleting custom layouts");
assert.match(source["LiveRacing.jsx"], /function duplicateCustomLayout/, "Live Racing should support duplicating custom layouts");
assert.match(source["LiveRacing.jsx"], /customLayoutIdFromPreset\(saved\.preset/, "Restoring should accept a saved custom layout preset");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run smoke`
Expected: FAIL on the first new `assert.match`.

- [ ] **Step 3: Add state**

After `const [panelSizes, setPanelSizes] = React.useState(readLivePanelSizes);` add:

```js
    const [customLayouts, setCustomLayouts] = React.useState(readCustomLayouts);
    const [customPickerOpen, setCustomPickerOpen] = React.useState(false);
    const [customDraftRects, setCustomDraftRects] = React.useState({});
```

Next to `const profilePanelSizesKeyRef = React.useRef("");` add:

```js
    const customLayoutsTouchedRef = React.useRef(false);
    const profileCustomLayoutsKeyRef = React.useRef("");
    const customCanvasRef = React.useRef(null);
```

- [ ] **Step 4: Add persistence effects**

After the existing `panelSizes` localStorage/profile effect (`localStorage.setItem(PANEL_SIZE_STORAGE_KEY, serialized)` block, ends `}, [panelSizes, profile]);`), add:

```js
    React.useEffect(() => {
      const normalized = normalizeCustomLayouts(customLayouts);
      const serialized = JSON.stringify(normalized);
      localStorage.setItem(CUSTOM_LAYOUT_STORAGE_KEY, serialized);
      if (!customLayoutsTouchedRef.current || !window.pitwall?.profile?.set || serialized === profileCustomLayoutsKeyRef.current) return;
      profileCustomLayoutsKeyRef.current = serialized;
      window.pitwall.profile.set({ ...profile, liveCustomLayouts: normalized }).catch(() => {});
    }, [customLayouts, profile]);
    React.useEffect(() => {
      if (customLayoutsTouchedRef.current) return;
      if (!profile.liveCustomLayouts) return;
      const normalized = normalizeCustomLayouts(profile.liveCustomLayouts);
      const serialized = JSON.stringify(normalized);
      if (serialized === profileCustomLayoutsKeyRef.current) return;
      profileCustomLayoutsKeyRef.current = serialized;
      setCustomLayouts((current) => JSON.stringify(normalizeCustomLayouts(current)) === serialized ? current : normalized);
    }, [profile.liveCustomLayouts]);
    React.useEffect(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("pw-live-layout") || "{}");
        localStorage.setItem("pw-live-layout", JSON.stringify({ ...saved, preset }));
      } catch {
        localStorage.setItem("pw-live-layout", JSON.stringify({ preset }));
      }
    }, [preset]);
```

- [ ] **Step 5: Switch layout computation and restore effect**

Replace `const layout = LAYOUTS[preset];` with:

```js
    const activeCustomLayout = customLayouts.layouts.find((entry) => entry.id === customLayoutIdFromPreset(preset)) || null;
    const layout = activeCustomLayout ? "custom" : LAYOUTS[preset];
```

In the mount restore effect, replace:

```js
        if (savedPreset && LAYOUTS[savedPreset]) setPreset(savedPreset);
```

with:

```js
        const savedCustomId = customLayoutIdFromPreset(saved.preset || "");
        if (savedCustomId && readCustomLayouts().layouts.some((entry) => entry.id === savedCustomId)) setPreset(saved.preset);
        else if (savedPreset && LAYOUTS[savedPreset]) setPreset(savedPreset);
```

- [ ] **Step 6: Add CRUD handlers**

After `function adjustSidecarCount` (inside the `LiveRacing` component), add:

```js
    function createCustomLayout() {
      const id = "cl-" + Math.random().toString(36).slice(2, 10);
      customLayoutsTouchedRef.current = true;
      setCustomLayouts((current) => ({ layouts: [...current.layouts, { id, name: nextCustomLayoutName(current.layouts), tiles: [] }] }));
      setPreset(customLayoutPresetId(id));
    }
    function updateCustomLayout(layoutId, transform) {
      customLayoutsTouchedRef.current = true;
      setCustomLayouts((current) => ({ layouts: current.layouts.map((entry) => entry.id === layoutId ? transform(entry) : entry) }));
    }
    function updateCustomTileRect(layoutId, tileId, rect) {
      updateCustomLayout(layoutId, (entry) => ({ ...entry, tiles: entry.tiles.map((tile) => tile.id === tileId ? { ...tile, ...clampCustomTileGeometry({ ...tile, ...rect }) } : tile) }));
    }
    function updateCustomTileSource(layoutId, tileId, source) {
      const normalized = normalizeCustomTileSource(source);
      if (!normalized) return;
      updateCustomLayout(layoutId, (entry) => ({ ...entry, tiles: entry.tiles.map((tile) => tile.id === tileId ? { ...tile, source: normalized } : tile) }));
    }
    function addCustomTile(layoutId, source) {
      const normalized = normalizeCustomTileSource(source);
      if (!normalized) return;
      updateCustomLayout(layoutId, (entry) => {
        if (entry.tiles.some((tile) => customTileSourceKey(tile.source) === customTileSourceKey(normalized))) return entry;
        const rect = defaultCustomTileRect(entry.tiles);
        if (!rect) return entry;
        return { ...entry, tiles: [...entry.tiles, { id: "t-" + Math.random().toString(36).slice(2, 10), source: normalized, ...rect }] };
      });
    }
    function removeCustomTile(layoutId, tileId) {
      updateCustomLayout(layoutId, (entry) => ({ ...entry, tiles: entry.tiles.filter((tile) => tile.id !== tileId) }));
    }
    function renameCustomLayout(layoutId, name) {
      updateCustomLayout(layoutId, (entry) => ({ ...entry, name: String(name || "") }));
    }
    function duplicateCustomLayout(layoutId) {
      const sourceLayout = customLayouts.layouts.find((entry) => entry.id === layoutId);
      if (!sourceLayout) return;
      const id = "cl-" + Math.random().toString(36).slice(2, 10);
      customLayoutsTouchedRef.current = true;
      setCustomLayouts((current) => ({ layouts: [...current.layouts, { ...sourceLayout, id, name: sourceLayout.name.trim() + " copy" }] }));
      setPreset(customLayoutPresetId(id));
    }
    function deleteCustomLayout(layoutId) {
      customLayoutsTouchedRef.current = true;
      setCustomLayouts((current) => ({ layouts: current.layouts.filter((entry) => entry.id !== layoutId) }));
      if (customLayoutIdFromPreset(preset) === layoutId) setPreset("Intelligent");
    }
```

Note: `renameCustomLayout` stores the raw string while typing (the name input is controlled); `normalizeCustomLayouts` trims on load so a blank name falls back to "Custom layout".

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run smoke`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add scripts/pitwall-smoke-test.cjs ui_kits/pitwall/LiveRacing.jsx
git commit -m "feat: add custom layout state, persistence, and preset plumbing"
```

---

### Task 3: Preset dropdown — "My layouts" group

**Files:**
- Test: `scripts/pitwall-smoke-test.cjs`
- Modify: `ui_kits/pitwall/LiveRacing.jsx` (`rg -n 'preset-select" aria-label'`)

- [ ] **Step 1: Write the failing assertions**

```js
assert.match(source["LiveRacing.jsx"], /<optgroup label="My layouts">/, "Layout preset dropdown should group saved custom layouts");
assert.match(source["LiveRacing.jsx"], /__new-custom-layout__/, "Layout preset dropdown should offer creating a new custom layout");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run smoke` → FAIL.

- [ ] **Step 3: Implement**

Replace the preset `<select>` (currently at `ui_kits/pitwall/LiveRacing.jsx:4059-4061`):

```jsx
              <select className="preset-select" aria-label="Layout preset" value={preset}
                onChange={(e) => {
                  if (e.target.value === "__new-custom-layout__") createCustomLayout();
                  else setPreset(e.target.value);
                  setExpandedPane(null);
                }}>
                {presetOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                <optgroup label="My layouts">
                  {customLayouts.layouts.map((entry) => <option key={entry.id} value={customLayoutPresetId(entry.id)}>{entry.name.trim() || "Custom layout"}</option>)}
                  <option value="__new-custom-layout__">New custom layout…</option>
                </optgroup>
              </select>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run smoke` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/pitwall-smoke-test.cjs ui_kits/pitwall/LiveRacing.jsx
git commit -m "feat: list saved custom layouts in the Live Racing preset dropdown"
```

---

### Task 4: Custom canvas CSS

**Files:**
- Test: `scripts/pitwall-smoke-test.cjs` (near the existing live CSS assertions, `rg -n 'live__traffic' scripts/pitwall-smoke-test.cjs`)
- Modify: `ui_kits/pitwall/LiveRacing.jsx` CSS string — add the body rule next to the other `.live__body[data-layout=...]` rules (~`:75-79`), and the component classes after the `.live__grid[data-layout="data"]` rule (~`:151`)

- [ ] **Step 1: Write the failing assertions**

```js
assert.match(source["LiveRacing.jsx"], /\.live__body\[data-layout="custom"\] \{ grid-template-columns: minmax\(0, 1fr\); \}/, "Custom layout should give the canvas the full live body width");
assert.match(source["LiveRacing.jsx"], /\.custom-canvas \{[^}]*position: relative;[^}]*background: #000/, "Custom canvas should be a relative black stage for free tile placement");
assert.match(source["LiveRacing.jsx"], /\.custom-tile \{[^}]*position: absolute/, "Custom tiles should be absolutely positioned");
assert.match(source["LiveRacing.jsx"], /\.custom-tile__handle--se \{[^}]*cursor: nwse-resize/, "Custom tiles should expose corner resize handles");
assert.match(source["LiveRacing.jsx"], /\.custom-picker \{[^}]*z-index/, "Custom feed picker should overlay the canvas");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run smoke` → FAIL.

- [ ] **Step 3: Implement the CSS**

Next to the other `.live__body[data-layout=...]` rules add:

```css
    .live__body[data-layout="custom"] { grid-template-columns: minmax(0, 1fr); }
    .live__body[data-layout="custom"] .live__center { grid-column: 1; grid-row: 1; }
```

After the `.live__grid[data-layout="data"]` rule add:

```css
    .live__grid[data-layout="custom"] { display: flex; flex-direction: column; }
    .custom-toolbar { display: flex; align-items: center; gap: var(--space-3); padding: 4px 8px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-base); }
    .custom-toolbar__name { width: 200px; height: 26px; padding: 0 var(--space-3); border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-default); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 600; outline: 0; }
    .custom-toolbar__name:focus { border-color: var(--accent-border); }
    .custom-toolbar__spacer { flex: 1; }
    .custom-canvas { position: relative; flex: 1; min-width: 0; min-height: 0; background: #000; overflow: hidden; }
    .custom-canvas__empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-4); color: var(--text-tertiary); }
    .custom-tile { position: absolute; display: flex; flex-direction: column; min-width: 0; min-height: 0; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-base); overflow: hidden; }
    .custom-tile[data-dragging="true"] { border-color: var(--accent-border); z-index: 4; }
    .custom-tile__head { display: flex; align-items: center; justify-content: space-between; gap: 6px; height: 24px; padding: 0 6px; font-size: var(--text-2xs); color: var(--text-secondary); background: var(--bg-sunken); cursor: grab; user-select: none; }
    .custom-tile__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .custom-tile__body { position: relative; flex: 1; min-width: 0; min-height: 0; }
    .custom-tile__body .pane { position: absolute; inset: 0; }
    .custom-tile__body .live__timing--tile { position: absolute; inset: 0; border-right: 0; border-left: 0; }
    .custom-tile__handle { position: absolute; z-index: 5; }
    .custom-tile__handle--n { top: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
    .custom-tile__handle--s { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
    .custom-tile__handle--e { right: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
    .custom-tile__handle--w { left: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
    .custom-tile__handle--ne { top: -3px; right: -3px; width: 10px; height: 10px; cursor: nesw-resize; }
    .custom-tile__handle--sw { bottom: -3px; left: -3px; width: 10px; height: 10px; cursor: nesw-resize; }
    .custom-tile__handle--nw { top: -3px; left: -3px; width: 10px; height: 10px; cursor: nwse-resize; }
    .custom-tile__handle--se { bottom: -3px; right: -3px; width: 10px; height: 10px; cursor: nwse-resize; }
    .custom-picker { position: absolute; top: 40px; left: 12px; z-index: 30; width: 280px; max-height: 70%; display: flex; flex-direction: column; border-radius: var(--radius-md); border: 1px solid var(--border-default); background: var(--surface-overlay); box-shadow: var(--shadow-lg); overflow: hidden; }
    .custom-picker__head { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid var(--border-subtle); font-weight: 600; font-size: var(--text-sm); }
    .custom-picker__groups { overflow-y: auto; padding: 6px; }
    .custom-picker__grouptitle { padding: 6px 4px 2px; font-size: var(--text-2xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-tertiary); }
    .custom-picker__item { display: block; width: 100%; text-align: left; padding: 6px 8px; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); cursor: pointer; }
    .custom-picker__item:hover { background: var(--surface-hover); }
    .custom-picker__item:disabled { color: var(--text-tertiary); cursor: default; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run smoke` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/pitwall-smoke-test.cjs ui_kits/pitwall/LiveRacing.jsx
git commit -m "feat: add custom layout canvas, tile, and picker styles"
```

---

### Task 5: Panes from tiles + stream plumbing

**Files:**
- Test: `scripts/pitwall-smoke-test.cjs`
- Modify: `ui_kits/pitwall/LiveRacing.jsx` — `const panes =` branch (`rg -n 'const panes = layout === "battle"'`), paneId mapping (`rg -n 'paneId: pane.broadcast'`), `renderLivePane` (`rg -n 'function renderLivePane'`), `OnboardPane` driver select (`rg -n 'pane__driverselect' | head -1`)

- [ ] **Step 1: Write the failing assertions**

```js
assert.match(source["LiveRacing.jsx"], /function customTilePane/, "Custom layout tiles should convert to live panes");
assert.match(source["LiveRacing.jsx"], /paneId: pane\.paneId \|\| \(pane\.broadcast \? "WORLD" : `DRIVER-\$\{pane\.code\}`\)/, "Pane id mapping should respect precomputed custom pane ids");
assert.match(source["LiveRacing.jsx"], /layout === "custom"\s*\? \(activeCustomLayout\?\.tiles \|\| \[\]\)\.map\(customTilePane\)\.filter\(Boolean\)/, "Custom layout should build panes from its tiles");
assert.match(source["LiveRacing.jsx"], /driverOptions=\{p\.channel \? \[\] : D\.drivers\}/, "Channel panes should not offer a driver switcher");
assert.match(source["LiveRacing.jsx"], /\{driverOptions\.length > 0 && \(/, "Onboard pane should hide the driver select when no options exist");
assert.match(source["LiveRacing.jsx"], /updateCustomTileSource\(activeCustomLayout\.id, p\.tileId, \{ type: "onboard", code \}\)/, "Changing the driver on a custom onboard tile should update the saved layout");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run smoke` → FAIL.

- [ ] **Step 3: Add `customTilePane` and the panes branch**

Inside the `LiveRacing` component, just above `const panes = layout === "battle"`, add:

```js
    function customTilePane(tile) {
      if (tile.source.type === "timing") return null;
      if (tile.source.type === "onboard") {
        return { feed: "Onboard", code: tile.source.code, slot: "custom-" + tile.id, telemetry: true, custom: true, tileId: tile.id, paneId: customPaneIdForSource(tile.source) };
      }
      const feeds = resolvedF1TvContent?.feeds || [];
      const feed = feeds.find((entry) => entry.feedId === tile.source.feedId) || null;
      if (feed && feed === preferredMainF1TvFeed(feeds)) {
        return { broadcast: true, focus: true, custom: true, tileId: tile.id, paneId: "WORLD" };
      }
      return { feed: feed?.label || tile.source.feedId, code: tile.source.feedId, slot: "custom-" + tile.id, custom: true, channel: true, tileId: tile.id, paneId: customPaneIdForSource(tile.source) };
    }
```

Change the head of the `panes` expression from:

```js
    const panes = layout === "battle"
```

to:

```js
    const panes = layout === "custom"
      ? (activeCustomLayout?.tiles || []).map(customTilePane).filter(Boolean)
      : layout === "battle"
```

- [ ] **Step 4: Respect precomputed pane ids**

Change (at the `activePanes` mapping):

```js
      .map((pane) => ({ ...pane, paneId: pane.broadcast ? "WORLD" : `DRIVER-${pane.code}` }))
```

to:

```js
      .map((pane) => ({ ...pane, paneId: pane.paneId || (pane.broadcast ? "WORLD" : `DRIVER-${pane.code}`) }))
```

- [ ] **Step 5: Tweak `renderLivePane` for channel/custom panes**

In `renderLivePane`, change `driverOptions={D.drivers}` to `driverOptions={p.channel ? [] : D.drivers}`, and change the `onDriverChange` line to:

```js
          onDriverChange={(code) => {
            if (p.custom && activeCustomLayout) updateCustomTileSource(activeCustomLayout.id, p.tileId, { type: "onboard", code });
            else if (p.slot) setOnboardOverrides((current) => ({ ...current, [p.slot]: code }));
          }}
```

Also change the `label` line so channel panes get their channel label:

```js
      const label = p.broadcast ? "F1 Live" : p.channel ? (p.feed || p.code) : (D.byCode[p.code]?.name || p.code || "Driver") + " onboard";
```

- [ ] **Step 6: Hide the driver select in `OnboardPane` when there are no options**

In `OnboardPane` (search `pane__driverselect`), wrap the `<select>`:

```jsx
          {driverOptions.length > 0 && (
            <select className="pane__driverselect" value={code || ""} aria-label="Switch onboard driver"
              onChange={(event) => onDriverChange?.(event.target.value)}>
              {driverOptions.map((driver) => <option key={driver.code} value={driver.code}>{driver.code} · {driver.name}</option>)}
            </select>
          )}
```

(Keep the original select markup exactly; only add the wrapper condition.)

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run smoke` → PASS.

- [ ] **Step 8: Commit**

```bash
git add scripts/pitwall-smoke-test.cjs ui_kits/pitwall/LiveRacing.jsx
git commit -m "feat: build live panes from custom layout tiles with channel stream support"
```

---

### Task 6: Timing tower extraction + sidebar hiding in custom mode

**Files:**
- Test: `scripts/pitwall-smoke-test.cjs`
- Modify: `ui_kits/pitwall/LiveRacing.jsx` — body render (`rg -n '<aside className="live__timing">'`)

- [ ] **Step 1: Write the failing assertions**

```js
assert.match(source["LiveRacing.jsx"], /function renderTimingTower/, "Timing tower content should be extracted for reuse by the custom layout timing tile");
assert.match(source["LiveRacing.jsx"], /\{layout !== "custom" && \(\s*<>\s*<aside className="live__timing">/, "The docked timing sidebar should hide in custom layout mode");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run smoke` → FAIL.

- [ ] **Step 3: Extract `renderTimingTower`**

The `<aside className="live__timing">…</aside>` block contains the timing header, `TimingColumnMenu`, scroll area, and weather strip. Move **everything between** `<aside className="live__timing">` and `</aside>` into a new render function placed next to `renderLivePane`:

```jsx
    function renderTimingTower() {
      return (
        <>
          {/* …the exact JSX previously inside the <aside>, unchanged… */}
        </>
      );
    }
```

(The moved JSX is ~45 lines starting with `<div className={"live__timinghd" + …}>` and ending with the `live__weather` div. Do not edit it — cut and paste verbatim inside the fragment.)

Then replace the body block:

```jsx
          {/* Live timing sidebar */}
          {layout !== "custom" && (
            <>
              <aside className="live__timing">
                {renderTimingTower()}
              </aside>
              <ResizeHandle kind="timing" label="Resize live timing" />
            </>
          )}
```

(The existing `<ResizeHandle kind="timing" …/>` directly after the aside moves inside this conditional.)

- [ ] **Step 4: Run smoke + verify the app still renders the docked sidebar**

Run: `npm run smoke` → PASS.
Run: `npm run build` → exits 0 (catches JSX syntax errors via the renderer build).

- [ ] **Step 5: Commit**

```bash
git add scripts/pitwall-smoke-test.cjs ui_kits/pitwall/LiveRacing.jsx
git commit -m "refactor: extract timing tower render for reuse and hide docked sidebar in custom mode"
```

---

### Task 7: Custom canvas UI — toolbar, tiles, drag/resize, feed picker

**Files:**
- Test: `scripts/pitwall-smoke-test.cjs`
- Modify: `ui_kits/pitwall/LiveRacing.jsx` — grid render (`rg -n 'gridPanes.map\(renderLivePane\)'` and the insights strip right below)

- [ ] **Step 1: Write the failing assertions**

```js
assert.match(source["LiveRacing.jsx"], /className="custom-canvas" ref=\{customCanvasRef\}/, "Custom mode should render the free placement canvas");
assert.match(source["LiveRacing.jsx"], /custom-canvas__empty/, "Custom canvas should show a blank-state add-feed prompt");
assert.match(source["LiveRacing.jsx"], /function beginCustomTileDrag/, "Custom tiles should support pointer drag and resize");
assert.match(source["LiveRacing.jsx"], /snapCustomTileGeometry\(proposed, others, threshold, mode\)/, "Custom tile drags should snap against neighbor edges");
assert.match(source["LiveRacing.jsx"], /if \(!customTileCollides\(next, others\)\) lastValid = next/, "Custom tile drags should reject geometry that overlaps another tile");
assert.match(source["LiveRacing.jsx"], /function renderCustomFeedPicker/, "Custom mode should offer a grouped feed picker");
assert.match(source["LiveRacing.jsx"], /\{ group: "Channels"/, "Feed picker should group F1 TV channels");
assert.match(source["LiveRacing.jsx"], /\{ group: "Onboards"/, "Feed picker should group driver onboards");
assert.match(source["LiveRacing.jsx"], /\{ group: "App panels"/, "Feed picker should offer app panels like the timing tower");
assert.match(source["LiveRacing.jsx"], /\{layout !== "focus" && layout !== "custom" && renderInsightsPane\(\)\}/, "Custom layout should not render the insights strip");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run smoke` → FAIL.

- [ ] **Step 3: Add drag handler, tile renderer, and picker (inside `LiveRacing`, next to `renderLivePane`)**

```jsx
    function beginCustomTileDrag(event, tile, mode) {
      if (!activeCustomLayout) return;
      event.preventDefault();
      event.stopPropagation();
      const canvas = customCanvasRef.current;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      if (!canvasRect.width || !canvasRect.height) return;
      const origin = { x: event.clientX, y: event.clientY };
      const start = { x: tile.x, y: tile.y, w: tile.w, h: tile.h };
      const others = activeCustomLayout.tiles.filter((entry) => entry.id !== tile.id);
      let lastValid = start;
      function onPointerMove(moveEvent) {
        const dx = ((moveEvent.clientX - origin.x) / canvasRect.width) * 100;
        const dy = ((moveEvent.clientY - origin.y) / canvasRect.height) * 100;
        const proposed = applyCustomDrag(start, mode, dx, dy);
        const threshold = (8 / canvasRect.width) * 100;
        const snapped = snapCustomTileGeometry(proposed, others, threshold, mode);
        const next = clampCustomTileGeometry(snapped);
        if (!customTileCollides(next, others)) lastValid = next;
        setCustomDraftRects({ [tile.id]: lastValid });
      }
      function onPointerUp() {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        setCustomDraftRects({});
        updateCustomTileRect(activeCustomLayout.id, tile.id, lastValid);
      }
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }
    function customTileLabel(tile) {
      if (tile.source.type === "timing") return "Live timing";
      if (tile.source.type === "onboard") return (D.byCode[tile.source.code]?.name || tile.source.code) + " onboard";
      const feed = (resolvedF1TvContent?.feeds || []).find((entry) => entry.feedId === tile.source.feedId);
      return feed?.label || tile.source.feedId;
    }
    function renderCustomTile(tile) {
      const isTiming = tile.source.type === "timing";
      const draft = customDraftRects[tile.id];
      const rect = draft || tile;
      const pane = isTiming ? null : activePaneMap.get(customPaneIdForSource(tile.source));
      return (
        <div key={tile.id} className="custom-tile" data-dragging={draft ? "true" : undefined}
          style={{ left: rect.x + "%", top: rect.y + "%", width: rect.w + "%", height: rect.h + "%" }}>
          <div className="custom-tile__head" onPointerDown={(event) => beginCustomTileDrag(event, tile, "move")}>
            <span className="custom-tile__label">{customTileLabel(tile)}</span>
            <IconButton variant="ghost" size="sm" label="Remove tile" onClick={() => removeCustomTile(activeCustomLayout.id, tile.id)}><Icon name="close" size={12} /></IconButton>
          </div>
          <div className="custom-tile__body">
            {isTiming ? <div className="live__timing live__timing--tile">{renderTimingTower()}</div> : (pane ? renderLivePane({ ...pane, style: { position: "absolute", inset: 0 } }) : null)}
          </div>
          {["n", "s", "e", "w", "ne", "nw", "se", "sw"].map((dir) => (
            <span key={dir} className={"custom-tile__handle custom-tile__handle--" + dir} onPointerDown={(event) => beginCustomTileDrag(event, tile, dir)} />
          ))}
        </div>
      );
    }
    function renderCustomFeedPicker() {
      const feeds = resolvedF1TvContent?.feeds || [];
      const placedKeys = new Set((activeCustomLayout?.tiles || []).map((tile) => customTileSourceKey(tile.source)));
      const channels = feeds.filter((feed) => !feed.driverCode && feed.kind !== "onboard");
      const onboardDrivers = feeds.some((feed) => feed.driverCode)
        ? feeds.filter((feed) => feed.driverCode).map((feed) => ({ code: feed.driverCode }))
        : D.drivers;
      const pickerGroups = [
        { group: "Channels", items: channels.map((feed) => ({ key: customTileSourceKey({ type: "channel", feedId: feed.feedId }), label: feed.label || feed.feedId, source: { type: "channel", feedId: feed.feedId } })) },
        { group: "Onboards", items: onboardDrivers.map((driver) => ({ key: "onboard:" + driver.code, label: (D.byCode[driver.code]?.name || driver.code) + " onboard", source: { type: "onboard", code: driver.code } })) },
        { group: "App panels", items: [{ key: "timing", label: "Live timing tower", source: { type: "timing" } }] },
      ];
      return (
        <div className="custom-picker" role="dialog" aria-label="Add feed">
          <div className="custom-picker__head">
            <span>Add feed</span>
            <IconButton variant="ghost" size="sm" label="Close feed picker" onClick={() => setCustomPickerOpen(false)}><Icon name="close" size={14} /></IconButton>
          </div>
          <div className="custom-picker__groups">
            {pickerGroups.map((group) => (
              <div className="custom-picker__group" key={group.group}>
                <div className="custom-picker__grouptitle">{group.group}</div>
                {group.items.map((item) => (
                  <button key={item.key} className="custom-picker__item" disabled={placedKeys.has(item.key)}
                    onClick={() => { addCustomTile(activeCustomLayout.id, item.source); setCustomPickerOpen(false); }}>
                    {item.label}{placedKeys.has(item.key) ? " · placed" : ""}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }
```

- [ ] **Step 4: Wire the canvas into the grid render**

Inside the `live__grid` div, change `{gridPanes.map(renderLivePane)}` to:

```jsx
              {layout === "custom" && activeCustomLayout ? (
                <>
                  <div className="custom-toolbar">
                    <input className="custom-toolbar__name" value={activeCustomLayout.name} aria-label="Custom layout name"
                      onChange={(e) => renameCustomLayout(activeCustomLayout.id, e.target.value)} />
                    <Button size="sm" variant="primary" onClick={() => setCustomPickerOpen(true)} iconLeft={<Icon name="plus" size={14} />}>Add feed</Button>
                    <span className="custom-toolbar__spacer" />
                    <Button size="sm" variant="ghost" onClick={() => duplicateCustomLayout(activeCustomLayout.id)}>Save as copy</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteCustomLayout(activeCustomLayout.id)}>Delete</Button>
                  </div>
                  <div className="custom-canvas" ref={customCanvasRef}>
                    {activeCustomLayout.tiles.length === 0 && (
                      <div className="custom-canvas__empty">
                        <span>Blank canvas — add feeds and arrange them however you like</span>
                        <Button size="sm" variant="primary" onClick={() => setCustomPickerOpen(true)} iconLeft={<Icon name="plus" size={14} />}>Add feed</Button>
                      </div>
                    )}
                    {activeCustomLayout.tiles.map(renderCustomTile)}
                    {parkedPanes.map(renderLivePane)}
                  </div>
                  {customPickerOpen && renderCustomFeedPicker()}
                </>
              ) : (
                gridPanes.map(renderLivePane)
              )}
```

Notes for this step:
- `parkedPanes` is the existing array of retained-but-inactive panes (`rg -n 'const parkedPanes'`); rendering them keeps streams warm exactly as the grid does. If the existing code renders parked panes through `gridPanes` already (check how `gridPanes` is built — `rg -n 'const gridPanes'`), match that: the custom branch must render the same parked set the grid branch does, hidden.
- Close the picker when leaving custom mode — add to the existing `}, [layout]);` effect (the one that closes `aiPopupOpen`): `if (layout !== "custom") setCustomPickerOpen(false);`

Below the grid, change:

```jsx
            {layout !== "focus" && <ResizeHandle kind="insights" label="Resize AI insights" />}
            {layout !== "focus" && renderInsightsPane()}
```

to:

```jsx
            {layout !== "focus" && layout !== "custom" && <ResizeHandle kind="insights" label="Resize AI insights" />}
            {layout !== "focus" && layout !== "custom" && renderInsightsPane()}
```

(The assertion in Step 1 expects `{layout !== "focus" && layout !== "custom" && renderInsightsPane()}` exactly.)

- [ ] **Step 5: Run tests**

Run: `npm run smoke` → PASS.
Run: `npm run build` → exits 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/pitwall-smoke-test.cjs ui_kits/pitwall/LiveRacing.jsx
git commit -m "feat: add custom layout canvas with drag/resize tiles and feed picker"
```

---

### Task 8: Full verification

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`
Expected: both smoke tests pass, exit 0.

- [ ] **Step 2: Manual verification in the app**

Run: `npm start` and in Live Racing verify:
1. Preset dropdown shows "My layouts" → "New custom layout…" creates and activates a blank black canvas with the "Add feed" prompt; the docked timing sidebar is gone.
2. Add the world feed, two onboards, the data channel, and the timing tower from the picker; each lands in a free spot, none overlap.
3. Drag tiles by their header — they snap to canvas edges and each other and refuse to overlap; resize from edges/corners respects the 12% minimum.
4. Rename the layout in the toolbar; "Save as copy" duplicates; switching to "Battle Mode" and back restores the arrangement exactly.
5. Relaunch the app (`npm start` again): the custom layout is still selected and intact.
6. Delete the active layout → falls back to Intelligent; the layout disappears from the dropdown.
7. Switch audio focus to a channel tile and confirm playback follows it.

- [ ] **Step 3: Commit any fixes, then finish**

Use the superpowers:finishing-a-development-branch skill to decide merge/PR next steps.

---

## Self-Review (completed)

- **Spec coverage:** free canvas (T4/T7), full F1 TV channel picker (T7), timing tile + hidden sidebar (T6/T7), snap + no-overlap (T1/T7), unlimited named layouts in dropdown (T2/T3), persistence + profile mirror + restore (T2), missing-channel graceful degrade (T5 — pane renders its existing unavailable state when `resolvedFeedForKey` finds nothing), delete-active fallback (T2).
- **Placeholder scan:** the only intentionally elided block is the verbatim cut-and-paste of existing timing JSX in Task 6 (moving code, not writing it) — instructions are exact.
- **Type consistency:** tile = `{id, source, x, y, w, h}` percent geometry everywhere; `customLayouts = { layouts: [...] }`; handler names match between tasks (`updateCustomTileRect`, `updateCustomTileSource`, `removeCustomTile`, `renameCustomLayout`, `duplicateCustomLayout`, `deleteCustomLayout`, `addCustomTile`).
