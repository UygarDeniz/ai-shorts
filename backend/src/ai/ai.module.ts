import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { ScriptService } from './script.service.js';
import { VoiceService } from './voice.service.js';
import { VideoGenService } from './video-gen.service.js';

@Module({
  imports: [MediaModule],
  providers: [ScriptService, VoiceService, VideoGenService],
  exports: [ScriptService, VoiceService, VideoGenService],
})
export class AiModule {}
