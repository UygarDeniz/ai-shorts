import { api } from "@/lib/api-client";
import type { Video, PaginatedVideos } from "@/types/video";

export const videosKeys = {
  all: ["videos"] as const,
  lists: () => [...videosKeys.all, "list"] as const,
  list: (page: number, limit: number) =>
    [...videosKeys.lists(), page, limit] as const,
  details: () => [...videosKeys.all, "detail"] as const,
  detail: (id: string) => [...videosKeys.details(), id] as const,
};

export async function createVideo(
  topic: string,
  durationSec?: number,
  style?: string,
  captions?: boolean,
  voiceId?: string,
  modelId?: string,
  resolution?: string,
): Promise<{ id: string; status: string }> {
  const payload: {
    topic: string;
    durationSec?: number;
    style?: string;
    captions?: boolean;
    voiceId?: string;
    modelId?: string;
    resolution?: string;
  } = {
    topic,
  };
  if (durationSec !== undefined) {
    payload.durationSec = durationSec;
  }
  if (style) {
    payload.style = style;
  }
  if (captions !== undefined) {
    payload.captions = captions;
  }
  if (voiceId) {
    payload.voiceId = voiceId;
  }
  if (modelId) {
    payload.modelId = modelId;
  }
  if (resolution) {
    payload.resolution = resolution;
  }

  return api.post("/videos", payload);
}

export async function getVideo(id: string): Promise<Video> {
  return api.get(`/videos/${id}`);
}

export async function getVideos(
  page = 1,
  limit = 20,
): Promise<PaginatedVideos> {
  return api.get(`/videos?page=${page}&limit=${limit}`);
}

export async function retryVideo(
  id: string,
): Promise<{ id: string; status: string }> {
  return api.post(`/videos/${id}/retry`);
}
