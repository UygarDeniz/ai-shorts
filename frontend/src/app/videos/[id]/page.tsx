"use client";

import { use } from "react";
import { z } from "zod";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/video-player";
import { getVideo, retryVideo, videosKeys } from "@/lib/api";
import { TERMINAL_STATUSES } from "@/types/video";

const idSchema = z.string().cuid();

export default function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    notFound();
  }

  const queryClient = useQueryClient();

  const {
    data: video,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: videosKeys.detail(id),
    queryFn: () => getVideo(id),
  });

  const retryMutation = useMutation({
    mutationFn: () => retryVideo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: videosKeys.detail(id) });
    },
  });

  const errorMessage =
    isError && error
      ? error instanceof Error
        ? error.message
        : "Failed to load video"
      : null;

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button asChild>
              <Link href="/videos">Back to Videos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !video) {
    return (
      <div className="flex items-center justify-center px-4 py-20">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If video is still in progress, redirect to the progress tracker
  if (!TERMINAL_STATUSES.includes(video.status)) {
    redirect(`/generate/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <Link
          href="/videos"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to My Videos
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-2xl font-bold">{video.topic}</h1>
          <Badge
            variant={video.status === "completed" ? "default" : "destructive"}
            className="shrink-0"
          >
            {video.status}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            {new Date(video.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {video.style && (
            <>
              <span>·</span>
              <span>{video.style}</span>
            </>
          )}
          {video.modelId && (
            <>
              <span>·</span>
              <span>{video.modelId}</span>
            </>
          )}
          {video.resolution && (
            <>
              <span>·</span>
              <span>{video.resolution}</span>
            </>
          )}
        </div>
      </div>

      {video.status === "completed" && video.finalUrl && (
        <div className="mb-8">
          <VideoPlayer finalUrl={video.finalUrl} videoId={video.id} />
        </div>
      )}

      {video.script && (
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Generated Script</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">
              &ldquo;{video.script}&rdquo;
            </p>
          </CardContent>
        </Card>
      )}

      {video.status === "failed" && (
        <Card className="border-destructive">
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-destructive">
              {video.error ?? "An unknown error occurred during generation."}
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
              >
                {retryMutation.isPending ? "Retrying..." : "Retry"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">New Video</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
