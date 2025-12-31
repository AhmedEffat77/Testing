import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const cred = await signInWithEmailAndPassword(auth, emailEl.value, passwordEl.value);
      const snap = await getDoc(doc(db, "users", cred.user.uid));

      if (!snap.exists()) {
        alert("No user profile found in Firestore. Please register (or ask admin to create your user record).");
        return;
      }

      const data = snap.data();
      if (!data.approved) {
        alert("Your account is pending admin approval.");
        return;
      }

      window.location.href = `${data.role}-dashboard.html`;
    } catch (err) {
      console.error(err);
      alert(err?.message || "Login failed");
    }
  });
}

