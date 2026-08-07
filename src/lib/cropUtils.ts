export const getCroppedImg = async (imageSrc: string, pixelCrop: any, resultWidth = 400): Promise<string> => {
  const image = new Image();
  image.src = imageSrc;
  
  // Create an image and wait for it to load
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const canvas = document.createElement('canvas');
  canvas.width = resultWidth;
  canvas.height = resultWidth;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  // Draw the cropped portion of the image onto the fixed-size canvas
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    resultWidth,
    resultWidth
  );

  // Export as 85% quality JPEG
  return canvas.toDataURL('image/jpeg', 0.85);
};
