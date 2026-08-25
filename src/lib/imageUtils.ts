export function resizeAndConvertToBase64(
  file: File,
  maxSize = 250,
  options: {
    preserveAlpha?: boolean;
    removeWhiteBg?: boolean;
    quality?: number;
    mimeType?: "image/png" | "image/jpeg" | "image/webp";
  } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          reject(new Error("Não foi possível obter o contexto 2D"));
          return;
        }

        // Draw image keeping transparent channel
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Optional white background removal (ideal for scanned signatures & logos)
        if (options.removeWhiteBg) {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // If pixel is white or near white, make it transparent
            if (r > 230 && g > 230 && b > 230) {
              data[i + 3] = 0; // completely transparent
            } else if (r > 190 && g > 190 && b > 190) {
              // Smooth gradient feathering
              const avg = (r + g + b) / 3;
              const alphaFactor = Math.max(0, (255 - avg) / 65);
              data[i + 3] = Math.round(data[i + 3] * alphaFactor);
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

        const isPng =
          file.type === "image/png" ||
          file.type === "image/webp" ||
          file.type === "image/svg+xml" ||
          options.preserveAlpha ||
          options.mimeType === "image/png";

        const targetMime = options.mimeType || (isPng ? "image/png" : "image/jpeg");

        if (targetMime === "image/png") {
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve(canvas.toDataURL("image/jpeg", options.quality || 0.85));
        }
      };
      img.onerror = reject;
      if (e.target?.result) img.src = e.target.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

