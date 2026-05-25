#!/usr/bin/env node
// Generates the PWA / home-screen icons from the inline SVG below.
// Run with: node scripts/gen-icons.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function svg({ rx, mask = false }) {
  // For maskable icons, iOS / Android may crop up to ~10% on each edge,
  // so we pull the artwork inward when rendering the maskable variant.
  const inset = mask ? 8 : 0;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7DB9E8"/>
      <stop offset="100%" stop-color="#5B9BD5"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="${rx}" fill="url(#g)"/>
  <g transform="translate(${inset / 2}, ${inset / 2}) scale(${(64 - inset) / 64})">
    <path d="M14 30 L32 14 L50 30 V50 H38 V38 H26 V50 H14 Z"
          fill="white" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="32" cy="11" r="3.5" fill="white"/>
    <path d="M32 14.5 L32 18" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>`;
}

async function render(size, outPath, opts = {}) {
  const buf = Buffer.from(svg({ rx: opts.mask ? 0 : 14, mask: opts.mask }));
  await sharp(buf, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log('Wrote', outPath);
}

(async () => {
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });
  await render(192, path.join(iconsDir, 'icon-192.png'));
  await render(512, path.join(iconsDir, 'icon-512.png'));
  await render(512, path.join(iconsDir, 'icon-512-maskable.png'), { mask: true });
  await render(180, path.join(__dirname, '..', 'public', 'apple-touch-icon.png'));
})();
