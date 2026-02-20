import { Logger } from '@nestjs/common';
import { fal } from '@fal-ai/client';
import * as fs from 'node:fs';
import {
  GenerateVideoOpts,
  GeneratedVideoSegment,
  VideoModelProvider,
} from '../video-model.types.js';

export class FastWanProvider implements VideoModelProvider {
  private readonly logger = new Logger(FastWanProvider.name);

  async generateSegment(
    prompt: string,
    outputPath: string,
    opts: GenerateVideoOpts,
    segmentIndex: number,
  ): Promise<GeneratedVideoSegment> {
    const minFps = 4;
    const maxFps = 60;
    const preferredFps = 24;
    const minFrames = 17;
    const maxFrames = 161;

    const safeDurationSec = Math.min(5, Math.max(0.1, opts.durationSec));
    const maxFpsFromFrameLimit = Math.floor(maxFrames / safeDurationSec);
    const framesPerSecond = Math.max(
      minFps,
      Math.min(preferredFps, maxFps, maxFpsFromFrameLimit),
    );

    let numFrames = Math.ceil(safeDurationSec * framesPerSecond);
    numFrames = Math.max(minFrames, Math.min(maxFrames, numFrames));
    const estimatedDurationSec = numFrames / framesPerSecond;

    this.logger.log(
      `FastWan generating segment ${segmentIndex + 1}: ${opts.durationSec.toFixed(2)}s, ${numFrames} frames at ${opts.resolution}`,
    );

    const result = await fal.subscribe(
      'fal-ai/wan/v2.2-5b/text-to-video/fast-wan',
      {
        input: {
          prompt,
          aspect_ratio: opts.aspectRatio as '9:16' | '16:9' | '1:1',
          resolution: opts.resolution as '480p' | '580p' | '720p',
          frames_per_second: framesPerSecond,
          num_frames: numFrames,
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

    const data = result.data as { video?: { url?: string } };
    if (!data?.video?.url) {
      throw new Error('fal.ai returned no video URL for FastWan');
    }

    const response = await fetch(data.video.url);
    if (!response.ok) {
      throw new Error(`Failed to download video segment: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));

    return {
      path: outputPath,
      durationSec: estimatedDurationSec,
      falConfigInfo: {
        resolution: opts.resolution,
        framesPerSecond,
        numFrames,
        isDurationCapped: estimatedDurationSec < safeDurationSec,
        estimatedDurationSec,
      },
    };
  }
}
