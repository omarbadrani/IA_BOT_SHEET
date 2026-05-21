import express from "express";
import session from "express-session";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

declare module 'express-session' {
  interface SessionData {
    authorized: boolean;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-secret-keyboard',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  }));

  // Google GenAI initialization - DISABLED on server to allow "Bring Your Own Key" logic on frontend
  // const apiKey = process.env.GEMINI_API_KEY2 || process.env.GEMINI_API_KEY;
  const apiKey = null; // Forced null to bypass developer key
  let genAI: any = null;
  if (apiKey) {
    genAI = new GoogleGenAI({ apiKey });
  }

  // API Routes
  app.post("/api/verify-code", (req, res) => {
    const { code } = req.body;
    if (code === process.env.ACCESS_CODE) {
      req.session.authorized = true;
      return res.json({ success: true });
    }
    return res.status(401).json({ success: false });
  });

  app.get("/api/check-auth", (req, res) => {
    return res.json({ authorized: !!req.session.authorized });
  });

  app.post("/api/gemini", async (req, res) => {
    return res.status(410).json({ error: "Ce point de terminaison est obsolète. Veuillez utiliser l'appel direct au client avec votre propre clé API." });
  });

  app.post("/api/gemini-fallback", async (req, res) => {
    const { contents, systemInstruction, model } = req.body;

    const backupKeys = [
      process.env.BACKUP_GEMINI_KEY_1,
      process.env.BACKUP_GEMINI_KEY_2,
      process.env.BACKUP_GEMINI_KEY_3,
      process.env.BACKUP_GEMINI_KEY_4
    ].filter(Boolean) as string[];

    if (backupKeys.length === 0) {
      console.warn("Fallback requested but no backup keys configured in env.");
      return res.status(503).json({
        error: "Aucune clé de secours n'est configurée sur le serveur de l'application."
      });
    }

    const requestedModel = model || "gemini-3-flash-preview";

    for (let i = 0; i < backupKeys.length; i++) {
      const currentKey = backupKeys[i];
      try {
        console.log(`[Backup fallback] Trial of backup key ${i + 1}/${backupKeys.length}`);
        const ai = new GoogleGenAI({ 
          apiKey: currentKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const response = await ai.models.generateContent({
          model: requestedModel,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
          },
        });

        if (response && response.text) {
          console.log(`[Backup fallback] Success using key index ${i + 1}`);
          return res.json({ text: response.text });
        } else {
          throw new Error("Empty response from backup model.");
        }
      } catch (error: any) {
        console.error(`[Backup fallback] Key index ${i + 1} failed:`, error?.message || error);
        // Continue to next key
      }
    }

    return res.status(429).json({
      error: "Toutes les clés API de secours du serveur de l'application sont également épuisées (quotas terminés)."
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
