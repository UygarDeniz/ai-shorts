"use client";

import { use, useEffect } from "react";
import { z } from "zod";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getVideo, retryVideo, videosKeys } from "@/lib/api";
import { TERMINAL_STATUSES } from "@/types/video";
import { ProgressTracker } from "./_components/progress-tracker";

const idSchema = z.string().cuid();
const POLL_INTERVAL = 2000;

export default function GeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    notFound();
  }

  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: video,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: videosKeys.detail(id),
    queryFn: () => getVideo(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return POLL_INTERVAL;
    },
  });

  // Auto-redirect to viewer page when generation is done
  useEffect(() => {
    if (video && TERMINAL_STATUSES.includes(video.status)) {
      router.replace(`/videos/${id}`);
    }
  }, [video, id, router]);

  const retryMutation = useMutation({
    mutationFn: () => retryVideo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: videosKeys.detail(id) });
      refetch();
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
              <Link href="/">Try Again</Link>
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

  return (
    <div className="flex flex-col items-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">Generating Your Video</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">
          &ldquo;{video.topic}&rdquo;
        </p>
      </div>

      <div className="mb-10">
        <ProgressTracker status={video.status} />
      </div>

      {video.script && (
        <Card className="mb-8 w-full max-w-md">
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
        <Card className="w-full max-w-md border-destructive">
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
