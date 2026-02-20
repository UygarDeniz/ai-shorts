import { Logger } from '@nestjs/common';
import { fal } from '@fal-ai/client';
import * as fs from 'node:fs';
import {
  GenerateVideoOpts,
  GeneratedVideoSegment,
  VideoModelProvider,
} from '../video-model.types.js';

export class ViduQ3TurboProvider implements VideoModelProvider {
  private readonly logger = new Logger(ViduQ3TurboProvider.name);

  async generateSegment(
    prompt: string,
    outputPath: string,
    opts: GenerateVideoOpts,
    segmentIndex: number,
  ): Promise<GeneratedVideoSegment> {
    const safeDurationSec = Math.min(
      8,
      Math.max(2, Math.round(opts.durationSec)),
    );

    this.logger.log(
      `ViduQ3Turbo generating segment ${segmentIndex + 1}: ${opts.durationSec.toFixed(2)}s (rounded to ${safeDurationSec}s) at ${opts.resolution}`,
    );

    const result = await fal.subscribe('fal-ai/vidu/q3/text-to-video/turbo', {
      input: {
        prompt,
        duration: safeDurationSec,
        aspect_ratio: opts.aspectRatio,
        resolution: opts.resolution,
        audio: false,
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
    });

    const data = result.data as { video?: { url?: string } };
    if (!data?.video?.url) {
      throw new Error('fal.ai returned no video URL for Vidu Q3 Turbo');
    }

    const response = await fetch(data.video.url);
    if (!response.ok) {
      throw new Error(`Failed to download video segment: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));

    return {
      path: outputPath,
      durationSec: safeDurationSec,
      falConfigInfo: {
        resolution: opts.resolution,
        duration: safeDurationSec,
        estimatedDurationSec: safeDurationSec,
      },
    };
  }
}
