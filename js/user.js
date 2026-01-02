import { protectPage } from "./guard.js";
import { auth, db } from "./firebase.js";
import {
  addDoc, collection, serverTimestamp, query, where, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, escapeHtml } from "./utils.js";

protectPage(["user"]);

const form = document.getElementById("reqForm");
const myList = document.getElementById("myRequests");
const statusEl = document.getElementById("myStatus");
const searchEl = document.getElementById("mySearch");
const refListEl = document.getElementById("refList");
const modelListEl = document.getElementById("modelList");
let STOCK_REFS = new Set();
let STOCK_MODELS = new Set();
let STOCK_CATEGORIES = new Set();

const categoryListEl = document.getElementById("categoryList");
const deptListEl = document.getElementById("deptList");
const categoryInput = document.getElementById("category");


async function loadStockSuggestions() {
  try {
    if (!refListEl || !modelListEl) return;
    const snap = await getDocs(collection(db, "stockItems"));
    const refs = new Set();
    const models = new Set();
    snap.forEach(d => {
      const x = d.data() || {};
      if (x.reference) refs.add(String(x.reference));
      if (x.model) models.add(String(x.model));
    });

    refListEl.innerHTML = Array.from(refs).sort().slice(0, 2000)
      .map(v => `<option value="${escapeHtml(v)}"></option>`).join("");
    modelListEl.innerHTML = Array.from(models).sort().slice(0, 2000)
      .map(v => `<option value="${escapeHtml(v)}"></option>`).join("");
  } catch (e) {
    console.warn("Autocomplete load skipped:", e);
  }
}

async function prefillProfile() {
  const user = auth.currentUser;
  if (!user) return;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return;
  const u = snap.data() || {};
  document.getElementById("reqName").value = u.name || "";
  document.getElementById("reqDept").value = u.department || "";
}

function reqRow(r) {
  return `
  <div class="card" style="margin:10px 0; padding:12px; background:rgba(255,255,255,0.02)">
    <div class="row" style="align-items:flex-start;">
      <div>
        <div style="font-weight:700">${escapeHtml(r.itemReference || r.itemModel || "-")}</div>
        <div class="muted" style="font-size:12px;">Qty: ${escapeHtml(r.qty)} • Status: <b>${escapeHtml(r.status)}</b></div>
        <div class="muted" style="font-size:12px;">Dept: ${escapeHtml(r.department || "")}</div>
        <div class="muted" style="font-size:12px;">Notes: ${escapeHtml(r.notes || "")}</div>
      </div>
      <div style="min-width:180px;">
        <div class="badge">Last update: ${r.updatedAt?.toDate?.()?.toLocaleString?.() || "-"}</div>
        ${r.managerComment ? `<div class="muted" style="font-size:12px;margin-top:8px;">Comment: ${escapeHtml(r.managerComment)}</div>` : ""}
      </div>
    </div>
  </div>`;
}

async function loadMine() {
  const user = auth.currentUser;
  if (!user) return;
    const q = query(collection(db, "requests"), where("userId", "==", user.uid));
  const snap = await getDocs(q);

  const status = statusEl.value;
  const term = (searchEl.value || "").trim().toLowerCase();

  const rows = [];
  snap.forEach(d => {
    const r = d.data() || {};
    if (status && r.status !== status) return;
    const key = `${r.itemReference||""} ${r.itemModel||""} ${r.notes||""} ${r.status||""}`.toLowerCase();
    if (term && !key.includes(term)) return;
    rows.push(reqRow({...r, id:d.id}));
  });

  myList.innerHTML = rows.join("") || `<p class="small muted">No requests yet.</p>`;
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    showToast("Please login");
    location.href = "index.html";
    return;
  }

  const payload = {
    userId: user.uid,
    requesterName: document.getElementById("reqName").value.trim(),
    department: document.getElementById("reqDept").value.trim(),
    itemReference: document.getElementById("ref").value.trim(),
    itemModel: document.getElementById("model").value.trim(),
    qty: Number(document.getElementById("qty").value),
    notes: document.getElementById("notes").value.trim(),
    status: "Pending",
    managerComment: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!payload.itemReference && !payload.itemModel) {
    showToast("Enter Reference or Model");
    return;
  }

  try {
    await addDoc(collection(db, "requests"), payload);
    showToast("Request submitted");
    form.reset();
await loadStockSuggestions();
    await prefillProfile();
    await loadMine();
  } catch (err) {
    console.error(err);
    showToast("Failed to submit request. Check Firestore Rules.");
  }
});

statusEl?.addEventListener("change", loadMine);
searchEl?.addEventListener("input", loadMine);

await prefillProfile();

  // Validate against uploaded stock
  const category = (document.getElementById("category")?.value || "").trim();
  if (category && !STOCK_CATEGORIES.has(category)) {
    showToast("Invalid category. Please pick from the list (uploaded stock categories).");
    return;
  }
  const refVal = (payload.itemReference || "").trim();
  const modelVal = (payload.itemModel || "").trim();
  if (refVal && !STOCK_REFS.has(refVal)) {
    showToast("Reference not found in uploaded stock. Please select a valid reference.");
    return;
  }
  if (modelVal && !STOCK_MODELS.has(modelVal)) {
    showToast("Model not found in uploaded stock. Please select a valid model.");
    return;
  }
  // If user filled category, keep it in request for better filtering
  payload.itemCategory = category || "";
await loadMine();