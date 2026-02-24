export default () => ({
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  database: {
    url: process.env['DATABASE_URL'],
  },
  redis: {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  },
  openai: {
    apiKey: process.env['OPENAI_API_KEY'],
  },
  elevenlabs: {
    apiKey: process.env['ELEVENLABS_API_KEY'],
    voiceId: process.env['ELEVENLABS_VOICE_ID'] ?? '21m00Tcm4TlvDq8ikWAM',
  },
  fal: {
    apiKey: process.env['FAL_KEY'],
  },
  pipeline: {
    saveToDisk: process.env['PIPELINE_SAVE_TO_DISK'] !== 'false',
  },
  supabase: {
    url: process.env['SUPABASE_URL'],
  },
  ffmpeg: {
    path: process.env['FFMPEG_PATH'],
  },
});
