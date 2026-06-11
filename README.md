# 📋 Todo Manager

Gestionnaire de todo list — application web avec stockage PostgreSQL.

## Fonctionnalités

- **Multi-utilisateur** : inscription / connexion par email + mot de passe
- **Partage & distribution** : on peut assigner une tâche à un autre
  utilisateur, qui la voit alors apparaître chez lui
- **Vue Kanban** (fenêtre séparée `kanban.html`) : colonnes
  *À faire / En cours / Terminé*, glisser-déposer pour changer le statut,
  menu pour assigner chaque carte
- Chaque utilisateur voit **ses tâches** + **celles qui lui sont assignées**
- Ajouter, modifier, supprimer des tâches
- Marquer une tâche comme terminée / à faire
- Priorité (basse / normale / haute) et date d'échéance
- Filtres : Toutes / À faire / Terminées
- Recherche en texte libre
- Mise en évidence des tâches en retard

### Règles de partage

- Le **propriétaire** (créateur) et l'**assigné** peuvent modifier la tâche
  et changer son statut.
- Seul le **propriétaire** peut supprimer la tâche.

## Sécurité

- Mots de passe hachés avec **bcrypt** (jamais stockés en clair)
- Sessions par cookie, persistées dans PostgreSQL
- Toutes les routes de tâches sont protégées et scopées à l'utilisateur connecté

## Stack

- **Backend** : Node.js + Express + `pg`
- **Auth** : `express-session` + `connect-pg-simple` + `bcryptjs`
- **Frontend** : HTML / CSS / JavaScript (sans framework)
- **Base de données** : PostgreSQL 18

> ⚠️ En production, remplacez `SESSION_SECRET` dans `.env` par une longue chaîne
> aléatoire secrète.

## Configuration

### Variables d'environnement

Les paramètres de connexion sont dans le fichier `.env`. Deux contextes sont possibles :

#### 1. Développement local (chacun sur son poste)

Copie le contenu de `.env.example.local` dans `.env` :

```
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=1234
PGDATABASE=todo_db
PORT=3000
SESSION_SECRET=change-moi-pour-une-longue-chaine-aleatoire-secrete
```

Cela te permet de tester l'application en local avec ta propre base de données PostgreSQL.

#### 2. Serveur de test partagé (192.168.1.3)

Copie le contenu de `.env.example.server` dans `.env` sur le serveur :

```
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=1234
PGDATABASE=todo_db
PORT=3000
SESSION_SECRET=change-moi-pour-une-longue-chaine-aleatoire-secrete
```

Cela te permet de déployer l'application sur le serveur de test que tous les devs peuvent accéder via `http://192.168.1.3:3000`.

> ⚠️ En production, remplacez `SESSION_SECRET` par une longue chaîne aléatoire secrète unique.

La table `tasks` est créée automatiquement au démarrage.

## Lancer l'application

```bash
npm install      # une seule fois
npm start        # démarre le serveur
```

Puis ouvrir http://localhost:3000 dans le navigateur.

Pour le développement avec rechargement automatique : `npm run dev`.
