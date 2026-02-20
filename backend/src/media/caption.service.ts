import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WordTimestamp } from '../ai/voice.service.js';

export interface CaptionPhrase {
  text: string;
  startSec: number;
  endSec: number;
  words: WordTimestamp[];
}

@Injectable()
export class CaptionService {
  private readonly logger = new Logger(CaptionService.name);

  groupWordsIntoPhrases(
    words: WordTimestamp[],
    maxWordsPerPhrase = 4,
  ): CaptionPhrase[] {
    const phrases: CaptionPhrase[] = [];

    for (let i = 0; i < words.length; i += maxWordsPerPhrase) {
      const chunk = words.slice(i, i + maxWordsPerPhrase);
      phrases.push({
        text: chunk.map((w) => w.word).join(' '),
        startSec: chunk[0].startSec,
        endSec: chunk[chunk.length - 1].endSec,
        words: chunk,
      });
    }

    return phrases;
  }

  generateAssFile(
    phrases: CaptionPhrase[],
    outputDir: string,
    resolution: { width: number; height: number } = {
      width: 720,
      height: 1280,
    },
  ): string {
    const outputPath = path.join(outputDir, 'captions.ass');
    const fontSize = Math.round(resolution.width / 12);
    const marginV = Math.round(resolution.height * 0.12);

    const header = `[Script Info]
Title: Auto-generated captions
ScriptType: v4.00+
PlayResX: ${resolution.width}
PlayResY: ${resolution.height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

    const events = phrases
      .map((phrase) => {
        const start = this.formatAssTime(phrase.startSec);
        const end = this.formatAssTime(phrase.endSec);
        const text = phrase.text.replace(/\n/g, '\\N');
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
      })
      .join('\n');

    const assContent = `${header}\n${events}\n`;
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, assContent, 'utf-8');

    this.logger.log(
      `Caption file written: ${outputPath} (${phrases.length} phrases)`,
    );

    return outputPath;
  }

  private formatAssTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const sWhole = Math.floor(s);
    const cs = Math.round((s - sWhole) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(sWhole).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }
}
