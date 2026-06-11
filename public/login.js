// Page de connexion / inscription dédiée.
// En cas de succès, redirige vers l'application (index.html).

const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
const authSubtitle = document.getElementById("auth-subtitle");
const authToggleText = document.getElementById("auth-toggle-text");
const authToggleLink = document.getElementById("auth-toggle-link");

let mode = "login"; // "login" | "register"

function showError(msg) {
  authError.textContent = msg;
  authError.hidden = false;
}

// Bascule connexion <-> inscription.
authToggleLink.addEventListener("click", (e) => {
  e.preventDefault();
  mode = mode === "login" ? "register" : "login";
  authError.hidden = true;
  if (mode === "login") {
    authSubtitle.textContent = "Connectez-vous pour accéder à vos tâches";
    authSubmit.textContent = "Se connecter";
    authToggleText.textContent = "Pas encore de compte ?";
    authToggleLink.textContent = "Créer un compte";
    authPassword.setAttribute("autocomplete", "current-password");
  } else {
    authSubtitle.textContent = "Créez un compte pour commencer";
    authSubmit.textContent = "Créer mon compte";
    authToggleText.textContent = "Déjà un compte ?";
    authToggleLink.textContent = "Se connecter";
    authPassword.setAttribute("autocomplete", "new-password");
  }
});

// Soumission du formulaire.
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.hidden = true;

  const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: authEmail.value,
      password: authPassword.value,
    }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    return showError(error || "Une erreur est survenue.");
  }

  // Connecté : on rejoint l'application.
  window.location.href = "index.html";
});

// Si une session est déjà active, on saute directement à l'application.
(async function redirectIfLoggedIn() {
  const res = await fetch("/api/auth/me");
  if (res.ok) window.location.href = "index.html";
})();
