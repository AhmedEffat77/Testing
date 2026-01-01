import { protectPage } from "./guard.js";
protectPage("user");

import { auth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } finally {
      // ارجع للّوجين دايمًا
      window.location.href = "index.html";
    }
  });
}
