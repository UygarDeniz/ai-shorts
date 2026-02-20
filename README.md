# AI Short-Form Video Generator

Generate AI-powered short-form videos for YouTube Shorts, TikTok, and Instagram Reels. Enter a topic and get a publish-ready vertical video — 100% AI generated.

## Tech Stack

- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL + BullMQ + Redis
- **Frontend:** Next.js + Tailwind CSS + shadcn/ui
- **AI Services:** OpenAI GPT-4 (script), ElevenLabs (voice), fal.ai WAN (video)
- **Media:** FFmpeg for merging video + audio

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- FFmpeg installed and available in PATH
- API keys: OpenAI, ElevenLabs, fal.ai

## Getting Started

### 1. Start PostgreSQL & Redis

```bash
docker compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379) with persistent volumes.

### 2. Backend

```bash
cd backend
cp .env.example .env    # Edit with your API keys
npm install
npx prisma migrate dev --name init
npm run start:dev
```

Backend runs on `http://localhost:3001`

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

## API Endpoints

| Method | Path                        | Description                    |
| ------ | --------------------------- | ------------------------------ |
| POST   | `/api/videos`               | Create a new video generation  |
| GET    | `/api/videos`               | List all videos (paginated)    |
| GET    | `/api/videos/:id`           | Get video status and details   |
| GET    | `/api/videos/:id/download`  | Download the final MP4         |

## How It Works

1. User enters a topic
2. GPT-4 generates a voiceover script and visual scene description
3. ElevenLabs converts the script to speech (MP3)
4. fal.ai WAN generates a 5-second 9:16 video (MP4)
5. FFmpeg merges video + audio into the final output
