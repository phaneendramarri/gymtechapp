/**
 * In-Browser Biometric Face Comparison & Recognition Engine
 * 
 * Performs client-side facial feature extraction and similarity comparison
 * between live camera feeds and registered member profile photos without
 * sending biometric images to external third-party servers.
 */

export interface EnrolledFaceMember {
  id: number;
  name: string;
  memberCode: string;
  phone?: string;
  photoUrl?: string | null;
  faceEmbedding?: string | null;
}

export interface FaceSignature {
  spatialGrid: Float32Array; // 64-element normalized luminance grid (8x8)
  dHash: string;             // 64-bit gradient difference hash
  skinTone: [number, number];// [Cb, Cr] mean chrominance
}

export interface FaceMatchResult {
  member: EnrolledFaceMember;
  confidence: number;
  isMatch: boolean;
  details: {
    spatialSimilarity: number;
    hashSimilarity: number;
    colorSimilarity: number;
  };
}

/**
 * Extracts a normalized facial signature from an image, video, or canvas.
 */
export async function extractFaceSignature(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<FaceSignature | null> {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    let sourceWidth = 0;
    let sourceHeight = 0;

    if (source instanceof HTMLVideoElement) {
      sourceWidth = source.videoWidth;
      sourceHeight = source.videoHeight;
    } else if (source instanceof HTMLImageElement) {
      sourceWidth = source.naturalWidth || source.width;
      sourceHeight = source.naturalHeight || source.height;
    } else {
      sourceWidth = source.width;
      sourceHeight = source.height;
    }

    if (!sourceWidth || !sourceHeight) return null;

    // Crop center 75% region (where face is aligned in the reticle)
    const cropSize = Math.min(sourceWidth, sourceHeight) * 0.75;
    const cropX = (sourceWidth - cropSize) / 2;
    const cropY = (sourceHeight - cropSize) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, cropX, cropY, cropSize, cropSize, 0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    // 1. Grayscale luminance + Contrast Equalization
    const luminance = new Float32Array(size * size);
    let minLum = 255;
    let maxLum = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      luminance[i / 4] = lum;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }

    const range = maxLum - minLum || 1;
    for (let i = 0; i < luminance.length; i++) {
      luminance[i] = ((luminance[i] - minLum) / range) * 255;
    }

    // 2. 8x8 Spatial Luminance Grid
    const gridSize = 8;
    const blockSize = size / gridSize;
    const spatialGrid = new Float32Array(gridSize * gridSize);
    let normSum = 0;

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        let blockSum = 0;
        for (let py = 0; py < blockSize; py++) {
          for (let px = 0; px < blockSize; px++) {
            const y = gy * blockSize + py;
            const x = gx * blockSize + px;
            blockSum += luminance[y * size + x];
          }
        }
        const avg = blockSum / (blockSize * blockSize);
        const idx = gy * gridSize + gx;
        spatialGrid[idx] = avg;
        normSum += avg * avg;
      }
    }

    // Normalize spatial vector
    const norm = Math.sqrt(normSum) || 1;
    for (let i = 0; i < spatialGrid.length; i++) {
      spatialGrid[i] /= norm;
    }

    // 3. Difference Hash (dHash) 8x8
    let dHashBits = '';
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize - 1; gx++) {
        const left = spatialGrid[gy * gridSize + gx];
        const right = spatialGrid[gy * gridSize + gx + 1];
        dHashBits += left > right ? '1' : '0';
      }
      // Wrap around last comparison
      const last = spatialGrid[gy * gridSize + (gridSize - 1)];
      const first = spatialGrid[gy * gridSize];
      dHashBits += last > first ? '1' : '0';
    }

    // 4. Central Skin-tone Chrominance (Cb, Cr in YCbCr)
    let cbSum = 0;
    let crSum = 0;
    let colorPixelCount = 0;

    const coreStart = Math.floor(size * 0.25);
    const coreEnd = Math.floor(size * 0.75);

    for (let y = coreStart; y < coreEnd; y++) {
      for (let x = coreStart; x < coreEnd; x++) {
        const idx = (y * size + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        // Standard RGB to YCbCr conversion
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        cbSum += cb;
        crSum += cr;
        colorPixelCount++;
      }
    }

    const skinTone: [number, number] = [
      colorPixelCount ? cbSum / colorPixelCount : 128,
      colorPixelCount ? crSum / colorPixelCount : 128,
    ];

    return {
      spatialGrid,
      dHash: dHashBits,
      skinTone,
    };
  } catch (err) {
    console.error('Face signature extraction failed:', err);
    return null;
  }
}

