import { useMemo, useState } from "react";

interface Variant {
  label: string;
  src: string | null;
  lookPath: string | null;
}

function fileUrl(path: string | null): string | null {
  if (!path) return null;
  return `/api/local-file?path=${encodeURIComponent(path)}`;
}

export function ComparePage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const kind = params.get("kind") === "video" ? "video" : "image";
  const original = params.get("original");
  const variants: Variant[] = [
    { label: "Variant 1", src: params.get("v1"), lookPath: params.get("v1Look") },
    { label: "Variant 2", src: params.get("v2"), lookPath: params.get("v2Look") },
    { label: "Variant 3", src: params.get("v3"), lookPath: params.get("v3Look") },
  ];

  const [busy, setBusy] = useState<number | null>(null);

  async function editVariant(i: number) {
    const v = variants[i];
    if (!v.lookPath || !original) return;
    setBusy(i);
    try {
      await fetch("/api/seed-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: original, look: v.lookPath }),
      });
      window.location.href = "/";
    } finally {
      setBusy(null);
    }
  }

  function Cell({ title, src, action }: { title: string; src: string | null; action?: React.ReactNode }) {
    return (
      <div className="flex flex-col bg-zinc-900 rounded-md overflow-hidden border border-zinc-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <span className="text-xs text-zinc-300">{title}</span>
          {action}
        </div>
        <div className="flex-1 flex items-center justify-center bg-black min-h-0">
          {src ? (
            kind === "video" ? (
              <video src={src} controls className="max-w-full max-h-full" />
            ) : (
              <img src={src} alt={title} className="max-w-full max-h-full object-contain" />
            )
          ) : (
            <span className="text-xs text-zinc-600">missing</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col p-4 gap-3">
      <div className="text-sm text-zinc-400">Compare — pick a variant to edit</div>
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 min-h-0">
        <Cell title="Original" src={fileUrl(original)} />
        {variants.map((v, i) => (
          <Cell
            key={i}
            title={v.label}
            src={fileUrl(v.src)}
            action={
              <button
                onClick={() => editVariant(i)}
                disabled={busy !== null || !v.lookPath || !original}
                className="text-xs text-white bg-accent hover:bg-accent-hover disabled:opacity-50 rounded-sm px-2 py-0.5"
              >
                {busy === i ? "Opening…" : "Edit"}
              </button>
            }
          />
        ))}
      </div>
    </div>
  );
}
