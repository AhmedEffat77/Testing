import { auth } from "./firebase.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showToast } from "./utils.js";

const form = document.getElementById("resetForm");
const emailEl = document.getElementById("resetEmail");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await sendPasswordResetEmail(auth, emailEl.value.trim());
    showToast("Reset email sent.");
    location.href = "index.html";
  } catch (err) {
    console.error(err);
    showToast(err?.message || "Failed to send reset email");
  }
});
