import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateVideoDto } from './dto/create-video.dto.js';
import { VideoStatus, type Video } from '../../generated/prisma/client.js';

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('video-generation') private readonly videoQueue: Queue,
  ) {}

  async create(dto: CreateVideoDto, userId?: string) {
    const durationSec = dto.durationSec ?? 5;
    const style = dto.style ?? 'Cinematic';
    const captions = dto.captions ?? true;
    const voiceId = dto.voiceId ?? '';
    const modelId = dto.modelId ?? 'fast-wan';
    const resolution = dto.resolution ?? '480p';

    const video = await this.prisma.video.create({
      data: {
        topic: dto.topic,
        style,
        captions,
        voiceId,
        modelId,
        resolution,
        userId,
      },
    });

    this.logger.log(
      `Created video record ${video.id} for topic: "${dto.topic}" style: "${style}" captions: ${captions} voiceId: "${voiceId}" userId: "${userId}"`,
    );

    await this.videoQueue.add(
      'generate',
      {
        videoId: video.id,
        durationSec,
        style,
        captions,
        voiceId,
        modelId,
        resolution,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Enqueued generation job for video ${video.id} (${durationSec}s target)`,
    );

    return video;
  }

  async findOne(id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video) {
      throw new NotFoundException(`Video with id "${id}" not found`);
    }
    return video;
  }

  async findAll(page = 1, limit = 20, userId?: string) {
    const skip = (page - 1) * limit;

    const where = userId ? { userId } : {};

    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.video.count({ where }),
    ]);

    return {
      data: videos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async retry(id: string, durationSec?: number) {
    const video: Video = await this.findOne(id);
    if (video.status !== VideoStatus.failed) {
      throw new BadRequestException('Only failed videos can be retried');
    }

    const dur = durationSec ?? 5;

    await this.prisma.video.update({
      where: { id },
      data: { status: VideoStatus.queued, error: null },
    });

    await this.videoQueue.add(
      'generate',
      {
        videoId: id,
        durationSec: dur,
        style: video.style,
        captions: video.captions,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(`Re-enqueued failed video ${id} for retry`);
    return { id, status: VideoStatus.queued };
  }

  async updateStatus(
    id: string,
    status: VideoStatus,
    extra?: Record<string, unknown>,
  ) {
    return this.prisma.video.update({
      where: { id },
      data: { status, ...extra },
    });
  }
}
