/**
 * Utilitário profissional para compressão e sanitização de imagens (avatares, fotos de perfil e logos)
 * Reduz fotos de celulares (6MB - 25MB) para avatares ultraleves de ~15KB - 30KB em JPEG com alta nitidez,
 * evitando que o limite de 1MB por documento do Firestore seja ultrapassado.
 */

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  maxFileSizeMB?: number;
}

/**
 * Comprime uma imagem de arquivo ou DataURL para um avatar de tamanho reduzido e qualidade otimizada.
 */
export async function compressAvatar(
  input: File | Blob | string,
  options: CompressOptions = {}
): Promise<string> {
  const { maxDimension = 300, quality = 0.8, maxFileSizeMB = 25 } = options;

  if (input instanceof File && input.size > maxFileSizeMB * 1024 * 1024) {
    throw new Error(`O arquivo excede o limite máximo permitido de ${maxFileSizeMB}MB.`);
  }

  return new Promise((resolve, reject) => {
    let srcUrl: string;
    let shouldRevoke = false;

    if (typeof input === "string") {
      srcUrl = input;
    } else {
      srcUrl = URL.createObjectURL(input);
      shouldRevoke = true;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width <= 0 || height <= 0) {
          if (shouldRevoke) URL.revokeObjectURL(srcUrl);
          return resolve(typeof input === "string" ? input : "");
        }

        // Calcula dimensões proporcionais preservando proporção
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          if (shouldRevoke) URL.revokeObjectURL(srcUrl);
          return resolve(typeof input === "string" ? input : "");
        }

        // Suavização de alta qualidade
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Preenchimento branco para evitar transparência preta em PNGs convertidos para JPEG
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (shouldRevoke) URL.revokeObjectURL(srcUrl);
        resolve(dataUrl);
      } catch (err) {
        if (shouldRevoke) URL.revokeObjectURL(srcUrl);
        reject(err);
      }
    };

    img.onerror = (err) => {
      if (shouldRevoke) URL.revokeObjectURL(srcUrl);
      reject(new Error("Falha ao carregar a imagem para processamento."));
    };

    img.src = srcUrl;
  });
}

/**
 * Sanitiza e re-comprime uma lista de profissionais caso contenham fotos em alta resolução no Firestore
 */
export async function sanitizeProfessionalList<T extends { photoUrl?: string | null }>(
  list: T[]
): Promise<T[]> {
  if (!Array.isArray(list)) return [];

  const sanitized = await Promise.all(
    list.map(async (prof) => {
      if (!prof.photoUrl || typeof prof.photoUrl !== "string") {
        return prof;
      }
      // Se a string da foto tiver mais de 60KB (aprox 80.000 caracteres base64), re-comprime
      if (prof.photoUrl.startsWith("data:image/") && prof.photoUrl.length > 80000) {
        try {
          const compressed = await compressAvatar(prof.photoUrl, { maxDimension: 260, quality: 0.75 });
          return { ...prof, photoUrl: compressed };
        } catch (e) {
          console.warn("[Sanitizer] Não foi possível re-comprimir foto de profissional:", e);
          return prof;
        }
      }
      return prof;
    })
  );

  return sanitized;
}
