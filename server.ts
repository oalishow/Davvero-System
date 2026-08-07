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
    res.json({ version: APP_VERSION });
  });

  // Routes for Push Notifications
  app.get("/api/push/public-key", (req, res) => {
    res.json({ publicKey: vapidPublicKey });
  });

  // Delegate the broadcast to receive subscriptions from the frontend
  app.post("/api/push/broadcast", async (req, res) => {
    const { title, message, url, subscriptions } = req.body;
    console.log(`[Broadcast] Iniciando envio: "${title}" para ${subscriptions?.length || 0} alvos.`);
    
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ success: true, count: 0 });
    }

    const payload = { title, body: message, url: url || "/" };

    try {
      const expiredEndpoints: string[] = [];
      const notifications = subscriptions.map((subscription: any) => {
        return webpush.sendNotification(subscription, JSON.stringify(payload))
          .catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              console.log(`[Broadcast] Subscrição expirada/inválida (${err.statusCode})`);
              expiredEndpoints.push(subscription.endpoint);
            } else {
              console.error(`[Broadcast] Erro push:`, err.message);
            }
          });
      });

      await Promise.allSettled(notifications);
      console.log(`[Broadcast] Envio finalizado.`);
      res.status(200).json({ success: true, expiredEndpoints });
    } catch (error: any) {
      console.error("Error in broadcast:", error);
      res.status(500).json({ error: "Failed to broadcast notifications", details: error.message });
    }
  });

  app.post("/api/push/send", async (req, res) => {
    const { subscription, payload } = req.body;
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error sending push:", error);
      res.status(500).json({ error: "Failed to send notification" });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
