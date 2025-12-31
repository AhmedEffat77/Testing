import { auth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const btn = document.getElementById("logoutBtn");

if (btn) {
  btn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } finally {
      location.href = "index.html";
    }
  });
}
