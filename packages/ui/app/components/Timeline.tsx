import { useState, useRef, useEffect, useCallback } from "react";
import { computeTicks } from "./timelineTicks";

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

export function formatTimecodeFrames(seconds: number, fps = 30): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const f = Math.floor((total - Math.floor(total)) * fps);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
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

  const skipToStart = useCallback(() => {
    if (!videoRef) return;
    videoRef.currentTime = 0;
    setCurrentTime(0);
  }, [videoRef]);

  const skipToEnd = useCallback(() => {
    if (!videoRef || !duration) return;
    videoRef.currentTime = duration;
    setCurrentTime(duration);
  }, [videoRef, duration]);

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const ticks = computeTicks(duration);

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-t border-zinc-800 select-none">
      {/* Transport bar */}
      <div className="relative flex items-center px-3 py-2 bg-zinc-800">
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 text-zinc-300">
          <button
            onClick={skipToStart}
            className="hover:text-white transition-colors"
            aria-label="Skip to start"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="5" y="5" width="2" height="14" />
              <polygon points="20,5 20,19 9,12" />
            </svg>
          </button>
          <button
            onClick={togglePlay}
            className="hover:text-white transition-colors"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>
          <button
            onClick={skipToEnd}
            className="hover:text-white transition-colors"
            aria-label="Skip to end"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="4,5 4,19 15,12" />
              <rect x="17" y="5" width="2" height="14" />
            </svg>
          </button>
        </div>
        <span className="ml-auto text-sm text-zinc-300 tabular-nums px-2 py-0.5">
          {formatTimecodeFrames(currentTime)}
        </span>
      </div>

      {/* Scrubber + ruler */}
      <div
        ref={trackRef}
        className="relative flex-1 cursor-pointer overflow-hidden"
        onMouseDown={onMouseDown}
      >
        <div className="absolute top-6 inset-x-0 h-2 bg-zinc-800 rounded-sm" />

        {/* Ruler strip */}
        <div className="absolute top-0 inset-x-0 h-4 pointer-events-none">
          {ticks.majors.map((time, i) => {
            const percent = (time / duration) * 100;
            return (
              <div key={`M${i}`} className="absolute top-0" style={{ left: `${percent}%` }}>
                <div className="w-px h-2 bg-zinc-500" />
                <div className="text-[9px] text-zinc-500 tabular-nums -translate-x-1/2 mt-0.5">
                  {formatTimecode(time)}
                </div>
              </div>
            );
          })}
          {ticks.majors.flatMap((time, i) => {
            const step = ticks.majorInterval / (ticks.minorsPerMajor + 1);
            return Array.from({ length: ticks.minorsPerMajor }, (_, j) => {
              const tickTime = time - ticks.majorInterval + step * (j + 1);
              if (tickTime < 0 || tickTime > duration) return null;
              const percent = (tickTime / duration) * 100;
              return (
                <div
                  key={`m${i}-${j}`}
                  className="absolute top-0 w-px h-1 bg-zinc-600"
                  style={{ left: `${percent}%` }}
                />
              );
            }).filter(Boolean);
          })}
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-accent z-10 pointer-events-none"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2 bg-accent rounded-sm" />
        </div>
      </div>
    </div>
  );
}
