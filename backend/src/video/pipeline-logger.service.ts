import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PipelineRunData {
  videoId: string;
  topic: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  steps: {
    script?: {
      prompts: {
        system: string;
        user: string;
        model: string;
        temperature: number;
        maxTokens: number;
        targetDurationSec: number;
        targetWordRange: string;
      };
      result: {
        voiceover: string;
        visualPrompts: string[];
      };
      durationMs?: number;
    };
    voice?: {
      input: { text: string; voiceId: string };
      result: { audioPath: string; audioDurationSec: number };
      durationMs?: number;
    };
    video?: {
      input: {
        prompts: string[];
        aspectRatio: string;
        resolution: string;
        modelId?: string;
        providerConfig?: Record<string, any>;
        requestedTargetDurationSec: number;
        sourceAudioDurationSec: number;
      };
      result: {
        videoPath: string;
        falVideoUrl?: string;
        generatedDurationSec: number;
        isDurationCapped?: boolean;
        segments?: { durationSec: number; path: string }[];
      };
      durationMs?: number;
    };
    captions?: {
      input?: { wordCount: number; phraseCount: number };
      result: { captionsPath: string };
      durationMs?: number;
    };
    merge?: {
      input?: {
        requestedTargetDurationSec: number;
        sourceAudioDurationSec: number;
        hasCaptions?: boolean;
      };
      result: { finalPath: string };
      durationMs?: number;
    };
  };
  error?: string;
}

@Injectable()
export class PipelineLoggerService {
  private readonly logger = new Logger(PipelineLoggerService.name);
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.enabled =
      this.configService.get<boolean>('pipeline.saveToDisk') ?? true;
  }

  private getLogPath(videoId: string): string {
    const baseDir = path.resolve(process.cwd(), 'uploads', videoId);
    fs.mkdirSync(baseDir, { recursive: true });
    return path.join(baseDir, 'pipeline.json');
  }

  save(data: PipelineRunData): void {
    if (!this.enabled) return;

    try {
      const logPath = this.getLogPath(data.videoId);
      const json = JSON.stringify(data, null, 2);
      fs.writeFileSync(logPath, json, 'utf-8');
      this.logger.debug(`Pipeline log saved to ${logPath}`);
    } catch (err) {
      this.logger.warn(`Failed to save pipeline log: ${err}`);
    }
  }

  load(videoId: string): PipelineRunData | null {
    try {
      const logPath = this.getLogPath(videoId);
      const json = fs.readFileSync(logPath, 'utf-8');
      return JSON.parse(json) as PipelineRunData;
    } catch {
      return null;
    }
  }
}
