import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:album.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize database
async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS stickers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      rarity TEXT DEFAULT 'common'
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      recovery_code TEXT NOT NULL DEFAULT '1234',
      is_admin BOOLEAN DEFAULT 0
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS pack_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      is_used BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_collection (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'default',
      sticker_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      is_stuck BOOLEAN DEFAULT 0,
      FOREIGN KEY (sticker_id) REFERENCES stickers(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS swap_market (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sticker_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      FOREIGN KEY (sticker_id) REFERENCES stickers(id)
    );
  `);

  // Column checks (Turso/libSQL handles ALTER TABLE slightly differently but standard SQL works)
  try {
    await db.execute("SELECT user_id FROM user_collection LIMIT 1");
  } catch (e) {
    console.log("Adding user_id column to user_collection...");
    await db.execute("ALTER TABLE user_collection ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default'");
  }

  try {
    await db.execute("SELECT recovery_code FROM users LIMIT 1");
  } catch (e) {
    console.log("Adding recovery_code column to users...");
    await db.execute("ALTER TABLE users ADD COLUMN recovery_code TEXT NOT NULL DEFAULT '1234'");
  }

  try {
    await db.execute("SELECT is_admin FROM users LIMIT 1");
  } catch (e) {
    console.log("Adding is_admin column to users...");
    await db.execute("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0");
  }

  // Seed initial stickers if empty
  const stickerCountRes = await db.execute("SELECT COUNT(*) as count FROM stickers");
  const stickerCount = stickerCountRes.rows[0]?.count as number;
  
  if (stickerCount === 0) {
    const categories = ["Supercopa", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro", "Campeão"];
    
    for (const cat of categories) {
      for (let i = 1; i <= 10; i++) {
        const rarity = Math.random() > 0.9 ? 'lendária' : (Math.random() > 0.7 ? 'rara' : 'comum');
        await db.execute({
          sql: "INSERT INTO stickers (name, category, image_url, rarity) VALUES (?, ?, ?, ?)",
          args: [`${cat} #${i}`, cat, `https://picsum.photos/seed/${cat}${i}/200/300`, rarity]
        });
      }
    }
  }
}

