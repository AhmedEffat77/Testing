import { auth } from "./firebase.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const resetLink = document.getElementById("resetPassword");

if (resetLink) {
  resetLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = prompt("Enter your email to receive a reset link:");
    if (!email) return;
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent.");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to send reset email");
    }
  });
}

