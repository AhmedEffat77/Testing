import { protectPage } from "./guard.js";
protectPage("admin");

import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const container = document.getElementById("pendingUsers");

async function loadPending() {
  if (!container) return;

  container.innerHTML = "<p>Loading...</p>";

  const q = query(collection(db, "users"), where("approved", "==", false));
  const snap = await getDocs(q);

  if (snap.empty) {
    container.innerHTML = "<p>No pending users.</p>";
    return;
  }

  container.innerHTML = "";

  snap.forEach((u) => {
    const data = u.data() || {};
    const email = data.email || "(no email)";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.alignItems = "center";
    row.style.marginBottom = "10px";

    row.innerHTML = `
      <div style="flex:1">
        <div style="font-weight:600">${email}</div>
        <div style="opacity:.8;font-size:12px">${u.id}</div>
      </div>

      <select style="padding:6px;border-radius:8px">
        <option value="user">user</option>
        <option value="warehouse">warehouse</option>
        <option value="technical">technical</option>
        <option value="admin">admin</option>
      </select>

      <button type="button" style="padding:8px 12px;border-radius:10px;cursor:pointer">
        Approve
      </button>
    `;

    const roleSelect = row.querySelector("select");
    const btn = row.querySelector("button");

    // لو المستخدم كان محدد role قبل كده، خلّيه default في القائمة
    if (data.role) roleSelect.value = data.role;

    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = "Approving...";

      try {
        const chosenRole = roleSelect.value;

        await updateDoc(doc(db, "users", u.id), {
          approved: true,
          role: chosenRole,
          approvedAt: serverTimestamp(),
          // لو مش عامل tracking للأدمن، سيبها كده أو احذف السطر
          // approvedBy: auth.currentUser?.uid || null,
        });

        row.remove();
        if (!container.children.length) container.innerHTML = "<p>No pending users.</p>";
      } catch (e) {
        console.error(e);
        alert("Failed to approve user. Check Firestore Rules.");
        btn.disabled = false;
        btn.textContent = "Approve";
      }
    };

    container.appendChild(row);
  });
}

loadPending();
