import { protectPage } from "./guard.js";
protectPage("warehouse");

import { auth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try { await signOut(auth); } finally { window.location.href = "index.html"; }
});
