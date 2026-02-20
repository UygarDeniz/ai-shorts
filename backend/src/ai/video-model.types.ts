export interface GenerateVideoOpts {
  durationSec: number;
  resolution: string;
  aspectRatio: string;
}

export interface GeneratedVideoSegment {
  path: string;
  durationSec: number;
  falConfigInfo: Record<string, unknown>;
}

export interface VideoModelProvider {
  /**
   * Generates a single segment of video based on the prompt and options.
   * Returns the downloaded absolute path to the .mp4 file.
   */
  generateSegment(
    prompt: string,
    outputPath: string,
    opts: GenerateVideoOpts,
    segmentIndex: number,
  ): Promise<GeneratedVideoSegment>;
}

export interface VideoModelInfo {
  id: string;
  label: string;
  description: string;
  maxSegmentDurationSec: number;
  resolutions: string[];
  defaultResolution: string;
  aspectRatios: string[];
  defaultAspectRatio: string;
}

export const MODEL_REGISTRY: Record<string, VideoModelInfo> = {
  'fast-wan': {
    id: 'fast-wan',
    label: 'Fast Wan',
    description: 'Fast, anime & general purpose video generation',
    maxSegmentDurationSec: 5,
    resolutions: ['480p', '580p', '720p'],
    defaultResolution: '480p',
    aspectRatios: ['9:16', '16:9', '1:1'],
    defaultAspectRatio: '9:16',
  },
  'vidu-q3-turbo': {
    id: 'vidu-q3-turbo',
    label: 'Vidu Q3 Turbo',
    description: 'High quality cinematic text-to-video',
    maxSegmentDurationSec: 5, // Per fal.ai vidu api duration enum is [2,3,4,5,6,7,8] seconds. Let's use 4 or 5 as conservative max segments.
    resolutions: ['360p', '540p', '720p', '1080p'],
    defaultResolution: '720p',
    aspectRatios: ['9:16', '16:9', '4:3', '3:4', '1:1'],
    defaultAspectRatio: '9:16',
  },
};
