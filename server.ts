import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import webpush from "web-push";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { APP_VERSION } from "./src/lib/constants.ts";

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

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // App Version config
  app.get("/api/version", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json({ version: APP_VERSION });
  });

  // Manifest endpoint with explicit no-cache headers for Android PWA install
  app.get(["/manifest.json", "/manifest.webmanifest"], (req, res) => {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const manifestPath = path.join(process.cwd(), "public", "manifest.json");
    res.sendFile(manifestPath);
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

  // Helper to build nodemailer transporter from settings or env
  async function getMailTransporter(customSmtp?: any) {
    let smtpData = customSmtp;

    // Se customSmtp não foi fornecido ou está incompleto, buscar do Firestore
    if (!smtpData || !smtpData.user || !smtpData.pass) {
      try {
        const settingsSnap = await db
          .collection("artifacts")
          .doc("banco-de-dados-fajopa")
          .collection("public")
          .doc("data")
          .collection("students")
          .doc("_settings_global")
          .get();

        if (settingsSnap.exists) {
          const cloudSettings = settingsSnap.data();
          if (cloudSettings?.smtpConfig?.user && cloudSettings?.smtpConfig?.pass) {
            smtpData = {
              ...cloudSettings.smtpConfig,
              ...smtpData
            };
          }
        }
      } catch (err) {
        console.warn("[Email] Não foi possível carregar configurações de SMTP do banco:", err);
      }
    }

    let host = (smtpData?.host || process.env.SMTP_HOST || "").trim();
    const port = Number(smtpData?.port || process.env.SMTP_PORT || 587);
    const secure = smtpData?.secure !== undefined 
      ? Boolean(smtpData.secure) 
      : (process.env.SMTP_SECURE === "true" || port === 465);
    
    let user = (smtpData?.user || process.env.SMTP_USER || "").trim();
    let pass = (smtpData?.pass || process.env.SMTP_PASS || "").trim();

    // Auto-clean Google App Passwords if pasted with spaces (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
    if (host.includes("gmail") || host.includes("google") || user.endsWith("@gmail.com") || user.endsWith("@fajopa.edu.br")) {
      pass = pass.replace(/\s+/g, "");
      if (!host || host.toLowerCase() === "gmail" || host.toLowerCase() === "google") {
        host = "smtp.gmail.com";
      }
    }

    if (!host || !user || !pass) {
      return null;
    }

    const effectivePort = port || (secure ? 465 : 587);
    const isSecure = secure || effectivePort === 465;

    return nodemailer.createTransport({
      host,
      port: effectivePort,
      secure: isSecure,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 25000,
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  function formatSmtpError(err: any): string {
    const rawMsg = err?.message || String(err);
    if (rawMsg.includes("535") || rawMsg.includes("BadCredentials") || rawMsg.includes("Username and Password not accepted")) {
      return "Erro de Autenticação do Gmail (535): O Google não aceita a sua senha comum de login. É obrigatório usar uma 'Senha de App' de 16 letras gerada em sua Conta Google (myaccount.google.com/apppasswords).";
    }
    if (rawMsg.includes("ETIMEDOUT") || rawMsg.includes("ECONNREFUSED") || rawMsg.includes("Timeout")) {
      return `Não foi possível conectar ao servidor SMTP (${rawMsg}). Verifique o endereço do Host e a Porta (Porta 465 com SSL marcado, ou Porta 587 com SSL desmarcado).`;
    }
    return rawMsg;
  }

  // Send Email Notification Endpoint
  app.post("/api/email/send", async (req, res) => {
    const { to, subject, html, text, customSmtp } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: "Missing required fields: to, subject, html/text" });
    }

    const rawList = Array.isArray(to) ? to : String(to).split(/[,;\n\r\t]+/);
    const recipients = rawList
      .map((e: any) => String(e).trim())
      .filter((e: string) => e.length > 3 && e.includes("@"));

    if (recipients.length === 0) {
      return res.status(400).json({ error: "Nenhum endereço de e-mail válido foi fornecido." });
    }

    try {
      const transporter = await getMailTransporter(customSmtp);
      const fromName = customSmtp?.fromName || process.env.SMTP_FROM_NAME || "DAVVERO System";
      const fromEmail = customSmtp?.fromEmail || customSmtp?.user || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "secretaria@fajopa.edu.br";

      if (!transporter) {
        // Se SMTP não estiver parametrizado com senha/servidor, salvar em fallback Firestore collection('mail')
        console.log(`[Email] SMTP não configurado. Salvando requisição na fila Firestore para: ${recipients.join(', ')}`);
        try {
          await db.collection("artifacts").doc("banco-de-dados-fajopa").collection("public").doc("data").collection("mail").add({
            to: recipients,
            subject,
            html,
            text: text || "",
            createdAt: new Date().toISOString(),
            status: "queued"
          });
        } catch (dbErr) {
          console.warn("[Email] Falha ao registrar fila secundária:", dbErr);
        }

        return res.status(200).json({
          success: true,
          mode: "queued",
          message: "Notificação enfileirada no banco de dados com sucesso."
        });
      }

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: recipients.join(", "),
        subject,
        text: text || "",
        html: html || undefined
      });

      console.log(`[Email] Mensagem enviada com sucesso para [${recipients.join(', ')}]. MessageId: ${info.messageId}`);
      return res.status(200).json({
        success: true,
        mode: "smtp",
        messageId: info.messageId,
        recipients,
        message: "E-mail disparado com sucesso!"
      });
    } catch (err: any) {
      console.error("[Email] Erro ao enviar e-mail via SMTP:", err);
      return res.status(500).json({
        success: false,
        error: formatSmtpError(err)
      });
    }
  });

  // Test SMTP Connection Endpoint
  app.post("/api/email/test-connection", async (req, res) => {
    const { customSmtp, testRecipient } = req.body;
    try {
      const transporter = await getMailTransporter(customSmtp);
      if (!transporter) {
        return res.status(400).json({ 
          success: false, 
          error: "Preencha Servidor Host, Usuário e Senha para testar a conexão SMTP." 
        });
      }

      await transporter.verify();
      
      if (testRecipient) {
        const fromName = customSmtp?.fromName || "DAVVERO System";
        const fromEmail = customSmtp?.fromEmail || customSmtp?.user;
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: testRecipient,
          subject: "🧪 Teste de Conexão de E-mail - DAVVERO",
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
              <h2 style="color: #0284c7;">Conexão SMTP Bem-Sucedida!</h2>
              <p>Este é um e-mail de teste enviado pelo <strong>DAVVERO System</strong>.</p>
              <p>As configurações de envio automático de e-mails para alunos e secretaria estão funcionando perfeitamente.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <small style="color: #64748b;">Enviado em: ${new Date().toLocaleString("pt-BR")}</small>
            </div>
          `
        });
      }

      return res.status(200).json({ 
        success: true, 
        message: testRecipient ? `Conexão válida e e-mail de teste enviado com sucesso para ${testRecipient}!` : "Conexão com o servidor SMTP estabelecida com sucesso!" 
      });
    } catch (err: any) {
      console.error("[Email] Erro no teste SMTP:", err);
      return res.status(500).json({ 
        success: false, 
        error: formatSmtpError(err)
      });
    }
  });

  // Unsubscribe Endpoint
  app.post("/api/email/unsubscribe", async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email parameter is required." });
    }
    try {
      const snap = await db.collection("artifacts").doc("banco-de-dados-fajopa").collection("public").doc("data").collection("students")
        .where("email", "==", email.trim())
        .get();

      if (!snap.empty) {
        const batch = db.batch();
        snap.forEach(docSnap => {
          batch.update(docSnap.ref, {
            emailNotificationsEnabled: false,
            emailUnsubscribedAt: new Date().toISOString()
          });
        });
        await batch.commit();
      }

      return res.status(200).json({
        success: true,
        message: `O e-mail ${email} foi descadastrado com sucesso.`
      });
    } catch (err: any) {
      console.error("[Email] Erro ao descadastrar email:", err);
      return res.status(500).json({ success: false, error: err?.message || "Erro ao descadastrar e-mail." });
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
