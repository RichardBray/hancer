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

Clicking **Edit** on a variant cell:

1. POSTs `{file: original, look: vNLook}` to `/api/seed-edit`.
2. The server stores both as `initialFilePath` and `initialLookPath`.
3. The page navigates to `/`, where the editor's mount-time fetches pick up the file (`/api/initial-file`) and the look (`/api/initial-look`) and seed the initial state.

## Constraints

- The compare page reuses the editor's Tailwind setup, components, and font — never duplicate styling.
- The page does not render WebGPU effects itself; it just displays pre-rendered files. All rendering happens in the `try` step before opening the page.
- The server endpoints `/api/local-file`, `/api/initial-look`, and `/api/seed-edit` are the contract; do not add new endpoints without updating this doc.
