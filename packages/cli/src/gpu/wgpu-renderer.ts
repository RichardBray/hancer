import { join } from "node:path";

export interface HeadlessRenderer {
  init(width: number, height: number, params?: Record<string, unknown>): Promise<void>;
  renderFrame(
    rgba: Uint8Array,
    width: number,
    height: number,
    params: Record<string, unknown>,
  ): Promise<Uint8Array>;
  close(): Promise<void>;
}

export async function createHeadlessRenderer(): Promise<HeadlessRenderer> {
  let proc: ReturnType<typeof Bun.spawn> | null = null;
  let frameSize = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let readBuffer = new Uint8Array(0);

  function sidecarPath(): string {
    // Check for bundled binary next to CLI, then fall back to dev path
    const devPath = join(import.meta.dir, "..", "..", "..", "wgpu", "target", "release", "hance-gpu");
    return devPath;
  }

  async function readExactly(n: number): Promise<Uint8Array> {
    while (readBuffer.length < n) {
      const { done, value } = await reader!.read();
      if (done) throw new Error("Sidecar stdout closed unexpectedly");
      const combined = new Uint8Array(readBuffer.length + value.length);
      combined.set(readBuffer);
      combined.set(value, readBuffer.length);
      readBuffer = combined;
    }
    const result = readBuffer.slice(0, n);
    readBuffer = readBuffer.slice(n);
    return result;
  }

  async function init(width: number, height: number, params: Record<string, unknown> = {}): Promise<void> {
    frameSize = width * height * 4;

    const initJson = JSON.stringify({ width, height, params });
    proc = Bun.spawn([sidecarPath(), initJson], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    });

    reader = proc.stdout.getReader();
  }

  async function renderFrame(
    rgba: Uint8Array,
    _width: number,
    _height: number,
    params: Record<string, unknown>,
  ): Promise<Uint8Array> {
    if (!proc) throw new Error("Renderer not initialized");

    // Note: params are sent in init message. For per-frame params we'd need
    // a protocol extension. For now, params are fixed at init time.
    // TODO: If per-frame param updates are needed, extend the protocol.

    await proc.stdin.write(rgba);

    return readExactly(frameSize);
  }

  async function close(): Promise<void> {
    if (proc) {
      proc.stdin.end();
      await proc.exited;
      proc = null;
      reader = null;
    }
  }

  return { init, renderFrame, close };
}
