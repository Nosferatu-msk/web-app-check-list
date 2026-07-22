import sharp from 'sharp';

export async function resizeForPreview(inputPath: string): Promise<Buffer> {
  return sharp(inputPath)
    .resize({ width: 400, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function resizeForActScan(inputPath: string): Promise<Buffer> {
  return sharp(inputPath)
    .resize({ width: 1200, withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 80 })
    .withMetadata({})
    .toBuffer();
}

export async function imageToBase64(inputPath: string, maxWidth = 400, quality = 85): Promise<string> {
  const buf = await sharp(inputPath)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
  return buf.toString('base64');
}
