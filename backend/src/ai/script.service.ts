import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { EnvironmentVariables } from '../env.validation.js';

export interface GeneratedScript {
  voiceover: string;
  visualPrompts: string[];
}

export interface ScriptGenerationResult extends GeneratedScript {
  _prompts?: {
    system: string;
    user: string;
    model: string;
    temperature: number;
    maxTokens: number;
    targetDurationSec: number;
    targetWordRange: string;
  };
}

@Injectable()
export class ScriptService {
  private readonly logger = new Logger(ScriptService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY', { infer: true }),
    });
  }

  async generateScript(
    topic: string,
    targetDurationSec = 5,
    style = 'Cinematic',
  ): Promise<ScriptGenerationResult> {
    this.logger.log(
      `Generating script for topic: "${topic}" style: "${style}"`,
    );
    const minWords = Math.max(8, Math.round(targetDurationSec * 2));
    const maxWords = Math.max(minWords + 2, Math.round(targetDurationSec * 3));
    const targetWordRange = `${minWords}-${maxWords}`;

    const segmentCount = Math.ceil(targetDurationSec / 5);

    const visualPromptsInstruction =
      segmentCount === 1
        ? `2. "visualPrompts": An array containing exactly 1 cinematic scene description (40-60 words) optimized for AI video generation. It MUST directly depict the same topic from the voiceover. Describe camera angle, lighting, atmosphere, colors, and motion. Do NOT mention text overlays or UI elements.`
        : `2. "visualPrompts": An array of exactly ${segmentCount} cinematic scene descriptions (each 40-60 words), one per ~5-second video segment. Together they must form a natural visual progression depicting the voiceover topic—e.g. wide establishing shot → medium shot → close-up detail, or a sequence of related actions. Describe camera angle, lighting, atmosphere, colors, and motion for each. Do NOT mention text overlays or UI elements.`;

    const systemPrompt = `You are an expert short-form video scriptwriter for YouTube Shorts, TikTok, and Instagram Reels.

Given a topic, produce a JSON object with exactly two fields:

1. "voiceover": A concise narration script designed to be spoken aloud in about ${targetDurationSec} seconds (roughly ${targetWordRange} words at natural speed). It must stay specific to the user topic and include one concrete detail (for example a year, place, person, or number). Do NOT include stage directions or timestamps.

${visualPromptsInstruction}

Visual style: ${style}. Apply this style as a visual filter — the scene must still clearly depict the TOPIC first. The style affects colors, mood, and atmosphere, but should never replace the subject matter.

Relevance requirements (CRITICAL — the #1 priority):
- The visual prompt must depict the TOPIC directly — a viewer should understand the topic from the visuals alone.
- Style is secondary: it changes HOW the scene looks, not WHAT the scene shows.
- Every visual prompt must visually support the same point as the voiceover.

Respond ONLY with valid JSON. No markdown, no extra text.`;
    const userPrompt = `Create a short-form video script about: ${topic}`;

    const model = 'gpt-4o-mini';
    const defaultTemp = model.includes('gpt-5-mini') ? 1 : 0.5;
    const temperature = defaultTemp;

    const schemaProperties: Record<string, unknown> = {
      voiceover: {
        type: 'string',
        description: `Concise narration script for ~${targetDurationSec}s voiceover`,
      },
      visualPrompts: {
        type: 'array',
        items: { type: 'string' },
        description: `Array of ${segmentCount} cinematic scene descriptions (40-60 words each)`,
      },
    };
    const schemaRequired: string[] = ['voiceover', 'visualPrompts'];

    const maxTokens = Math.min(800, 300 + segmentCount * 100);

    const completion = await this.openai.chat.completions.create({
      model,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'video_script',
          schema: {
            type: 'object',
            properties: schemaProperties,
            required: schemaRequired,
            additionalProperties: false,
          },
          strict: true,
        },
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_completion_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      this.logger.warn('OpenAI returned empty content');
      throw new Error('OpenAI response missing content');
    }

    const parsed = JSON.parse(content) as GeneratedScript;
    if (!parsed.voiceover) {
      throw new Error('OpenAI response missing required field: voiceover');
    }
    if (
      !Array.isArray(parsed.visualPrompts) ||
      parsed.visualPrompts.length === 0
    ) {
      throw new Error(
        'OpenAI response missing required field: visualPrompts (expected non-empty array)',
      );
    }

    this.logger.log(
      `Script generated: ${parsed.visualPrompts.length} visual prompt(s)`,
    );
    this.logger.debug(`Voiceover: ${parsed.voiceover}`);
    parsed.visualPrompts.forEach((vp, i) => {
      this.logger.debug(`Visual prompt ${i + 1}: ${vp}`);
    });

    return {
      ...parsed,
      _prompts: {
        system: systemPrompt,
        user: userPrompt,
        model,
        temperature,
        maxTokens,
        targetDurationSec,
        targetWordRange,
      },
    };
  }
}
