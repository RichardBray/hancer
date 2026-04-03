import { useState, useCallback } from "react";

interface UploadState {
  file: File | null;
  objectUrl: string | null;
  isVideo: boolean;
}

export function useUpload() {
  const [state, setState] = useState<UploadState>({
    file: null, objectUrl: null, isVideo: false,
  });

  const upload = useCallback((file: File) => {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    setState({ file, objectUrl: url, isVideo });
  }, [state.objectUrl]);

  return { ...state, upload };
}
