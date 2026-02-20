import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as ffmpeg from 'fluent-ffmpeg';
import * as path from 'node:path';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  readonly ffmpegPath: string;
  readonly ffprobePath: string;

  constructor(private readonly configService: ConfigService) {
    const customPath = this.configService.get<string>('ffmpeg.path');
    this.ffmpegPath = customPath ?? ffmpegInstaller.path;
    ffmpeg.default.setFfmpegPath(this.ffmpegPath);

    const derivedFfprobePath = path.join(
      path.dirname(this.ffmpegPath),
      process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe',
    );
    this.ffprobePath = process.env['FFPROBE_PATH'] ?? derivedFfprobePath;
    if (fs.existsSync(this.ffprobePath)) {
      ffmpeg.default.setFfprobePath(this.ffprobePath);
    }
  }

  async mergeVideoAndAudio(
    videoPath: string,
    audioPath: string,
    outputDir: string,
    captionsPath?: string,
  ): Promise<string> {
    const outputPath = path.join(outputDir, 'final.mp4');

    this.logger.log(
      `Merging video and audio${captionsPath ? ' with captions' : ''}`,
    );
    this.logger.debug(`Video: ${videoPath}`);
    this.logger.debug(`Audio: ${audioPath}`);
    if (captionsPath) {
      this.logger.debug(`Captions: ${captionsPath}`);
    }
    this.logger.debug(`Output: ${outputPath}`);

    return new Promise<string>((resolve, reject) => {
      const cmd = ffmpeg.default().input(videoPath).input(audioPath);

      const outputOpts: string[] = [
        '-c:a aac',
        '-b:a 192k',
        '-map 0:v:0',
        '-map 1:a:0',
        '-shortest',
        '-movflags +faststart',
      ];

      if (captionsPath) {
        // Use cwd-relative path to avoid non-ASCII characters in absolute
        // paths breaking FFmpeg's libass filter (e.g. "ü" in "Masaüstü").
        const relativePath = path.relative(process.cwd(), captionsPath);
        const subtitlePath = relativePath
          .replace(/\\/g, '/')
          .replace(/:/g, '\\:');
        cmd.videoFilters(`ass=${subtitlePath}`);
        outputOpts.push('-c:v libx264', '-preset fast', '-crf 23');
      } else {
        outputOpts.push('-c:v copy');
      }

      cmd
        .outputOptions(outputOpts)
        .output(outputPath)
        .on('start', (cmdLine: string) => {
          this.logger.debug(`FFmpeg command: ${cmdLine}`);
        })
        .on('progress', (progress: { percent?: number }) => {
          if (progress.percent) {
            this.logger.debug(
              `Merging progress: ${Math.round(progress.percent)}%`,
            );
          }
        })
        .on('end', () => {
          this.logger.log(`Merge complete: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err: Error) => {
          this.logger.error(`FFmpeg error: ${err.message}`);
          reject(new Error(`FFmpeg merge failed: ${err.message}`));
        })
        .run();
    });
  }

  async concatenateVideos(
    videoPaths: string[],
    outputDir: string,
  ): Promise<string> {
    if (videoPaths.length === 0) {
      throw new Error('At least one video path is required');
    }
    if (videoPaths.length === 1) {
      return videoPaths[0];
    }

    const outputPath = path.join(outputDir, 'video.mp4');
    const listPath = path.join(outputDir, 'concat-list.txt');

    const listContent = videoPaths
      .map((p) => path.resolve(p))
      .map((p) => `file '${p.replace(/\\/g, '/')}'`)
      .join('\n');
    fs.writeFileSync(listPath, listContent, 'utf-8');

    this.logger.log(`Concatenating ${videoPaths.length} video segments`);
    this.logger.debug(`List file: ${listPath}`);

    return new Promise<string>((resolve, reject) => {
      ffmpeg
        .default()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('start', (cmd: string) => {
          this.logger.debug(`FFmpeg concat command: ${cmd}`);
        })
        .on('end', () => {
          try {
            fs.unlinkSync(listPath);
          } catch {
            this.logger.warn(`Could not remove temp list file: ${listPath}`);
          }
          this.logger.log(`Concatenation complete: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err: Error) => {
          try {
            fs.unlinkSync(listPath);
          } catch {
            /* ignore */
          }
          this.logger.error(`FFmpeg concat error: ${err.message}`);
          reject(new Error(`FFmpeg concatenation failed: ${err.message}`));
        })
        .run();
    });
  }
}
