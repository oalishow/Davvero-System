export function resizeAndConvertToBase64(
  file: File,
  maxSize = 600,
  options: {
    preserveAlpha?: boolean;
    removeWhiteBg?: boolean;
    quality?: number;
    mimeType?: "image/png" | "image/jpeg" | "image/webp";
  } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Support high-resolution camera images up to 100MB seamlessly
    if (file.size > 100 * 1024 * 1024) {
      reject(new Error("O arquivo selecionado excede o limite de 100MB."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate proportional scale
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

        // Prevent zero or negative dimensions
        width = Math.max(1, width);
        height = Math.max(1, height);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          reject(new Error("Não foi possível obter o contexto 2D para renderização."));
          return;
        }

        // Enable high-quality smoothing for sharp vectors & heraldic details
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Clear canvas completely to keep transparent channel intact
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Optional white background removal ONLY from outer borders (Flood Fill / BFS)
        // This guarantees that white elements inside the shield/emblem (crosses, doves, banners) are NOT removed!
        if (options.removeWhiteBg) {
          try {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            const visited = new Uint8Array(width * height);
            const queue: number[] = [];

            // Helper to check if pixel is near-white boundary background
            const isNearWhite = (idx: number) => {
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];
              // Boundary background threshold
              return a > 40 && r >= 242 && g >= 242 && b >= 242;
            };

            // Seed only the outer perimeter (top, bottom, left, right edges)
            for (let x = 0; x < width; x++) {
              const topIdx = (0 * width + x) * 4;
              if (isNearWhite(topIdx)) {
                queue.push(x, 0);
                visited[0 * width + x] = 1;
              }
              const botIdx = ((height - 1) * width + x) * 4;
              if (isNearWhite(botIdx)) {
                queue.push(x, height - 1);
                visited[(height - 1) * width + x] = 1;
              }
            }
            for (let y = 0; y < height; y++) {
              const leftIdx = (y * width + 0) * 4;
              if (isNearWhite(leftIdx) && !visited[y * width + 0]) {
                queue.push(0, y);
                visited[y * width + 0] = 1;
              }
              const rightIdx = (y * width + (width - 1)) * 4;
              if (isNearWhite(rightIdx) && !visited[y * width + (width - 1)]) {
                queue.push(width - 1, y);
                visited[y * width + (width - 1)] = 1;
              }
            }

            // BFS Flood Fill from outer edges only
            let head = 0;
            while (head < queue.length) {
              const qx = queue[head++];
              const qy = queue[head++];
              const pIdx = (qy * width + qx) * 4;

              // Make this outer background pixel transparent
              data[pIdx + 3] = 0;

              // Check 4 neighbors
              const neighbors = [
                [qx + 1, qy],
                [qx - 1, qy],
                [qx, qy + 1],
                [qx, qy - 1]
              ];

              for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const nPos = ny * width + nx;
                  if (!visited[nPos]) {
                    visited[nPos] = 1;
                    const nIdx = nPos * 4;
                    if (isNearWhite(nIdx)) {
                      queue.push(nx, ny);
                    }
                  }
                }
              }
            }

            ctx.putImageData(imgData, 0, 0);
          } catch (err) {
            console.warn("Could not execute flood fill background removal:", err);
          }
        }

        const isExplicitPngOrWebp =
          file.type === "image/png" ||
          file.type === "image/webp" ||
          file.type === "image/svg+xml" ||
          options.preserveAlpha === true;

        const targetMime = options.mimeType || (isExplicitPngOrWebp ? "image/png" : "image/jpeg");

        if (targetMime === "image/png") {
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve(canvas.toDataURL("image/jpeg", options.quality || 0.85));
        }
      };

      img.onerror = () => {
        reject(new Error("Erro ao carregar a imagem selecionada. Verifique se o formato é válido."));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };

    reader.onerror = () => {
      reject(new Error("Erro ao ler o arquivo de imagem no navegador."));
    };

    reader.readAsDataURL(file);
  });
}



