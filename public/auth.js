// Garde de session pour l'application.
// Si aucune session valide, on redirige vers la page de connexion.
// Sinon, on révèle l'application et on charge les tâches.

const appScreen = document.getElementById("app");
const userEmail = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

// Redirige vers la page de connexion.
window.goToLogin = function goToLogin() {
  window.location.href = "login.html";
};

// Déconnexion : détruit la session puis retourne à la connexion.
logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.goToLogin();
});

// Au chargement : vérifie la session.
(async function guard() {
  const res = await fetch("/api/auth/me");
  if (!res.ok) {
    window.goToLogin();
    return;
  }
  const user = await res.json();
  window.currentUser = user; // utilisé par app.js pour distinguer les tâches partagées
  userEmail.textContent = user.email;
  appScreen.hidden = false;
  if (window.startTodoApp) window.startTodoApp();
})();
