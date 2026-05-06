import { createRenderer, type Renderer, type PreviewParams } from "../gpu/renderer";

const THUMB_SIZE = 256;
const REFERENCE_URL = "/assets/reference.webp";

type Generator = {
  generate: (name: string, params: PreviewParams) => Promise<string>;
  invalidate: (name: string) => void;
  rename: (oldName: string, newName: string) => void;
};

let generatorPromise: Promise<Generator> | null = null;

async function loadReferenceImage(): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = REFERENCE_URL;
  await img.decode();
  return img;
}

async function createGenerator(): Promise<Generator> {
  const canvas = document.createElement("canvas");
  const reference = await loadReferenceImage();
  const renderer: Renderer = await createRenderer(canvas, {
    sourceWidth: reference.naturalWidth,
    sourceHeight: reference.naturalHeight,
    previewWidth: THUMB_SIZE,
    previewHeight: THUMB_SIZE,
  });
  renderer.setSource(reference);

  const out2d = document.createElement("canvas");
  out2d.width = THUMB_SIZE;
  out2d.height = THUMB_SIZE;
  const ctx = out2d.getContext("2d")!;

  const cache = new Map<string, string>();
  let queue: Promise<void> = Promise.resolve();

  async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const prev = queue;
    let resolve: () => void;
    queue = new Promise(r => { resolve = r; });
    try {
      await prev;
      return await fn();
    } finally {
      resolve!();
    }
  }

  return {
    async generate(name, params) {
      return runExclusive(async () => {
        renderer.setParams(params);
        renderer.renderFrame();
        const pixels = await renderer.readPixels();
        const imageData = new ImageData(new Uint8ClampedArray(pixels.buffer), THUMB_SIZE, THUMB_SIZE);
        ctx.putImageData(imageData, 0, 0);
        const blob: Blob = await new Promise((res, rej) =>
          out2d.toBlob(b => b ? res(b) : rej(new Error("toBlob failed")), "image/webp", 0.82),
        );
        const prev = cache.get(name);
        if (prev) URL.revokeObjectURL(prev);
        const url = URL.createObjectURL(blob);
        cache.set(name, url);
        return url;
      });
    },
    invalidate(name) {
      const prev = cache.get(name);
      if (prev) {
        URL.revokeObjectURL(prev);
        cache.delete(name);
      }
    },
    rename(oldName, newName) {
      const url = cache.get(oldName);
      if (url) {
        cache.delete(oldName);
        cache.set(newName, url);
      }
    },
  };
}

export function getThumbnailGenerator(): Promise<Generator> {
  if (!generatorPromise) generatorPromise = createGenerator();
  return generatorPromise;
}
