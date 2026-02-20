"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getVideos, videosKeys } from "@/lib/api";
import { VideoCard } from "./_components/video-card";

export default function VideosPage() {
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: videosKeys.list(page, limit),
    queryFn: () => getVideos(page, limit),
    placeholderData: keepPreviousData,
  });

  const videos = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const errorMessage =
    isError && error
      ? error instanceof Error
        ? error.message
        : "Failed to load videos"
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">My Videos</h1>

      {errorMessage && (
        <p className="mb-4 text-sm text-destructive">{errorMessage}</p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading videos...</p>
      ) : videos.length === 0 && !errorMessage ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-4">No videos yet.</p>
          <Button asChild>
            <Link href="/">Create your first video</Link>
          </Button>
        </div>
      ) : videos.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
