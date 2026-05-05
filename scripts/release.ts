#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { $ } from "bun";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error("usage: bun run release <version>   (e.g. 0.2.0)");
  process.exit(1);
}

const tag = `v${version}`;

const branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
if (branch !== "main") {
  console.error(`must be on main (currently on ${branch})`);
  process.exit(1);
}

const status = (await $`git status --porcelain`.text()).trim();
if (status) {
  console.error("working tree not clean:\n" + status);
  process.exit(1);
}

await $`git pull --ff-only`;

const existing = (await $`git tag --list ${tag}`.text()).trim();
if (existing) {
  console.error(`tag ${tag} already exists`);
  process.exit(1);
}

const rootPkgPath = "package.json";
const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
rootPkg.version = version;
writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + "\n");

const workspaces = ["packages/core", "packages/cli", "packages/ui"];
for (const ws of workspaces) {
  const wsPkgPath = `${ws}/package.json`;
  const wsPkg = JSON.parse(readFileSync(wsPkgPath, "utf8"));
  wsPkg.version = version;
  writeFileSync(wsPkgPath, JSON.stringify(wsPkg, null, 2) + "\n");
}

await $`git add package.json packages/*/package.json`;
await $`git commit -m ${`chore(release): ${tag}`}`;
await $`git tag ${tag}`;
await $`git push origin main ${tag}`;

console.log(`\nreleased ${tag}. watch the build:\n  gh run watch`);
