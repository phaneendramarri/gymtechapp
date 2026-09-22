import { describe, it, expect } from 'vitest';
import {
  computeEuclideanDistance,
  distanceToConfidence,
  serializeDescriptor,
  deserializeDescriptor,
  findBestFaceMatch,
  type EnrolledFaceRecord,
} from '../../apps/web/src/lib/face-api';

describe('Biometric Face-API Matching & Descriptor Engine', () => {
  // Helper to generate a normalized 128-dimensional vector
  const makeVector = (seed: number): Float32Array => {
    const vec = new Float32Array(128);
    let normSq = 0;
    for (let i = 0; i < 128; i++) {
      // Deterministic pseudorandom values
      vec[i] = Math.sin(seed * 100 + i);
      normSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(normSq);
    for (let i = 0; i < 128; i++) {
      vec[i] /= norm;
    }
    return vec;
  };

  describe('Euclidean Distance', () => {
    it('returns 0 for identical face descriptors', () => {
      const v = makeVector(1);
      const distance = computeEuclideanDistance(v, v);
      expect(distance).toBeCloseTo(0, 5);
    });

    it('is symmetric: d(A, B) === d(B, A)', () => {
      const v1 = makeVector(1);
      const v2 = makeVector(2);
      expect(computeEuclideanDistance(v1, v2)).toBeCloseTo(computeEuclideanDistance(v2, v1), 5);
    });

    it('calculates known distance between unit vectors correctly', () => {
      const u = new Float32Array(128);
      const v = new Float32Array(128);
      u[0] = 1; // [1, 0, 0, ...]
      v[1] = 1; // [0, 1, 0, ...]
      // Distance is sqrt(1^2 + 1^2) = sqrt(2) ~= 1.4142
      expect(computeEuclideanDistance(u, v)).toBeCloseTo(Math.SQRT2, 4);
    });

    it('handles slightly perturbed vectors with small distance', () => {
      const v1 = makeVector(5);
      const v2 = new Float32Array(v1);
      // Small perturbation to simulate live webcam variance of same face
      for (let i = 0; i < 128; i++) {
        v2[i] += (Math.sin(i) * 0.02);
      }
      const distance = computeEuclideanDistance(v1, v2);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(0.35); // Strongly matching same person
    });
  });

  describe('Descriptor Serialization & Deserialization', () => {
    it('serializes 128-D descriptor to a valid JSON string and restores it', () => {
      const original = makeVector(42);
      const serialized = serializeDescriptor(original);

      expect(typeof serialized).toBe('string');
      expect(serialized.startsWith('[')).toBe(true);
      expect(serialized.endsWith(']')).toBe(true);

      const restored = deserializeDescriptor(serialized);
      expect(restored).not.toBeNull();
      expect(restored?.length).toBe(128);

      for (let i = 0; i < 128; i++) {
        expect(restored![i]).toBeCloseTo(original[i], 5);
      }
    });

    it('supports comma-separated string format fallback', () => {
      const original = makeVector(99);
      const commaSeparated = Array.from(original).join(',');
      const restored = deserializeDescriptor(commaSeparated);

      expect(restored).not.toBeNull();
      expect(restored?.length).toBe(128);
      expect(restored![0]).toBeCloseTo(original[0], 5);
    });

    it('returns null for invalid inputs or non-128 arrays', () => {
      expect(deserializeDescriptor(null)).toBeNull();
      expect(deserializeDescriptor(undefined)).toBeNull();
      expect(deserializeDescriptor('')).toBeNull();
      expect(deserializeDescriptor('not-a-vector')).toBeNull();
      expect(deserializeDescriptor(JSON.stringify([1, 2, 3]))).toBeNull(); // length 3, not 128
    });
  });

  describe('Distance to Confidence Mapping', () => {
    it('maps distance 0 to 100% confidence', () => {
      expect(distanceToConfidence(0)).toBe(100);
    });

    it('maps confident distances (<= 0.40) to >= 85% confidence', () => {
      expect(distanceToConfidence(0.2)).toBeGreaterThanOrEqual(90);
      expect(distanceToConfidence(0.35)).toBeGreaterThanOrEqual(80);
    });

    it('maps threshold distance (0.55) to acceptable match confidence', () => {
      const conf = distanceToConfidence(0.55);
      expect(conf).toBeGreaterThanOrEqual(65);
    });

    it('maps distant / non-matching vectors (>= 0.80) to 0%', () => {
      expect(distanceToConfidence(0.85)).toBe(0);
      expect(distanceToConfidence(1.2)).toBe(0);
    });
  });

  describe('findBestFaceMatch', () => {
    it('identifies the correct enrolled member from multiple candidates', () => {
      const aliceDesc = makeVector(10);
      const bobDesc = makeVector(20);
      const charlieDesc = makeVector(30);

      const enrolled: EnrolledFaceRecord[] = [
        {
          member: { id: 1, name: 'Alice Smith', memberCode: 'MEM-001', status: 'ACTIVE' },
          descriptor: aliceDesc,
        },
        {
          member: { id: 2, name: 'Bob Jones', memberCode: 'MEM-002', status: 'ACTIVE' },
          descriptor: bobDesc,
        },
        {
          member: { id: 3, name: 'Charlie Brown', memberCode: 'MEM-003', status: 'ACTIVE' },
          descriptor: charlieDesc,
        },
      ];

      // Live scan of Bob with tiny camera noise
      const liveBob = new Float32Array(bobDesc);
      liveBob[5] += 0.03;
      liveBob[20] -= 0.02;

      const match = findBestFaceMatch(liveBob, enrolled, 0.55);

      expect(match).not.toBeNull();
      expect(match?.member.name).toBe('Bob Jones');
      expect(match?.member.memberCode).toBe('MEM-002');
      expect(match?.isConfidentMatch).toBe(true);
      expect(match?.distance).toBeLessThan(0.3);
      expect(match?.confidence).toBeGreaterThan(80);
    });

    it('refuses match when distance exceeds threshold (unregistered stranger)', () => {
      const aliceDesc = makeVector(10);
      const enrolled: EnrolledFaceRecord[] = [
        {
          member: { id: 1, name: 'Alice Smith', memberCode: 'MEM-001', status: 'ACTIVE' },
          descriptor: aliceDesc,
        },
      ];

      // Stranger face
      const strangerDesc = makeVector(999);
      const match = findBestFaceMatch(strangerDesc, enrolled, 0.55);

      expect(match).not.toBeNull();
      expect(match?.isConfidentMatch).toBe(false);
      expect(match?.distance).toBeGreaterThan(0.55);
    });

    it('returns null when enrolled array is empty', () => {
      const live = makeVector(1);
      expect(findBestFaceMatch(live, [])).toBeNull();
    });
  });
});
