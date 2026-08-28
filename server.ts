import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import webpush from "web-push";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { APP_VERSION } from "./src/lib/constants";

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp();
    console.log("Firebase Admin initialized with default credentials.");
  } catch (err) {
    console.error("Firebase Admin default init failed, trying with config project ID:", err);
    admin.initializeApp({
      projectId: "banco-de-dados-fajopa",
    });
  }
}
const db = admin.firestore();

// VAPID keys
// Hardcoding keys for immediate use in preview environment
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "BExGkxEI0iWpLyDIDONDcUaHlIb3f_gGODmxL9LRkLT3qoWd0zpZhgFHA2c1c6sKIsRL9kLh4fpZ1maZg_CLELk";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "BLaG0xS9zg1ICGRlg7Q8kHBr_dmMF_IyPJYW3JWVFTg";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:admblackjamf@gmail.com",
    vapidPublicKey,
    vapidPrivateKey
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // App Version config
  app.get("/api/version", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json({ version: APP_VERSION });
  });

  // Routes for Push Notifications
  app.get("/api/push/public-key", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({ 
      publicKey: vapidPublicKey,
      configured: Boolean(vapidPublicKey && vapidPrivateKey)
    });
  });

  app.get("/api/push/status", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({
      status: "online",
      vapidConfigured: Boolean(vapidPublicKey && vapidPrivateKey),
      publicKeyLength: vapidPublicKey ? vapidPublicKey.length : 0,
      publicKeyPreview: vapidPublicKey ? `${vapidPublicKey.substring(0, 10)}...${vapidPublicKey.substring(vapidPublicKey.length - 6)}` : null,
      contactEmail: "mailto:admblackjamf@gmail.com",
      timestamp: new Date().toISOString()
    });
  });

  // Delegate the broadcast to receive subscriptions from the frontend
  app.post("/api/push/broadcast", async (req, res) => {
    const { title, message, url, subscriptions } = req.body;
    console.log(`[Broadcast] Iniciando envio: "${title}" para ${subscriptions?.length || 0} alvos.`);
    
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ success: true, count: 0, sent: 0 });
    }

    const payload = { 
      title: title || "Nova Notificação", 
      body: message || "Você tem uma nova mensagem no DAVVERO.", 
      url: url || "/" 
    };

    try {
      const expiredEndpoints: string[] = [];
      let successCount = 0;
      let failureCount = 0;

      const notifications = subscriptions.map((subItem: any) => {
        // Normalizar subscrição caso venha em formato plano ou aninhado
        let targetSub = subItem;
        if (subItem && subItem.subscription) {
          targetSub = subItem.subscription;
        }

        // Se tiver endpoint mas não tiver keys (ex: formato incorreto), logar aviso
        if (!targetSub || !targetSub.endpoint) {
          console.warn("[Broadcast] Item de subscrição inválido (sem endpoint):", subItem);
          failureCount++;
          return Promise.resolve();
        }

        return webpush.sendNotification(targetSub, JSON.stringify(payload))
          .then(() => {
            successCount++;
          })
          .catch(err => {
            failureCount++;
            if (err.statusCode === 410 || err.statusCode === 404) {
              console.log(`[Broadcast] Subscrição expirada/inválida (${err.statusCode})`);
              expiredEndpoints.push(targetSub.endpoint);
            } else {
              console.error(`[Broadcast] Erro push (${err.statusCode || 'desconhecido'}):`, err.message);
            }
          });
      });

      await Promise.allSettled(notifications);
      console.log(`[Broadcast] Envio finalizado. Sucessos: ${successCount}, Falhas: ${failureCount}`);
      res.status(200).json({ 
        success: true, 
        count: subscriptions.length,
        sent: successCount,
        failed: failureCount,
        expiredEndpoints 
      });
    } catch (error: any) {
      console.error("Error in broadcast:", error);
      res.status(500).json({ error: "Failed to broadcast notifications", details: error.message });
    }
  });

  app.post("/api/push/send", async (req, res) => {
    const { subscription, payload, title, message, url } = req.body;
    try {
      let targetSub = subscription;
      if (subscription && subscription.subscription) {
        targetSub = subscription.subscription;
      }

      if (!targetSub || !targetSub.endpoint) {
        return res.status(400).json({ error: "Subscription object with endpoint is required." });
      }

      const notificationPayload = payload || {
        title: title || "Teste de Notificação DAVVERO",
        body: message || "Sua conexão de notificações push está funcionando perfeitamente!",
        url: url || "/"
      };

      await webpush.sendNotification(targetSub, JSON.stringify(notificationPayload));
      res.status(200).json({ success: true, message: "Push sent successfully" });
    } catch (error: any) {
      console.error("Error sending push:", error);
      res.status(500).json({ error: "Failed to send notification", details: error.message, statusCode: error.statusCode });
    }
  });

  // Gemini Proxy Endpoint
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: model || "gemini-3-flash-preview",
        contents,
        config
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini proxy error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Fetch Event data for Social Media / WhatsApp Link Preview
  async function getEventData(eventId: string) {
    try {
      if (!eventId || typeof eventId !== "string") return null;
      const cleanId = eventId.trim();
      const docRef = db.doc(`artifacts/banco-de-dados-fajopa/public/data/events/${cleanId}`);
      const snap = await docRef.get();
      if (snap.exists) {
        return { id: snap.id, ...snap.data() } as any;
      }
    } catch (e) {
      console.warn("[SocialMeta] Erro ao buscar evento no Firestore:", e);
    }
    return null;
  }

  function injectSocialMetaTags(html: string, event: any, requestUrl: string) {
    if (!event) return html;

    const escapeHtml = (str: string) =>
      String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const title = `${event.title || "Evento Acadêmico"} | DAVVERO System`;

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

    const dateStr = formatDate(event.startDate);
    const timeStr = formatTime(event.startDate);
    const dateInfo = dateStr
      ? timeStr
        ? `Data: ${dateStr} às ${timeStr}`
        : `Data: ${dateStr}`
      : "";
    const speakerInfo = event.speaker ? ` • Convidado: ${event.speaker}` : "";
    const formatInfo =
      event.format === "online"
        ? "Online"
        : event.format === "presencial"
        ? "Presencial"
        : "Híbrido";
    const locInfo =
      event.location || event.locationOrLink
        ? ` (${event.location || event.locationOrLink})`
        : "";

    let description = `${dateInfo} • ${formatInfo}${locInfo}${speakerInfo}`;
    if (event.description) {
      const cleanDesc = event.description
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleanDesc) {
        description = `${description} — ${cleanDesc.substring(0, 160)}`;
      }
    }

    const imageUrl =
      event.imageUrl ||
      "https://davvero.netlify.app/icon.svg";

    const escapedTitle = escapeHtml(title);
    const escapedDesc = escapeHtml(description);
    const escapedImg = escapeHtml(imageUrl);
    const escapedUrl = escapeHtml(requestUrl.includes("localhost") || requestUrl.includes("run.app") ? requestUrl : `https://davvero.netlify.app/?event=${encodeURIComponent(event.id)}`);

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
    <meta property="og:url" content="${escapedUrl}" />

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDesc}" />
    <meta name="twitter:image" content="${escapedImg}" />
  `;

    let cleaned = html
      .replace(/<title>[\s\S]*?<\/title>/gi, "")
      .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, "")
      .replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, "");

    cleaned = cleaned.replace(/<head>/i, `<head>\n${metaBlock}`);
    return cleaned;
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    // Intercept event shared links before default SPA fallback
    app.get(["/", "/event/:eventId", "/events"], async (req, res, next) => {
      const eventId = (req.query.event as string) || req.params.eventId;
      if (!eventId) return next();

      try {
        const event = await getEventData(eventId);
        if (!event) return next();

        const fs = await import("fs/promises");
        const raw = await fs.readFile(path.join(process.cwd(), "index.html"), "utf-8");
        const transformed = await vite.transformIndexHtml(req.originalUrl, raw);
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.headers["x-forwarded-host"] || req.get("host") || "";
        const fullUrl = `${protocol}://${host}${req.originalUrl}`;
        const output = injectSocialMetaTags(transformed, event, fullUrl);

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        return res.status(200).send(output);
      } catch (err) {
        console.error("[SocialMeta Dev] Error rendering social HTML:", err);
        return next();
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Intercept event shared links in production
    app.get(["/", "/event/:eventId", "/events"], async (req, res, next) => {
      const eventId = (req.query.event as string) || req.params.eventId;
      if (!eventId) return next();

      try {
        const event = await getEventData(eventId);
        if (!event) return next();

        const fs = await import("fs/promises");
        const raw = await fs.readFile(path.join(distPath, "index.html"), "utf-8");
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.headers["x-forwarded-host"] || req.get("host") || "";
        const fullUrl = `${protocol}://${host}${req.originalUrl}`;
        const output = injectSocialMetaTags(raw, event, fullUrl);

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        return res.status(200).send(output);
      } catch (err) {
        console.error("[SocialMeta Prod] Error rendering social HTML:", err);
        return next();
      }
    });

    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Enforce no-cache on HTML and service worker files to guarantee fresh version execution
        if (filePath.endsWith(".html") || filePath.endsWith("service-worker.js") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      }
    }));
    app.get("*", async (req, res) => {
      const eventId = req.query.event as string;
      if (eventId) {
        const event = await getEventData(eventId);
        if (event) {
          try {
            const fs = await import("fs/promises");
            const raw = await fs.readFile(path.join(distPath, "index.html"), "utf-8");
            const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
            const host = req.headers["x-forwarded-host"] || req.get("host") || "";
            const fullUrl = `${protocol}://${host}${req.originalUrl}`;
            const output = injectSocialMetaTags(raw, event, fullUrl);

            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
            return res.status(200).send(output);
          } catch (e) {
            console.error(e);
          }
        }
      }

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
