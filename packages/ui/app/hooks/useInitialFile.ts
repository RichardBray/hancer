import { useEffect } from "react";

export function useInitialFile(upload: (file: File) => void): void {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/initial-file");
        if (!res.ok || cancelled) return;
        const name = decodeURIComponent(res.headers.get("X-Filename") || "file");
        const blob = await res.blob();
        if (cancelled) return;
        upload(new File([blob], name, { type: blob.type }));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [upload]);
}
