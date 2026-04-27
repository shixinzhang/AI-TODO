import fs from "fs/promises";
import path from "path";

const targetDir = process.argv[2];
if (!targetDir) {
  console.error("usage: node scripts/repair-images.js <dir>");
  process.exit(1);
}

const absDir = path.resolve(targetDir);
const entries = await fs.readdir(absDir, { withFileTypes: true });
let fixedCount = 0;

for (const ent of entries) {
  if (!ent.isFile()) continue;
  const filePath = path.join(absDir, ent.name);
  const buf = await fs.readFile(filePath);
  const normalized = normalizeImageBuffer(buf);
  if (normalized.prefixStripped === 0 && !normalized.aigcSegmentStripped) continue;
  await fs.writeFile(filePath, normalized.buffer);
  fixedCount += 1;
  console.log(
    JSON.stringify(
      {
        file: filePath,
        bytesBefore: buf.length,
        bytesAfter: normalized.buffer.length,
        prefixStripped: normalized.prefixStripped,
        aigcSegmentStripped: normalized.aigcSegmentStripped,
        mime: normalized.mime,
      },
      null,
      0
    )
  );
}

console.log(`fixed ${fixedCount} file(s) in ${absDir}`);

function normalizeImageBuffer(buffer) {
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpegSig = Buffer.from([0xff, 0xd8, 0xff]);
  const riffSig = Buffer.from("RIFF");

  const candidates = [];
  const jpegAt = buffer.indexOf(jpegSig);
  if (jpegAt !== -1) candidates.push({ offset: jpegAt, mime: "image/jpeg" });

  const pngAt = buffer.indexOf(pngSig);
  if (pngAt !== -1) candidates.push({ offset: pngAt, mime: "image/png" });

  let webpAt = buffer.indexOf(riffSig);
  while (webpAt !== -1) {
    if (
      buffer.length >= webpAt + 12 &&
      buffer.toString("ascii", webpAt + 8, webpAt + 12) === "WEBP"
    ) {
      candidates.push({ offset: webpAt, mime: "image/webp" });
      break;
    }
    webpAt = buffer.indexOf(riffSig, webpAt + 1);
  }

  if (candidates.length === 0) {
    return { buffer, mime: undefined, prefixStripped: 0, aigcSegmentStripped: false };
  }

  candidates.sort((a, b) => a.offset - b.offset);
  const best = candidates[0];
  let sliced = buffer.slice(best.offset);
  let aigcSegmentStripped = false;

  if (best.mime === "image/jpeg") {
    const stripped = stripAigcJpegSegment(sliced);
    if (stripped !== sliced) {
      aigcSegmentStripped = true;
      sliced = stripped;
    }
    const eoi = sliced.lastIndexOf(Buffer.from([0xff, 0xd9]));
    if (eoi !== -1) sliced = sliced.slice(0, eoi + 2);
  }

  return {
    buffer: sliced,
    mime: best.mime,
    prefixStripped: best.offset,
    aigcSegmentStripped,
  };
}

function stripAigcJpegSegment(buffer) {
  if (buffer.length < 6) return buffer;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer;
  if (buffer[2] !== 0xff || buffer[3] !== 0xeb) return buffer;
  const segLen = (buffer[4] << 8) | buffer[5];
  if (!Number.isFinite(segLen) || segLen < 2) return buffer;
  const segEnd = 4 + segLen;
  if (segEnd > buffer.length) return buffer;
  const markerPayload = buffer.slice(6, Math.min(segEnd, buffer.length));
  if (markerPayload.indexOf(Buffer.from("AIGC")) === -1) return buffer;
  return Buffer.concat([buffer.slice(0, 2), buffer.slice(segEnd)]);
}
