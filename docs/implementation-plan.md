# AI Short-Form Video Generator — Implementation Plan

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Video Generation Pipeline](#video-generation-pipeline)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Phase 1 — Backend Scaffold (NestJS + Prisma + PostgreSQL)](#phase-1--backend-scaffold-nestjs--prisma--postgresql)
- [Phase 2 — AI Service Integrations](#phase-2--ai-service-integrations)
- [Phase 3 — Media Merging](#phase-3--media-merging)
- [Phase 4 — Job Queue and Pipeline Orchestration](#phase-4--job-queue-and-pipeline-orchestration)
- [Phase 5 — REST API](#phase-5--rest-api)
- [Phase 6 — Frontend (Next.js + Tailwind CSS + shadcn/ui)](#phase-6--frontend-nextjs--tailwind-css--shadcnui)
- [Phase 7 — Environment and Configuration](#phase-7--environment-and-configuration)
- [Design Decisions](#design-decisions)
- [GPT-4 Prompt Design](#gpt-4-prompt-design)
- [Future Phases](#future-phases)
  - [Phase 8 — Authentication](#phase-8--authentication)
  - [Phase 9 — Auto-Publishing to Social Platforms](#phase-9--auto-publishing-to-social-platforms)
  - [Phase 10 — Multi-Scene Videos](#phase-10--multi-scene-videos)
  - [Phase 11 — Credits and Billing](#phase-11--credits-and-billing)
  - [Phase 12 — Dashboard and Analytics](#phase-12--dashboard-and-analytics)

---

## Overview

A SaaS platform that generates short-form video content (YouTube Shorts, TikTok, Instagram Reels) entirely with AI. The user provides a topic, and the platform:

1. Generates a voiceover script and visual description using **OpenAI GPT-4**
2. Converts the script to speech using **ElevenLabs TTS**
3. Generates a 5-second video using **fal.ai WAN v2.2-5b**
4. Merges video and audio into a final MP4 using **FFmpeg**

The output is a vertical (9:16) short-form video ready for upload to any platform.

---

## Architecture

```mermaid
flowchart TB
    subgraph frontend [Next.js Frontend]
        UI[Topic Input Page]
        Progress[Progress Tracker]
        Gallery[Video Gallery]
    end

    subgraph backend [NestJS Backend]
        API[REST API Controller]
        Queue[BullMQ Job Queue]
        Worker[Video Pipeline Worker]
    end

    subgraph ai_services [External AI Services]
        GPT4[OpenAI GPT-4]
        ElevenLabs[ElevenLabs TTS]
        FalAI[fal.ai WAN v2.2]
    end

    subgraph infra [Infrastructure]
        DB[(PostgreSQL)]
        Redis[(Redis)]
        Storage[Local File Storage]
        FFmpeg[FFmpeg]
    end

    UI -->|"POST /api/videos"| API
    Progress -->|"GET /api/videos/:id (poll)"| API
    API --> DB
    API --> Queue
    Queue --> Redis
    Queue --> Worker
    Worker -->|"1. Generate script"| GPT4
    Worker -->|"2. Generate voice"| ElevenLabs
    Worker -->|"3. Generate video"| FalAI
    Worker -->|"4. Merge audio+video"| FFmpeg
    Worker --> Storage
    Worker --> DB
    Gallery -->|"GET /api/videos"| API
```

**Stack Summary:**

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Frontend   | Next.js (App Router) + Tailwind CSS + shadcn/ui |
| Backend    | NestJS + TypeScript                 |
| Database   | PostgreSQL + Prisma ORM             |
| Queue      | BullMQ + Redis                      |
| AI Script  | OpenAI GPT-4                        |
| AI Voice   | ElevenLabs Text-to-Speech           |
| AI Video   | fal.ai WAN v2.2-5b (fast-wan)      |
| Merging    | FFmpeg (via fluent-ffmpeg)          |
| Deployment | VPS (backend) + Vercel (frontend)   |

---

## Video Generation Pipeline

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as NestJS API
    participant Q as BullMQ
    participant W as Worker
    participant GPT as OpenAI GPT-4
    participant EL as ElevenLabs
    participant FAL as fal.ai WAN
    participant FF as FFmpeg

    User->>Frontend: Enter topic
    Frontend->>API: POST /api/videos {topic}
    API->>API: Create DB record (status: queued)
    API->>Q: Add job to queue
    API-->>Frontend: Return {id, status: queued}
    Frontend->>Frontend: Start polling GET /api/videos/:id

    Q->>W: Pick up job
    W->>W: Update status: scripting
    W->>GPT: Generate video script from topic
    GPT-->>W: Script text + visual prompt

    W->>W: Update status: voicing
    W->>EL: Generate speech from script
    EL-->>W: Audio file (MP3)

    W->>W: Update status: generating
    W->>FAL: Generate 5s video (9:16 portrait)
    FAL-->>W: Video file (MP4, no audio)

    W->>W: Update status: merging
    W->>FF: Merge video + audio
    FF-->>W: Final MP4

    W->>W: Update status: completed
    Frontend->>API: Poll detects completed
    Frontend->>User: Show video player + download
```

---

## Project Structure

```
some-saas/
├── backend/                        # NestJS application
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── config/
│   │   │   └── configuration.ts    # Environment config
│   │   ├── video/
│   │   │   ├── video.module.ts
│   │   │   ├── video.controller.ts # REST endpoints
│   │   │   ├── video.service.ts    # Business logic
│   │   │   ├── video.processor.ts  # BullMQ worker/processor
│   │   │   └── dto/
│   │   │       ├── create-video.dto.ts
│   │   │       └── video-response.dto.ts
│   │   ├── ai/
│   │   │   ├── ai.module.ts
│   │   │   ├── script.service.ts   # OpenAI GPT-4 integration
│   │   │   ├── voice.service.ts    # ElevenLabs integration
│   │   │   └── video-gen.service.ts# fal.ai integration
│   │   └── media/
│   │       ├── media.module.ts
│   │       └── media.service.ts    # FFmpeg merging
│   ├── prisma/
│   │   └── schema.prisma           # Database schema
│   ├── uploads/                    # Generated files (gitignored)
│   ├── .env                        # API keys
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                       # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # Landing + topic input
│   │   │   ├── generate/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Progress + result page
│   │   │   └── videos/
│   │   │       └── page.tsx        # Video gallery
│   │   ├── components/
│   │   │   ├── topic-form.tsx
│   │   │   ├── progress-tracker.tsx
│   │   │   ├── video-card.tsx
│   │   │   └── video-player.tsx
│   │   └── lib/
│   │       └── api.ts              # Backend API client
│   ├── .env.local
│   ├── package.json
│   └── tailwind.config.ts
│
├── docs/
│   └── implementation-plan.md      # This document
│
└── README.md
```

---

## Database Schema

Prisma schema for PostgreSQL:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Video {
  id          String   @id @default(cuid())
  topic       String
  status      String   @default("queued")
  script      String?  @db.Text
  visualPrompt String? @db.Text
  audioUrl    String?
  videoUrl    String?
  finalUrl    String?
  error       String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Status values:** `queued` | `scripting` | `voicing` | `generating` | `merging` | `completed` | `failed`

---

## API Endpoints

| Method | Path                      | Description                                          |
| ------ | ------------------------- | ---------------------------------------------------- |
| POST   | `/api/videos`             | Accept `{ topic }`, create record, enqueue job, return `{ id, status }` |
| GET    | `/api/videos/:id`         | Return video record with current status and URLs     |
| GET    | `/api/videos`             | List all videos (paginated, newest first)            |
| GET    | `/api/videos/:id/download`| Stream the final MP4 file                            |

---

## Phase 1 — Backend Scaffold (NestJS + Prisma + PostgreSQL)

1. Initialize NestJS project in `backend/` with TypeScript strict mode.
2. Set up Prisma with PostgreSQL using the schema above.
3. Install core dependencies:
   - `@nestjs/config` — environment configuration
   - `@nestjs/bullmq`, `bullmq`, `ioredis` — job queue
   - `@prisma/client`, `prisma` — ORM
4. Configure module structure: `VideoModule`, `AiModule`, `MediaModule`.

---

## Phase 2 — AI Service Integrations

### Script Generation (`ai/script.service.ts`)

- Call OpenAI GPT-4 with a system prompt that produces structured JSON output:
  - `voiceover`: Concise narration text (~30 words for 5 seconds)
  - `visual_prompt`: Cinematic scene description optimized for video generation
- Use `openai` npm package with `response_format: { type: "json_object" }`.

### Voice Generation (`ai/voice.service.ts`)

- Call ElevenLabs TTS API (`/v1/text-to-speech/{voice_id}`)
- Send the `voiceover` text, receive MP3 audio buffer
- Save to `uploads/{videoId}/audio.mp3`
- Use `elevenlabs` npm package or direct HTTP calls.

### Video Generation (`ai/video-gen.service.ts`)

- Call fal.ai WAN v2.2-5b using `@fal-ai/client`
- Parameters:
  - `prompt`: The `visual_prompt` from GPT-4
  - `aspect_ratio`: `"9:16"` (portrait for Shorts/TikTok/Reels)
  - `resolution`: `"720p"`
  - `frames_per_second`: `24`
  - `num_frames`: `81` (default, ~5 seconds at 24fps)
- Use `fal.subscribe()` to wait for the result
- Download the video file and save to `uploads/{videoId}/video.mp4`

---

## Phase 3 — Media Merging

### FFmpeg Merge (`media/media.service.ts`)

- Use `fluent-ffmpeg` Node.js wrapper
- Take the video from fal.ai (MP4, no audio) and audio from ElevenLabs (MP3)
- Merge into a final MP4 at `uploads/{videoId}/final.mp4`
- Trim audio to match video length (5 seconds) or pad with silence
- Output codec: H.264 video + AAC audio for maximum compatibility

---

## Phase 4 — Job Queue and Pipeline Orchestration

### BullMQ Setup

- Configure a `video-generation` queue backed by Redis
- One worker process that handles jobs sequentially

### Video Processor (`video/video.processor.ts`)

- BullMQ worker that runs the full pipeline:
  1. Update status to `scripting` → call `ScriptService`
  2. Update status to `voicing` → call `VoiceService`
  3. Update status to `generating` → call `VideoGenService`
  4. Update status to `merging` → call `MediaService`
  5. Update status to `completed`
- On any failure: set status to `failed`, store error message in DB
- Each step saves output to disk and records the URL/path in the database

---

## Phase 5 — REST API

### Video Controller (`video/video.controller.ts`)

- `POST /api/videos` — Validate input with `CreateVideoDto`, create DB record, add to BullMQ queue, return `{ id, status }`
- `GET /api/videos/:id` — Return full video record including status and all URLs
- `GET /api/videos` — Paginated list (query params: `page`, `limit`), newest first
- `GET /api/videos/:id/download` — Stream `final.mp4` with proper content headers
- Enable CORS for the frontend origin
- Serve static files from `uploads/` directory

---

## Phase 6 — Frontend (Next.js + Tailwind CSS + shadcn/ui)

### Setup

- Initialize Next.js with App Router, TypeScript, Tailwind CSS
- Install shadcn/ui for polished components (button, input, card, progress, badge)

### Landing Page (`app/page.tsx`)

- Hero section explaining the platform purpose
- Large text input for entering the video topic
- "Generate Video" button
- On submit: POST to backend API, redirect to `/generate/[id]`

### Generation Page (`app/generate/[id]/page.tsx`)

- Poll `GET /api/videos/:id` every 2 seconds
- Multi-step progress tracker showing: Scripting → Voicing → Generating → Merging → Done
- When completed: embedded video player + download button
- On failure: error message + retry option

### Gallery Page (`app/videos/page.tsx`)

- Grid of video cards showing topic, status, timestamp
- Click to navigate to the generation page for that video

---

## Phase 7 — Environment and Configuration

### Backend `.env`

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/some_saas
REDIS_HOST=localhost
REDIS_PORT=6379
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
FAL_KEY=...
FRONTEND_URL=http://localhost:3000
PORT=3001
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## Design Decisions

| Decision             | Choice                  | Rationale                                                                 |
| -------------------- | ----------------------- | ------------------------------------------------------------------------- |
| Async processing     | BullMQ + Redis          | Video generation takes minutes; user gets instant response + progress     |
| Frontend framework   | Next.js                 | Best DX with React, SSR for SEO on landing page, easy Vercel deployment  |
| ORM                  | Prisma                  | Type-safe, great migration tooling, first-class PostgreSQL support        |
| Video format         | 9:16 portrait, 720p     | Standard for YouTube Shorts, TikTok, and Instagram Reels                 |
| File storage         | Local disk (`uploads/`) | Simple for VPS deployment; easy to swap to S3/R2 later                   |
| GPT-4 output         | Two fields (voiceover + visual) | Narration text and video prompts have fundamentally different needs |

---

## GPT-4 Prompt Design

The GPT-4 call produces **two outputs** in a structured JSON response:

1. **`voiceover`** — The narration text sent to ElevenLabs for speech generation. Written to be spoken aloud, concise (~30 words for 5 seconds), engaging, and informative.

2. **`visual_prompt`** — A cinematic scene description sent to fal.ai for video generation. Written to produce visually compelling footage (e.g., "Aerial view of ancient Constantinople walls at dawn, dramatic golden light, cinematic atmosphere").

This separation is critical because what sounds good as narration ("Istanbul fell in 1453...") is very different from what generates good video.

---

## Future Phases

### Phase 8 — Authentication

**Goal:** Add user accounts so each user has their own video library.

- Integrate **Clerk** or **BetterAuth** for authentication
- Add a `userId` foreign key to the `Video` model
- Protect all API endpoints with auth middleware
- Add sign-up / sign-in pages to the frontend
- Per-user video history and gallery
- Rate limiting per user to prevent abuse

### Phase 9 — Auto-Publishing to Social Platforms

**Goal:** Cron jobs that automatically publish generated videos to social media.

- OAuth integration with:
  - **YouTube Data API v3** — upload as YouTube Shorts
  - **TikTok Content Posting API** — upload as TikTok videos
  - **Instagram Graph API** — upload as Instagram Reels
- New database models:
  - `SocialAccount` — stores OAuth tokens per user per platform
  - `PublishJob` — tracks publishing status per video per platform
- Settings page for connecting social accounts
- Cron scheduler (e.g., `@nestjs/schedule`) to:
  - Automatically publish completed videos on a schedule
  - Retry failed publishes
  - Refresh expired OAuth tokens
- Publishing status visible on each video card

### Phase 10 — Multi-Scene Videos

**Goal:** Support longer videos with multiple scenes, transitions, and background music.

- GPT-4 generates a multi-scene script (array of scenes, each with voiceover + visual prompt)
- Each scene generates its own 5-second video clip via fal.ai
- ElevenLabs generates full narration audio for all scenes
- FFmpeg concatenates scenes with transitions (crossfade, cut)
- Optional background music layer (royalty-free library or AI-generated)
- Configurable video length: 15s, 30s, 60s
- Scene-by-scene progress tracking in the UI

### Phase 11 — Credits and Billing

**Goal:** Monetize the platform with a credit-based system.

- Each video generation costs credits (based on length and quality)
- **Stripe** integration for purchasing credit packs and subscriptions
- Subscription tiers:
  - **Free** — 3 videos/month
  - **Pro** — 50 videos/month + priority queue
  - **Business** — unlimited + auto-publishing + API access
- New database models:
  - `Subscription` — Stripe subscription data
  - `CreditTransaction` — credit purchase and usage ledger
- Usage tracking and quota enforcement middleware
- Billing page in the frontend with usage stats

### Phase 12 — Dashboard and Analytics

**Goal:** Provide users with insights into their content performance.

- Dashboard page showing:
  - Total videos generated
  - Videos published per platform
  - Generation success/failure rates
  - Credit usage over time
- Per-video analytics (when auto-publishing is active):
  - View counts from YouTube/TikTok/Instagram APIs
  - Engagement metrics (likes, comments, shares)
  - Best-performing topics and time slots
- Charts and graphs using a library like Recharts or Chart.js
- Export analytics data as CSV
- Weekly email summary of performance (optional)

---

## Deployment Notes

### Backend (VPS)

- Run NestJS with PM2 or systemd for process management
- PostgreSQL and Redis installed on the same VPS or as managed services
- FFmpeg must be installed on the VPS (`apt install ffmpeg`)
- Nginx reverse proxy with SSL (Let's Encrypt)
- `uploads/` directory with sufficient disk space

### Frontend (Vercel or VPS)

- Deploy Next.js to Vercel for zero-config deployment
- Or serve from the same VPS with Nginx
- Set `NEXT_PUBLIC_API_URL` to the backend's public URL

### Required External Accounts

- OpenAI API key (for GPT-4)
- ElevenLabs API key + voice ID
- fal.ai API key
- PostgreSQL database
- Redis instance
