import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function protectPage(role) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.log("NO USER -> redirect to index");
      location.href = "index.html";
      return;
    }

    console.log("LOGGED IN UID:", user.uid, "EMAIL:", user.email);

    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) {
      console.log("NO DOC in users for UID:", user.uid);
      alert("No user profile found in Firestore");
      location.href = "index.html";
      return;
    }

    const data = snap.data();
    console.log("USER DOC DATA:", data);
    console.log("EXPECTED ROLE:", role);

    if (!data.approved || data.role !== role) {
      console.log("DENIED BECAUSE:", {
        approved: data.approved,
        role: data.role,
        expected: role
      });
      alert("Access denied");
      location.href = "index.html";
      return;
    }

    console.log("ACCESS GRANTED");
  });
}
