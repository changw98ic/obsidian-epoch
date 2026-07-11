import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = new Uint32Array(256);

for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(content: Buffer) {
  let crc = 0xffffffff;
  for (const byte of content) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, content = Buffer.alloc(0)) {
  const name = Buffer.from(type, "ascii");
  const header = Buffer.alloc(4);
  header.writeUInt32BE(content.length, 0);
  const footer = Buffer.alloc(4);
  footer.writeUInt32BE(crc32(Buffer.concat([name, content])), 0);
  return Buffer.concat([header, name, content, footer]);
}

export function encodePngRgba(width: number, height: number, pixels: Buffer) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    pixels.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    pngSignature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND"),
  ]);
}

export function hexToRgb(hex: string): Rgb {
  const raw = hex.replace(/^#/, "");
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

export function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function mix(left: Rgb, right: Rgb, amount: number): Rgb {
  const t = Math.max(0, Math.min(1, amount));
  return {
    r: left.r + (right.r - left.r) * t,
    g: left.g + (right.g - left.g) * t,
    b: left.b + (right.b - left.b) * t,
  };
}

export function hashSeed(value: string) {
  const hash = createHash("sha256").update(value).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

export function setPixel(pixels: Buffer, width: number, x: number, y: number, color: Rgb, alpha = 255) {
  const offset = (y * width + x) * 4;
  pixels[offset] = clamp(color.r);
  pixels[offset + 1] = clamp(color.g);
  pixels[offset + 2] = clamp(color.b);
  pixels[offset + 3] = clamp(alpha);
}
