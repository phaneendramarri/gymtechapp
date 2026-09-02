/**
 * Client-Side Image Compression & Base64 Encoder
 * Compresses member photos & logos to ultra-lightweight WebP format (< 25 KB)
 * Allows storing images directly inside Cloudflare D1 with 0 external paid services.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function compressAndConvertToBase64(
  file: File,
  options: CompressionOptions = {}
): Promise<{ base64: string; sizeBytes: number; originalSizeBytes: number }> {
  const { maxWidth = 320, maxHeight = 320, quality = 0.75 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio bounding box
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        // Smooth image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as lightweight WebP (or fallback JPEG)
        let base64 = canvas.toDataURL('image/webp', quality);
        if (!base64.startsWith('data:image/webp')) {
          base64 = canvas.toDataURL('image/jpeg', quality);
        }

        resolve({
          base64,
          sizeBytes: Math.round((base64.length * 3) / 4),
          originalSizeBytes: file.size,
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
}
