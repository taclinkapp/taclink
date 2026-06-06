/**
 * Client-side image compression so big phone camera photos (often 8–12MB on
 * modern Android devices) can be uploaded without hitting our 5MB limit.
 *
 * - Downscales to fit within `maxDimension` (default 1600px) preserving aspect.
 * - Re-encodes as JPEG at the given quality.
 * - Falls back to the original file if anything fails or the result is larger.
 */
export async function compressImageFile(
  file: File,
  opts: { maxDimension?: number; quality?: number; maxBytes?: number } = {}
): Promise<File> {
  const { maxDimension = 1600, quality = 0.82, maxBytes = 5 * 1024 * 1024 } = opts;

  if (!file.type.startsWith('image/')) return file;
  // HEIC/HEIF can't be decoded by canvas in most browsers — return as-is.
  if (/heic|heif/i.test(file.type)) return file;
  // GIFs must stay as GIFs to preserve animation; canvas.toBlob would turn them into static JPEGs.
  if (file.type === 'image/gif') return file;
  if (file.size <= maxBytes && file.type === 'image/jpeg') return file;

  try {
    const bitmap = await createBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDimension);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
    if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
      (bitmap as ImageBitmap).close();
    }

    let q = quality;
    let blob = await canvasToBlob(canvas, q);
    // Iterate down if still too large.
    while (blob && blob.size > maxBytes && q > 0.4) {
      q -= 0.12;
      blob = await canvasToBlob(canvas, q);
    }
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.(png|webp|heic|heif|jpe?g)$/i, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

function fitWithin(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

async function createBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
}
