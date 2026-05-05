import { useState, useCallback } from "react";
import { getThumbnailGenerator } from "../lib/lookThumbnails";
import { fetchJson, fetchOk } from "../lib/fetchJson";

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
  return fetchJson<Record<string, string | number | boolean>>(`/api/look?name=${encodeURIComponent(name)}`);
}

export function useLooks() {
  const [looks, setLooks] = useState<LookMeta[]>([]);
  const [activeLook, setActiveLook] = useState<string | null>(null);
  const [activeLookParams, setActiveLookParams] = useState<Record<string, string | number | boolean> | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    fetchJson<string[]>("/api/looks")
      .then((names) => {
        setLooks(prev => {
          const prevByName = new Map(prev.map(l => [l.name, l.thumbnailUrl]));
          return names.map(name => ({ name, thumbnailUrl: prevByName.get(name) ?? "" }));
        });
        for (const name of names) {
          void updateThumbnail(name);
        }
      })
      .catch((err: Error) => {
        console.error("Failed to load looks:", err);
        setError(`Failed to load looks: ${err.message}`);
      });
  }, [updateThumbnail]);

  const loadLook = useCallback(async (name: string): Promise<Record<string, string | number | boolean>> => {
    const params = await fetchLookParams(name);
    setActiveLook(name);
    setActiveLookParams({ ...params });
    return params;
  }, []);

  const saveLook = useCallback(async (name: string, data: Record<string, string | number | boolean>) => {
    try {
      await fetchOk("/api/look", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data }),
      });
      setActiveLookParams({ ...data });
      void updateThumbnail(name);
    } catch (err) {
      setError(`Failed to save look "${name}": ${(err as Error).message}`);
      throw err;
    }
  }, [updateThumbnail]);

  const createLook = useCallback(async (
    name: string,
    data: Record<string, string | number | boolean>,
    metadata: { description: string; keywords: string[]; characteristics: string[] }
  ) => {
    try {
      await fetchOk("/api/looks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data, ...metadata }),
      });
      setActiveLook(name);
      setActiveLookParams({ ...data });
      refreshLooks();
    } catch (err) {
      setError(`Failed to create look "${name}": ${(err as Error).message}`);
      throw err;
    }
  }, [refreshLooks]);

  const deleteLook = useCallback(async (name: string) => {
    try {
      await fetchOk(`/api/look?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (activeLook === name) {
        setActiveLook(null);
        setActiveLookParams(null);
      }
      const gen = await getThumbnailGenerator();
      gen.invalidate(name);
      refreshLooks();
    } catch (err) {
      setError(`Failed to delete look "${name}": ${(err as Error).message}`);
      throw err;
    }
  }, [activeLook, refreshLooks]);

  const renameLook = useCallback(async (oldName: string, newName: string) => {
    try {
      await fetchOk("/api/look/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName }),
      });
      if (activeLook === oldName) setActiveLook(newName);
      const gen = await getThumbnailGenerator();
      gen.rename(oldName, newName);
      refreshLooks();
    } catch (err) {
      setError(`Failed to rename look "${oldName}": ${(err as Error).message}`);
      throw err;
    }
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
    try {
      const params = await fetchLookParams(name);
      setActiveLook(name);
      setActiveLookParams({ ...params });
    } catch {
      // Look was deleted between snapshot and undo; clear rather than crash.
      setActiveLook(null);
      setActiveLookParams(null);
    }
  }, []);

  const importLook = useCallback(async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      await fetchOk("/api/look/import", { method: "POST", body: formData });
      refreshLooks();
    } catch (err) {
      setError(`Import failed: ${(err as Error).message}`);
      throw err;
    }
  }, [refreshLooks]);

  return {
    looks,
    activeLook,
    activeLookParams,
    error,
    clearError: useCallback(() => setError(null), []),
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
