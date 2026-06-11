import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool, initDb } from "./db.js";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// --- Sessions (stockées dans PostgreSQL) ---------------------------------
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "secret-de-developpement",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
    },
  })
);

app.use(express.static(join(__dirname, "public")));

// Petit utilitaire pour gérer les erreurs des routes async.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Middleware : exige une session authentifiée.
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non authentifié." });
  }
  next();
}

// Sélection enrichie : ajoute l'email du propriétaire et de l'assigné.
const TASK_SELECT = `
  SELECT t.*, owner.email AS owner_email, assignee.email AS assignee_email
  FROM tasks t
  JOIN users owner ON owner.id = t.user_id
  LEFT JOIN users assignee ON assignee.id = t.assigned_to
`;

// Récupère une tâche enrichie par son id.
async function getTask(id) {
  const { rows } = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [id]);
  return rows[0];
}

// --- API d'authentification ----------------------------------------------

// Inscription.
app.post(
  "/api/auth/register",
  wrap(async (req, res) => {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Email invalide." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit faire au moins 6 caractères." });
    }

    const exists = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (exists.rowCount) {
      return res.status(409).json({ error: "Cet email est déjà utilisé." });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, hash]
    );
    req.session.userId = rows[0].id;
    res.status(201).json({ id: rows[0].id, email: rows[0].email });
  })
);

// Connexion.
app.post(
  "/api/auth/login",
  wrap(async (req, res) => {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    const { rows } = await pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = rows[0];
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    req.session.userId = user.id;
    res.json({ id: user.id, email: user.email });
  })
);

// Déconnexion.
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.status(204).end();
  });
});

// Utilisateur courant.
app.get(
  "/api/auth/me",
  wrap(async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Non authentifié." });
    }
    const { rows } = await pool.query("SELECT id, email FROM users WHERE id = $1", [
      req.session.userId,
    ]);
    if (!rows.length) {
      // Session orpheline (utilisateur supprimé) : on la nettoie.
      return req.session.destroy(() => res.status(401).json({ error: "Non authentifié." }));
    }
    res.json(rows[0]);
  })
);

// --- Utilisateurs --------------------------------------------------------

// Liste les utilisateurs (pour le menu d'assignation).
app.get(
  "/api/users",
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await pool.query("SELECT id, email FROM users ORDER BY email");
    res.json(rows);
  })
);

// --- API REST des tâches (protégée) --------------------------------------
// Visibilité : un utilisateur voit les tâches qu'il possède OU qui lui sont
// assignées. Le propriétaire ET l'assigné peuvent modifier une tâche ;
// seul le propriétaire peut la supprimer.
// `visible(n)` renvoie la clause avec le paramètre SQL $n (l'id utilisateur).
const visible = (n) => `(t.user_id = $${n} OR t.assigned_to = $${n})`;

