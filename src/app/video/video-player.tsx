"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { RiRestartLine } from "react-icons/ri";

/**
 * Video served from `public/videos/`. It is cached for a year (see next.config.js),
 * so when replacing the video, give the new file a new name and update this path.
 */
const VIDEO_SRC = "/videos/cachoeira-araras.mp4";

type PlayerStatus = "playing" | "ended" | "error";

/**
 * Autoplays the video (muted, as browsers require) with native controls.
 * When it ends, shows "replay" and "learn more" (home) buttons over it.
 * Replaying reuses the already downloaded file, so it costs no extra bandwidth.
 */
export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<PlayerStatus>("playing");

  function replay() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setStatus("playing");
    // play() rejects if the user interrupts it; the native controls cover that case.
    void video.play().catch(() => undefined);
  }

  return (
    <div className="relative flex w-full items-center justify-center">
      <video
        ref={videoRef}
        className="max-h-[100dvh] w-full object-contain"
        src={VIDEO_SRC}
        autoPlay
        muted
        playsInline
        controls
        controlsList="nodownload"
        preload="metadata"
        onPlay={() => setStatus("playing")}
        onEnded={() => setStatus("ended")}
        onError={() => setStatus("error")}
      />

      {status !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75 px-4 text-center">
          {status === "error" && (
            <p className="max-w-xs text-lg text-primary-50">
              Não foi possível carregar o vídeo agora. Tente novamente mais
              tarde.
            </p>
          )}
          <div className="flex w-full max-w-xs flex-col gap-3">
            {status === "ended" && (
              <button
                type="button"
                onClick={replay}
                className="flex h-14 items-center justify-center gap-2 rounded-xl border border-primary-200 text-lg font-medium text-primary-50 transition-colors hover:bg-white/10"
              >
                <RiRestartLine className="h-6 w-6" aria-hidden />
                Reproduzir novamente
              </button>
            )}
            {/* No prefetch: avoids extra Vercel requests until the user taps. */}
            <Link
              href="/"
              prefetch={false}
              className="flex h-14 items-center justify-center rounded-xl bg-primary-500 text-lg font-medium text-bg-blue transition-colors hover:bg-primary-600"
            >
              Conhecer mais
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
