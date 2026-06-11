// Vue Kanban : 3 colonnes (À faire / En cours / Terminé).
// Glisser-déposer une carte change son statut. Un menu permet d'assigner
// la tâche à un autre utilisateur (partage).

const STATUSES = ["todo", "in_progress", "done"];

const boardWrapper = document.getElementById("board-wrapper");
const kanbanUser = document.getElementById("kanban-user");
const columns = Object.fromEntries(
  STATUSES.map((s) => [s, document.querySelector(`.column[data-status="${s}"]`)])
);

let me = null; // utilisateur courant
let users = []; // liste des utilisateurs (pour l'assignation)

// --- Utilitaires ---------------------------------------------------------
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

// --- API -----------------------------------------------------------------
async function api(url, options) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = "login.html";
    throw new Error("unauthenticated");
  }
  return res;
}

async function loadTasks() {
  const res = await api("/api/tasks");
  return res.json();
}

async function setStatus(id, status) {
  await api(`/api/tasks/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

async function assignTask(id, assignedTo) {
  await api(`/api/tasks/${id}/assign`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assigned_to: assignedTo }),
  });
}

// --- Rendu d'une carte ---------------------------------------------------
function card(task) {
  const el = document.createElement("article");
  el.className = `kard priority-${task.priority}`;
  el.draggable = true;
  el.dataset.id = task.id;

  const owner = task.user_id === me.id ? "moi" : task.owner_email;
  const dueBadge = task.due_date
    ? `<span class="badge">📅 ${formatDate(task.due_date)}</span>`
    : "";

  // Menu d'assignation : liste des utilisateurs + option "Personne".
  const options = [`<option value="">— Non assignée —</option>`]
    .concat(
      users.map(
        (u) =>
          `<option value="${u.id}" ${u.id === task.assigned_to ? "selected" : ""}>${esc(
            u.id === me.id ? "Moi" : u.email
          )}</option>`
      )
    )
    .join("");

  el.innerHTML = `
    <div class="kard-title"></div>
    <div class="kard-desc"></div>
    <div class="kard-meta">
      <span class="badge">${esc(task.priority)}</span>
      ${dueBadge}
    </div>
    <label class="assign">
      <span>Assigner à</span>
      <select class="assign-select">${options}</select>
    </label>
    <div class="kard-owner">Propriétaire : ${esc(owner)}</div>
  `;

  el.querySelector(".kard-title").textContent = task.title;
  const desc = el.querySelector(".kard-desc");
  if (task.description) desc.textContent = task.description;
  else desc.remove();

  // Assignation.
  el.querySelector(".assign-select").addEventListener("change", async (e) => {
    const value = e.target.value ? Number(e.target.value) : null;
    try {
      await assignTask(task.id, value);
      render();
    } catch (err) {
      if (err.message !== "unauthenticated") alert("Impossible d'assigner la tâche.");
    }
  });

  // Glisser-déposer.
  el.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", String(task.id));
    el.classList.add("dragging");
  });
  el.addEventListener("dragend", () => el.classList.remove("dragging"));

  return el;
}

// --- Rendu du tableau ----------------------------------------------------
async function render() {
  let tasks;
  try {
    tasks = await loadTasks();
  } catch {
    return; // non authentifié : message déjà affiché
  }

  STATUSES.forEach((status) => {
    const col = columns[status];
    const body = col.querySelector("[data-dropzone]");
    const items = tasks.filter((t) => t.status === status);
    body.innerHTML = "";
    items.forEach((t) => body.appendChild(card(t)));
    col.querySelector("[data-count]").textContent = items.length;
  });
}

// --- Zones de dépôt ------------------------------------------------------
STATUSES.forEach((status) => {
  const body = columns[status].querySelector("[data-dropzone]");

  body.addEventListener("dragover", (e) => {
    e.preventDefault(); // autorise le drop
    body.classList.add("drop-hover");
  });
  body.addEventListener("dragleave", () => body.classList.remove("drop-hover"));

  body.addEventListener("drop", async (e) => {
    e.preventDefault();
    body.classList.remove("drop-hover");
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    try {
      await setStatus(id, status);
      render();
    } catch (err) {
      if (err.message !== "unauthenticated") alert("Impossible de déplacer la tâche.");
    }
  });
});

// --- Démarrage -----------------------------------------------------------
(async function init() {
  // Vérifie la session et récupère l'utilisateur courant.
  const meRes = await fetch("/api/auth/me");
  if (!meRes.ok) {
    window.location.href = "login.html";
    return;
  }
  me = await meRes.json();
  boardWrapper.hidden = false;
  kanbanUser.textContent = me.email;

  users = await (await api("/api/users")).json();
  render();
})();
