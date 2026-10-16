"use client";

import { useRef, useState } from "react";

import { PauseCircle, Play } from "@/components/huge-icons";

import styles from "./chat.module.css";

/** "0:07", "1:32": the length of a voice note, as WhatsApp shows it. */
export function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * A WhatsApp audio in a chat bubble: play/pause, a progress bar that seeks, and the time.
 * The file streams from the authenticated media route, so it is only as available as the viewer's scope.
 */
export function ChatAudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  if (failed) return <p className={styles.audioUnavailable}>Áudio indisponível</p>;

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play().catch(() => setFailed(true));
    }
  }

  function seek(event: React.MouseEvent<HTMLButtonElement>) {
    const audio = audioRef.current;
    const track = trackRef.current;
    if (!audio || !track || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrent(audio.currentTime);
  }

  return (
    <div className={styles.audio}>
      <button
        type="button"
        onClick={togglePlayback}
        aria-label={playing ? "Pausar áudio" : "Ouvir áudio"}
        className={styles.audioButton}
      >
        {playing ? <PauseCircle className="size-4" /> : <Play className="size-4" />}
      </button>
      <div className={styles.audioBody}>
        <audio
          ref={audioRef}
          src={url}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setCurrent(0); }}
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onError={() => setFailed(true)}
          className="hidden"
        />
        <button
          ref={trackRef}
          type="button"
          onClick={seek}
          role="slider"
          aria-label="Posição do áudio"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(current)}
          className={styles.audioTrack}
        >
          <span className={styles.audioFill} style={{ width: `${progress}%` }} />
        </button>
        <span className={styles.audioTime}>
          {playing || current > 0 ? `${formatAudioTime(current)} / ${formatAudioTime(duration)}` : formatAudioTime(duration)}
        </span>
      </div>
    </div>
  );
}