/**
 * Loads an image from a URL or base64 string and extracts its face signature.
 */
export async function extractSignatureFromUrl(url: string): Promise<FaceSignature | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      const sig = await extractFaceSignature(img);
      resolve(sig);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Compares two facial signatures and computes a similarity score (0 to 100).
 */
export function compareFaceSignatures(
  sigA: FaceSignature,
  sigB: FaceSignature
): { confidence: number; isMatch: boolean; details: FaceMatchResult['details'] } {
  // 1. Cosine similarity of normalized spatial luminance grids
  let dotProduct = 0;
  for (let i = 0; i < sigA.spatialGrid.length; i++) {
    dotProduct += sigA.spatialGrid[i] * sigB.spatialGrid[i];
  }
  // Clamp between 0 and 1
  const spatialSimilarity = Math.max(0, Math.min(1, dotProduct));

  // 2. Normalized Hamming similarity of difference hashes
  let matchBits = 0;
  const len = Math.min(sigA.dHash.length, sigB.dHash.length);
  for (let i = 0; i < len; i++) {
    if (sigA.dHash[i] === sigB.dHash[i]) {
      matchBits++;
    }
  }
  const hashSimilarity = len ? matchBits / len : 0;

  // 3. Chrominance similarity (skin tone distance)
  const deltaCb = sigA.skinTone[0] - sigB.skinTone[0];
  const deltaCr = sigA.skinTone[1] - sigB.skinTone[1];
  const colorDist = Math.sqrt(deltaCb * deltaCb + deltaCr * deltaCr);
  // Max expected Euclidean distance in CbCr space is ~100
  const colorSimilarity = Math.max(0, 1 - colorDist / 70);

  // Weighted composite confidence score
  // Spatial structure carries the highest weight, followed by gradients and tone
  const rawScore = spatialSimilarity * 0.55 + hashSimilarity * 0.30 + colorSimilarity * 0.15;
  const confidence = Math.round(Math.max(0, Math.min(1, rawScore)) * 100);

  // Threshold: >= 72% confidence is considered an authenticated match
  const isMatch = confidence >= 72;

  return {
    confidence,
    isMatch,
    details: {
      spatialSimilarity: Math.round(spatialSimilarity * 100),
      hashSimilarity: Math.round(hashSimilarity * 100),
      colorSimilarity: Math.round(colorSimilarity * 100),
    },
  };
}

/**
 * Searches across all enrolled members to find the closest matching face.
 */
export async function matchLiveVideoAgainstEnrolled(
  video: HTMLVideoElement,
  enrolledList: Array<{ member: EnrolledFaceMember; signature: FaceSignature }>
): Promise<FaceMatchResult | null> {
  if (!video || !enrolledList.length) return null;

  const liveSig = await extractFaceSignature(video);
  if (!liveSig) return null;

  let bestResult: FaceMatchResult | null = null;

  for (const item of enrolledList) {
    const comparison = compareFaceSignatures(liveSig, item.signature);
    if (!bestResult || comparison.confidence > bestResult.confidence) {
      bestResult = {
        member: item.member,
        confidence: comparison.confidence,
        isMatch: comparison.isMatch,
        details: comparison.details,
      };
    }
  }

  return bestResult;
}

/**
 * Serializes a FaceSignature into a lightweight JSON string for database storage.
 */
export function serializeFaceSignature(sig: FaceSignature): string {
  return JSON.stringify({
    spatialGrid: Array.from(sig.spatialGrid),
    dHash: sig.dHash,
    skinTone: sig.skinTone,
  });
}

/**
 * Deserializes a stored face_embedding string from the database back into a FaceSignature.
 */
export function deserializeFaceSignature(raw: string | null | undefined): FaceSignature | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data.spatialGrid || !data.dHash || !data.skinTone) return null;
    return {
      spatialGrid: new Float32Array(data.spatialGrid),
      dHash: String(data.dHash),
      skinTone: [Number(data.skinTone[0]), Number(data.skinTone[1])],
    };
  } catch {
    return null;
  }
}
