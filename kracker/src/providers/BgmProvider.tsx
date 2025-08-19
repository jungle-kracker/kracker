// src/providers/BgmProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
// NOTE: 프로젝트 구조에 맞춰 경로 확인하세요. (예: "../audio/tracks")
import { PAGE_TO_PLAYLIST, PageKey } from "../assets/audios/tracks";

type AudioCtx = {
  // 공개 API (변경 없음)
  master: number; bgm: number; sfx: number;
  setMaster: (v: number) => void; setBgm: (v: number) => void; setSfx: (v: number) => void;
  next: () => void; prev: () => void;
  isPlaying: boolean;
  play: () => void; pause: () => void;
  playSfx: (src: string) => void;
};

const AudioContext = createContext<AudioCtx | null>(null);
export const useAudio = () => {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used within <BgmProvider/>");
  return ctx;
};

// ───────────────────────────────────────────────────────────────────────────────
// Utils
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const mixToLinear = (master100: number, lane100: number) => (master100 / 100) * (lane100 / 100);
// ───────────────────────────────────────────────────────────────────────────────

export const BgmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Volumes (0~100)
  const [masterVolume, setMasterVolume] = useState(50);
  const [bgmVolume, setBgmVolume] = useState(50);
  const [sfxVolume, setSfxVolume] = useState(50);

  // Playback state
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);

  // Elements/refs
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);      // BGM 전용 <audio>
  const sfxChannelPoolRef = useRef<HTMLAudioElement[]>([]);       // SFX 채널 풀

  // Playlist state
  const currentPlaylistRef = useRef<string[]>([]);
  const trackIndexRef = useRef(0);
  const lastTrackUrlRef = useRef<string | null>(null);

  // Fade animation
  const fadeAnimationIdRef = useRef<number | null>(null);
  const targetBgmLinearVolumeRef = useRef(1);

  // Current page → playlist
  const { pathname } = useLocation();
  const currentPage: PageKey = useMemo(
    () => (pathname.startsWith("/lobby") ? "lobby" : pathname.startsWith("/game") ? "game" : "home"),
    [pathname]
  );

  // rAF-based fade (current → target)
  const fadeTo = (targetLinearVolume: number, durationMs = 200) => {
    const audio = bgmAudioRef.current; if (!audio) return;

    if (fadeAnimationIdRef.current) {
      cancelAnimationFrame(fadeAnimationIdRef.current);
      fadeAnimationIdRef.current = null;
    }

    const startVol = audio.volume;
    const delta = clamp01(targetLinearVolume) - startVol;
    if (Math.abs(delta) < 0.001 || durationMs <= 0) {
      audio.volume = clamp01(targetLinearVolume);
      return;
    }

    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      audio.volume = clamp01(startVol + delta * p);
      fadeAnimationIdRef.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    fadeAnimationIdRef.current = requestAnimationFrame(step);
  };

  // Play current track immediately (used by next/prev or user-initiated resumes)
  const playCurrentTrack = async () => {
    const audio = bgmAudioRef.current;
    const list = currentPlaylistRef.current;
    if (!audio || !list.length) return;

    // Clamp index and resolve URL
    trackIndexRef.current = ((trackIndexRef.current % list.length) + list.length) % list.length;
    const trackUrl = list[trackIndexRef.current];

    // Swap source only when changed
    if (lastTrackUrlRef.current !== trackUrl) {
      audio.src = trackUrl;
      lastTrackUrlRef.current = trackUrl;
    }

    // On track end → queue next (autoplay path with muted+load)
    audio.onended = () => {
      const L = currentPlaylistRef.current.length;
      if (!L) return;

      trackIndexRef.current = (trackIndexRef.current + 1) % L;

      // Transition with muted=true (so autoplay allowed), unmute in 'playing'
      audio.muted = true;
      const nextUrl = currentPlaylistRef.current[trackIndexRef.current];
      if (audio.src !== nextUrl) audio.src = nextUrl;
      audio.load();
    };

    try {
      await audio.play();
      setIsBgmPlaying(true);
      fadeTo(targetBgmLinearVolumeRef.current, 160);
    } catch {
      setIsBgmPlaying(false);
    }
  };

  // Ensure playback continues without reinitialization (fallback on user gesture)
  const ensurePlayback = () => {
    const audio = bgmAudioRef.current; if (!audio) return;
    if (!currentPlaylistRef.current.length) return;
    if (!audio.src) return; // initial setup runs first

    if (audio.paused) {
      audio.muted = false; // just in case
      audio.play().then(() => setIsBgmPlaying(true)).catch(() => { });
    }
    // if already playing → no-op
  };

  // Public controls
  const nextTrack = () => {
    const L = currentPlaylistRef.current.length; if (!L) return;
    trackIndexRef.current = (trackIndexRef.current + 1) % L;
    void playCurrentTrack();
  };

  const previousTrack = () => {
    const L = currentPlaylistRef.current.length; if (!L) return;
    trackIndexRef.current = (trackIndexRef.current - 1 + L) % L;
    void playCurrentTrack();
  };

  const playBgm = () => void ensurePlayback();

  const pauseBgm = () => {
    const audio = bgmAudioRef.current; if (!audio) return;
    audio.pause();
    setIsBgmPlaying(false);
    if (fadeAnimationIdRef.current) {
      cancelAnimationFrame(fadeAnimationIdRef.current);
      fadeAnimationIdRef.current = null;
    }
  };

  // BgmProvider.tsx
  useEffect(() => {
    // master/sfx 변동 → 모든 SFX 채널 실시간 반영
    const linear = mixToLinear(masterVolume, sfxVolume);
    const pool = sfxChannelPoolRef.current;
    for (const ch of pool) {
      try { ch.volume = clamp01(linear); } catch { }
    }
  }, [masterVolume, sfxVolume]);

  // Page change → set first track via autoplay path (muted + src + load)
  useEffect(() => {
    const list = PAGE_TO_PLAYLIST[currentPage] || [];
    currentPlaylistRef.current = [...list];
    trackIndexRef.current = 0;

    const audio = bgmAudioRef.current;
    if (!audio || !list.length) return;

    audio.muted = true; // allow autoplay on load
    const firstUrl = list[0];
    if (audio.src !== firstUrl) audio.src = firstUrl;
    audio.load();

    // Also set onended handler here (safety)
    audio.onended = () => {
      const L = currentPlaylistRef.current.length;
      if (!L) return;
      trackIndexRef.current = (trackIndexRef.current + 1) % L;

      audio.muted = true;
      const nextUrl = currentPlaylistRef.current[trackIndexRef.current];
      if (audio.src !== nextUrl) audio.src = nextUrl;
      audio.load();
    };
  }, [currentPage]);

  // User gesture fallback → resume only (no reinit)
  useEffect(() => {
    const handler = () => ensurePlayback();
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    window.addEventListener("touchend", handler);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchend", handler);
    };
  }, []);

  // Update target linear volume & apply smoothly when playing
  useEffect(() => {
    const target = mixToLinear(masterVolume, bgmVolume);
    targetBgmLinearVolumeRef.current = target;

    const audio = bgmAudioRef.current; if (!audio) return;
    if (!audio.paused) fadeTo(target, 140);
    else audio.volume = target;
  }, [masterVolume, bgmVolume]);

  // When actual playback starts (autoplay muted), immediately unmute + fade in
  useEffect(() => {
    const audio = bgmAudioRef.current; if (!audio) return;
    const handlePlaying = () => {
      audio.muted = false;
      fadeTo(targetBgmLinearVolumeRef.current, 220);
      setIsBgmPlaying(true);
    };
    audio.addEventListener("playing", handlePlaying);
    return () => audio.removeEventListener("playing", handlePlaying);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (fadeAnimationIdRef.current) cancelAnimationFrame(fadeAnimationIdRef.current);
      const audio = bgmAudioRef.current;
      if (audio) { audio.pause(); audio.onended = null; }
    };
  }, []);

  // SFX: play on independent channels (pool)
  const playSfx = (src: string) => {
    const pool = sfxChannelPoolRef.current;
    const linearVol = mixToLinear(masterVolume, sfxVolume);

    // Find idle channel
    let channel = pool.find(el => el.paused);

    // Create if needed (max 6)
    if (!channel) {
      if (pool.length < 6) {
        channel = new Audio();
        channel.preload = "auto";
        pool.push(channel);
      } else {
        channel = pool[0];
        channel.pause();
      }
    }

    channel.src = src;
    channel.currentTime = 0;
    channel.muted = false;
    channel.volume = clamp01(linearVol);
    channel.play().catch(() => { });
  };

  // Public value (API 유지)
  const value: AudioCtx = {
    master: masterVolume,
    bgm: bgmVolume,
    sfx: sfxVolume,
    setMaster: setMasterVolume,
    setBgm: setBgmVolume,
    setSfx: setSfxVolume,
    next: nextTrack,
    prev: previousTrack,
    isPlaying: isBgmPlaying,
    play: playBgm,
    pause: pauseBgm,
    playSfx,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
      <audio
        ref={bgmAudioRef}
        preload="auto"
        autoPlay       // 입장 즉시(무음) 자동재생
        muted          // 정책 우회: 무음 자동재생 허용
        playsInline    // iOS 인라인 재생
        style={{ display: "none" }}
      />
    </AudioContext.Provider>
  );
};