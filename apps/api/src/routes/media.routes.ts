// filepath: apps/api/src/routes/media.routes.ts
import { Hono } from 'hono';
import { requireGym } from '../middleware/auth';
import { getCtx } from '../middleware/context';
import { safeHandler } from '../middleware/params';
import { jsonErr, jsonOk } from './helpers';

export const mediaRoutes = new Hono();

// Upload media
mediaRoutes.post('/upload', requireGym, safeHandler(async (c) => {
  const ctx = getCtx(c);
  try {
    const contentType = c.req.header('Content-Type') || '';
    let fileBuffer: ArrayBuffer | null = null;
    let fileName = `image-${Date.now()}.jpg`;
    let fileMime = 'image/jpeg';

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

    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${ctx.gymId}/${Date.now()}-${safeName}`;
    if (ctx.env.MEDIA_BUCKET) {
      await ctx.env.MEDIA_BUCKET.put(storageKey, fileBuffer, {
        httpMetadata: { contentType: fileMime },
        customMetadata: { gymId: String(ctx.gymId), uploadedBy: String(ctx.user?.id ?? '') },
      });
    }
    return jsonOk({
      success: true, storageKey,
      url: `/api/v1/media/${storageKey}`,
      fileName, mimeType: fileMime, sizeBytes: fileBuffer.byteLength,
    }, 201);
  } catch (err: any) {
    return jsonErr(`Image upload failed: ${err.message}`, 500);
  }
}));

// Get media object — note: this is public (no tenant gate)
mediaRoutes.get('/:gymId/:key', safeHandler(async (c) => {
  const ctx = getCtx(c);
  const params = c.req.param() as { gymId: string; key: string };
  const fullKey = `${params.gymId}/${params.key}`;
  if (!ctx.env.MEDIA_BUCKET) return jsonErr('R2 Object Storage is not configured', 503);
  const object = await ctx.env.MEDIA_BUCKET.get(fullKey);
  if (!object) return jsonErr('Media object not found', 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}));