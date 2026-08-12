const fs = require('fs');

let file = fs.readFileSync('server.ts', 'utf8');

const searchStr = `  // Delegate the broadcast to receive subscriptions from the frontend
  app.post("/api/push/broadcast", async (req, res) => {
    const { title, message, url, subscriptions } = req.body;
    console.log(\`[Broadcast] Iniciando envio: "\${title}" para \${subscriptions?.length || 0} alvos.\`);
    
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
              console.log(\`[Broadcast] Subscrição expirada/inválida (\${err.statusCode})\`);
              expiredEndpoints.push(subscription.endpoint);
            } else {
              console.error(\`[Broadcast] Erro push:\`, err.message);
            }
          });
      });

      await Promise.allSettled(notifications);
      
      console.log(\`[Broadcast] Envio finalizado.\`);
      res.status(200).json({ success: true, expiredEndpoints });
    } catch (error: any) {
      console.error("Error in broadcast:", error);
      res.status(500).json({ error: "Failed to broadcast notifications", details: error.message });
    }
  });`;

const replaceStr = `  // Delegate the broadcast to receive subscriptions from the frontend (FCM)
  app.post("/api/push/broadcast", async (req, res) => {
    const { title, message, url, tokens } = req.body;
    console.log(\`[Broadcast] Iniciando envio FCM: "\${title}" para \${tokens?.length || 0} alvos.\`);
    
    if (!tokens || tokens.length === 0) {
      return res.status(200).json({ success: true, count: 0 });
    }

    const messagePayload = {
      notification: {
        title: title,
        body: message,
      },
      webpush: {
        fcmOptions: {
          link: url || "/",
        }
      },
      tokens: tokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(messagePayload);
      console.log(\`[Broadcast] Envio finalizado. Sucessos: \${response.successCount}, Falhas: \${response.failureCount}\`);
      
      const expiredTokens: string[] = [];
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
             const error = resp.error?.code;
             if (error === 'messaging/invalid-registration-token' || error === 'messaging/registration-token-not-registered') {
                expiredTokens.push(tokens[idx]);
             }
          }
        });
      }

      res.status(200).json({ success: true, expiredTokens });
    } catch (error: any) {
      console.error("Error in FCM broadcast:", error);
      res.status(500).json({ error: "Failed to broadcast notifications", details: error.message });
    }
  });`;

file = file.replace(searchStr, replaceStr);
fs.writeFileSync('server.ts', file);
