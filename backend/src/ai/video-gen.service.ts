import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fal } from '@fal-ai/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MediaService } from '../media/media.service.js';

interface FalVideoResult {
  video: {
    url: string;
    content_type: string;
    file_name: string;
    file_size: number;
  };
  seed: number;
  prompt: string;
}

export interface VideoGenerationConfig {
  targetDurationSec: number;
  framesPerSecond: number;
  numFrames: number;
  estimatedDurationSec: number;
  isDurationCapped: boolean;
  resolution: '480p' | '580p' | '720p';
}

@Injectable()
export class VideoGenService {
  private readonly logger = new Logger(VideoGenService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mediaService: MediaService,
  ) {
    fal.config({
      credentials: this.configService.get<string>('fal.apiKey'),
    });
  }

  /** FastWan produces up to 5 seconds of video (per fal.ai docs). */
  private static readonly MAX_DURATION_SEC = 5;

  /** fal.ai min 17 frames; at 24fps ≈ 0.71s */
  private static readonly MIN_SEGMENT_SEC = 17 / 24;

  /** Retries for transient network errors (fetch failed, ECONNRESET, etc.) */
  private static readonly SEGMENT_RETRIES = 3;

  private static isRetryableError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|network/i.test(
      msg,
    );
  }

  private computeSegments(targetDurationSec: number): number[] {
    if (targetDurationSec <= VideoGenService.MAX_DURATION_SEC) {
      return [Math.max(targetDurationSec, VideoGenService.MIN_SEGMENT_SEC)];
    }
    const segments: number[] = [];
    let remaining = targetDurationSec;
    while (remaining > 0.01) {
      let chunk = Math.min(VideoGenService.MAX_DURATION_SEC, remaining);
      if (chunk < VideoGenService.MIN_SEGMENT_SEC) {
        if (segments.length > 0) {
          const prev = segments[segments.length - 1];
          if (prev + chunk <= VideoGenService.MAX_DURATION_SEC) {
            segments[segments.length - 1] = prev + chunk;
            remaining -= chunk;
            continue;
          }
        }
        chunk = VideoGenService.MIN_SEGMENT_SEC;
      }
      segments.push(chunk);
      remaining -= chunk;
    }
    return segments;
  }

  private buildGenerationConfig(
    targetDurationSec: number,
  ): VideoGenerationConfig {
    const minFps = 4;
    const maxFps = 60;
    const preferredFps = 24;
    const minFrames = 17;
    const maxFrames = 161;

    const safeDurationSec = Math.min(
      VideoGenService.MAX_DURATION_SEC,
      Math.max(0.1, targetDurationSec),
    );
    const maxFpsFromFrameLimit = Math.floor(maxFrames / safeDurationSec);
    const framesPerSecond = Math.max(
      minFps,
      Math.min(preferredFps, maxFps, maxFpsFromFrameLimit),
    );

    let numFrames = Math.ceil(safeDurationSec * framesPerSecond);
    numFrames = Math.max(minFrames, Math.min(maxFrames, numFrames));
    const estimatedDurationSec = numFrames / framesPerSecond;

    return {
      targetDurationSec: safeDurationSec,
      framesPerSecond,
      numFrames,
      estimatedDurationSec,
      isDurationCapped: estimatedDurationSec < safeDurationSec,
      resolution: '480p',
    };
  }

  private async generateVideoSegment(
    prompt: string,
    outputDir: string,
    durationSec: number,
    segmentIndex: number,
  ): Promise<string> {
    const config = this.buildGenerationConfig(durationSec);
    const outputPath = path.join(outputDir, `part${segmentIndex + 1}.mp4`);

    this.logger.log(
      `Generating segment ${segmentIndex + 1}: ${durationSec.toFixed(2)}s, ${config.numFrames} frames`,
    );

    let lastError: unknown;
    for (
      let attempt = 1;
      attempt <= VideoGenService.SEGMENT_RETRIES;
      attempt++
    ) {
      try {
        return await this.runSegmentGeneration(
          prompt,
          outputPath,
          config,
          segmentIndex,
        );
      } catch (err: unknown) {
        lastError = err;
        if (
          attempt < VideoGenService.SEGMENT_RETRIES &&
          VideoGenService.isRetryableError(err)
        ) {
          const delayMs = attempt * 2000;
          this.logger.warn(
            `Segment ${segmentIndex + 1} attempt ${attempt} failed (${err instanceof Error ? err.message : String(err)}), retrying in ${delayMs / 1000}s...`,
          );
          await new Promise((r) => setTimeout(r, delayMs));
        } else {
          throw err;
        }
      }
    }
    throw lastError;
  }

  private async runSegmentGeneration(
    prompt: string,
    outputPath: string,
    config: VideoGenerationConfig,
    segmentIndex: number,
  ): Promise<string> {
    try {
      const result = await fal.subscribe(
        'fal-ai/wan/v2.2-5b/text-to-video/fast-wan',
        {
          input: {
            prompt,
            aspect_ratio: '9:16',
            resolution: config.resolution,
            frames_per_second: config.framesPerSecond,
            num_frames: config.numFrames,
            interpolator_model: 'none',
            num_interpolated_frames: 0,
            adjust_fps_for_interpolation: false,
            video_quality: 'high',
            enable_prompt_expansion: false,
            video_write_mode: 'fast',
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
              const logs = 'logs' in update ? update.logs : [];
              if (Array.isArray(logs)) {
                logs
                  .map((log: { message: string }) => log.message)
                  .forEach((msg: string) => {
                    this.logger.debug(`fal.ai: ${msg}`);
                  });
              }
            }
          },
        },
      );

      const data = result.data as FalVideoResult;
      if (!data?.video?.url) {
        throw new Error('fal.ai returned no video URL');
      }
      const videoUrl = data.video.url;

      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to download video segment: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(outputPath, buffer);

      this.logger.log(`Segment ${segmentIndex + 1} saved: ${outputPath}`);
      return outputPath;
    } catch (err: unknown) {
      const rawStatus =
        err && typeof err === 'object'
          ? (err as Record<string, unknown>).status
          : undefined;
      let status: string;
      if (rawStatus == null) {
        status = '';
      } else if (typeof rawStatus === 'object') {
        status = JSON.stringify(rawStatus);
      } else {
        status = String(rawStatus as string | number | boolean);
      }
      const body =
        err && typeof err === 'object'
          ? (err as Record<string, unknown>).body
          : null;
      const msg =
        body != null
          ? JSON.stringify(body)
          : err instanceof Error
            ? err.message
            : String(err);
      this.logger.error(
        `fal.ai segment ${segmentIndex + 1} failed (${status || 'unknown'}): ${msg}`,
      );
      throw err;
    }
  }

  async generateVideo(
    visualPrompts: string[],
    outputDir: string,
    targetDurationSec: number,
  ): Promise<{
    path: string;
    falVideoUrl: string;
    config: VideoGenerationConfig;
    segments?: { durationSec: number; path: string }[];
  }> {
    const segments = this.computeSegments(targetDurationSec);
    this.logger.log(
      `Generating video: ${targetDurationSec.toFixed(2)}s in ${segments.length} segment(s)`,
    );

    fs.mkdirSync(outputDir, { recursive: true });

    const prompts = segments.map(
      (_, i) => visualPrompts[Math.min(i, visualPrompts.length - 1)],
    );

    const segmentPaths: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const existingPath = path.join(outputDir, `part${i + 1}.mp4`);
      if (fs.existsSync(existingPath) && fs.statSync(existingPath).size > 0) {
        this.logger.log(`Segment ${i + 1} already exists, skipping`);
        segmentPaths.push(existingPath);
        continue;
      }
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 1500));
      }
      const segmentPath = await this.generateVideoSegment(
        prompts[i],
        outputDir,
        segments[i],
        i,
      );
      segmentPaths.push(segmentPath);
    }

    const totalDurationSec = segments.reduce((a, b) => a + b, 0);
    const config = this.buildGenerationConfig(
      Math.min(targetDurationSec, VideoGenService.MAX_DURATION_SEC),
    );
    const segmentInfos = segments.map((dur, i) => ({
      durationSec: dur,
      path: segmentPaths[i],
    }));

    if (segmentPaths.length === 1) {
      const outputPath = path.join(outputDir, 'video.mp4');
      fs.copyFileSync(segmentPaths[0], outputPath);
      return {
        path: outputPath,
        falVideoUrl: 'single-segment',
        config: {
          ...config,
          targetDurationSec,
          estimatedDurationSec: totalDurationSec,
        },
        segments: segmentInfos,
      };
    }

    const concatenatedPath = await this.mediaService.concatenateVideos(
      segmentPaths,
      outputDir,
    );

    return {
      path: concatenatedPath,
      falVideoUrl: 'concatenated',
      config: {
        ...config,
        targetDurationSec,
        estimatedDurationSec: totalDurationSec,
      },
      segments: segmentInfos,
    };
  }
}
