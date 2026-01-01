import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from "./utils.js";

export function protectPage(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.replace("index.html");
      return;
    }

    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        showToast("No user profile found. Please register first.");
        location.replace("register.html");
        return;
      }
      const data = snap.data() || {};
      const role = data.role || "user";
      const approved = !!data.approved;
      const active = data.active !== false;

      if (!active) {
        showToast("Account disabled.");
        location.replace("index.html");
        return;
      }

      if (!approved) {
        showToast("Account pending approval.");
        location.replace("index.html");
        return;
      }

      if (!roles.includes(role)) {
        showToast("Access denied.");
        location.replace("index.html");
        return;
      }
    } catch (err) {
      console.error(err);
      showToast("Authorization error. Check Firestore Rules and user profile.");
      location.replace("index.html");
    }
  });
}
