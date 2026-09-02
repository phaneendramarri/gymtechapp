// filepath: apps/api/src/lib/media.ts
/**
 * Media service — wraps Filebase (S3-compatible) with tenant scoping and
 * short-lived signed download URLs (Phase 2.2 of the security review).
 *
 * Design:
 *   1. All uploads are authenticated via `requireGym`. The key namespace
 *      is `{gymId}/{objectKey}` so a presigned URL for gym 5 cannot
 *      resolve to an object under gym 6.
 *   2. Downloads go through this service: callers must present a valid
 *      session cookie AND a non-expired signed URL. The signed URL is the
 *      primary authorization; the cookie just lets us identify the tenant.
 *   3. URLs default to a 15-minute TTL. This bounds the damage of a
 *      leaked URL without being so short that legitimate UI flows break.
 *
 * For callers that need a "stable" URL inside their own UI (e.g. an
 * `<img src>` rendered in a member's profile), the pattern is:
 *   - On load, ask the API for a signed URL
 *   - The browser uses that URL for up to 15 minutes
 *   - If the page is open longer, re-fetch a new signed URL
 */
import {
  createFilebaseClient,
  putObject,
  getObject,
  deleteObject,
  presignDownloadUrl,
  makeKey as fbMakeKey,
  parseGymIdFromKey,
  type FilebaseConfig,
} from './filebase';

export const DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60; // 15 minutes
export const MAX_SIGNED_URL_TTL_SECONDS = 60 * 60;     // 1 hour hard cap
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;      // 10 MB per object

export interface MediaConfig extends FilebaseConfig {
  appUrl: string;            // used to compose the download URL
  publicBaseUrl?: string;    // optional CDN base for serving; defaults to Filebase
}

export interface MediaContext {
  env: {
    FILEBASE_ENDPOINT?: string;
    FILEBASE_REGION?: string;
    FILEBASE_BUCKET?: string;
    FILEBASE_ACCESS_KEY_ID?: string;
    FILEBASE_SECRET_ACCESS_KEY?: string;
    APP_URL?: string;
  };
}

export interface UploadInput {
  gymId: number;
  body: ArrayBuffer;
  mimeType: string;
  fileName: string;
  uploadedByUserId?: number;
}

export interface UploadResult {
  /** Fully-qualified S3 key (gymId/objectKey). */
  objectKey: string;
  /** Tenant-relative key, suitable for storing in member/plan tables. */
  relativeKey: string;
  /** Short-lived URL the browser can use to download the object. */
  signedUrl: string;
  /** Expiry epoch seconds. */
  expiresAt: number;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Read Filebase config from the Cloudflare Worker env. Throws a clear
 * error if any required setting is missing.
 */
export function readMediaConfig(ctx: MediaContext): MediaConfig {
  const endpoint = ctx.env.FILEBASE_ENDPOINT;
  const region = ctx.env.FILEBASE_REGION;
  const bucket = ctx.env.FILEBASE_BUCKET;
  const accessKeyId = ctx.env.FILEBASE_ACCESS_KEY_ID;
  const secretAccessKey = ctx.env.FILEBASE_SECRET_ACCESS_KEY;
  const appUrl = ctx.env.APP_URL;
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    throw Object.assign(
      new Error(
        'Filebase is not configured. Set FILEBASE_ENDPOINT, FILEBASE_REGION, ' +
        'FILEBASE_BUCKET, FILEBASE_ACCESS_KEY_ID, FILEBASE_SECRET_ACCESS_KEY as ' +
        '`wrangler secret put` or in wrangler.jsonc vars.'
      ),
      { code: 'MEDIA_NOT_CONFIGURED' }
    );
  }
  if (!appUrl) {
    throw new Error('APP_URL is required to compose media URLs');
  }
  return { endpoint, region, bucket, accessKeyId, secretAccessKey, appUrl };
}

export async function uploadMedia(ctx: MediaContext, input: UploadInput): Promise<UploadResult> {
  if (input.body.byteLength === 0) {
    throw new Error('Empty upload');
  }
  if (input.body.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`Upload exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes`);
  }
  const cfg = readMediaConfig(ctx);
  const client = createFilebaseClient(cfg);
  const objectKey = generateObjectKey(input.fileName);
  const fullKey = await putObject(
    client,
    cfg.bucket,
    input.gymId,
    objectKey,
    input.body,
    input.mimeType,
    input.uploadedByUserId ? { uploadedBy: String(input.uploadedByUserId) } : undefined
  );
  const signedUrl = await presignDownloadUrl(client, cfg.bucket, fullKey, DEFAULT_SIGNED_URL_TTL_SECONDS);
  return {
    objectKey: fullKey,
    relativeKey: `${input.gymId}/${objectKey}`,
    signedUrl,
    expiresAt: Math.floor(Date.now() / 1000) + DEFAULT_SIGNED_URL_TTL_SECONDS,
    mimeType: input.mimeType,
    sizeBytes: input.body.byteLength,
  };
}

/**
 * Generate a presigned URL for an object the caller is authorized to see.
 * Verifies that the requested gymId matches the key prefix — otherwise
 * a user from gym 5 could read objects under gym 6 by passing
 * `objectKey="6/secret.jpg"`.
 */
export async function presignForGym(
  ctx: MediaContext,
  gymId: number,
  fullKey: string,
  ttlSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS
): Promise<{ url: string; expiresAt: number }> {
  if (parseGymIdFromKey(fullKey) !== gymId) {
    throw new Error('Object key is outside the requested tenant');
  }
  const ttl = Math.max(1, Math.min(ttlSeconds, MAX_SIGNED_URL_TTL_SECONDS));
  const cfg = readMediaConfig(ctx);
  const client = createFilebaseClient(cfg);
  const url = await presignDownloadUrl(client, cfg.bucket, fullKey, ttl);
  return { url, expiresAt: Math.floor(Date.now() / 1000) + ttl };
}

export interface FetchedObject {
  body: ReadableStream | Uint8Array;
  contentType?: string;
  size?: number;
}

/**
 * Download an object for the authenticated tenant. Verifies the gymId
 * prefix before issuing the request.
 */
export async function fetchForGym(
  ctx: MediaContext,
  gymId: number,
  fullKey: string
): Promise<FetchedObject | null> {
  if (parseGymIdFromKey(fullKey) !== gymId) {
    throw new Error('Object key is outside the requested tenant');
  }
  const cfg = readMediaConfig(ctx);
  const client = createFilebaseClient(cfg);
  return await getObject(client, cfg.bucket, fullKey);
}

export async function deleteForGym(
  ctx: MediaContext,
  gymId: number,
  fullKey: string
): Promise<void> {
  if (parseGymIdFromKey(fullKey) !== gymId) {
    throw new Error('Object key is outside the requested tenant');
  }
  const cfg = readMediaConfig(ctx);
  const client = createFilebaseClient(cfg);
  await deleteObject(client, cfg.bucket, fullKey);
}

/**
 * Generate an object key with a timestamp prefix for natural sort order
 * and a sanitized filename. Two uploads in the same millisecond are
 * disambiguated by a random suffix.
 */
function generateObjectKey(fileName: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffffff).toString(36).padStart(4, '0');
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80) || 'file';
  return `${ts}-${rand}-${safe}`;
}

export { fbMakeKey as makeKey, parseGymIdFromKey };
