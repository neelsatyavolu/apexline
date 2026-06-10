# Live Racing — Custom Layouts (Design)

**Date:** 2026-06-10
**Status:** Approved

## Summary

Add a user-built "custom" layout mode to Live Racing alongside the existing fixed presets
(`focus`, `battle`, `quad`, `data`). A custom layout is a free-form canvas: it starts blank,
the user adds feeds from a picker, places and sizes them anywhere (empty/black space is
allowed), tiles snap but never overlap, and any number of named layouts can be saved.

## Requirements (validated with user)

1. **Free-form canvas** — starts blank; user places feeds wherever they want; uncovered
   black space is acceptable.
2. **Feed picker contents** — the session's full F1 TV channel lineup: World/International
   feed, F1 Live, Data Channel, F1 TV's Track Map channel, Pit Lane, and all driver
   onboards. Plus the app's own timing tower as a placeable tile.
3. **Timing sidebar** — in custom mode the docked timing sidebar is hidden; the timing
   tower is instead a placeable tile. The canvas takes the full live body area.
4. **No overlap, with snapping** — tiles can be placed freely but snap to canvas edges and
   neighboring tile edges; moves/resizes that would overlap another tile are clamped.
5. **Saving** — users can save as many named custom layouts as they want; layouts appear
   in the existing layout preset dropdown.

## Existing system (context)

- `ui_kits/pitwall/LiveRacing.jsx` defines `LAYOUTS` (preset name → layout type) and builds
  a `panes` array per layout type; panes are keyed by `paneId` (`"WORLD"` or
  `"DRIVER-{code}"`), retained/parked when inactive, and rendered by the `Pane` component
  (HLS playback, stream readiness, driver select).
- Session feeds come from `resolvedF1TvContent.feeds`; each feed has `feedId`, `kind`,
  `label`, `driverCode`.
- Panel sizes are CSS variables persisted to localStorage (`pw-live-panel-sizes`) and the
  pitwall profile (`window.pitwall.profile.set`). The active preset persists in
  `pw-live-layout`.
- Resize handles are hand-rolled pointer-event drags; no layout library is used.

## Approach decision

Considered:

- **react-grid-layout (or similar) dependency** — rejected: row-packing model conflicts
  with free placement, and the codebase is deliberately hand-rolled/no-dependency for
  layout interaction.
- **Fine CSS-grid tracks (snap-grid-only)** — rejected by user in favor of free placement
  with snap assistance.
- **Hand-rolled percentage-based free canvas** — **chosen.** Consistent with existing
  pointer-event drag code; tiles are absolutely positioned with `%` geometry so layouts
  are resolution-independent.

## Data model

```js
// localStorage "pw-live-custom-layouts", mirrored to pitwall profile
{
  layouts: [
    {
      id: "cl-<random>",        // stable id
      name: "My Quad+",         // user-chosen, unique-ified on save
      tiles: [
        {
          id: "t-<random>",
          source:
            { type: "channel", feedId: "..." }   // any non-onboard F1 TV channel
          | { type: "onboard", code: "VER" }     // driver onboard
          | { type: "timing" },                  // app timing tower
          x, y, w, h            // percent of canvas (0–100), numbers
        }
      ]
    }
  ]
}
```

Validation on load: unknown `source.type`, malformed geometry, or non-array shapes are
dropped per-tile / per-layout; geometry is clamped into bounds. Never trust stored data.

## Component / UI design

**Preset dropdown** — gains a "My layouts" option group listing saved layouts (by name)
plus "New custom layout…". Selecting a saved layout activates layout type `custom`.
`pw-live-layout` persistence stores the custom layout id so it restores on reopen.

**Custom canvas** (replaces `live__grid` + docked timing when active):

- Fills the entire live body (timing sidebar hidden).
- Empty state: centered "+ Add feed" call to action.
- Toolbar strip (top of canvas): layout name, **+ Add feed**, Save as copy, Rename,
  Delete. Geometry and tile changes auto-save to the active layout (matches existing
  auto-persist behavior for panel sizes).
- **Feed picker** popover grouped into: Channels (from `resolvedF1TvContent.feeds`,
  excluding onboards), Onboards (driver list), App panels (Timing tower). Feeds already
  placed are marked; the same source can only be placed once per layout.
- **Tiles**: drag via tile header to move; 8-direction edge/corner resize; snap threshold
  ~8px to canvas edges and neighbor tile edges; collision clamp prevents any overlap;
  minimum tile size (e.g. 12% × 12%) enforced. Tile header has a remove (✕) button.
- New tiles are placed in the largest free rectangle (or default size at first free spot).

**Rendering** — video tiles reuse the existing `Pane` component. New paneId scheme
`CHANNEL-{feedId}` for non-onboard channels (world keeps `"WORLD"`); onboard tiles use the
existing `DRIVER-{code}` scheme so stream retention/parking works unchanged. The timing
tile wraps the existing timing tower component.

## Pure helpers (unit-testable)

Extracted as plain functions in `LiveRacing.jsx` (exposed for smoke tests like existing
helpers):

- `clampTileGeometry(tile)` — bounds + min-size clamp.
- `snapTileGeometry(tile, otherTiles, threshold)` — edge snapping.
- `resolveTileCollision(tile, otherTiles)` — clamp a proposed move/resize so no overlap.
- `normalizeCustomLayouts(raw)` — parse/validate/migrate stored JSON.
- `customPaneIdForSource(source)` — source → paneId mapping.

## Error handling

- Stored layout JSON parse failures → fall back to empty list (existing try/catch pattern).
- A tile whose `feedId` is absent from the current session's feed list renders the pane's
  existing "stream unavailable" state rather than being dropped (the channel may exist in
  the next session).
- Deleting the active layout switches to the default preset.

## Testing

Repo pattern: assertions in `scripts/pitwall-smoke-test.cjs` run against the source. TDD:

1. Add failing assertions for the pure helpers (snapping, collision clamp, geometry
   clamp, normalize/migration, paneId mapping) and for required UI markers
   (e.g. `data-layout="custom"`, picker structure).
2. Implement until green.
3. Manual verification in the running Electron app (create, arrange, save, switch,
   relaunch-restore).
