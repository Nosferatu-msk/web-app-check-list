/**
 * Generate PWA placeholder icons (192x192 and 512x512 PNG).
 *
 * Draws a clipboard-with-checklist icon on a blue rounded-rect background.
 * Pure Node.js — no external dependencies (uses built-in zlib for PNG deflate).
 *
 * Usage:  node scripts/generate-icons.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons');

// ── PNG helpers ──────────────────────────────────────────────────────

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcData = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

function createPNG(width, height, rgbaPixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines: filter byte (0 = None) + row pixels
  const rowLen = width * 4 + 1;
  const raw = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0; // filter: None
    rgbaPixels.copy(raw, y * rowLen + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Drawing helpers ──────────────────────────────────────────────────

function setPixel(buf, width, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  x = Math.round(x);
  y = Math.round(y);
  const idx = (y * width + x) * 4;
  // Alpha blending
  if (a < 255 && buf[idx + 3] > 0) {
    const srcA = a / 255;
    const dstA = buf[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    buf[idx]     = Math.round((r * srcA + buf[idx]     * dstA * (1 - srcA)) / outA);
    buf[idx + 1] = Math.round((g * srcA + buf[idx + 1] * dstA * (1 - srcA)) / outA);
    buf[idx + 2] = Math.round((b * srcA + buf[idx + 2] * dstA * (1 - srcA)) / outA);
    buf[idx + 3] = Math.round(outA * 255);
  } else {
    buf[idx]     = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = a;
  }
}

function fillRoundedRect(buf, w, x0, y0, rw, rh, radius, r, g, b, a = 255) {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) {
      // Check if inside rounded rect
      let inside = true;
      const corners = [
        [x0 + radius, y0 + radius],
        [x0 + rw - radius, y0 + radius],
        [x0 + radius, y0 + rh - radius],
        [x0 + rw - radius, y0 + rh - radius],
      ];
      const inCornerRegion =
        (x < x0 + radius && y < y0 + radius) ||
        (x >= x0 + rw - radius && y < y0 + radius) ||
        (x < x0 + radius && y >= y0 + rh - radius) ||
        (x >= x0 + rw - radius && y >= y0 + rh - radius);

      if (inCornerRegion) {
        // Find nearest corner center
        let cx, cy;
        if (x < x0 + radius && y < y0 + radius) {
          cx = x0 + radius; cy = y0 + radius;
        } else if (x >= x0 + rw - radius && y < y0 + radius) {
          cx = x0 + rw - radius - 1; cy = y0 + radius;
        } else if (x < x0 + radius && y >= y0 + rh - radius) {
          cx = x0 + radius; cy = y0 + rh - radius - 1;
        } else {
          cx = x0 + rw - radius - 1; cy = y0 + rh - radius - 1;
        }
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > radius * radius) inside = false;
      }

      if (inside) {
        setPixel(buf, w, x, y, r, g, b, a);
      }
    }
  }
}

function fillRect(buf, w, x0, y0, rw, rh, r, g, b, a = 255) {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) {
      setPixel(buf, w, x, y, r, g, b, a);
    }
  }
}

function fillCircle(buf, w, cx, cy, radius, r, g, b, a = 255) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(buf, w, Math.round(x), Math.round(y), r, g, b, a);
      }
    }
  }
}

// ── Icon design ──────────────────────────────────────────────────────

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4, 0);
  const s = size / 512; // scale factor (design on 512 grid)

  // Scale helper
  const sx = (v) => Math.round(v * s);
  const sw = (v) => Math.max(1, Math.round(v * s));

  // Background: rounded rectangle, Ant Design blue #1677ff
  fillRoundedRect(pixels, size, 0, 0, size, size, sx(80), 22, 119, 255, 255);

  // Clipboard body (white)
  const clipX = sx(120);
  const clipY = sx(100);
  const clipW = sx(272);
  const clipH = sx(340);
  const clipR = sx(24);
  fillRoundedRect(pixels, size, clipX, clipY, clipW, clipH, clipR, 255, 255, 255, 255);

  // Clipboard clip (top center, darker blue)
  const clipTopX = sx(196);
  const clipTopY = sx(72);
  const clipTopW = sx(120);
  const clipTopH = sx(60);
  const clipTopR = sx(16);
  fillRoundedRect(pixels, size, clipTopX, clipTopY, clipTopW, clipTopH, clipTopR, 255, 255, 255, 255);

  // Inner clip circle (blue)
  fillCircle(pixels, size, sx(256), sx(88), sx(16), 22, 119, 255, 255);

  // Checklist items: 3 checkboxes with lines
  const checkStartY = sx(180);
  const checkSpacing = sx(76);
  const checkX = sx(156);
  const checkSize = sx(36);
  const lineX = sx(210);
  const lineW = sx(148);
  const lineH = sx(14);

  for (let i = 0; i < 3; i++) {
    const cy = checkStartY + i * checkSpacing;

    // Checkbox border
    const cbR = sx(6);
    // Draw checkbox outline
    fillRoundedRect(pixels, size, checkX, cy, checkSize, checkSize, cbR, 22, 119, 255, 255);
    // Inner white
    fillRoundedRect(pixels, size, checkX + sw(3), cy + sw(3), checkSize - sw(6), checkSize - sw(6), sx(3), 255, 255, 255, 255);

    // Checkmark for first two items (checked)
    if (i < 2) {
      // Fill checkbox with blue (checked state)
      fillRoundedRect(pixels, size, checkX, cy, checkSize, checkSize, cbR, 22, 119, 255, 255);
      // White checkmark (simplified as two small rects forming an L/angle)
      const cmX = checkX + sx(8);
      const cmY = cy + sx(10);
      // Short stroke of checkmark
      fillRect(pixels, size, cmX, cmY + sw(6), sw(8), sw(4), 255, 255, 255, 255);
      // Long stroke of checkmark
      fillRect(pixels, size, cmX + sw(6), cmY, sw(4), sw(10), 255, 255, 255, 255);
      // Diagonal connector (approximate with small rects)
      fillRect(pixels, size, cmX + sw(2), cmY + sw(4), sw(5), sw(4), 255, 255, 255, 255);
    }

    // Text line (gray)
    fillRoundedRect(pixels, size, lineX, cy + sx(10), lineW, lineH, sx(4), 180, 190, 210, 255);
  }

  return pixels;
}

// ── Main ─────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });

for (const size of [192, 512]) {
  const pixels = drawIcon(size);
  const png = createPNG(size, size, pixels);
  const outPath = resolve(OUT_DIR, `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${png.length} bytes)`);
}

console.log('Done.');
