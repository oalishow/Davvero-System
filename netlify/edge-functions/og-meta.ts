export default async function (request: Request, context: any) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("event");

  // Only intercept if an event ID is requested
  if (!eventId) {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return response;
  }

  try {
    // Fetch event data from Firestore REST API
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/banco-de-dados-fajopa/databases/(default)/documents/artifacts/banco-de-dados-fajopa/public/data/events/${encodeURIComponent(eventId)}`;
    const eventRes = await fetch(firestoreUrl);
    
    if (!eventRes.ok) {
      return response;
    }

    const eventJson = await eventRes.json();
    const fields = eventJson.fields || {};

    const title = fields.title?.stringValue || "Evento Acadêmico";
    const speaker = fields.speaker?.stringValue || "";
    const startDate = fields.startDate?.stringValue || "";
    const format = fields.format?.stringValue || "presencial";
    const location = fields.location?.stringValue || fields.locationOrLink?.stringValue || "";
    const description = fields.description?.stringValue || "";
    const imageUrl = fields.imageUrl?.stringValue || "https://davvero.netlify.app/icon.svg";

    const escapeHtml = (str: string) =>
      String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const formatDate = (isoString?: string) => {
      if (!isoString) return "";
      const d = new Date(isoString);
      return isNaN(d.getTime())
        ? ""
        : d.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          });
    };

    const formatTime = (isoString?: string) => {
      if (!isoString) return "";
      const d = new Date(isoString);
      return isNaN(d.getTime())
        ? ""
        : d.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });
    };

    const dateStr = formatDate(startDate);
    const timeStr = formatTime(startDate);
    const dateInfo = dateStr ? (timeStr ? `Data: ${dateStr} às ${timeStr}` : `Data: ${dateStr}`) : "";
    const speakerInfo = speaker ? ` • Convidado: ${speaker}` : "";
    const formatInfo = format === "online" ? "Online" : format === "presencial" ? "Presencial" : "Híbrido";
    const locInfo = location ? ` (${location})` : "";

    let metaDesc = `${dateInfo} • ${formatInfo}${locInfo}${speakerInfo}`;
    if (description) {
      const cleanDesc = description.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      if (cleanDesc) {
        metaDesc = `${metaDesc} — ${cleanDesc.substring(0, 160)}`;
      }
    }

    const fullTitle = `${title} | DAVVERO System`;
    const escapedTitle = escapeHtml(fullTitle);
    const escapedDesc = escapeHtml(metaDesc);
    const escapedImg = escapeHtml(imageUrl);
    const canonicalUrl = `https://davvero.netlify.app/?event=${encodeURIComponent(eventId)}`;

    const metaBlock = `
    <!-- Dynamic Open Graph / WhatsApp / Facebook Meta Tags -->
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDesc}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="DAVVERO System" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDesc}" />
    <meta property="og:image" content="${escapedImg}" />
    <meta property="og:image:secure_url" content="${escapedImg}" />
    <meta property="og:image:alt" content="${escapedTitle}" />
    <meta property="og:url" content="${canonicalUrl}" />

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDesc}" />
    <meta name="twitter:image" content="${escapedImg}" />
  `;

    let html = await response.text();
    html = html
      .replace(/<title>[\s\S]*?<\/title>/gi, "")
      .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, "")
      .replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, "");

    html = html.replace(/<head>/i, `<head>\n${metaBlock}`);

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[Netlify Edge Function OG] Error:", err);
    return response;
  }
}
