/**
 * Compresses an image data URL or image source to reasonable dimensions and file size.
 * Prevents huge multi-megabyte payloads that cause slow Firestore saves or size limit errors.
 */
export const compressOriginalImage = async (
  imageSrc: string,
  maxDim = 800,
  quality = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(width, 1);
      canvas.height = Math.max(height, 1);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(imageSrc);
        return;
      }

      // Smooth rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Return high quality but compact JPEG
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      // Fallback
      resolve(imageSrc);
    };
    img.src = imageSrc;
  });
};

/**
 * Crops an image according to pixelCrop rectangle while preserving original aspect ratio.
 */
export const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  maxDim = 800,
  quality = 0.82
): Promise<string> => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = imageSrc;

  // Create an image and wait for it to load
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  if (!pixelCrop || !pixelCrop.width || !pixelCrop.height) {
    return compressOriginalImage(imageSrc, maxDim, quality);
  }

  let targetWidth = pixelCrop.width;
  let targetHeight = pixelCrop.height;

  // Downscale if larger than maxDim to ensure quick Firestore persistence
  if (targetWidth > maxDim || targetHeight > maxDim) {
    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
      targetWidth = maxDim;
    } else {
      targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
      targetHeight = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(targetWidth, 1);
  canvas.height = Math.max(targetHeight, 1);
  const ctx = canvas.getContext('2d');

  if (!ctx) return imageSrc;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the cropped portion of the image onto the canvas with proper aspect ratio
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  // Export as compact JPEG
  return canvas.toDataURL('image/jpeg', quality);
};

