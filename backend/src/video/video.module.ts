import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VideoController } from './video.controller.js';
import { VideoService } from './video.service.js';
import { VideoProcessor } from './video.processor.js';
import { PipelineLoggerService } from './pipeline-logger.service.js';
import { AiModule } from '../ai/ai.module.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'video-generation' }),
    AiModule,
    MediaModule,
  ],
  controllers: [VideoController],
  providers: [VideoService, VideoProcessor, PipelineLoggerService],
})
export class VideoModule {}
