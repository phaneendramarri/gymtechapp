/**
 * Biometric Face Recognition Engine using @vladmandic/face-api
 *
 * Implements client-side:
 *   1. Model initialization & caching (TinyFaceDetector, Landmarks, Recognition)
 *   2. 128-dimensional face descriptor extraction from video / image / canvas
 *   3. Descriptor serialization & deserialization (Float32Array <-> JSON)
 *   4. Euclidean distance similarity matching against registered members
 */

export interface EnrolledFaceMember {
  id: number;
  name: string;
  memberCode: string;
  phone?: string;
  photoUrl?: string | null;
  faceEmbedding?: string | null;
  status?: string;
  planName?: string;
  membershipStatus?: string;
  endDate?: number;
}

export interface EnrolledFaceRecord {
  member: EnrolledFaceMember;
  descriptor: Float32Array;
}

export interface FaceMatch {
  member: EnrolledFaceMember;
  distance: number;
  confidence: number;
  isConfidentMatch: boolean;
}

let modelsLoaded = false;
let modelLoadingPromise: Promise<boolean> | null = null;
let faceapiInstance: any = null;

/**
 * Lazily loads the face-api bundle in browser contexts.
 * Prevents bundling/execution issues in test/node environments and
 * avoids blocking initial application load until biometric features are used.
 */
export async function getFaceApi(): Promise<any> {
  if (faceapiInstance) return faceapiInstance;
  if (typeof window === 'undefined') {
    throw new Error('Face-API operations are only available in a browser environment');
  }

  // Load face-api
  const mod = await import('@vladmandic/face-api');
  faceapiInstance = mod.default || mod;
  return faceapiInstance;
}

/**
 * Check if models are currently initialized.
 */
export function isFaceApiModelsLoaded(): boolean {
  return modelsLoaded;
}

/**
 * Load face-api models. First attempts loading from the local `/models` directory;
 * if that fails, transparently falls back to the jsDelivr CDN.
 * Uses a singleton promise to ensure models are only loaded once.
 */
export async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      const api = await getFaceApi();
      const locations = ['/models', 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'];

      for (const loc of locations) {
        try {
          await Promise.all([
            api.nets.tinyFaceDetector.loadFromUri(loc),
            api.nets.faceLandmark68TinyNet.loadFromUri(loc),
            api.nets.faceRecognitionNet.loadFromUri(loc),
          ]);
          modelsLoaded = true;
          return true;
        } catch (err) {
          console.warn(`[face-api] Failed loading models from ${loc}:`, err);
        }
      }

      console.error('[face-api] All model loading paths failed.');
      return false;
    } catch (err) {
      console.error('[face-api] Error initializing face-api module:', err);
      return false;
    }
  })();

  const result = await modelLoadingPromise;
  if (!result) {
    modelLoadingPromise = null;
  }
  return result;
}

/**
 * Computes Euclidean distance between two 128-dimensional face vectors:
 *   d(u, v) = sqrt(sum((u_i - v_i)^2))
 */
export function computeEuclideanDistance(desc1: Float32Array, desc2: Float32Array): number {
  if (desc1.length !== desc2.length) return 1.0;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Converts a Euclidean distance into a human-friendly confidence percentage (0-100%).
 * Standard face-api 128-D Euclidean distance:
 *   distance <= 0.20 -> ~95-100% (extremely confident)
 *   distance = 0.35  -> ~88%
 *   distance = 0.55  -> 70% (typical matching threshold)
 *   distance >= 0.80 -> 0% (unregistered / no similarity)
 */
export function distanceToConfidence(distance: number): number {
  if (distance <= 0) return 100;
  if (distance >= 0.8) return 0;
  if (distance <= 0.55) {
    const factor = distance / 0.55;
    return Math.round(100 - factor * factor * 30);
  }
  const factor = (distance - 0.55) / 0.25;
  return Math.max(0, Math.round(70 * (1 - factor)));
}

/**
 * Serializes a 128-D Float32Array face descriptor into a JSON array string for database storage.
 */
export function serializeDescriptor(descriptor: Float32Array): string {
  return JSON.stringify(Array.from(descriptor));
}

/**
 * Deserializes a stored string into a 128-D Float32Array.
 * Supports standard JSON arrays and comma-separated float strings.
 */
export function deserializeDescriptor(raw: string | null | undefined): Float32Array | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length === 128) {
      return new Float32Array(parsed);
    }
  } catch {
    // Fallback: handle comma-separated string
    const parts = trimmed.split(',').map((p) => parseFloat(p.trim())).filter((n) => !isNaN(n));
    if (parts.length === 128) {
      return new Float32Array(parts);
    }
  }

  return null;
}

/**
 * Detect a single face in a video, image, or canvas and extract its 128-D descriptor.
 */
export async function extractFaceDescriptor(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  const ready = await loadFaceApiModels();
  if (!ready) return null;

  try {
    const api = await getFaceApi();

    // Use TinyFaceDetector with 320px input size and 0.45 score threshold for fast edge detection
    const options = new api.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.45,
    });

    const detection = await api
      .detectSingleFace(source, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (detection && detection.descriptor && detection.descriptor.length === 128) {
      return detection.descriptor;
    }

    // Fallback for still photos with lower score threshold if not immediately detected
    if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
      const relaxedOptions = new api.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.3,
      });
      const fallbackDetection = await api
        .detectSingleFace(source, relaxedOptions)
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (fallbackDetection && fallbackDetection.descriptor) {
        return fallbackDetection.descriptor;
      }
    }

    return null;
  } catch (err) {
    console.error('[face-api] Error during face descriptor extraction:', err);
    return null;
  }
}

/**
 * Extract face descriptor directly from an image URL (data URI or remote URL).
 */
export async function extractDescriptorFromImageUrl(url: string): Promise<Float32Array | null> {
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const desc = await extractFaceDescriptor(img);
        resolve(desc);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Compares a live face descriptor against an enrolled list of members using Euclidean distance.
 * Returns the best match, distance, confidence, and whether it meets the threshold.
 *
 * @param liveDescriptor - The 128-D descriptor of the face in front of the camera
 * @param enrolled - Array of enrolled members with their pre-loaded 128-D descriptors
 * @param maxDistanceThreshold - Maximum Euclidean distance for a match (default: 0.55)
 */
export function findBestFaceMatch(
  liveDescriptor: Float32Array,
  enrolled: EnrolledFaceRecord[],
  maxDistanceThreshold = 0.55
): FaceMatch | null {
  if (!enrolled || enrolled.length === 0) return null;

  let bestRecord: EnrolledFaceRecord | null = null;
  let minDistance = Infinity;

  for (const record of enrolled) {
    const dist = computeEuclideanDistance(liveDescriptor, record.descriptor);
    if (dist < minDistance) {
      minDistance = dist;
      bestRecord = record;
    }
  }

  if (!bestRecord) return null;

  const confidence = distanceToConfidence(minDistance);
  const isConfidentMatch = minDistance <= maxDistanceThreshold;

  return {
    member: bestRecord.member,
    distance: Number(minDistance.toFixed(4)),
    confidence,
    isConfidentMatch,
  };
}
