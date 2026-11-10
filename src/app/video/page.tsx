import { type Metadata } from "next";
import { VideoPlayer } from "./video-player";

export const metadata: Metadata = {
  title: "Cachoeira das Araras | Vídeo",
  description: "Conheça a Cachoeira das Araras em Pirenópolis-GO.",
};

// Fully static page: no data fetching, so Vercel serves it from the CDN.
export default function VideoPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-black">
      <VideoPlayer />
    </main>
  );
}
