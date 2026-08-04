-- CreateTable
CREATE TABLE "SpeechClip" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audio" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeechClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpeechClip_hash_key" ON "SpeechClip"("hash");
