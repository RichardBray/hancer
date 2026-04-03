import { useCallback } from "react";

interface Props {
  onFile: (file: File) => void;
}

export function UploadPanel({ onFile }: Props) {
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      onDrop={onDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,video/*";
        input.onchange = () => { if (input.files?.[0]) onFile(input.files[0]); };
        input.click();
      }}
      style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        border: "2px dashed #333", borderRadius: 12, margin: 16, cursor: "pointer",
        flexDirection: "column", gap: 12,
      }}
    >
      <span style={{ fontSize: 48, opacity: 0.3 }}>+</span>
      <span style={{ opacity: 0.5 }}>Drop image or video here</span>
    </div>
  );
}
