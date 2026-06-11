const API = "/api/tasks";

// --- Éléments du DOM -----------------------------------------------------
const form = document.getElementById("task-form");
const idField = document.getElementById("task-id");
const titleField = document.getElementById("title");
const descField = document.getElementById("description");
const priorityField = document.getElementById("priority");
const dueField = document.getElementById("due_date");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const list = document.getElementById("task-list");
const emptyMsg = document.getElementById("empty");
const searchField = document.getElementById("search");
const tabs = document.querySelectorAll(".tab");

let currentFilter = "all"; // all | todo | done
let searchTerm = "";

// --- Appels API ----------------------------------------------------------
async function fetchTasks() {
  const params = new URLSearchParams();
  if (currentFilter === "todo") params.set("done", "false");
  if (currentFilter === "done") params.set("done", "true");
  if (searchTerm) params.set("q", searchTerm);

  const res = await fetch(`${API}?${params}`);
  if (res.status === 401) {
    // Session expirée : on renvoie vers la page de connexion.
    window.goToLogin();
    return [];
  }
  return res.json();
}

async function saveTask(data, id) {
  const url = id ? `${API}/${id}` : API;
  const method = id ? "PUT" : "POST";
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error || "Erreur lors de l'enregistrement.");
  }
  return res.json();
}

async function toggleTask(id) {
  await fetch(`${API}/${id}/toggle`, { method: "PATCH" });
  render();
}

async function deleteTask(id) {
  if (!confirm("Supprimer cette tâche ?")) return;
  await fetch(`${API}/${id}`, { method: "DELETE" });
  render();
}

// --- Rendu ---------------------------------------------------------------
function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Échappe le texte destiné à de l'innerHTML.
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function isOverdue(task) {
  if (!task.due_date || task.done) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.due_date) < today;
}

function taskElement(task) {
  const li = document.createElement("li");
  li.className = `task priority-${task.priority}${task.done ? " done" : ""}`;

  const meta = [];
  meta.push(`<span class="badge">${task.priority}</span>`);
  if (task.due_date) {
    const overdue = isOverdue(task);
    meta.push(
      `<span class="badge${overdue ? " overdue" : ""}">📅 ${formatDate(task.due_date)}${
        overdue ? " (en retard)" : ""
      }</span>`
    );
  }

  // Indications de partage.
  const me = window.currentUser?.id;
  if (task.user_id !== me) {
    // Tâche dont je ne suis pas propriétaire : on me l'a partagée.
    meta.push(`<span class="badge shared">👤 de ${esc(task.owner_email)}</span>`);
  } else if (task.assigned_to && task.assigned_to !== me) {
    // Ma tâche, mais assignée à quelqu'un d'autre.
    meta.push(`<span class="badge shared">➡️ ${esc(task.assignee_email)}</span>`);
  }

  li.innerHTML = `
    <button class="checkbox" title="Marquer terminé"></button>
    <div class="task-body">
      <div class="task-title"></div>
      ${task.description ? `<div class="task-desc"></div>` : ""}
      <div class="task-meta">${meta.join("")}</div>
    </div>
    <div class="task-actions">
      <button class="icon-btn edit" title="Modifier">✏️</button>
      ${task.user_id === me ? `<button class="icon-btn delete" title="Supprimer">🗑️</button>` : ""}
    </div>
  `;

  // On insère les textes via textContent pour éviter toute injection HTML.
  li.querySelector(".task-title").textContent = task.title;
  if (task.description) li.querySelector(".task-desc").textContent = task.description;

  li.querySelector(".checkbox").addEventListener("click", () => toggleTask(task.id));
  li.querySelector(".edit").addEventListener("click", () => startEdit(task));
  li.querySelector(".delete")?.addEventListener("click", () => deleteTask(task.id));

  return li;
}

async function render() {
  const tasks = await fetchTasks();
  list.innerHTML = "";
  emptyMsg.hidden = tasks.length > 0;
  tasks.forEach((t) => list.appendChild(taskElement(t)));
}

// --- Formulaire (ajout / édition) ---------------------------------------
function startEdit(task) {
  idField.value = task.id;
  titleField.value = task.title;
  descField.value = task.description || "";
  priorityField.value = task.priority;
  dueField.value = task.due_date ? task.due_date.slice(0, 10) : "";
  submitBtn.textContent = "Enregistrer";
  cancelBtn.hidden = false;
  titleField.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  form.reset();
  idField.value = "";
  priorityField.value = "normale";
  submitBtn.textContent = "Ajouter";
  cancelBtn.hidden = true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    title: titleField.value,
    description: descField.value,
    priority: priorityField.value,
    due_date: dueField.value || null,
  };
  try {
    await saveTask(data, idField.value || null);
    resetForm();
    render();
  } catch (err) {
    alert(err.message);
  }
});

cancelBtn.addEventListener("click", resetForm);

// --- Filtres & recherche -------------------------------------------------
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    render();
  });
});

let searchTimer;
searchField.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTerm = searchField.value.trim();
    render();
  }, 250);
});

// --- Démarrage -----------------------------------------------------------
// C'est auth.js qui déclenche le chargement une fois l'utilisateur connecté.
window.startTodoApp = function startTodoApp() {
  // On réinitialise les filtres à chaque connexion.
  currentFilter = "all";
  searchTerm = "";
  searchField.value = "";
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.filter === "all"));
  resetForm();
  render();
};
