import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from "./utils.js";

const form = document.getElementById("registerForm");
const nameEl = document.getElementById("name");
const deptEl = document.getElementById("department");
const emailEl = document.getElementById("regEmail");
const passEl = document.getElementById("regPassword");
const roleEl = document.getElementById("role");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const cred = await createUserWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);

    await setDoc(doc(db, "users", cred.user.uid), {
      name: nameEl.value.trim(),
      department: deptEl.value.trim(),
      email: emailEl.value.trim().toLowerCase(),
      role: roleEl.value,
      approved: false,
      active: true,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    }, { merge: true });

    showToast("Account created. Waiting for approval.");
    location.href = "index.html";
  } catch (err) {
    console.error(err);
    showToast(err?.message || "Registration failed");
  }
});
