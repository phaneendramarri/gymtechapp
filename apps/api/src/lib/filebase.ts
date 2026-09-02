// filepath: apps/api/src/lib/filebase.ts
/**
 * Filebase S3-compatible object storage client (Phase 2.2).
 *
 * Filebase (https://filebase.com) is an S3-compatible object store. We use
 * it for member photos, plan artwork, and any other media uploaded through
 * the API. The endpoint is `https://s3.filebase.com`.
 *
 * Why Filebase instead of R2?
 *   - Single-vendor story on Cloudflare for compute, but the data
 *     is durably stored on Filebase's IPFS-backed infrastructure.
 *   - S3 API is well-known and battle-tested.
 *   - Signed URLs are issued via the standard S3 presigner.
 *
 * Tenant isolation:
 *   - Every object key is namespaced: `${gymId}/${objectKey}`. A
 *     presigned URL encodes the full key, so a URL for gym 5 cannot
 *     accidentally address an object under gym 6.
 *   - The media routes still gate access via `requireGym` before
 *     issuing a download URL.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface FilebaseConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Build an S3 client configured for Filebase. The Cloudflare Workers
 * runtime has the global `fetch` API but no Node `http` module, so we
 * pass `requestHandler` to keep AWS SDK v3 happy in the edge runtime.
 */
export function createFilebaseClient(cfg: FilebaseConfig): S3Client {
  return new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    // Force path-style addressing — Filebase's S3 endpoint only supports
    // virtual-host–style for newer SDKs; path-style is the safe default.
    forcePathStyle: true,
  });
}

/**
 * Upload an object. The `gymId` is prefixed to the key so objects from
 * different tenants are isolated by namespace.
 *
 * Returns the fully-qualified object key (including the gymId prefix),
 * which is what the caller must hand back to the URL signer.
 */
export async function putObject(
  client: S3Client,
  bucket: string,
  gymId: number,
  objectKey: string,
  body: ArrayBuffer | Uint8Array | Blob,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> {
  const fullKey = makeKey(gymId, objectKey);
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: fullKey,
    Body: body as any,
    ContentType: contentType,
    Metadata: metadata,
  });
  await client.send(cmd);
  return fullKey;
}

/**
 * Stream an object's bytes. Used by the authenticated download route.
 */
export async function getObject(
  client: S3Client,
  bucket: string,
  fullKey: string
): Promise<{ body: ReadableStream | Uint8Array; contentType?: string; size?: number } | null> {
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: fullKey })
    );
    if (!res.Body) return null;
    return {
      body: res.Body as unknown as ReadableStream,
      contentType: res.ContentType,
      size: res.ContentLength,
    };
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404) return null;
    if (err?.name === 'NoSuchKey') return null;
    throw err;
  }
}

export async function deleteObject(
  client: S3Client,
  bucket: string,
  fullKey: string
): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: fullKey }));
}

/**
 * Build a short-lived presigned URL that grants GET access to a specific
 * object. URL TTL is the main defense against URL sharing.
 */
export async function presignDownloadUrl(
  client: S3Client,
  bucket: string,
  fullKey: string,
  expiresInSeconds: number
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: fullKey });
  return await getSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
}

/**
 * Compose a tenant-scoped key.
 *   makeKey(5, "1735761234-photo.jpg") => "5/1735761234-photo.jpg"
 *
 * Caller is responsible for sanitizing `objectKey` so it cannot escape
 * the namespace (e.g. by including ".."). We refuse path-traversal
 * patterns explicitly because naive `replace(/[^A-Za-z0-9._-]/g, '_')`
 * turns ".." into "..", which is still dangerous.
 */
export function makeKey(gymId: number, objectKey: string): string {
  if (!Number.isInteger(gymId) || gymId <= 0) {
    throw new Error('Invalid gymId');
  }
  if (typeof objectKey !== 'string') {
    throw new Error('Invalid object key');
  }
  const trimmed = objectKey.trim();
  if (trimmed.length === 0) {
    throw new Error('Invalid object key');
  }
  // Reject any path-traversal pattern before sanitization.
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('Object key cannot contain path separators or ".."');
  }
  const safe = trimmed.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200);
  if (safe.length === 0) {
    throw new Error('Invalid object key');
  }
  return `${gymId}/${safe}`;
}

/**
 * Extract the gymId from a fully-qualified key. Returns null if the
 * key is malformed (e.g. doesn't start with an integer segment).
 */
export function parseGymIdFromKey(fullKey: string): number | null {
  const slash = fullKey.indexOf('/');
  if (slash <= 0) return null;
  const head = fullKey.substring(0, slash);
  const n = Number.parseInt(head, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}
