import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  videoRef: HTMLVideoElement | null;
}

export function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Timeline({ videoRef }: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Sync with video element — must be useEffect since video is an external system
  useEffect(() => {
    if (!videoRef) return;

    function onLoadedMetadata() {
      setDuration(videoRef!.duration);
    }
    function onPlay() { setPlaying(true); }
    function onPause() { setPlaying(false); }

    videoRef.addEventListener("loadedmetadata", onLoadedMetadata);
    videoRef.addEventListener("play", onPlay);
    videoRef.addEventListener("pause", onPause);
    if (videoRef.duration) setDuration(videoRef.duration);
    setPlaying(!videoRef.paused);

    function updateTime() {
      if (videoRef && !dragging) {
        setCurrentTime(videoRef.currentTime);
      }
      rafRef.current = requestAnimationFrame(updateTime);
    }
    rafRef.current = requestAnimationFrame(updateTime);

    return () => {
      cancelAnimationFrame(rafRef.current);
      videoRef.removeEventListener("loadedmetadata", onLoadedMetadata);
      videoRef.removeEventListener("play", onPlay);
      videoRef.removeEventListener("pause", onPause);
    };
  }, [videoRef, dragging]);

  // Spacebar play/pause — must be useEffect since it's a global keyboard listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        if (videoRef) {
          if (videoRef.paused) videoRef.play();
          else videoRef.pause();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [videoRef]);

  const seekToPosition = useCallback((clientX: number) => {
    if (!trackRef.current || !videoRef || !duration) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = ratio * duration;
    videoRef.currentTime = time;
    setCurrentTime(time);
  }, [videoRef, duration]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    seekToPosition(e.clientX);

    function onMouseMove(e: MouseEvent) {
      seekToPosition(e.clientX);
    }
    function onMouseUp() {
      setDragging(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [seekToPosition]);

  const togglePlay = useCallback(() => {
    if (!videoRef) return;
    if (videoRef.paused) videoRef.play();
    else videoRef.pause();
  }, [videoRef]);

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-3 h-full bg-zinc-800 border-t border-zinc-700 select-none">
      {/* Play/pause button */}
      <button
        onClick={togglePlay}
        className="text-zinc-300 hover:text-white transition-colors flex-shrink-0"
      >
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Current timecode */}
      <span className="text-[11px] text-zinc-400 tabular-nums flex-shrink-0 w-12">
        {formatTimecode(currentTime)}
      </span>

      {/* Timeline track */}
      <div
        ref={trackRef}
        className="flex-1 relative h-full cursor-pointer"
        onMouseDown={onMouseDown}
      >
        {/* Track background */}
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-8 bg-zinc-700 rounded">
          {/* Timecode ruler ticks */}
          <div className="absolute inset-x-0 top-0 h-2 flex items-end">
            {duration > 0 && Array.from({ length: Math.min(20, Math.ceil(duration / 5)) }, (_, i) => {
              const tickTime = (i + 1) * (duration / Math.min(20, Math.ceil(duration / 5)));
              const percent = (tickTime / duration) * 100;
              return (
                <div
                  key={i}
                  className="absolute bottom-0 w-px h-1.5 bg-zinc-600"
                  style={{ left: `${percent}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-accent z-10"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2 bg-accent rounded-sm" />
        </div>
      </div>

      {/* Duration */}
      <span className="text-[11px] text-zinc-400 tabular-nums flex-shrink-0 w-12 text-right">
        {formatTimecode(duration)}
      </span>
    </div>
  );
}
