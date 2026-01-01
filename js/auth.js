import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from "./utils.js";

const loginForm = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const cred = await signInWithEmailAndPassword(auth, emailEl.value.trim(), passwordEl.value);
    const snap = await getDoc(doc(db, "users", cred.user.uid));

    if (!snap.exists()) {
      showToast("No profile in Firestore. Please register.");
      location.href = "register.html";
      return;
    }

    const data = snap.data() || {};
    if (data.active === false) {
      showToast("Account disabled.");
      return;
    }
    if (!data.approved) {
      showToast("Your account is pending admin approval.");
      return;
    }

    const role = data.role || "user";
    const routes = {
      admin: "admin-dashboard.html",
      warehouse: "warehouse-dashboard.html",
      technical: "technical-dashboard.html",
      user: "user-dashboard.html",
    };

    location.href = routes[role] || "user-dashboard.html";
  } catch (err) {
    console.error(err);
    showToast(err?.message || "Login failed");
  }
});
