export const VIDEO_STATUSES = [
  "queued",
  "scripting",
  "voicing",
  "generating",
  "merging",
  "completed",
  "failed",
] as const;

export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const TERMINAL_STATUSES: readonly VideoStatus[] = [
  "completed",
  "failed",
];

export interface Video {
  id: string;
  topic: string;
  style: string;
  status: VideoStatus;
  script: string | null;
  visualPrompt: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  finalUrl: string | null;
  error: string | null;
  modelId: string;
  resolution: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedVideos {
  data: Video[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
