import { Controller, Get } from '@nestjs/common';
import { VoiceService } from './voice.service.js';

@Controller('api/voices')
export class AiController {
  constructor(private readonly voiceService: VoiceService) {}

  @Get()
  async getVoices() {
    return this.voiceService.getVoices();
  }
}
