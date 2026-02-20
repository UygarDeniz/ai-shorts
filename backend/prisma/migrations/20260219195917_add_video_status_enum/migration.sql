/*
  Warnings:

  - The `status` column on the `Video` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('queued', 'scripting', 'voicing', 'generating', 'merging', 'completed', 'failed');

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "status",
ADD COLUMN     "status" "VideoStatus" NOT NULL DEFAULT 'queued';
