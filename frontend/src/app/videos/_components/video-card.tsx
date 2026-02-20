import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Video, VideoStatus } from "@/types/video";
import { TERMINAL_STATUSES } from "@/types/video";

interface VideoCardProps {
  video: Video;
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  completed: "default",
  failed: "destructive",
  queued: "outline",
};

function getStatusVariant(
  status: VideoStatus,
): "default" | "secondary" | "destructive" | "outline" {
  return STATUS_VARIANT[status] ?? "secondary";
}

export function VideoCard({ video }: VideoCardProps) {
  const href = TERMINAL_STATUSES.includes(video.status)
    ? `/videos/${video.id}`
    : `/generate/${video.id}`;

  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-shadow hover:shadow-lg h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm line-clamp-2 leading-snug">
              {video.topic}
            </h3>
            <Badge
              variant={getStatusVariant(video.status)}
              className="shrink-0 text-xs"
            >
              {video.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          {video.script && (
            <p className="text-xs text-muted-foreground line-clamp-3">
              {video.script}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            {new Date(video.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </CardFooter>
      </Card>
    </Link>
  );
}
