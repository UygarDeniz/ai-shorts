import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Res,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { VideoService } from './video.service.js';
import { PipelineLoggerService } from './pipeline-logger.service.js';
import { CreateVideoDto } from './dto/create-video.dto.js';

@Controller('api/videos')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
    private readonly pipelineLogger: PipelineLoggerService,
  ) {}

  @Post()
  async create(@Body() dto: CreateVideoDto) {
    const video = await this.videoService.create(dto);
    return { id: video.id, status: video.status };
  }

  @Get()
  async findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.videoService.findAll(
      page ? parseInt(page, 10) : 1,
      Math.min(Math.max(1, parsedLimit), 100),
    );
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return this.videoService.retry(id);
  }

  @Get(':id/pipeline')
  async getPipeline(@Param('id') id: string) {
    await this.videoService.findOne(id);
    const pipeline = this.pipelineLogger.load(id);
    if (!pipeline) {
      throw new NotFoundException('Pipeline log not found for this video');
    }
    return pipeline;
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const video = await this.videoService.findOne(id);

    if (!video.finalUrl) {
      throw new NotFoundException('Video file not ready yet');
    }

    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const filePath = path.resolve(
      process.cwd(),
      video.finalUrl.replace(/^\//, ''),
    );

    if (!filePath.startsWith(uploadsRoot)) {
      throw new ForbiddenException('Invalid file path');
    }

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Video file not found on disk');
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="video-${video.id}.mp4"`,
    );

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error reading video file' });
      }
    });
    stream.pipe(res);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.videoService.findOne(id);
  }
}
