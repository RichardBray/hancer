import { describe, it, expect } from "bun:test";

describe("cli --version", () => {
  it("prints HANCE_VERSION and exits 0", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "packages/cli/src/cli.ts", "--version"],
      { stdout: "pipe", stderr: "pipe", env: { ...process.env, HANCE_VERSION: "9.9.9-test" } }
    );
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(out.trim()).toBe("hance 9.9.9-test");
  });

  it("prints 'dev' when HANCE_VERSION is unset", async () => {
    const env = { ...process.env };
    delete env.HANCE_VERSION;
    const proc = Bun.spawn(
      ["bun", "run", "packages/cli/src/cli.ts", "--version"],
      { stdout: "pipe", stderr: "pipe", env }
    );
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    expect(code).toBe(0);
    expect(out.trim()).toBe("hance dev");
  });
});
