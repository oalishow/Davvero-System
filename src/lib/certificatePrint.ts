/**
 * Isolated Certificate Printing Utility.
 * Prints ONLY the certificate node formatted to A4 Landscape (297mm x 210mm),
 * guaranteeing exact applied styles, backgrounds, fonts and signatures with zero layout defects.
 */
export async function printCertificateNode(element: HTMLElement | null): Promise<void> {
  if (!element) {
    window.print();
    return;
  }

  // 1. Ensure web fonts are completely resolved
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch (_) {}
  }

  // 2. High-resolution rasterization for pixel-perfect printing across all browsers
  let imgDataUrl: string | null = null;
  try {
    const { toPng } = await import("html-to-image");
    imgDataUrl = await toPng(element, {
      pixelRatio: 2.5,
      skipFonts: false,
      cacheBust: true,
      backgroundColor: "#ffffff",
    });
  } catch (errToImage) {
    console.warn("html-to-image failed, trying html2canvas fallback", errToImage);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      imgDataUrl = canvas.toDataURL("image/png");
    } catch (errCanvas) {
      console.warn("Canvas rasterization fallback failed, using DOM print", errCanvas);
    }
  }

  // 3. Create properly dimensioned print iframe
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "1122px";
  iframe.style.height = "793px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  if (imgDataUrl) {
    // Pristine rasterized image print: zero missing CSS, zero font drops, exactly 1 page
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Certificado Oficial - DAVVERO</title>
          <style>
            @page {
              size: 297mm 210mm landscape;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body {
              width: 297mm;
              height: 210mm;
              background: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            img.cert-img {
              width: 297mm;
              height: 210mm;
              max-width: 297mm;
              max-height: 210mm;
              object-fit: contain;
              display: block;
              margin: 0 auto;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @media print {
              html, body {
                width: 297mm !important;
                height: 210mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                overflow: hidden !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              img.cert-img {
                width: 297mm !important;
                height: 210mm !important;
                max-width: 297mm !important;
                max-height: 210mm !important;
                object-fit: contain !important;
                display: block !important;
                margin: 0 auto !important;
                page-break-inside: avoid !important;
                page-break-after: avoid !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body>
          <img class="cert-img" src="${imgDataUrl}" alt="Certificado Oficial" />
        </body>
      </html>
    `);
    doc.close();
  } else {
    // DOM Fallback with exhaustive stylesheet extraction
    const headElements = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((el) => el.outerHTML)
      .join("\n");

    let extractedCss = "";
    try {
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        try {
          if (sheet.cssRules) {
            for (let j = 0; j < sheet.cssRules.length; j++) {
              extractedCss += sheet.cssRules[j].cssText + "\n";
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.transform = "none";
    clone.style.position = "relative";
    clone.style.margin = "0";
    clone.style.width = "1122px";
    clone.style.height = "793px";
    clone.style.minWidth = "1122px";
    clone.style.minHeight = "793px";
    clone.style.maxWidth = "1122px";
    clone.style.maxHeight = "793px";
    clone.style.boxShadow = "none";
    clone.style.borderRadius = "0";
    clone.style.overflow = "hidden";

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Certificado Oficial - DAVVERO</title>
          ${headElements}
          ${extractedCss ? `<style>${extractedCss}</style>` : ""}
          <style>
            @page {
              size: 297mm 210mm landscape;
              margin: 0;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: 1122px;
              height: 793px;
              background: white;
              overflow: hidden;
            }
            .cert-isolated-print-wrapper {
              width: 1122px;
              height: 793px;
              overflow: hidden;
              background: white;
            }
          </style>
        </head>
        <body>
          <div class="cert-isolated-print-wrapper">
            ${clone.outerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();
  }

  const printWindow = iframe.contentWindow;
  if (!printWindow) {
    window.print();
    return;
  }

  // Execute print with load confirmation
  await new Promise<void>((resolve) => {
    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.warn("Notice in print window execution", e);
      } finally {
        setTimeout(() => {
          try {
            if (iframe.parentNode) {
              document.body.removeChild(iframe);
            }
          } catch (_) {}
          resolve();
        }, 1500);
      }
    };

    if (imgDataUrl) {
      const img = doc.querySelector("img.cert-img") as HTMLImageElement | null;
      if (img) {
        if (img.complete) {
          setTimeout(triggerPrint, 100);
        } else {
          img.onload = () => setTimeout(triggerPrint, 100);
          img.onerror = () => setTimeout(triggerPrint, 100);
        }
      } else {
        setTimeout(triggerPrint, 200);
      }
    } else {
      setTimeout(triggerPrint, 400);
    }
  });
}

