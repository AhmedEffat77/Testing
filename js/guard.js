import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function protectPage(role) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = "index.html";
      return;
    }

    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) {
      alert("No user profile found. Please register first.");
      location.href = "index.html";
      return;
    }

    const data = snap.data();

    if (!data.approved || data.role !== role) {
      alert("Access denied");
      location.href = "index.html";
      return;
    }
  });
}
