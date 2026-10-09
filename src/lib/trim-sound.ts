/**
 * Turn a specialist's recording of one letter sound into a short, tight clip.
 *
 * A take is mostly silence: the moment between pressing record and speaking,
 * and the moment between speaking and pressing stop. Played in a sequence —
 * "a… so", or "bata… /b/… /m/" — that silence becomes the pause, and a second
 * of it makes the child hold the first part in mind for too long. So the sound
 * is cut out here, in the browser, before it is saved.
 *
 * Saved as 16 kHz mono 16-bit WAV rather than the recorder's own WebM: a few
 * tens of kilobytes, plays on every browser the study supports, and — unlike a
 * MediaRecorder WebM, which carries no duration — has nothing to go wrong when
 * played from the start.
 *
 * Browser only.
 */

const RATE = 16_000;
const FRAME = RATE / 100; // 10 ms
/** A frame counts as sound when it is louder than this share of the take's peak (about −28 dB). */
const SOUND_FLOOR = 0.04;
/** Kept either side of the sound, so a soft onset or a released consonant is not clipped. */
const LEAD_FRAMES = 5;
const TAIL_FRAMES = 9;

export async function trimToWav(blob: Blob): Promise<string | null> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const mono = (await offline.startRendering()).getChannelData(0);

    const levels: number[] = [];
    for (let i = 0; i + FRAME <= mono.length; i += FRAME) {
      let sum = 0;
      for (let j = i; j < i + FRAME; j++) sum += mono[j] * mono[j];
      levels.push(Math.sqrt(sum / FRAME));
    }
    const peak = Math.max(0, ...levels);
    if (peak < 0.01) return null; // nothing was heard

    const first = levels.findIndex((l) => l > peak * SOUND_FLOOR);
    let last = first;
    for (let i = levels.length - 1; i >= 0; i--) {
      if (levels[i] > peak * SOUND_FLOOR) {
        last = i;
        break;
      }
    }
    const start = Math.max(0, (first - LEAD_FRAMES) * FRAME);
    const end = Math.min(mono.length, (last + 1 + TAIL_FRAMES) * FRAME);

    // Brought up to a steady loudness, so a softly spoken /h/ is not drowned by
    // the neural voice beside it — but never by more than 8×, which would only
    // amplify the room.
    let samplePeak = 0;
    for (let i = start; i < end; i++) samplePeak = Math.max(samplePeak, Math.abs(mono[i]));
    const gain = samplePeak > 0 ? Math.min(8, 0.9 / samplePeak) : 1;

    return wavDataUrl(mono.subarray(start, end), gain);
  } catch {
    return null;
  } finally {
    void ctx.close();
  }
}

function wavDataUrl(samples: Float32Array, gain: number): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per frame
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] * gain));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}
