import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const form = document.getElementById("registerForm");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const roleEl = document.getElementById("role");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailEl.value, passwordEl.value);
      await setDoc(doc(db, "users", cred.user.uid), {
        role: roleEl.value,
        approved: false
      });
      alert("Registration successful. Waiting for admin approval.");
      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      alert(err?.message || "Registration failed");
    }
  });
}
