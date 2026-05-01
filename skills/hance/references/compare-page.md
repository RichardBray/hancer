# `/compare` page

A route in `packages/ui` that displays a 2×2 grid: the original plus three variant renders, each with an **Edit** button that opens the editor seeded with that look.

## URL contract

```
http://localhost:<port>/compare
  ?kind=image|video
  &original=<absolute-path>
  &v1=<abs-path-to-rendered-variant>
  &v2=<abs>
  &v3=<abs>
  &v1Look=<abs-path-to-.hlook>
  &v2Look=<abs>
  &v3Look=<abs>
```

- `kind` selects `<img>` vs `<video controls>` rendering.
- File paths must be absolute and readable by the UI server. `try` registers them via `allowFilePath()` (server-side allowlist) so that `/api/local-file?path=...` will serve them. If you build the URL but the server has not been told the paths are allowed, the cells will show "missing".

## Edit hand-off

Clicking **Edit** on a variant cell navigates to:

```
/?look=<abs-path-to-vNLook>
```

The editor reads `?look=` on mount, derives the preset name from the basename (strips `.hlook`), and loads it via the existing preset API. The original file is served by the existing `/api/initial-file`, which `try` seeds via `setInitialFile()` before launching the browser.

This is stateless — no server-side seeding endpoint, no POST round-trip. Two tabs/windows can show different looks without trampling each other.

## Constraints

- The compare page reuses the editor's Tailwind setup, components, and font — never duplicate styling.
- The page does not render WebGPU effects itself; it just displays pre-rendered files. All rendering happens in the `try` step before opening the page.
- The server endpoint `/api/local-file` is the contract for file display; do not add new endpoints without updating this doc.
- Variant `.hlook` files must be discoverable by `loadPreset(name)` (i.e. written into the user presets dir) so the editor can resolve them by name.
