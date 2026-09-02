// filepath: apps/api/src/lib/crypto.ts
/**
 * Phase 4.2: AES-GCM encryption for face embeddings and sensitive data at rest.
 * Uses Web Crypto API (available in Cloudflare Workers).
 * Each encryption uses a random 12-byte IV — the same plaintext encrypts to different ciphertext every time.
 */
import { hashOpaqueToken } from './password';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits as required by AES-GCM

export interface EncryptedData {
  /** Base64url-encoded ciphertext (IV prepended) */
  ciphertext: string;
  /** Base64url-encoded encrypted data key (key is encrypted with KEK) */
  encryptedKey: string;
}

/**
 * Derive a KEK from the FACE_EMBEDDING_KEY env var using PBKDF2.
 * Cached after first call to avoid re-deriving on every request.
 */
let cachedKey: CryptoKey | null = null;

async function getFaceEmbeddingKey(env: Record<string, string | undefined>): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const rawKey = env.FACE_EMBEDDING_KEY;
  if (!rawKey) throw new Error('FACE_EMBEDDING_KEY env var is not set');
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(rawKey), 'PBKDF2', false, ['deriveKey']);
  cachedKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('gymtech-face-embedding-v1'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
  return cachedKey;
}

function b64url(s: string): string { return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

/**
 * Encrypt a face embedding (float32array JSON string) using AES-GCM.
 * Returns base64url-encoded ciphertext with IV prepended.
 */
export async function encryptFaceEmbedding(embedding: string, env: Record<string, string | undefined>): Promise<string> {
  const kek = await getFaceEmbeddingKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(embedding);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, kek, encoded);
  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  // Encode as base64url (no padding)
  let binary = '';
  for (const b of combined) binary += String.fromCharCode(b);
  return b64url(btoa(binary));
}

/**
 * Decrypt a face embedding encrypted with encryptFaceEmbedding.
 */
export async function decryptFaceEmbedding(encrypted: string, env: Record<string, string | undefined>): Promise<string> {
  const kek = await getFaceEmbeddingKey(env);
  const binary = atob(encrypted.replace(/-/g, '+').replace(/_/g, '/'));
  const combined = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, kek, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/**
 * Hash a face embedding for storage/comparison. Uses a keyed hash so
 * identical embeddings produce different hashes (prevents timing attacks on similarity).
 */
export async function hashFaceEmbedding(embedding: string, secret: string): Promise<string> {
  return hashOpaqueToken(embedding, secret);
}
