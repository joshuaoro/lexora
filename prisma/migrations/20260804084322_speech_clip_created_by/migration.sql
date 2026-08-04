-- AlterTable
ALTER TABLE "SpeechClip" ADD COLUMN     "createdBy" TEXT;

-- CreateIndex
CREATE INDEX "SpeechClip_createdBy_createdAt_idx" ON "SpeechClip"("createdBy", "createdAt");