// Liste les tâches visibles. Filtres : ?done=true|false, ?q=texte
app.get(
  "/api/tasks",
  requireAuth,
  wrap(async (req, res) => {
    const conditions = [visible(1)];
    const params = [req.session.userId];

    if (req.query.done === "true" || req.query.done === "false") {
      params.push(req.query.done === "true");
      conditions.push(`t.done = $${params.length}`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      conditions.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`);
    }

    const { rows } = await pool.query(
      `${TASK_SELECT}
       WHERE ${conditions.join(" AND ")}
       ORDER BY t.done ASC,
                CASE t.priority WHEN 'haute' THEN 0 WHEN 'normale' THEN 1 ELSE 2 END,
                t.due_date ASC NULLS LAST,
                t.created_at DESC`,
      params
    );
    res.json(rows);
  })
);

// Crée une tâche (le créateur en est le propriétaire).
app.post(
  "/api/tasks",
  requireAuth,
  wrap(async (req, res) => {
    const { title, description, priority, due_date } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Le titre est obligatoire." });
    }
    const { rows } = await pool.query(
      `INSERT INTO tasks (user_id, title, description, priority, due_date)
       VALUES ($1, $2, $3, COALESCE($4, 'normale'), $5)
       RETURNING id`,
      [
        req.session.userId,
        title.trim(),
        description?.trim() ?? "",
        priority || null,
        due_date || null,
      ]
    );
    res.status(201).json(await getTask(rows[0].id));
  })
);

// Met à jour une tâche (propriétaire ou assigné).
app.put(
  "/api/tasks/:id",
  requireAuth,
  wrap(async (req, res) => {
    const { title, description, priority, due_date, done } = req.body;
    const { rows } = await pool.query(
      `UPDATE tasks t SET
         title       = COALESCE($1, title),
         description = COALESCE($2, description),
         priority    = COALESCE($3, priority),
         due_date    = $4,
         done        = COALESCE($5, done),
         status      = CASE
                         WHEN $5 IS TRUE THEN 'done'
                         WHEN $5 IS FALSE AND status = 'done' THEN 'todo'
                         ELSE status
                       END
       WHERE id = $6 AND ${visible(7)}
       RETURNING id`,
      [
        title?.trim() || null,
        description?.trim() ?? null,
        priority || null,
        due_date || null,
        typeof done === "boolean" ? done : null,
        req.params.id,
        req.session.userId,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: "Tâche introuvable." });
    res.json(await getTask(rows[0].id));
  })
);

// Bascule terminé/à faire (synchronise aussi le statut Kanban).
app.patch(
  "/api/tasks/:id/toggle",
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await pool.query(
      `UPDATE tasks t SET
         done   = NOT done,
         status = CASE WHEN done THEN 'todo' ELSE 'done' END
       WHERE id = $1 AND ${visible(2)}
       RETURNING id`,
      [req.params.id, req.session.userId]
    );
    if (!rows.length) return res.status(404).json({ error: "Tâche introuvable." });
    res.json(await getTask(rows[0].id));
  })
);

// Change le statut Kanban (todo / in_progress / done).
app.patch(
  "/api/tasks/:id/status",
  requireAuth,
  wrap(async (req, res) => {
    const status = req.body.status;
    if (!["todo", "in_progress", "done"].includes(status)) {
      return res.status(400).json({ error: "Statut invalide." });
    }
    const { rows } = await pool.query(
      `UPDATE tasks t SET
         status = $1,
         done   = ($1 = 'done')
       WHERE id = $2 AND ${visible(3)}
       RETURNING id`,
      [status, req.params.id, req.session.userId]
    );
    if (!rows.length) return res.status(404).json({ error: "Tâche introuvable." });
    res.json(await getTask(rows[0].id));
  })
);

// Assigne (ou désassigne) la tâche à un utilisateur.
app.patch(
  "/api/tasks/:id/assign",
  requireAuth,
  wrap(async (req, res) => {
    const assignedTo = req.body.assigned_to ?? null;

    if (assignedTo !== null) {
      const u = await pool.query("SELECT 1 FROM users WHERE id = $1", [assignedTo]);
      if (!u.rowCount) return res.status(400).json({ error: "Utilisateur inconnu." });
    }

    const { rows } = await pool.query(
      `UPDATE tasks t SET assigned_to = $1
       WHERE id = $2 AND ${visible(3)}
       RETURNING id`,
      [assignedTo, req.params.id, req.session.userId]
    );
    if (!rows.length) return res.status(404).json({ error: "Tâche introuvable." });
    res.json(await getTask(rows[0].id));
  })
);

// Supprime une tâche (propriétaire uniquement).
app.delete(
  "/api/tasks/:id",
  requireAuth,
  wrap(async (req, res) => {
    const { rowCount } = await pool.query(
      "DELETE FROM tasks WHERE id = $1 AND user_id = $2",
      [req.params.id, req.session.userId]
    );
    if (!rowCount) return res.status(404).json({ error: "Tâche introuvable." });
    res.status(204).end();
  })
);

// Gestionnaire d'erreurs global.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur." });
});

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Échec de l'initialisation de la base :", err);
    process.exit(1);
  });
