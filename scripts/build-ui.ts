import { join } from "node:path";

// Build main UI
const result = await Bun.build({
  entrypoints: [join(import.meta.dir, "..", "src", "ui", "app", "index.tsx")],
  outdir: join(import.meta.dir, "..", "src", "ui", "dist"),
  minify: true,
  target: "browser",
  loader: { ".wgsl": "text" },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const html = await Bun.file(join(import.meta.dir, "..", "src", "ui", "app", "index.html")).text();
const jsFile = result.outputs.find(o => o.path.endsWith(".js"));
const jsName = jsFile ? jsFile.path.split("/").pop() : "index.js";
const injected = html.replace("<!-- SCRIPT -->", `<script type="module" src="/${jsName}"></script>`);
await Bun.write(join(import.meta.dir, "..", "src", "ui", "dist", "index.html"), injected);

console.log("UI built successfully");