async function startServer() {
  await initDb();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.post("/api/register", async (req, res) => {
    const { username, password, recoveryCode } = req.body;
    try {
      const user = username.trim().toLowerCase();
      const hashedPassword = await bcrypt.hash(password, 10);
      // For demo purposes, the first user or 'admin' is an admin
      const userCountRes = await db.execute("SELECT COUNT(*) as count FROM users");
      const userCount = userCountRes.rows[0]?.count as number;
      const isAdmin = userCount === 0 || user === 'admin' ? 1 : 0;
      
      await db.execute({
        sql: "INSERT INTO users (username, password, recovery_code, is_admin) VALUES (?, ?, ?, ?)",
        args: [user, hashedPassword, recoveryCode || '1234', isAdmin]
      });
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('UNIQUE')) {
        res.status(400).json({ error: "Usuário já existe" });
      } else {
        console.error("Error registering user:", error);
        res.status(500).json({ error: "Erro ao cadastrar usuário" });
      }
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = username.trim().toLowerCase();
      const userExistsRes = await db.execute({
        sql: "SELECT * FROM users WHERE username = ?",
        args: [user]
      });
      const userExists = userExistsRes.rows[0] as any;
      
      if (!userExists) {
        return res.status(404).json({ error: "Usuário não cadastrado" });
      }

      const isPasswordValid = await bcrypt.compare(password, userExists.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Senha incorreta" });
      }

      res.json({ success: true, username: userExists.username, isAdmin: userExists.is_admin === 1 });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    const { username, recoveryCode, newPassword } = req.body;
    try {
      const user = username.trim().toLowerCase();
      const foundRes = await db.execute({
        sql: "SELECT * FROM users WHERE username = ? AND recovery_code = ?",
        args: [user, recoveryCode]
      });
      const found = foundRes.rows[0] as any;
      
      if (found) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.execute({
          sql: "UPDATE users SET password = ? WHERE username = ?",
          args: [hashedPassword, user]
        });
        res.json({ success: true });
      } else {
        res.status(401).json({ error: "Código de recuperação incorreto ou usuário não encontrado" });
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Erro ao resetar senha" });
    }
  });

  app.get("/api/admin/download-db", (req, res) => {
    const dbPath = path.join(__dirname, "album.db");
    res.download(dbPath, "album.db", (err) => {
      if (err) {
        console.error("Erro ao baixar o banco de dados:", err);
        res.status(500).send("Erro ao baixar o banco de dados");
      }
    });
  });

  app.get("/api/stickers", async (req, res) => {
    try {
      const stickersRes = await db.execute("SELECT * FROM stickers");
      res.json(stickersRes.rows);
    } catch (error) {
      console.error("Error fetching stickers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/collection", async (req, res) => {
    const userId = (req.headers["user-id"] as string) || "default";
    try {
      const collectionRes = await db.execute({
        sql: `
          SELECT uc.*, s.name, s.category, s.image_url, s.rarity 
          FROM user_collection uc 
          JOIN stickers s ON uc.sticker_id = s.id
          WHERE uc.user_id = ?
        `,
        args: [userId]
      });
      res.json(collectionRes.rows);
    } catch (error) {
      console.error("Error fetching collection:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/open-pack", async (req, res) => {
    const userId = (req.headers["user-id"] as string) || "default";
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: "Por favor, informe um código de acesso." });
    }

    try {
      // Validate code
      const codeRecordRes = await db.execute({
        sql: "SELECT * FROM pack_codes WHERE code = ?",
        args: [code.trim().toUpperCase()]
      });
      const codeRecord = codeRecordRes.rows[0] as any;
      
      if (!codeRecord) {
        return res.status(400).json({ error: "Código inválido. Verifique se digitou corretamente." });
      }
      
      if (codeRecord.is_used) {
        return res.status(400).json({ error: "Este código já foi utilizado por outro usuário." });
      }

      const allStickersRes = await db.execute("SELECT id FROM stickers");
      const allStickers = allStickersRes.rows as unknown as { id: number }[];
      if (allStickers.length === 0) {
        return res.status(500).json({ error: "No stickers available in database" });
      }
      
      const packIds: number[] = [];
      const queries = [];

      // Mark code as used
      queries.push({
        sql: "UPDATE pack_codes SET is_used = 1 WHERE id = ?",
        args: [codeRecord.id]
      });

      for (let i = 0; i < 5; i++) {
        const randomSticker = allStickers[Math.floor(Math.random() * allStickers.length)];
        packIds.push(randomSticker.id);
        
        const existingRes = await db.execute({
          sql: "SELECT * FROM user_collection WHERE sticker_id = ? AND user_id = ?",
          args: [randomSticker.id, userId]
        });
        const existing = existingRes.rows[0] as any;

        if (existing) {
          queries.push({
            sql: "UPDATE user_collection SET quantity = quantity + 1 WHERE sticker_id = ? AND user_id = ?",
            args: [randomSticker.id, userId]
          });
        } else {
          queries.push({
            sql: "INSERT INTO user_collection (sticker_id, user_id, quantity, is_stuck) VALUES (?, ?, 1, 0)",
            args: [randomSticker.id, userId]
          });
        }
      }

      await db.batch(queries, "write");
      
      // Fetch details for each rolled ID to preserve duplicates in the response
      const packDetails = [];
      for (const id of packIds) {
        const detailRes = await db.execute({
          sql: "SELECT * FROM stickers WHERE id = ?",
          args: [id]
        });
        packDetails.push(detailRes.rows[0]);
      }
      res.json(packDetails);
    } catch (error) {
      console.error("Error opening pack:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin Routes
  app.get("/api/admin/codes", async (req, res) => {
    const userId = (req.headers["user-id"] as string) || "default";
    const userRes = await db.execute({
      sql: "SELECT is_admin FROM users WHERE username = ?",
      args: [userId]
    });
    const user = userRes.rows[0] as any;
    if (!user || user.is_admin !== 1) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    const codesRes = await db.execute("SELECT * FROM pack_codes ORDER BY created_at DESC");
    res.json(codesRes.rows);
  });

  app.post("/api/admin/generate-code", async (req, res) => {
    const userId = (req.headers["user-id"] as string) || "default";
    const userRes = await db.execute({
      sql: "SELECT is_admin FROM users WHERE username = ?",
      args: [userId]
    });
    const user = userRes.rows[0] as any;
    if (!user || user.is_admin !== 1) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    await db.execute({
      sql: "INSERT INTO pack_codes (code) VALUES (?)",
      args: [newCode]
    });
    res.json({ code: newCode });
  });
  
  app.post("/api/admin/reactivate-code", async (req, res) => {
    const userId = (req.headers["user-id"] as string) || "default";
    const { codeId } = req.body;
    const userRes = await db.execute({
      sql: "SELECT is_admin FROM users WHERE username = ?",
      args: [userId]
    });
    const user = userRes.rows[0] as any;
    if (!user || user.is_admin !== 1) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    await db.execute({
      sql: "UPDATE pack_codes SET is_used = 0 WHERE id = ?",
      args: [codeId]
    });
    res.json({ success: true });
  });

  app.post("/api/stick", async (req, res) => {
    const userId = (req.headers["user-id"] as string) || "default";
    const { stickerId } = req.body;
    await db.execute({
      sql: "UPDATE user_collection SET is_stuck = 1 WHERE sticker_id = ? AND user_id = ?",
      args: [stickerId, userId]
    });
    res.json({ success: true });
  });

  app.get("/api/swap-market", async (req, res) => {
    try {
      const swapsRes = await db.execute(`
        SELECT sm.*, s.name, s.category, s.image_url, s.rarity 
        FROM swap_market sm 
        JOIN stickers s ON sm.sticker_id = s.id
        WHERE sm.status = 'available'
      `);
      res.json(swapsRes.rows);
    } catch (error) {
      console.error("Error fetching swap market:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/add-to-swap", async (req, res) => {
    const userId = (req.headers["user-id"] as string) || "default";
    const { stickerId } = req.body;
    
    try {
      // Check if user has more than 1
      const itemRes = await db.execute({
        sql: "SELECT quantity FROM user_collection WHERE sticker_id = ? AND user_id = ?",
        args: [stickerId, userId]
      });
      const item = itemRes.rows[0] as any;
      
      if (item && item.quantity > 1) {
        await db.batch([
          {
            sql: "UPDATE user_collection SET quantity = quantity - 1 WHERE sticker_id = ? AND user_id = ?",
            args: [stickerId, userId]
          },
          {
            sql: "INSERT INTO swap_market (sticker_id, user_id) VALUES (?, ?)",
            args: [stickerId, userId]
          }
        ], "write");
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "Você precisa ter figurinhas repetidas para trocar" });
      }
    } catch (error) {
      console.error("Error adding to swap:", error);
      res.status(500).json({ error: "Erro ao adicionar para troca" });
    }
  });

  app.post("/api/claim-swap", async (req, res) => {
    const userId = (req.headers["user-id"] as string) || "default";
    const { swapId } = req.body;

    try {
      const swapRes = await db.execute({
        sql: "SELECT * FROM swap_market WHERE id = ? AND status = 'available'",
        args: [swapId]
      });
      const swap = swapRes.rows[0] as any;
      
      if (!swap) return res.status(400).json({ error: "Troca não disponível" });
      if (swap.user_id === userId) return res.status(400).json({ error: "Você não pode trocar com você mesmo" });

      const existingRes = await db.execute({
        sql: "SELECT * FROM user_collection WHERE sticker_id = ? AND user_id = ?",
        args: [swap.sticker_id, userId]
      });
      const existing = existingRes.rows[0] as any;

      const queries = [
        {
          sql: "UPDATE swap_market SET status = 'claimed' WHERE id = ?",
          args: [swapId]
        }
      ];

      if (existing) {
        queries.push({
          sql: "UPDATE user_collection SET quantity = quantity + 1 WHERE sticker_id = ? AND user_id = ?",
          args: [swap.sticker_id, userId]
        });
      } else {
        queries.push({
          sql: "INSERT INTO user_collection (sticker_id, user_id, quantity, is_stuck) VALUES (?, ?, 1, 0)",
          args: [swap.sticker_id, userId]
        });
      }

      await db.batch(queries, "write");
      res.json({ success: true });
    } catch (error) {
      console.error("Error claiming swap:", error);
      res.status(500).json({ error: "Erro ao realizar troca" });
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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
