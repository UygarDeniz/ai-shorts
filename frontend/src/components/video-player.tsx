"use client";

import { Button } from "@/components/ui/button";
import { getBackendUrl } from "@/lib/api-client";

interface VideoPlayerProps {
  finalUrl: string;
  videoId: string;
}

export function VideoPlayer({ finalUrl, videoId }: VideoPlayerProps) {
  const fullUrl = getBackendUrl(finalUrl);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative overflow-hidden rounded-xl border bg-black shadow-2xl"
        style={{ maxWidth: 360 }}
      >
        <video
          src={fullUrl}
          controls
          muted
          autoPlay
          loop
          playsInline
          className="aspect-9/16 w-full object-contain"
        />
      </div>

      <div className="flex gap-3">
        <Button asChild>
          <a href={fullUrl} download={`video-${videoId}.mp4`}>
            Download MP4
          </a>
        </Button>
      </div>
    </div>
  );
}
