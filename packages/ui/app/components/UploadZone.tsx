interface Props {
  onFile: (file: File) => void;
}

export function UploadZone({ onFile }: Props) {
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function openPicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.onchange = () => { if (input.files?.[0]) onFile(input.files[0]); };
    input.click();
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={e => e.preventDefault()}
      onClick={openPicker}
      className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 rounded-xl m-4 cursor-pointer hover:border-zinc-500 transition-colors gap-3"
    >
      <span className="text-5xl text-zinc-700">+</span>
      <span className="text-sm text-zinc-500">Drop image or video here</span>
    </div>
  );
}
