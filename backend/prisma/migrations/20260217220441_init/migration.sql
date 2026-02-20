-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "script" TEXT,
    "visualPrompt" TEXT,
    "audioUrl" TEXT,
    "videoUrl" TEXT,
    "finalUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);
