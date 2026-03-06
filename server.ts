import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("album.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS stickers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT NOT NULL,
    rarity TEXT DEFAULT 'common'
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    recovery_code TEXT NOT NULL DEFAULT '1234',
    is_admin BOOLEAN DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS pack_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_collection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    sticker_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    is_stuck BOOLEAN DEFAULT 0,
    FOREIGN KEY (sticker_id) REFERENCES stickers(id)
  );

  CREATE TABLE IF NOT EXISTS swap_market (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sticker_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'available',
    FOREIGN KEY (sticker_id) REFERENCES stickers(id)
  );
`);

// Add user_id column to user_collection if it doesn't exist (for existing databases)
try {
  db.prepare("SELECT user_id FROM user_collection LIMIT 1").get();
} catch (e) {
  console.log("Adding user_id column to user_collection...");
  db.exec("ALTER TABLE user_collection ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default'");
}

// Add recovery_code column to users if it doesn't exist
try {
  db.prepare("SELECT recovery_code FROM users LIMIT 1").get();
} catch (e) {
  console.log("Adding recovery_code column to users...");
  db.exec("ALTER TABLE users ADD COLUMN recovery_code TEXT NOT NULL DEFAULT '1234'");
}

// Add is_admin column to users if it doesn't exist
try {
  db.prepare("SELECT is_admin FROM users LIMIT 1").get();
} catch (e) {
  console.log("Adding is_admin column to users...");
  db.exec("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0");
}

// Seed initial stickers if empty
const stickerCount = db.prepare("SELECT COUNT(*) as count FROM stickers").get() as { count: number };
if (stickerCount.count === 0) {
  const categories = ["Supercopa", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro", "Campeão"];
  const insert = db.prepare("INSERT INTO stickers (name, category, image_url, rarity) VALUES (?, ?, ?, ?)");
  
  categories.forEach(cat => {
    for (let i = 1; i <= 10; i++) {
      const rarity = Math.random() > 0.9 ? 'lendária' : (Math.random() > 0.7 ? 'rara' : 'comum');
      insert.run(`${cat} #${i}`, cat, `https://picsum.photos/seed/${cat}${i}/200/300`, rarity);
    }
  });
}

