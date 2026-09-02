// filepath: apps/api/src/routes/media.routes.ts
/**
 * Media routes (Phase 2.2 of the security review).
 *
 *  POST /api/v1/media/upload     — authenticated; uploads to Filebase,
 *                                  returns a short-lived signed URL
 *  GET  /api/v1/media/sign?key=… — authenticated; returns a fresh
 *                                  signed URL for a previously-uploaded
 *                                  object (used by the SPA to refresh
 *                                  <img> tags before they expire)
 *  GET  /api/v1/media/:gymId/:key — AUTHENTICATED download route. The
 *                                  old unauthenticated public route is
 *                                  removed — see commit history.
 *
 * All routes require a valid session cookie + CSRF token. Object keys
 * are tenant-namespaced; cross-tenant reads are refused at the service
 * layer (`fetchForGym` / `presignForGym`).
 */
import { Hono } from 'hono';
import { requireGym } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import {
  uploadMedia,
  presignForGym,
  fetchForGym,
  deleteForGym,
  parseGymIdFromKey,
  MAX_UPLOAD_BYTES,
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  MAX_SIGNED_URL_TTL_SECONDS,
} from '../lib/media';
import { jsonErr, jsonOk } from './helpers';

export const mediaRoutes = new Hono();

/**
 * Upload. Accepts either `multipart/form-data` (with a `file` field) or
 * `application/octet-stream` (raw body). The session identifies the
 * tenant; the body carries the bytes.
 */
mediaRoutes.post('/upload', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  try {
    const contentType = c.req.header('Content-Type') || '';
    let fileBuffer: ArrayBuffer | null = null;
    let fileName = `upload-${Date.now()}`;
    let fileMime = 'application/octet-stream';

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.raw.formData();
      const file = formData.get('file') as File | null;
      if (!file) return jsonErr('No file provided in form data', 400);
      fileBuffer = await file.arrayBuffer();
      fileName = file.name || fileName;
      fileMime = file.type || fileMime;
    } else {
      fileBuffer = await c.req.raw.arrayBuffer();
      fileMime = contentType || fileMime;
    }
    if (!fileBuffer || fileBuffer.byteLength === 0) return jsonErr('Empty file upload', 400);
    if (fileBuffer.byteLength > MAX_UPLOAD_BYTES) {
      return jsonErr(`File too large; maximum is ${MAX_UPLOAD_BYTES} bytes`, 413);
    }

    const result = await uploadMedia(
      { env: ctx.env as any },
      {
        gymId: ctx.gymId!,
        body: fileBuffer,
        mimeType: fileMime,
        fileName,
        uploadedByUserId: ctx.user?.id,
      }
    );
    return jsonOk(
      {
        success: true,
        objectKey: result.objectKey,
        relativeKey: result.relativeKey,
        url: result.signedUrl,
        expiresAt: result.expiresAt,
        fileName,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
      },
      201
    );
  } catch (err: any) {
    if (err?.code === 'MEDIA_NOT_CONFIGURED') {
      return jsonErr(err.message, 503);
    }
    console.error('Media upload failed:', err);
    return jsonErr(`Image upload failed: ${err.message}`, 500);
  }
}));

/**
 * Sign a new download URL for a previously-uploaded object.
 *
 * The SPA calls this when an <img> tag's URL is about to expire. The
 * signed URL is short-lived (15 min default, 1h max).
 */
mediaRoutes.get('/sign', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const key = c.req.query('key');
  const ttlRaw = c.req.query('ttl');
  if (!key) return jsonErr('Missing required query parameter: key', 400);

  // Defense in depth: refuse to sign a key that doesn't belong to this tenant.
  const keyGym = parseGymIdFromKey(key);
  if (keyGym === null) return jsonErr('Malformed object key', 400);
  if (keyGym !== ctx.gymId) {
    return jsonErr('Object key is outside the requested tenant', 403);
  }

  let ttl = DEFAULT_SIGNED_URL_TTL_SECONDS;
  if (ttlRaw !== undefined) {
    const parsed = Number.parseInt(ttlRaw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return jsonErr('Invalid ttl parameter', 400);
    }
    if (parsed > MAX_SIGNED_URL_TTL_SECONDS) {
      return jsonErr(`ttl exceeds maximum of ${MAX_SIGNED_URL_TTL_SECONDS} seconds`, 400);
    }
    ttl = parsed;
  }

  try {
    const { url, expiresAt } = await presignForGym({ env: ctx.env as any }, ctx.gymId!, key, ttl);
    return jsonOk({ url, expiresAt, key });
  } catch (err: any) {
    if (err?.code === 'MEDIA_NOT_CONFIGURED') {
      return jsonErr(err.message, 503);
    }
    return jsonErr(err.message, 500);
  }
}));

/**
 * Authenticated download route. The caller is the session-holding user;
 * the URL is `/:gymId/:key` to mirror the S3 namespace. Tenant scoping
 * is enforced via `fetchForGym` (rejects cross-tenant reads).
 */
mediaRoutes.get('/:gymId/:key', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const params = c.req.param() as { gymId: string; key: string };
  const gymIdStr = params.gymId;
  const tail = params.key;
  const fullKey = `${gymIdStr}/${tail}`;

  // URL must point to the caller's own tenant.
  const keyGym = parseGymIdFromKey(fullKey);
  if (keyGym === null) return jsonErr('Malformed object key', 400);
  if (keyGym !== ctx.gymId) {
    return jsonErr('Object key is outside the requested tenant', 403);
  }

  try {
    const obj = await fetchForGym({ env: ctx.env as any }, ctx.gymId!, fullKey);
    if (!obj) return jsonErr('Media object not found', 404);

    const headers = new Headers();
    if (obj.contentType) headers.set('Content-Type', obj.contentType);
    if (typeof obj.size === 'number') headers.set('Content-Length', String(obj.size));
    // Authenticated route — don't cache in shared proxies.
    headers.set('Cache-Control', 'private, max-age=900');
    return new Response(obj.body as any, { headers });
  } catch (err: any) {
    if (err?.code === 'MEDIA_NOT_CONFIGURED') {
      return jsonErr(err.message, 503);
    }
    console.error('Media fetch failed:', err);
    return jsonErr(`Media fetch failed: ${err.message}`, 500);
  }
}));

/**
 * Authenticated delete. Owner-only via `requireRole` if we want stricter
 * access control later; for now any user in the tenant can delete their
 * gym's media.
 */
mediaRoutes.delete('/:gymId/:key', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  const params = c.req.param() as { gymId: string; key: string };
  const fullKey = `${params.gymId}/${params.key}`;
  const keyGym = parseGymIdFromKey(fullKey);
  if (keyGym === null) return jsonErr('Malformed object key', 400);
  if (keyGym !== ctx.gymId) {
    return jsonErr('Object key is outside the requested tenant', 403);
  }
  try {
    await deleteForGym({ env: ctx.env as any }, ctx.gymId!, fullKey);
    return jsonOk({ success: true, deleted: fullKey });
  } catch (err: any) {
    if (err?.code === 'MEDIA_NOT_CONFIGURED') {
      return jsonErr(err.message, 503);
    }
    return jsonErr(err.message, 500);
  }
}));
