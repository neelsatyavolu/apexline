const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "assets/app-icon.icns");
const sizes = [
  ["icp4", 16],
  ["icp5", 32],
  ["icp6", 64],
  ["ic07", 128],
  ["ic08", 256],
  ["ic09", 512],
  ["ic10", 1024],
];

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function png(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND"),
  ]);
}

function icns(entries) {
  const chunks = entries.map(([type, data]) => {
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, "ascii");
    header.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([header, data]);
  });
  const header = Buffer.alloc(8);
  header.write("icns", 0, 4, "ascii");
  header.writeUInt32BE(chunks.reduce((length, entry) => length + entry.length, 8), 4);
  return Buffer.concat([header, ...chunks]);
}

function hex(color) {
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
    255,
  ];
}

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function insideRoundRect(px, py, x, y, width, height, radius) {
  if (px < x || py < y || px > x + width || py > y + height) return false;
  const cx = Math.max(x + radius, Math.min(px, x + width - radius));
  const cy = Math.max(y + radius, Math.min(py, y + height - radius));
  return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2;
}

function coverage(px, py, scale, shape) {
  let hits = 0;
  const samples = 4;
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const x = (px + (sx + 0.5) / samples) / scale;
      const y = (py + (sy + 0.5) / samples) / scale;
      if (shape(x, y)) hits++;
    }
  }
  return hits / (samples * samples);
}

function paint(pixels, size, shape, colorAt) {
  const scale = size / 512;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = coverage(x, y, scale, shape);
      if (!a) continue;
      const color = colorAt((x + 0.5) / scale, (y + 0.5) / scale);
      const index = (y * size + x) * 4;
      const alpha = (color[3] / 255) * a;
      const inverse = 1 - alpha;
      for (let c = 0; c < 3; c++) pixels[index + c] = Math.round(color[c] * alpha + pixels[index + c] * inverse);
      pixels[index + 3] = Math.round(255 * (alpha + (pixels[index + 3] / 255) * inverse));
    }
  }
}

function roundedRect(x, y, width, height, radius) {
  return (px, py) => insideRoundRect(px, py, x, y, width, height, radius);
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const bgStart = hex("#181c25");
  const bgEnd = hex("#0b0d12");
  paint(pixels, size, roundedRect(8, 8, 496, 496, 116), (x, y) => mix(bgStart, bgEnd, Math.max(0, Math.min(1, (x + y) / 1024))));
  paint(pixels, size, (x, y) => {
    const outer = insideRoundRect(x, y, 8, 8, 496, 496, 116);
    const inner = insideRoundRect(x, y, 9, 9, 494, 494, 115);
    return outer && !inner;
  }, () => hex("#2c3340"));
  for (const [x, y, width, height, radius, color] of [
    [132, 120, 44, 272, 14, "#f4f6fb"],
    [196, 142, 150, 40, 12, "#2d7bff"],
    [196, 204, 184, 40, 12, "#f4f6fb"],
    [196, 266, 118, 40, 12, "#7c8597"],
    [196, 328, 160, 40, 12, "#f4f6fb"],
  ]) {
    paint(pixels, size, roundedRect(x, y, width, height, radius), () => hex(color));
  }
  paint(pixels, size, (x, y) => (x - 368) ** 2 + (y - 162) ** 2 <= 12 ** 2, () => hex("#2d7bff"));
  return png(size, size, pixels);
}

fs.writeFileSync(out, icns(sizes.map(([type, size]) => [type, drawIcon(size)])));
console.log(`Generated ${path.relative(root, out)}`);
