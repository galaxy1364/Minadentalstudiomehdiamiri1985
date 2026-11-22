/**
 * MinaDental Automated PWA & Apple Touch Icon Generator
 * Uses `sharp` to resize `/public/logo.png` (or `/public/icon.svg`) into:
 * - `/public/pwa-192x192.png` (192x192, purpose: "any")
 * - `/public/pwa-512x512.png` (512x512, purpose: "any")
 * - `/public/pwa-maskable-512x512.png` (512x512 with 20% safe-zone padding, purpose: "maskable")
 * - `/public/apple-touch-icon.png` (180x180 opaque background for iOS Home Screen)
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const SOURCE_LOGO_PNG = path.join(PUBLIC_DIR, 'logo.png');
const SOURCE_ICON_SVG = path.join(PUBLIC_DIR, 'icon.svg');

const LAVENDER_BG = { r: 250, g: 245, b: 255, alpha: 1 }; // #faf5ff (MinaDental soft purple theme)

async function generatePwaAssets() {
  const inputPath = fs.existsSync(SOURCE_LOGO_PNG)
    ? SOURCE_LOGO_PNG
    : SOURCE_ICON_SVG;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`No source logo found at ${SOURCE_LOGO_PNG} or ${SOURCE_ICON_SVG}`);
  }

  console.log(`[generate-pwa-assets] Using source logo: ${inputPath}`);

  // 1. Standard 192x192 PWA Icon (purpose: "any")
  const out192 = path.join(PUBLIC_DIR, 'pwa-192x192.png');
  await sharp(inputPath)
    .resize(192, 192, {
      fit: 'contain',
      background: LAVENDER_BG,
    })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(out192);
  console.log(`✅ Generated: ${out192} (192x192)`);

  // 2. Standard 512x512 PWA Icon (purpose: "any")
  const out512 = path.join(PUBLIC_DIR, 'pwa-512x512.png');
  await sharp(inputPath)
    .resize(512, 512, {
      fit: 'contain',
      background: LAVENDER_BG,
    })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(out512);
  console.log(`✅ Generated: ${out512} (512x512)`);

  // 3. Maskable 512x512 PWA Icon (purpose: "maskable" with safe-zone inset)
  // Android adaptive icon safe zone is inner 80% (~384x384 inside 512x512 canvas)
  const outMaskable512 = path.join(PUBLIC_DIR, 'pwa-maskable-512x512.png');
  const innerSize = 384;
  const pad = Math.floor((512 - innerSize) / 2); // 64px padding on all 4 sides
  const innerBuffer = await sharp(inputPath)
    .resize(innerSize, innerSize, {
      fit: 'contain',
      background: LAVENDER_BG,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: LAVENDER_BG,
    },
  })
    .composite([{ input: innerBuffer, top: pad, left: pad }])
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outMaskable512);
  console.log(`✅ Generated: ${outMaskable512} (512x512 maskable with 64px safe-zone padding)`);

  // 4. Apple Touch Icon 180x180 (iOS/iPadOS Home Screen)
  const outAppleTouch = path.join(PUBLIC_DIR, 'apple-touch-icon.png');
  const appleInner = 152;
  const applePad = Math.floor((180 - appleInner) / 2);
  const appleInnerBuf = await sharp(inputPath)
    .resize(appleInner, appleInner, {
      fit: 'contain',
      background: LAVENDER_BG,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: LAVENDER_BG,
    },
  })
    .composite([{ input: appleInnerBuf, top: applePad, left: applePad }])
    .flatten({ background: '#faf5ff' })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outAppleTouch);
  console.log(`✅ Generated: ${outAppleTouch} (180x180 iOS Home Screen icon)`);
}

generatePwaAssets().catch((err) => {
  console.error('❌ Error generating PWA assets:', err);
  process.exit(1);
});
