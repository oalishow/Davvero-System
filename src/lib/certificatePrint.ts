/**
 * Isolated Certificate Printing Utility.
 * Prints ONLY the certificate node formatted to A4 Landscape,
 * preventing any headers, navigation, footers or background UI from appearing.
 */
export function printCertificateNode(element: HTMLElement | null): void {
  if (!element) {
    window.print();
    return;
  }

  // Create an invisible iframe for isolated printing
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // Extract all stylesheet links and style tags from current document
  const headElements = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style')
  )
    .map((el) => el.outerHTML)
    .join("\n");

  // Clone the certificate node to avoid modifying the visual DOM in the app
  const clone = element.cloneNode(true) as HTMLElement;
  // Reset any scaling or translate applied by responsive wrappers
  clone.style.transform = "none";
  clone.style.position = "relative";
  clone.style.margin = "0";
  clone.style.width = "1122px";
  clone.style.height = "793px";
  clone.style.boxShadow = "none";
  clone.style.borderRadius = "0";

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Certificado Oficial - DAVVERO</title>
        ${headElements}
        <style>
          @page {
            size: A4 landscape;
            margin: 0;
          }
          @media print {
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
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
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          .cert-isolated-print-wrapper {
            width: 1122px;
            height: 793px;
            background: white;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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

  const printWindow = iframe.contentWindow;
  if (!printWindow) {
    window.print();
    return;
  }

  // Allow images, web fonts and styles to render before opening print dialog
  setTimeout(() => {
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
      }, 3000);
    }
  }, 450);
}
