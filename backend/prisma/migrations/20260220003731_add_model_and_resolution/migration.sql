-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "modelId" TEXT NOT NULL DEFAULT 'fast-wan',
ADD COLUMN     "resolution" TEXT NOT NULL DEFAULT '480p';
