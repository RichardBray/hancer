interface Props {
  name: string;
  thumbnailUrl: string;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function LookCard({ name, thumbnailUrl, isActive, onSelect, onHover, onHoverEnd, onContextMenu }: Props) {
  return (
    <div
      className={`
        group cursor-pointer rounded-lg overflow-hidden border-2 transition-colors
        ${isActive ? "border-accent" : "border-transparent hover:border-zinc-600"}
      `}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      onContextMenu={onContextMenu}
    >
      <div className="aspect-square bg-zinc-800 relative">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="px-1.5 py-1 bg-zinc-850">
        <span className="text-[11px] text-zinc-400 truncate block">{name}</span>
      </div>
    </div>
  );
}
