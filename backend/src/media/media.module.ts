import { Module } from '@nestjs/common';
import { MediaService } from './media.service.js';
import { CaptionService } from './caption.service.js';

@Module({
  providers: [MediaService, CaptionService],
  exports: [MediaService, CaptionService],
})
export class MediaModule {}
