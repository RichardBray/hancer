import { join } from "node:path";

const uiDir = join(import.meta.dir, "..", "packages", "ui");
const appDir = join(uiDir, "app");
const distDir = join(uiDir, "dist");

// Build CSS with PostCSS + Tailwind
const cssProcess = Bun.spawn(
  ["bun", "x", "postcss", join(appDir, "styles.css"), "-o", join(distDir, "styles.css")],
  { cwd: uiDir, stdout: "inherit", stderr: "inherit" }
);
const cssExit = await cssProcess.exited;
if (cssExit !== 0) {
  console.error("CSS build failed");
  process.exit(1);
}

// Build JS bundle
const result = await Bun.build({
  entrypoints: [join(appDir, "index.tsx")],
  outdir: distDir,
  minify: true,
  target: "browser",
  loader: { ".wgsl": "text" },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  external: [],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const html = await Bun.file(join(appDir, "index.html")).text();
const jsFile = result.outputs.find(o => o.path.endsWith(".js"));
const jsName = jsFile ? jsFile.path.split("/").pop() : "index.js";
const injected = html
  .replace("<!-- CSS -->", '<link rel="stylesheet" href="/styles.css">')
  .replace("<!-- SCRIPT -->", `<script type="module" src="/${jsName}"></script>`);
await Bun.write(join(distDir, "index.html"), injected);

console.log("UI built successfully");
