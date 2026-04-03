# Hancer
Single-binary CLI that applies cinematic film effects to video/images in one FFmpeg pass.

## Stack
- Runtime: Bun
- Language: TypeScript
- FFmpeg: via Bun.spawn (must be installed on system)
- Build: `bun build packages/cli/src/cli.ts --compile --outfile hancer`
- Monorepo: Bun workspaces (packages/core, packages/cli, packages/ui, packages/wgpu)

## Commands
- Run dev: `bun run packages/cli/src/cli.ts <input> [options]`
- Build binary: `bun run build`
- Run tests: `bun test`
- Run e2e tests: `bun test packages/cli/__tests__/e2e/`

## Conventions
- Verb-first naming: `buildFilterGraph`, `parseProgress`
- Effect modules are pure functions: `(inputLabel, options) => FilterResult`
- No external dependencies beyond Bun and FFmpeg
- TypeScript exclusively; function declarations over expressions

## Architecture
- Effects chain: grade → halation → aberration → weave
- All effects compose into a single `-filter_complex` string
- Each effect module returns `{ fragment, output }` — no side effects

## Git & PRs
- Conventional Commits: `<type>(<scope>): <description>`
- Never commit directly to main; use feature branches

## Testing
- Unit tests: `packages/*/\_\_tests\_\_/` — test each module's output and CLI arg parsing
- E2E tests: `packages/cli/__tests__/e2e/` — test actual FFmpeg execution with small test fixtures
- All features must have tests; all tests must pass before PRs
- Test framework: bun:test
