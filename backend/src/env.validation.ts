import { z } from 'zod';

const isProduction = process.env.APP_STAGE === 'production';

export const envSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  APP_STAGE: z.enum(['dev', 'production', 'test']).default('dev'),

  // Server
  PORT: z.coerce.number().positive().default(3001),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().startsWith('postgresql://'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().positive().default(6379),

  // Third-party APIs
  OPENAI_API_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_VOICE_ID: z.string().default('21m00Tcm4TlvDq8ikWAM'),
  FAL_KEY: z.string().min(1),

  // Supabase
  SUPABASE_URL: z.string().url(),

  // Pipeline execution
  PIPELINE_SAVE_TO_DISK: z
    .enum(['true', 'false'])
    .default('true')
    .transform((val: string) => val === 'true'),

  // System Dependencies
  FFMPEG_PATH: z.string().optional(),

  // Logging
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'trace'])
    .default(isProduction ? 'info' : 'debug'),
});

export type EnvironmentVariables = z.infer<typeof envSchema>;

export function validate(config: Record<string, any>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));

    result.error.issues.forEach((err) => {
      const path = err.path.join('.');
      console.error(`  ${path}: ${err.message}`);
    });

    throw new Error('Environment validation failed');
  }

  return result.data;
}
