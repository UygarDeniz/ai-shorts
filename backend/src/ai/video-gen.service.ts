import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fal } from '@fal-ai/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MediaService } from '../media/media.service.js';
import {
  GenerateVideoOpts,
  MODEL_REGISTRY,
  VideoModelProvider,
} from './video-model.types.js';
import { FastWanProvider } from './providers/fast-wan.provider.js';
import { ViduQ3TurboProvider } from './providers/vidu-q3-turbo.provider.js';
import { EnvironmentVariables } from '../env.validation.js';

@Injectable()
export class VideoGenService {
  private readonly logger = new Logger(VideoGenService.name);
  private readonly providers: Record<string, VideoModelProvider>;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly mediaService: MediaService,
  ) {
    fal.config({
      credentials: this.configService.get('FAL_KEY', { infer: true }),
    });

    this.providers = {
      'fast-wan': new FastWanProvider(),
      'vidu-q3-turbo': new ViduQ3TurboProvider(),
    };
  }

  /** fal.ai min 17 frames; at 24fps ≈ 0.71s for fast-wan. Vidu relies on ints. Let's use 1 second min */
  private static readonly MIN_SEGMENT_SEC = 1;

  /** Retries for transient network errors (fetch failed, ECONNRESET, etc.) */
  private static readonly SEGMENT_RETRIES = 3;

  private static isRetryableError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|network/i.test(
      msg,
    );
  }

  private computeSegments(
    targetDurationSec: number,
    maxSegmentDurationSec: number,
  ): number[] {
    if (targetDurationSec <= maxSegmentDurationSec) {
      return [Math.max(targetDurationSec, VideoGenService.MIN_SEGMENT_SEC)];
    }
    const segments: number[] = [];
    let remaining = targetDurationSec;
    while (remaining > 0.01) {
      let chunk = Math.min(maxSegmentDurationSec, remaining);
      if (chunk < VideoGenService.MIN_SEGMENT_SEC) {
        if (segments.length > 0) {
          const prev = segments[segments.length - 1];
          if (prev + chunk <= maxSegmentDurationSec) {
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

  private async generateVideoSegment(
    provider: VideoModelProvider,
    prompt: string,
    outputDir: string,
    opts: GenerateVideoOpts,
    segmentIndex: number,
  ) {
    const outputPath = path.join(outputDir, `part${segmentIndex + 1}.mp4`);

    let lastError: unknown;
    for (
      let attempt = 1;
      attempt <= VideoGenService.SEGMENT_RETRIES;
      attempt++
    ) {
      try {
        return await provider.generateSegment(
          prompt,
          outputPath,
          opts,
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

  async generateVideo(
    modelId: string,
    resolution: string,
    visualPrompts: string[],
    outputDir: string,
    targetDurationSec: number,
  ): Promise<{
    path: string;
    falVideoUrl: string;
    config: Record<string, unknown>;
    segments?: { durationSec: number; path: string }[];
  }> {
    const modelInfo = MODEL_REGISTRY[modelId] || MODEL_REGISTRY['fast-wan'];
    const provider = this.providers[modelInfo.id];
    if (!provider) {
      throw new Error(`Video model provider not found for ${modelId}`);
    }

    const segments = this.computeSegments(
      targetDurationSec,
      modelInfo.maxSegmentDurationSec,
    );
    this.logger.log(
      `Generating video using ${modelInfo.id} (${resolution}): ${targetDurationSec.toFixed(2)}s in ${segments.length} segment(s)`,
    );

    fs.mkdirSync(outputDir, { recursive: true });

    const prompts = segments.map(
      (_, i) => visualPrompts[Math.min(i, visualPrompts.length - 1)],
    );

    const segmentPaths: string[] = [];
    const generatedSegments = [];

    for (let i = 0; i < segments.length; i++) {
      const existingPath = path.join(outputDir, `part${i + 1}.mp4`);
      if (fs.existsSync(existingPath) && fs.statSync(existingPath).size > 0) {
        this.logger.log(`Segment ${i + 1} already exists, skipping`);
        segmentPaths.push(existingPath);

        // Push a dummy segment config based on the request just so we have complete data for resume
        generatedSegments.push({
          path: existingPath,
          durationSec: segments[i],
          falConfigInfo: { resumed: true, resolution },
        });
        continue;
      }
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 1500));
      }

      const opts: GenerateVideoOpts = {
        durationSec: segments[i],
        resolution: resolution || modelInfo.defaultResolution,
        aspectRatio: '9:16', // Keeping 9:16 hardcoded for shorts aspect ratio for now
      };

      const result = await this.generateVideoSegment(
        provider,
        prompts[i],
        outputDir,
        opts,
        i,
      );

      segmentPaths.push(result.path);
      generatedSegments.push(result);
    }

    const totalDurationSec = generatedSegments.reduce(
      (sum, seg) => sum + seg.durationSec,
      0,
    );
    const segmentInfos = generatedSegments.map((seg) => ({
      durationSec: seg.durationSec,
      path: seg.path,
    }));

    // Use the first segment's config as the main config
    const mainConfig = generatedSegments[0]?.falConfigInfo || {};

    if (segmentPaths.length === 1) {
      const outputPath = path.join(outputDir, 'video.mp4');
      fs.copyFileSync(segmentPaths[0], outputPath);
      return {
        path: outputPath,
        falVideoUrl: 'single-segment',
        config: {
          ...mainConfig,
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
        ...mainConfig,
        targetDurationSec,
        estimatedDurationSec: totalDurationSec,
      },
      segments: segmentInfos,
    };
  }
}
