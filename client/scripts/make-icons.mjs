import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

await fs.mkdir(publicDir, { recursive: true });

// SVG icon with Finenzo terracotta branding and refined serif 'F'
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="128" fill="#D97757"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" font-family="Georgia, serif" font-size="300" font-weight="600">F</text>
</svg>`;

const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#D97757"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" font-family="Georgia, serif" font-size="240" font-weight="600">F</text>
</svg>`;

await fs.writeFile(path.join(publicDir, 'favicon.svg'), svgIcon);

const svgBuffer = Buffer.from(svgIcon);
const maskableBuffer = Buffer.from(svgMaskable);

await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192.png'));
await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512.png'));
await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
await sharp(maskableBuffer).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-maskable-512.png'));

console.log('PWA icons successfully generated in client/public!');
