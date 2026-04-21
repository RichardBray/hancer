import { useState, useCallback } from "react";
import { getThumbnailGenerator } from "../lib/lookThumbnails";

export interface LookMeta {
  name: string;
  thumbnailUrl: string;
}

export function validateLookName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Name is required";
  if (trimmed.length > 50) return "Name must be 50 characters or less";
  if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) return "Name can only contain letters, numbers, spaces, hyphens, and underscores";
  return null;
}

async function fetchLookParams(name: string): Promise<Record<string, string | number | boolean>> {
  const res = await fetch(`/api/look?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to load look ${name}`);
  return res.json();
}

export function useLooks() {
  const [looks, setLooks] = useState<LookMeta[]>([]);
  const [activeLook, setActiveLook] = useState<string | null>(null);
  const [activeLookParams, setActiveLookParams] = useState<Record<string, string | number | boolean> | null>(null);

  const updateThumbnail = useCallback(async (name: string) => {
    try {
      const [gen, params] = await Promise.all([getThumbnailGenerator(), fetchLookParams(name)]);
      const url = await gen.generate(name, params);
      setLooks(prev => prev.map(l => l.name === name ? { ...l, thumbnailUrl: url } : l));
    } catch (err) {
      console.error(`Thumbnail generation failed for ${name}:`, err);
    }
  }, []);

  const refreshLooks = useCallback(() => {
    fetch("/api/looks")
      .then(r => r.json())
      .then((names: string[]) => {
        setLooks(prev => {
          const prevByName = new Map(prev.map(l => [l.name, l.thumbnailUrl]));
          return names.map(name => ({ name, thumbnailUrl: prevByName.get(name) ?? "" }));
        });
        for (const name of names) {
          void updateThumbnail(name);
        }
      });
  }, [updateThumbnail]);

  const loadLook = useCallback(async (name: string): Promise<Record<string, string | number | boolean>> => {
    const params = await fetchLookParams(name);
    setActiveLook(name);
    setActiveLookParams({ ...params });
    return params;
  }, []);

  const saveLook = useCallback(async (name: string, data: Record<string, string | number | boolean>) => {
    await fetch("/api/look", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data }),
    });
    setActiveLookParams({ ...data });
    void updateThumbnail(name);
  }, [updateThumbnail]);

  const createLook = useCallback(async (
    name: string,
    data: Record<string, string | number | boolean>,
    metadata: { description: string; keywords: string[]; characteristics: string[] }
  ) => {
    await fetch("/api/looks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data, ...metadata }),
    });
    setActiveLook(name);
    setActiveLookParams({ ...data });
    refreshLooks();
  }, [refreshLooks]);

  const deleteLook = useCallback(async (name: string) => {
    await fetch(`/api/look?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (activeLook === name) {
      setActiveLook(null);
      setActiveLookParams(null);
    }
    const gen = await getThumbnailGenerator();
    gen.invalidate(name);
    refreshLooks();
  }, [activeLook, refreshLooks]);

  const renameLook = useCallback(async (oldName: string, newName: string) => {
    await fetch("/api/look/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldName, newName }),
    });
    if (activeLook === oldName) setActiveLook(newName);
    const gen = await getThumbnailGenerator();
    gen.rename(oldName, newName);
    refreshLooks();
  }, [activeLook, refreshLooks]);

  const clearLook = useCallback(() => {
    setActiveLook(null);
    setActiveLookParams(null);
  }, []);

  // Restore look state from history (undo/redo) without committing a new
  // history entry. When name is null, clears the active look.
  const restoreActiveLook = useCallback(async (name: string | null): Promise<void> => {
    if (name === null) {
      setActiveLook(null);
      setActiveLookParams(null);
      return;
    }
    const res = await fetch(`/api/look?name=${encodeURIComponent(name)}`);
    if (!res.ok) {
      // Look was deleted between snapshot and undo; clear rather than crash.
      setActiveLook(null);
      setActiveLookParams(null);
      return;
    }
    const params = await res.json();
    setActiveLook(name);
    setActiveLookParams({ ...params });
  }, []);

  const importLook = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/look/import", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Import failed");
    refreshLooks();
  }, [refreshLooks]);

  return {
    looks,
    activeLook,
    activeLookParams,
    refreshLooks,
    loadLook,
    clearLook,
    saveLook,
    createLook,
    deleteLook,
    renameLook,
    importLook,
    restoreActiveLook,
  };
}
