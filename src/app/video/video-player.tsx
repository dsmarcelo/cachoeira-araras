"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RiArrowRightSLine } from "react-icons/ri";

/**
 * Video served from `public/videos/`. It is cached for a year (see next.config.js),
 * so when replacing the video, give the new file a new name and update this path.
 */
const VIDEO_SRC = "/videos/cachoeira-araras.mp4";

/** Any of these counts as a user gesture that lets browsers play audio. */
const UNMUTE_GESTURES = ["click", "touchend", "keydown"] as const;

/**
 * Plays the video as soon as the page opens, with sound when the browser allows.
 * Browsers (Chrome, Safari, iOS) block unmuted autoplay unless the visitor has
 * already interacted with the site, so when blocked it starts muted and turns
 * the sound on at the visitor's first tap, click or key press.
 * When it ends it goes straight to the site (home); a small button at the
 * bottom lets the visitor skip ahead at any time.
 */
export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [waitingForGesture, setWaitingForGesture] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function unmute(event: Event) {
      if (!video) return;
      // A tap on the video itself would also toggle pause via the native
      // controls; this tap is only meant to turn the sound on.
      if (event.target === video) event.preventDefault();
      video.muted = false;
      // Covers a muted start that was interrupted before the gesture.
      if (video.paused && !video.ended)
        void video.play().catch(() => undefined);
      stopListening();
    }
    function stopListening() {
      for (const type of UNMUTE_GESTURES)
        window.removeEventListener(type, unmute, true);
    }

    video.muted = false;
    video.play().catch((error: unknown) => {
      // Only autoplay-policy blocks get the muted fallback; other failures
      // (e.g. an aborted load) are handled by onError or the native controls.
      if (!(error instanceof DOMException) || error.name !== "NotAllowedError")
        return;
      // Set via property: React's `muted` attribute is unreliable before play().
      video.muted = true;
      setWaitingForGesture(true);
      video.play().catch(() => undefined);
      for (const type of UNMUTE_GESTURES)
        window.addEventListener(type, unmute, true);
    });

    return stopListening;
  }, []);

  return (
    <div className="relative flex w-full items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        className="max-h-[100dvh] w-full object-contain"
        src={VIDEO_SRC}
        playsInline
        controls
        controlsList="nodownload"
        preload="auto"
        onVolumeChange={(event) => {
          if (!event.currentTarget.muted) setWaitingForGesture(false);
        }}
        onEnded={() => router.push("/")}
        onError={() => setFailed(true)}
      />

      {/* Only shown when the browser forced a muted start. */}
      {waitingForGesture && !failed && (
        <p className="pointer-events-none absolute inset-x-0 top-6 mx-auto w-fit rounded-full border border-white/30 bg-white/20 px-5 py-2 text-sm font-medium text-white backdrop-blur-md">
          Toque na tela para ativar o som
        </p>
      )}

      {failed && (
        <p className="absolute inset-x-0 top-1/3 mx-auto max-w-xs px-4 text-center text-lg text-primary-50">
          Não foi possível carregar o vídeo agora. Você pode seguir para o site.
        </p>
      )}

      {/* Above the native controls bar. No prefetch: avoids extra Vercel requests until the user taps. */}
      <Link
        href="/"
        prefetch={false}
        className="absolute inset-x-0 bottom-20 mx-auto flex h-10 w-fit items-center justify-center gap-1 overflow-hidden rounded-full border border-white/30 bg-white/20 pl-6 pr-4 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/30"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 animate-shine bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />
        <span className="relative">Quero conhecer</span>
        <RiArrowRightSLine className="relative h-5 w-5" aria-hidden />
      </Link>
    </div>
  );
}
