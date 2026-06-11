import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// Pool de connexions PostgreSQL. Les paramètres sont lus depuis .env
// (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
export const pool = new Pool();

// Crée les tables si elles n'existent pas encore.
export async function initDb() {
  // Utilisateurs.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Tâches.
  //  - user_id     : propriétaire (créateur) de la tâche
  //  - assigned_to : utilisateur à qui la tâche est attribuée (partage)
  //  - status      : colonne du Kanban (todo / in_progress / done)
  //  - done        : conservé et synchronisé avec status (done = status 'done')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority    TEXT NOT NULL DEFAULT 'normale'
                    CHECK (priority IN ('basse', 'normale', 'haute')),
      status      TEXT NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in_progress', 'done')),
      due_date    DATE,
      done        BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migrations idempotentes pour les bases déjà existantes.
  await pool.query(
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`
  );
  await pool.query(
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL;`
  );
  await pool.query(
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo'
       CHECK (status IN ('todo', 'in_progress', 'done'));`
  );

  // Aligne status avec l'ancien champ done pour les tâches déjà présentes.
  await pool.query(`UPDATE tasks SET status = 'done' WHERE done = TRUE AND status = 'todo';`);

  // Index pour accélérer les filtrages.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);`);
}
