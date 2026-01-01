import { protectPage } from "./guard.js";
import { db } from "./firebase.js";
import {
  collection, query, where, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { escapeHtml, showToast } from "./utils.js";

protectPage(["admin"]);

const pendingEl = document.getElementById("pendingUsers");
const allEl = document.getElementById("allUsers");
const searchEl = document.getElementById("userSearch");

async function loadKpis() {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    document.getElementById("kpiUsers").textContent = usersSnap.size;

    let pending = 0;
    usersSnap.forEach(d => {
      const x = d.data() || {};
      if (x.approved === false) pending++;
    });
    document.getElementById("kpiPending").textContent = pending;

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const reqSnap = await getDocs(collection(db, "requests"));
    let req30 = 0;
    reqSnap.forEach(r => {
      const x = r.data() || {};
      const t = x.createdAt?.toDate?.();
      if (t && t >= since) req30++;
    });
    document.getElementById("kpiRequests").textContent = req30;

    const stockSnap = await getDocs(collection(db, "stockItems"));
    let low = 0;
    stockSnap.forEach(s => {
      const x = s.data() || {};
      const th = Number(x.lowThreshold ?? 5);
      const avail = Number(x.availableQty ?? 0);
      if (avail < th) low++;
    });
    document.getElementById("kpiLowStock").textContent = low;
  } catch (e) {
    console.error(e);
  }
}

function userRow(id, u, showActions) {
  const role = u.role || "user";
  const approved = !!u.approved;
  const active = u.active !== false;

  const roleOptions = ["admin", "warehouse", "technical", "user"]
    .map(r => `<option value="${r}" ${r===role?"selected":""}>${r}</option>`)
    .join("");

  return `
  <div class="card" style="margin:10px 0; padding:12px; background:rgba(255,255,255,0.02)">
    <div class="row" style="align-items:center;">
      <div>
        <div style="font-weight:700">${escapeHtml(u.name || "-")}</div>
        <div class="muted" style="font-size:12px;">${escapeHtml(u.email || "")} • ${escapeHtml(u.department || "")}</div>
        <div class="badge" style="margin-top:8px;">
          <span>role: <b>${escapeHtml(role)}</b></span>
          <span>approved: <b>${approved}</b></span>
          <span>active: <b>${active}</b></span>
        </div>
      </div>
      ${showActions ? `
      <div style="min-width:240px;">
        <label style="margin:0 0 6px;">Role</label>
        <select data-role="${id}">${roleOptions}</select>
        <div class="row" style="margin-top:10px;">
          <button data-approve="${id}" type="button">Approve</button>
          <button data-disable="${id}" type="button" class="danger">${active?"Disable":"Enable"}</button>
        </div>
      </div>` : ""}
    </div>
  </div>`;
}

async function loadPending() {
  const q = query(collection(db, "users"), where("approved", "==", false));
  const snap = await getDocs(q);
  if (snap.empty) {
    pendingEl.innerHTML = `<p class="small muted">No pending users.</p>`;
    return;
  }
  pendingEl.innerHTML = "";
  snap.forEach(d => pendingEl.insertAdjacentHTML("beforeend", userRow(d.id, d.data(), true)));
}

async function loadAll(filter="") {
  const snap = await getDocs(collection(db, "users"));
  const items = [];
  snap.forEach(d => {
    const u = d.data() || {};
    const key = `${u.name||""} ${u.email||""} ${u.department||""}`.toLowerCase();
    if (!filter || key.includes(filter)) items.push([d.id, u]);
  });
  allEl.innerHTML = items.slice(0, 25).map(([id,u]) => userRow(id,u,false)).join("") || `<p class="small muted">No users.</p>`;
}

document.addEventListener("change", async (e) => {
  const id = e.target?.getAttribute?.("data-role");
  if (!id) return;
  try {
    await updateDoc(doc(db, "users", id), { role: e.target.value });
    showToast("Role updated");
    await loadKpis();
  } catch (err) {
    console.error(err);
    showToast("Failed to update role");
  }
});

document.addEventListener("click", async (e) => {
  const approveId = e.target?.getAttribute?.("data-approve");
  const toggleId = e.target?.getAttribute?.("data-disable");

  if (approveId) {
    try {
      const roleSel = document.querySelector(`select[data-role="${approveId}"]`);
      const newRole = roleSel?.value || "user";
      await updateDoc(doc(db, "users", approveId), { approved: true, role: newRole });
      showToast("Approved");
      await loadPending();
      await loadKpis();
      await loadAll(searchEl.value.trim().toLowerCase());
    } catch (err) {
      console.error(err);
      showToast("Approve failed");
    }
  }

  if (toggleId) {
    try {
      const btn = e.target;
      const willDisable = btn.textContent.trim().toLowerCase() === "disable";
      await updateDoc(doc(db, "users", toggleId), { active: !willDisable });
      showToast("Updated");
      await loadPending();
      await loadAll(searchEl.value.trim().toLowerCase());
      await loadKpis();
    } catch (err) {
      console.error(err);
      showToast("Update failed");
    }
  }
});

searchEl?.addEventListener("input", () => loadAll(searchEl.value.trim().toLowerCase()));

await loadKpis();
await loadPending();
await loadAll();
