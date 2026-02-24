import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ScriptService } from '../ai/script.service.js';
import { VoiceService, type WordTimestamp } from '../ai/voice.service.js';
import { VideoGenService } from '../ai/video-gen.service.js';
import { MediaService } from '../media/media.service.js';
import { CaptionService } from '../media/caption.service.js';
import {
  PipelineLoggerService,
  PipelineRunData,
} from './pipeline-logger.service.js';
import { VideoService } from './video.service.js';
import { VideoStatus } from '../../generated/prisma/client.js';
import { classifyPipelineError } from './pipeline-errors.js';

interface VideoJobData {
  videoId: string;
  durationSec?: number;
  style?: string;
  captions?: boolean;
  voiceId?: string;
  modelId?: string;
  resolution?: string;
}

interface ScriptResult {
  voiceover: string;
  visualPrompts: string[];
}

interface VoiceResult {
  audioPath: string;
  durationSec: number;
  wordTimestamps: WordTimestamp[];
}

interface VideoResult {
  path: string;
  config: Record<string, any>;
  falVideoUrl: string;
  segments?: { durationSec: number; path: string }[];
}

@Processor('video-generation')
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private readonly videoService: VideoService,
    private readonly scriptService: ScriptService,
    private readonly voiceService: VoiceService,
    private readonly videoGenService: VideoGenService,
    private readonly mediaService: MediaService,
    private readonly captionService: CaptionService,
    private readonly pipelineLogger: PipelineLoggerService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<VideoJobData>): Promise<void> {
    const {
      videoId,
      durationSec: rawDurationSec,
      style: jobStyle,
      captions: jobCaptions,
      voiceId: jobVoiceId,
      modelId: jobModelId,
      resolution: jobResolution,
    } = job.data;
    const requestedDurationSec = rawDurationSec ?? 5;
    const style = jobStyle ?? 'Cinematic';
    const captions = jobCaptions ?? true;
    const modelId = jobModelId ?? 'fast-wan';
    const resolution = jobResolution ?? '480p';
    const uploadsDir = path.resolve(process.cwd(), 'uploads', videoId);
    const voiceId =
      jobVoiceId || this.configService.get<string>('ELEVENLABS_VOICE_ID') || '';

    const previous = this.pipelineLogger.load(videoId);
    const isResume = previous?.status === 'failed' && !!previous.steps;
    if (isResume) {
      this.logger.log(
        `Resuming pipeline for ${videoId} from previous checkpoint`,
      );
    } else {
      this.logger.log(`Starting video generation pipeline for ${videoId}`);
    }

    const pipelineData: PipelineRunData = {
      videoId,
      topic: previous?.topic ?? '',
      startedAt: previous?.startedAt ?? new Date().toISOString(),
      status: 'running',
      steps: {},
    };

    const savePipeline = () => this.pipelineLogger.save(pipelineData);

    try {
      const video = await this.videoService.findOne(videoId);
      pipelineData.topic = video.topic;

      // Step 1: Script
      const script = await this.resolveScript(
        previous,
        pipelineData,
        savePipeline,
        videoId,
        video.topic,
        requestedDurationSec,
        style,
      );

      // Step 2: Voice
      const voiceResult = await this.resolveVoice(
        previous,
        pipelineData,
        savePipeline,
        videoId,
        uploadsDir,
        voiceId,
        script,
      );

      // Step 3: Captions (skip if user opted out)
      let captionsPath: string | undefined;
      if (captions) {
        captionsPath = this.resolveCaptions(
          previous,
          pipelineData,
          savePipeline,
          videoId,
          uploadsDir,
          voiceResult.wordTimestamps,
        );
      } else {
        this.logger.log(`[${videoId}] Captions disabled by user, skipping`);
      }

      // Step 4: Video segments
      const styledPrompts = script.visualPrompts.map((p) => `${style}. ${p}`);
      const videoResult = await this.resolveVideo(
        previous,
        pipelineData,
        savePipeline,
        videoId,
        uploadsDir,
        requestedDurationSec,
        voiceResult.durationSec,
        styledPrompts,
        modelId,
        resolution,
      );

      // Step 5: Merge
      await this.resolveMerge(
        previous,
        pipelineData,
        savePipeline,
        videoId,
        uploadsDir,
        requestedDurationSec,
        voiceResult,
        videoResult,
        captionsPath,
      );

      this.logger.log(`[${videoId}] Pipeline completed successfully`);
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`[${videoId}] Pipeline failed: ${rawMessage}`);

      const { userMessage } = classifyPipelineError(rawMessage);

      pipelineData.status = 'failed';
      pipelineData.error = rawMessage;
      pipelineData.completedAt = new Date().toISOString();
      savePipeline();

      await this.videoService.updateStatus(videoId, VideoStatus.failed, {
        error: userMessage,
      });

      throw error;
    }
  }

  private async resolveScript(
    previous: PipelineRunData | null,
    pipelineData: PipelineRunData,
    savePipeline: () => void,
    videoId: string,
    topic: string,
    requestedDurationSec: number,
    style: string,
  ): Promise<ScriptResult> {
    if (previous?.steps.script?.result) {
      const r = previous.steps.script.result;
      const visualPrompts = Array.isArray(r.visualPrompts)
        ? r.visualPrompts
        : [];
      pipelineData.steps.script = previous.steps.script;
      this.logger.log(`[${videoId}] Resuming — script already generated`);
      return { voiceover: r.voiceover, visualPrompts };
    }

    await this.videoService.updateStatus(videoId, VideoStatus.scripting, {
      error: null,
    });

    const scriptStart = Date.now();
    const script = await this.scriptService.generateScript(
      topic,
      requestedDurationSec,
      style,
    );
    const scriptDuration = Date.now() - scriptStart;

    pipelineData.steps.script = {
      prompts: script._prompts ?? {
        system: '(not captured)',
        user: `Create a short-form video script about: ${topic}`,
        model: 'gpt-4o-mini',
        temperature: 0.5,
        maxTokens: 300,
        targetDurationSec: requestedDurationSec,
        targetWordRange: `${Math.round(requestedDurationSec * 2)}-${Math.round(requestedDurationSec * 3)}`,
      },
      result: {
        voiceover: script.voiceover,
        visualPrompts: script.visualPrompts,
      },
      durationMs: scriptDuration,
    };
    savePipeline();

    await this.videoService.updateStatus(videoId, VideoStatus.scripting, {
      script: script.voiceover,
      visualPrompt: script.visualPrompts[0],
    });
    this.logger.log(`[${videoId}] Script generated`);

    return {
      voiceover: script.voiceover,
      visualPrompts: script.visualPrompts,
    };
  }

  private async resolveVoice(
    previous: PipelineRunData | null,
    pipelineData: PipelineRunData,
    savePipeline: () => void,
    videoId: string,
    uploadsDir: string,
    voiceId: string,
    script: ScriptResult,
  ): Promise<VoiceResult> {
    const prevVoice = previous?.steps.voice;
    if (prevVoice?.result && fs.existsSync(prevVoice.result.audioPath)) {
      pipelineData.steps.voice = prevVoice;
      this.logger.log(`[${videoId}] Resuming — voice already generated`);

      const timestampsPath = path.join(uploadsDir, 'word-timestamps.json');
      let wordTimestamps: WordTimestamp[] = [];
      if (fs.existsSync(timestampsPath)) {
        try {
          wordTimestamps = JSON.parse(
            fs.readFileSync(timestampsPath, 'utf-8'),
          ) as WordTimestamp[];
        } catch {
          this.logger.warn(
            `[${videoId}] Could not load cached word timestamps`,
          );
        }
      }

      return {
        audioPath: prevVoice.result.audioPath,
        durationSec: prevVoice.result.audioDurationSec,
        wordTimestamps,
      };
    }

    await this.videoService.updateStatus(videoId, VideoStatus.voicing, {
      error: null,
    });

    const voiceStart = Date.now();
    const voiceResult = await this.voiceService.generateSpeech(
      script.voiceover,
      uploadsDir,
      voiceId,
    );
    const voiceDuration = Date.now() - voiceStart;

    const timestampsPath = path.join(uploadsDir, 'word-timestamps.json');
    fs.writeFileSync(
      timestampsPath,
      JSON.stringify(voiceResult.wordTimestamps),
      'utf-8',
    );

    pipelineData.steps.voice = {
      input: { text: script.voiceover, voiceId },
      result: {
        audioPath: voiceResult.audioPath,
        audioDurationSec: voiceResult.durationSec,
      },
      durationMs: voiceDuration,
    };
    savePipeline();

    await this.videoService.updateStatus(videoId, VideoStatus.voicing, {
      audioUrl: `/uploads/${videoId}/audio.mp3`,
    });
    this.logger.log(`[${videoId}] Voice generated`);

    return voiceResult;
  }

  private resolveCaptions(
    previous: PipelineRunData | null,
    pipelineData: PipelineRunData,
    savePipeline: () => void,
    videoId: string,
    uploadsDir: string,
    wordTimestamps: WordTimestamp[],
  ): string | undefined {
    if (wordTimestamps.length === 0) {
      this.logger.warn(`[${videoId}] No word timestamps, skipping captions`);
      return undefined;
    }

    const captionsFile = path.join(uploadsDir, 'captions.ass');
    const prevCaptions = previous?.steps.captions as
      | {
          input?: { wordCount: number; phraseCount: number };
          result: { captionsPath: string };
          durationMs?: number;
        }
      | undefined;
    if (prevCaptions?.result?.captionsPath && fs.existsSync(captionsFile)) {
      pipelineData.steps.captions = prevCaptions;
      this.logger.log(`[${videoId}] Resuming — captions already generated`);
      return captionsFile;
    }

    const captionsStart = Date.now();
    const phrases = this.captionService.groupWordsIntoPhrases(wordTimestamps);
    const captionsPath = this.captionService.generateAssFile(
      phrases,
      uploadsDir,
    );
    const captionsDuration = Date.now() - captionsStart;

    pipelineData.steps.captions = {
      input: { wordCount: wordTimestamps.length, phraseCount: phrases.length },
      result: { captionsPath },
      durationMs: captionsDuration,
    };
    savePipeline();

    this.logger.log(
      `[${videoId}] Captions generated (${phrases.length} phrases)`,
    );

    return captionsPath;
  }

  private async resolveVideo(
    previous: PipelineRunData | null,
    pipelineData: PipelineRunData,
    savePipeline: () => void,
    videoId: string,
    uploadsDir: string,
    requestedDurationSec: number,
    audioDurationSec: number,
    styledPrompts: string[],
    modelId: string,
    resolution: string,
  ): Promise<VideoResult> {
    const prevVideo = previous?.steps.video;
    if (
      prevVideo?.result?.videoPath &&
      fs.existsSync(prevVideo.result.videoPath)
    ) {
      pipelineData.steps.video = prevVideo;
      this.logger.log(`[${videoId}] Resuming — video already generated`);
      return {
        path: prevVideo.result.videoPath,
        falVideoUrl: prevVideo.result.falVideoUrl ?? 'resumed',
        config: {
          estimatedDurationSec: prevVideo.result.generatedDurationSec,
          isDurationCapped: prevVideo.result.isDurationCapped ?? false,
          resolution: prevVideo.input.resolution,
          ...(prevVideo.input.providerConfig || {}),
        },
        segments: prevVideo.result.segments as
          | { durationSec: number; path: string }[]
          | undefined,
      };
    }

    await this.videoService.updateStatus(videoId, VideoStatus.generating, {
      error: null,
    });

    const videoStart = Date.now();
    const videoResult = await this.videoGenService.generateVideo(
      modelId,
      resolution,
      styledPrompts,
      uploadsDir,
      audioDurationSec,
    );
    const videoDuration = Date.now() - videoStart;

    pipelineData.steps.video = {
      input: {
        prompts: styledPrompts,
        aspectRatio: '9:16',
        resolution,
        modelId,
        providerConfig: videoResult.config,
        requestedTargetDurationSec: requestedDurationSec,
        sourceAudioDurationSec: audioDurationSec,
      },
      result: {
        videoPath: videoResult.path,
        falVideoUrl: videoResult.falVideoUrl,
        generatedDurationSec: Number(
          videoResult.config['estimatedDurationSec'] || 0,
        ),
        isDurationCapped: Boolean(videoResult.config['isDurationCapped']),
        ...(videoResult.segments && { segments: videoResult.segments }),
      },
      durationMs: videoDuration,
    };
    savePipeline();

    await this.videoService.updateStatus(videoId, VideoStatus.generating, {
      videoUrl: `/uploads/${videoId}/video.mp4`,
    });
    this.logger.log(`[${videoId}] Video generated`);

    return videoResult;
  }

  private async resolveMerge(
    previous: PipelineRunData | null,
    pipelineData: PipelineRunData,
    savePipeline: () => void,
    videoId: string,
    uploadsDir: string,
    requestedDurationSec: number,
    voiceResult: VoiceResult,
    videoResult: VideoResult,
    captionsPath?: string,
  ): Promise<void> {
    const finalOnDisk = path.join(uploadsDir, 'final.mp4');
    if (previous?.steps.merge?.result && fs.existsSync(finalOnDisk)) {
      pipelineData.steps.merge = previous.steps.merge;
      pipelineData.status = 'completed';
      pipelineData.completedAt = new Date().toISOString();
      savePipeline();
      await this.videoService.updateStatus(videoId, VideoStatus.completed, {
        finalUrl: `/uploads/${videoId}/final.mp4`,
        error: null,
      });
      this.logger.log(`[${videoId}] Resuming — merge already completed`);
      return;
    }

    await this.videoService.updateStatus(videoId, VideoStatus.merging, {
      error: null,
    });

    const mergeStart = Date.now();
    const finalPath = await this.mediaService.mergeVideoAndAudio(
      videoResult.path,
      voiceResult.audioPath,
      uploadsDir,
      captionsPath,
    );
    const mergeDuration = Date.now() - mergeStart;

    pipelineData.steps.merge = {
      input: {
        requestedTargetDurationSec: requestedDurationSec,
        sourceAudioDurationSec: voiceResult.durationSec,
        hasCaptions: !!captionsPath,
      },
      result: { finalPath },
      durationMs: mergeDuration,
    };
    pipelineData.status = 'completed';
    pipelineData.completedAt = new Date().toISOString();
    savePipeline();

    await this.videoService.updateStatus(videoId, VideoStatus.completed, {
      finalUrl: `/uploads/${videoId}/final.mp4`,
    });
    this.logger.log(`[${videoId}] Merge completed`);
  }
}
