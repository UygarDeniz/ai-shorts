import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MediaService } from '../media/media.service.js';

export interface WordTimestamp {
  word: string;
  startSec: number;
  endSec: number;
}

export interface GeneratedSpeechResult {
  audioPath: string;
  durationSec: number;
  wordTimestamps: WordTimestamp[];
}

interface ElevenLabsTimestampResponse {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly apiKey: string;
  private readonly voiceId: string;
  private readonly ffmpegPath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly mediaService: MediaService,
  ) {
    this.apiKey = this.configService.get<string>('elevenlabs.apiKey') ?? '';
    this.voiceId = this.configService.get<string>('elevenlabs.voiceId') ?? '';
    this.ffmpegPath = this.mediaService.ffmpegPath;
  }

  private parseDurationToSeconds(durationText: string): number | null {
    const match = durationText.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!match) return null;

    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    const seconds = Number.parseFloat(match[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  private async probeDurationWithFfmpeg(audioPath: string): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
      const proc = spawn(
        this.ffmpegPath,
        ['-i', audioPath, '-f', 'null', '-'],
        { windowsHide: true },
      );

      let stderr = '';
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to run ffmpeg probe: ${err.message}`));
      });

      proc.on('close', () => {
        const durationSec = this.parseDurationToSeconds(stderr);
        if (!durationSec || Number.isNaN(durationSec)) {
          reject(new Error('Audio duration not found in ffmpeg output'));
          return;
        }
        resolve(durationSec);
      });
    });
  }

  private async getAudioDurationSec(audioPath: string): Promise<number> {
    try {
      return await new Promise<number>((resolve, reject) => {
        ffmpeg.default.ffprobe(audioPath, (err, metadata) => {
          if (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            reject(new Error(`Failed to probe audio duration: ${errMsg}`));
            return;
          }

          const durationSec = metadata.format.duration;
          if (!durationSec || Number.isNaN(durationSec)) {
            reject(new Error('Audio duration not found in ffprobe metadata'));
            return;
          }

          resolve(durationSec);
        });
      });
    } catch (err) {
      this.logger.warn(
        `ffprobe unavailable, falling back to ffmpeg probe: ${err}`,
      );
      return await this.probeDurationWithFfmpeg(audioPath);
    }
  }

  private charsToWords(
    alignment: ElevenLabsTimestampResponse['alignment'],
  ): WordTimestamp[] {
    const {
      characters,
      character_start_times_seconds,
      character_end_times_seconds,
    } = alignment;
    const words: WordTimestamp[] = [];
    let currentWord = '';
    let wordStart = -1;
    let wordEnd = 0;

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i];
      const start = character_start_times_seconds[i];
      const end = character_end_times_seconds[i];

      if (char === ' ' || char === '\n' || char === '\t') {
        if (currentWord) {
          words.push({
            word: currentWord,
            startSec: wordStart,
            endSec: wordEnd,
          });
          currentWord = '';
          wordStart = -1;
        }
        continue;
      }

      if (wordStart < 0) {
        wordStart = start;
      }
      currentWord += char;
      wordEnd = end;
    }

    if (currentWord) {
      words.push({ word: currentWord, startSec: wordStart, endSec: wordEnd });
    }

    return words;
  }

  async generateSpeech(
    text: string,
    outputDir: string,
    voiceId?: string,
  ): Promise<GeneratedSpeechResult> {
    const effectiveVoiceId = voiceId || this.voiceId;
    this.logger.log(
      `Generating speech for text (${text.length} chars) with voice ${effectiveVoiceId}`,
    );

    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'audio.mp3');

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${effectiveVoiceId}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `ElevenLabs API error (${response.status}): ${errorBody}`,
      );
    }

    const data = (await response.json()) as ElevenLabsTimestampResponse;

    const audioBuffer = Buffer.from(data.audio_base64, 'base64');
    fs.writeFileSync(outputPath, audioBuffer);

    const wordTimestamps = this.charsToWords(data.alignment);
    const durationSec = await this.getAudioDurationSec(outputPath);

    this.logger.log(
      `Audio saved to ${outputPath} (${audioBuffer.length} bytes, ${durationSec.toFixed(2)}s, ${wordTimestamps.length} words)`,
    );

    return { audioPath: outputPath, durationSec, wordTimestamps };
  }
}
