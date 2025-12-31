import { db } from "./firebase.js";
import { collection, query, where, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const container = document.getElementById("pendingUsers");

if (container) {
  const q = query(collection(db, "users"), where("approved", "==", false));
  const snap = await getDocs(q);

  if (snap.empty) {
    container.innerHTML = "<p>No pending users.</p>";
  }

  snap.forEach((u) => {
    const div = document.createElement("div");
    div.style.marginBottom = "8px";
    div.innerHTML = `<span>${u.id}</span> <button type="button">Approve</button>`;
    div.querySelector("button").onclick = async () => {
      try {
        await updateDoc(doc(db, "users", u.id), { approved: true });
        alert("Approved");
        div.remove();
      } catch (err) {
        console.error(err);
        alert(err?.message || "Approve failed");
      }
    };
    container.appendChild(div);
  });
}
