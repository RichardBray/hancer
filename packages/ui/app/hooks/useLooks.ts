import { useState, useCallback } from "react";

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

export function useLooks() {
  const [looks, setLooks] = useState<LookMeta[]>([]);
  const [activeLook, setActiveLook] = useState<string | null>(null);
  const [activeLookParams, setActiveLookParams] = useState<Record<string, string | number | boolean> | null>(null);

  const refreshLooks = useCallback(() => {
    fetch("/api/looks")
      .then(r => r.json())
      .then((names: string[]) => {
        setLooks(names.map(name => ({
          name,
          thumbnailUrl: `/api/look-thumbnail?name=${encodeURIComponent(name)}&t=${Date.now()}`,
        })));
      });
  }, []);

  const loadLook = useCallback(async (name: string): Promise<Record<string, string | number | boolean>> => {
    const res = await fetch(`/api/look?name=${encodeURIComponent(name)}`);
    const params = await res.json();
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
    refreshLooks();
  }, [refreshLooks]);

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
    refreshLooks();
  }, [activeLook, refreshLooks]);

  const renameLook = useCallback(async (oldName: string, newName: string) => {
    await fetch("/api/look/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldName, newName }),
    });
    if (activeLook === oldName) setActiveLook(newName);
    refreshLooks();
  }, [activeLook, refreshLooks]);

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
    saveLook,
    createLook,
    deleteLook,
    renameLook,
    importLook,
  };
}
