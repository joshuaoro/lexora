/**
 * Generate spoken samples of real instruction text, so a voice can be chosen by
 * ear rather than by name.
 *
 *   npx tsx scripts/voice-samples.ts
 *
 * Writes .mp3 files to voice-samples/ (gitignored). "Comforting and gentle" is
 * not something a voice list tells you.
 */
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "voice-samples";

/** The lines a child actually hears, not lorem ipsum. */
const LINES: Record<string, string> = {
  fil: "Pindutin ang mic, tapos basahin ang salita. Ngayon, subukan mo!",
  en: "Press the microphone, then say the word clearly. Now you try it!",
};

const VOICES = [
  { name: "fil-PH-BlessicaNeural", lang: "fil", note: "female — the word pronouncer's voice" },
  { name: "fil-PH-AngeloNeural", lang: "fil", note: "male" },
  { name: "en-PH-RosaNeural", lang: "en", note: "female, Philippine English" },
  { name: "en-PH-JamesNeural", lang: "en", note: "male, Philippine English" },
  { name: "en-US-AriaNeural", lang: "en", note: "female, US English — for comparison" },
];

/** Words are spoken at -10%; instructions are longer, so try a couple of rates. */
const RATES = ["-10%", "-20%"];

async function speak(voice: string, text: string, rate: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = await tts.toStream(text, { rate });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on("data", (c: Buffer) => chunks.push(c));
    audioStream.on("end", () => resolve());
    audioStream.on("error", reject);
  });
  return Buffer.concat(chunks);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`Writing samples to ${OUT}/\n`);

  for (const v of VOICES) {
    for (const rate of RATES) {
      const file = join(OUT, `${v.name}_${rate.replace("%", "")}.mp3`);
      try {
        const buf = await speak(v.name, LINES[v.lang], rate);
        await writeFile(file, buf);
        console.log(
          `  ${v.name.padEnd(24)} ${rate.padEnd(5)} ${String(Math.round(buf.length / 1024)).padStart(3)}KB  ${v.note}`
        );
      } catch (err) {
        console.log(`  ${v.name.padEnd(24)} ${rate.padEnd(5)} FAILED — ${(err as Error).message}`);
      }
    }
  }

  console.log(`\nPlay them and pick one. Filipino samples say the Filipino line,`);
  console.log(`English samples the English line — the same words the app uses.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
