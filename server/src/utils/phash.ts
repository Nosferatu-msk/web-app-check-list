import sharp from 'sharp';

/**
 * Вычисление перцептивного хэша (pHash) изображения.
 * Алгоритм: resize 32×32 → grayscale → DCT → 64-битный хэш.
 */
export async function computePhash(imagePath: string): Promise<string> {
  const size = 32;

  const { data, info } = await sharp(imagePath)
    .resize(size, size, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels: number[] = Array.from(data);

  const dctValues = applyDCT2D(pixels, size);

  const allCoeffs: number[] = [];
  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      if (u === 0 && v === 0) continue;
      allCoeffs.push(dctValues[u * size + v]);
    }
  }

  allCoeffs.sort((a, b) => a - b);
  const median = allCoeffs[Math.floor(allCoeffs.length / 2)];

  let hash = 0n;
  let bitIndex = 0;
  for (let u = 0; u < size && bitIndex < 64; u++) {
    for (let v = 0; v < size && bitIndex < 64; v++) {
      if (u === 0 && v === 0) continue;
      if (dctValues[u * size + v] > median) {
        hash |= 1n << BigInt(63 - bitIndex);
      }
      bitIndex++;
    }
  }

  return hash.toString(16).padStart(16, '0');
}

/**
 * Расстояние Хэмминга между двумя hex-хэшами.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== 16 || hash2.length !== 16) return 64;
  const b1 = BigInt('0x' + hash1);
  const b2 = BigInt('0x' + hash2);
  let xor = b1 ^ b2;
  let distance = 0;
  while (xor > 0n) {
    xor &= xor - 1n;
    distance++;
  }
  return distance;
}

function applyDCT2D(pixels: number[], size: number): number[] {
  const result = new Array(size * size).fill(0);

  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          sum += pixels[i * size + j] *
            Math.cos(((2 * i + 1) * u * Math.PI) / (2 * size)) *
            Math.cos(((2 * j + 1) * v * Math.PI) / (2 * size));
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      result[u * size + v] = 0.25 * cu * cv * sum;
    }
  }

  return result;
}