async function startServer() {
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
      const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
      const isAdmin = userCount.count === 0 || user === 'admin' ? 1 : 0;
      
      db.prepare("INSERT INTO users (username, password, recovery_code, is_admin) VALUES (?, ?, ?, ?)").run(user, hashedPassword, recoveryCode || '1234', isAdmin);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
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
      const userExists = db.prepare("SELECT * FROM users WHERE username = ?").get(user) as any;
      
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
      const found = db.prepare("SELECT * FROM users WHERE username = ? AND recovery_code = ?").get(user, recoveryCode) as any;
      
      if (found) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.prepare("UPDATE users SET password = ? WHERE username = ?").run(hashedPassword, user);
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

  app.get("/api/stickers", (req, res) => {
    try {
      const stickers = db.prepare("SELECT * FROM stickers").all();
      res.json(stickers);
    } catch (error) {
      console.error("Error fetching stickers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/collection", (req, res) => {
    const userId = req.headers["user-id"] || "default";
    try {
      const collection = db.prepare(`
        SELECT uc.*, s.name, s.category, s.image_url, s.rarity 
        FROM user_collection uc 
        JOIN stickers s ON uc.sticker_id = s.id
        WHERE uc.user_id = ?
      `).all(userId);
      res.json(collection);
    } catch (error) {
      console.error("Error fetching collection:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/open-pack", (req, res) => {
    const userId = req.headers["user-id"] || "default";
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: "Por favor, informe um código de acesso." });
    }

    try {
      // Validate code
      const codeRecord = db.prepare("SELECT * FROM pack_codes WHERE code = ?").get(code.trim().toUpperCase()) as any;
      
      if (!codeRecord) {
        return res.status(400).json({ error: "Código inválido. Verifique se digitou corretamente." });
      }
      
      if (codeRecord.is_used) {
        return res.status(400).json({ error: "Este código já foi utilizado por outro usuário." });
      }

      const allStickers = db.prepare("SELECT id FROM stickers").all() as { id: number }[];
      if (allStickers.length === 0) {
        return res.status(500).json({ error: "No stickers available in database" });
      }
      
      const packIds = [];
      const transaction = db.transaction(() => {
        // Mark code as used
        db.prepare("UPDATE pack_codes SET is_used = 1 WHERE id = ?").run(codeRecord.id);

        for (let i = 0; i < 5; i++) {
          const randomSticker = allStickers[Math.floor(Math.random() * allStickers.length)];
          packIds.push(randomSticker.id);
          
          const existing = db.prepare("SELECT * FROM user_collection WHERE sticker_id = ? AND user_id = ?").get(randomSticker.id, userId) as any;
          if (existing) {
            db.prepare("UPDATE user_collection SET quantity = quantity + 1 WHERE sticker_id = ? AND user_id = ?").run(randomSticker.id, userId);
          } else {
            db.prepare("INSERT INTO user_collection (sticker_id, user_id, quantity, is_stuck) VALUES (?, ?, 1, 0)").run(randomSticker.id, userId);
          }
        }
      });

      transaction();
      
      // Fetch details for each rolled ID to preserve duplicates in the response
      const packDetails = packIds.map(id => db.prepare("SELECT * FROM stickers WHERE id = ?").get(id));
      res.json(packDetails);
    } catch (error) {
      console.error("Error opening pack:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin Routes
  app.get("/api/admin/codes", (req, res) => {
    const userId = req.headers["user-id"] || "default";
    const user = db.prepare("SELECT is_admin FROM users WHERE username = ?").get(userId) as any;
    if (!user || user.is_admin !== 1) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    const codes = db.prepare("SELECT * FROM pack_codes ORDER BY created_at DESC").all();
    res.json(codes);
  });

  app.post("/api/admin/generate-code", (req, res) => {
    const userId = req.headers["user-id"] || "default";
    const user = db.prepare("SELECT is_admin FROM users WHERE username = ?").get(userId) as any;
    if (!user || user.is_admin !== 1) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    db.prepare("INSERT INTO pack_codes (code) VALUES (?)").run(newCode);
    res.json({ code: newCode });
  });
  
  app.post("/api/admin/reactivate-code", (req, res) => {
    const userId = req.headers["user-id"] || "default";
    const { codeId } = req.body;
    const user = db.prepare("SELECT is_admin FROM users WHERE username = ?").get(userId) as any;
    if (!user || user.is_admin !== 1) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    db.prepare("UPDATE pack_codes SET is_used = 0 WHERE id = ?").run(codeId);
    res.json({ success: true });
  });

  app.post("/api/stick", (req, res) => {
    const userId = req.headers["user-id"] || "default";
    const { stickerId } = req.body;
    db.prepare("UPDATE user_collection SET is_stuck = 1 WHERE sticker_id = ? AND user_id = ?").run(stickerId, userId);
    res.json({ success: true });
  });

  app.get("/api/swap-market", (req, res) => {
    const swaps = db.prepare(`
      SELECT sm.*, s.name, s.category, s.image_url, s.rarity 
      FROM swap_market sm 
      JOIN stickers s ON sm.sticker_id = s.id
      WHERE sm.status = 'available'
    `).all();
    res.json(swaps);
  });

  app.post("/api/add-to-swap", (req, res) => {
    const userId = req.headers["user-id"] || "default";
    const { stickerId } = req.body;
    
    const transaction = db.transaction(() => {
      // Check if user has more than 1
      const item = db.prepare("SELECT quantity FROM user_collection WHERE sticker_id = ? AND user_id = ?").get(stickerId, userId) as { quantity: number };
      
      if (item && item.quantity > 1) {
        // Decrement quantity
        db.prepare("UPDATE user_collection SET quantity = quantity - 1 WHERE sticker_id = ? AND user_id = ?").run(stickerId, userId);
        // Add to market
        db.prepare("INSERT INTO swap_market (sticker_id, user_id) VALUES (?, ?)").run(stickerId, userId);
        return true;
      }
      return false;
    });

    try {
      const success = transaction();
      if (success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "Você precisa ter figurinhas repetidas para trocar" });
      }
    } catch (error) {
      console.error("Error adding to swap:", error);
      res.status(500).json({ error: "Erro ao adicionar para troca" });
    }
  });

  app.post("/api/claim-swap", (req, res) => {
    const userId = req.headers["user-id"] || "default";
    const { swapId } = req.body;

    const transaction = db.transaction(() => {
      const swap = db.prepare("SELECT * FROM swap_market WHERE id = ? AND status = 'available'").get(swapId) as any;
      
      if (!swap) return { error: "Troca não disponível" };
      if (swap.user_id === userId) return { error: "Você não pode trocar com você mesmo" };

      // Mark as claimed
      db.prepare("UPDATE swap_market SET status = 'claimed' WHERE id = ?").run(swapId);

      // Add to claimant's collection
      const existing = db.prepare("SELECT * FROM user_collection WHERE sticker_id = ? AND user_id = ?").get(swap.sticker_id, userId) as any;
      if (existing) {
        db.prepare("UPDATE user_collection SET quantity = quantity + 1 WHERE sticker_id = ? AND user_id = ?").run(swap.sticker_id, userId);
      } else {
        db.prepare("INSERT INTO user_collection (sticker_id, user_id, quantity, is_stuck) VALUES (?, ?, 1, 0)").run(swap.sticker_id, userId);
      }

      return { success: true };
    });

    try {
      const result = transaction();
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: result.error });
      }
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
