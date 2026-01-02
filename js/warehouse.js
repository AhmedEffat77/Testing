import { protectPage } from "./guard.js";
import { auth, db } from "./firebase.js";
import {
  collection, getDocs, writeBatch, doc, query, where,
  updateDoc, addDoc, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, escapeHtml } from "./utils.js";

protectPage(["warehouse"]);

const fileEl = document.getElementById("stockFile");
const uploadBtn = document.getElementById("uploadBtn");
const statusEl = document.getElementById("uploadStatus");
const thresholdEl = document.getElementById("lowThreshold");

const pendingEl = document.getElementById("pendingRequests");
const reqSearch = document.getElementById("reqSearch");
const bulkBtn = document.getElementById("bulkApproveBtn");

const stockTableEl = document.getElementById("stockTable");
const stockSearch = document.getElementById("stockSearch");
const categoryFilter = document.getElementById("categoryFilter");

let _pending = [];
let _stock = [];
let _selected = new Set();
let _dailyChart = null;

function normalizeKey(s) { return String(s || "").trim(); }

function parseDateValue(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(v));
    return epoch;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function mapRow(row) {
  const get = (...keys) => {
    for (const k of keys) {
      if (row[k] != null && row[k] !== "") return row[k];
      const found = Object.keys(row).find(x => x.toLowerCase() === String(k).toLowerCase());
      if (found && row[found] != null && row[found] !== "") return row[found];
    }
    return "";
  };

  const reference = normalizeKey(get("Reference", "Ref"));
  const model = normalizeKey(get("Model"));
  const category = normalizeKey(get("Category"));
  const measurement = normalizeKey(get("Measurement", "UOM"));
  const available = Number(get("Available Qty (AE)", "Available Qty", "Available")) || 0;
  const lastMove = normalizeKey(get("Last move", "Last Move"));
  const creationDate = parseDateValue(get("Creation date", "Creation Date"));
  const description = normalizeKey(get("Description"));

  const qtyIn = Number(get("Qty in (AE)", "Qty in")) || 0;
  const qtyOut = Number(get("Qty out (AE)", "Qty out")) || 0;
  const qtyConsumed = Number(get("Qty consumed (AE)", "Qty consumed")) || 0;
  const lastMonthUsage = Number(get("Last Month Usage (AE)", "Last Month Usage")) || 0;
  const avgMonthly3 = Number(get("Avg monthly (3-Month)", "Avg monthly")) || 0;
  const coverageMonths = Number(get("Stock Coverage in Months (AE)", "Stock Coverage")) || 0;

  return {
    reference, model, category, measurement,
    availableQty: available,
    qtyIn, qtyOut, qtyConsumed, lastMonthUsage, avgMonthly3, coverageMonths,
    lastMove,
    creationDate: creationDate ? creationDate.toISOString() : "",
    description,
  };
}

async function readFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data || []),
        error: reject
      });
    });
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

async function uploadStock() {
  const file = fileEl.files?.[0];
  if (!file) { showToast("Choose a file first"); return; }
  statusEl.textContent = "Reading file...";
  const rows = await readFile(file);
  const mapped = rows.map(mapRow).filter(x => x.reference || x.model);
  if (mapped.length === 0) { showToast("No valid rows found"); statusEl.textContent=""; return; }

  const lowThreshold = Number(thresholdEl.value || 5);
  statusEl.textContent = `Uploading ${mapped.length} items...`;

  const batch = writeBatch(db);
  mapped.forEach(item => {
    const id = (item.reference || item.model).replaceAll("/", "-");
    batch.set(doc(db, "stockItems", id), {
      ...item,
      lowThreshold,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || null
    }, { merge: true });
  });

  await batch.commit();
  showToast("Stock uploaded");
  statusEl.textContent = `Uploaded ${mapped.length} items.`;
  await loadStock();
  await loadPendingRequests();
  await loadKpis();
}

function reqCard(r) {
  const id = r.id;
  const checked = _selected.has(id) ? "checked" : "";
  return `
  <div class="card" style="margin:10px 0; padding:12px; background:rgba(255,255,255,0.02)">
    <div class="row" style="align-items:flex-start;">
      <div style="max-width:32px;">
        <input type="checkbox" data-sel="${id}" ${checked} />
      </div>
      <div>
        <div style="font-weight:700">${escapeHtml(r.requesterName || "-")} <span class="muted">(${escapeHtml(r.department || "")})</span></div>
        <div class="muted" style="font-size:12px;">
          Ref: <b>${escapeHtml(r.itemReference || "-")}</b> • Model: <b>${escapeHtml(r.itemModel || "-")}</b> • Qty: <b>${escapeHtml(r.qty)}</b>
        </div>
        <div class="muted" style="font-size:12px;">Notes: ${escapeHtml(r.notes || "")}</div>
      </div>
      <div style="min-width:240px;">
        <label style="margin:0 0 6px;">Comment</label>
        <input data-comment="${id}" placeholder="Optional comment..." />
        <div class="row" style="margin-top:10px;">
          <button type="button" data-approve="${id}">Approve</button>
          <button type="button" data-reject="${id}" class="danger">Reject</button>
          <button type="button" data-fulfill="${id}" class="secondary">Fulfill</button>
        </div>
      </div>
    </div>
  </div>`;
}

async function loadPendingRequests() {
  const q = query(collection(db, "requests"), where("status", "==", "Pending"));
  const snap = await getDocs(q);
  _pending = [];
  snap.forEach(d => _pending.push({ id: d.id, ...d.data() }));
  _pending.sort((a,b) => (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0));

  const term = (reqSearch.value || "").trim().toLowerCase();
  const view = _pending.filter(r => {
    if (!term) return true;
    const key = `${r.requesterName||""} ${r.department||""} ${r.itemReference||""} ${r.itemModel||""}`.toLowerCase();
    return key.includes(term);
  });

  pendingEl.innerHTML = view.map(reqCard).join("") || `<p class="small muted">No pending requests.</p>`;
}

async function adjustStockForRequest(r, sign=-1) {
  const key = (r.itemReference || r.itemModel || "").trim();
  if (!key) return { ok:false, msg:"Missing item key" };
  const id = key.replaceAll("/", "-");
  const refDoc = doc(db, "stockItems", id);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) return { ok:false, msg:"Stock item not found. Upload stock or fix item reference/model." };
  const item = snap.data() || {};
  const avail = Number(item.availableQty || 0);
  const qty = Number(r.qty || 0);
  const next = avail + (sign*qty);
  if (next < 0) return { ok:false, msg:`Insufficient stock. Available: ${avail}` };
  await updateDoc(refDoc, {
    availableQty: next,
    updatedAt: serverTimestamp(),
    lastMove: `Request ${sign===-1?"approved":"reverted"}: ${r.id}`,
  });
  await addDoc(collection(db, "stockMovements"), {
    stockId: id,
    requestId: r.id,
    delta: sign*qty,
    before: avail,
    after: next,
    createdAt: serverTimestamp(),
    actorId: auth.currentUser?.uid || null,
    note: sign===-1 ? "Approved request deduction" : "Reverted deduction"
  });
  return { ok:true };
}

async function updateRequestStatus(id, status) {
  const comment = document.querySelector(`input[data-comment="${id}"]`)?.value?.trim() || "";
  const docRef = doc(db, "requests", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  const r = { id, ...snap.data() };

  if (status === "Approved") {
    const res = await adjustStockForRequest(r, -1);
    if (!res.ok) { showToast(res.msg); return; }
  }

  await updateDoc(docRef, {
    status,
    managerComment: comment,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || null
  });
  showToast(`Request ${status}`);
  await loadPendingRequests();
  await loadKpis();
}

document.addEventListener("click", async (e) => {
  const a = e.target?.getAttribute?.("data-approve");
  const r = e.target?.getAttribute?.("data-reject");
  const f = e.target?.getAttribute?.("data-fulfill");
  if (a) await updateRequestStatus(a, "Approved");
  if (r) await updateRequestStatus(r, "Rejected");
  if (f) await updateRequestStatus(f, "Fulfilled");
});

document.addEventListener("change", (e) => {
  const id = e.target?.getAttribute?.("data-sel");
  if (!id) return;
  if (e.target.checked) _selected.add(id);
  else _selected.delete(id);
});

bulkBtn?.addEventListener("click", async () => {
  if (_selected.size === 0) { showToast("Select at least one request"); return; }
  for (const id of Array.from(_selected)) {
    await updateRequestStatus(id, "Approved");
    _selected.delete(id);
  }
  showToast("Bulk approve done");
});

reqSearch?.addEventListener("input", loadPendingRequests);

function stockTable(items) {
  const rows = items.map(x => `
    <tr>
      <td>${escapeHtml(x.reference || "")}</td>
      <td>${escapeHtml(x.model || "")}</td>
      <td>${escapeHtml(x.category || "")}</td>
      <td>${escapeHtml(x.measurement || "")}</td>
      <td><b>${escapeHtml(x.availableQty ?? 0)}</b></td>
      <td>${escapeHtml(x.lowThreshold ?? 5)}</td>
      <td>${escapeHtml(x.lastMove || "")}</td>
    </tr>`).join("");
  return `
  <table class="table">
    <thead><tr>
      <th>Reference</th><th>Model</th><th>Category</th><th>UOM</th><th>Available</th><th>Low Th.</th><th>Last move</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function loadStock() {
  const snap = await getDocs(collection(db, "stockItems"));
  _stock = [];
  const cats = new Set();
  snap.forEach(d => {
    const x = d.data() || {};
    _stock.push({ id:d.id, ...x });
    if (x.category) cats.add(x.category);
  });

  const current = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="">All categories</option>` +
    Array.from(cats).sort().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  categoryFilter.value = current;

  renderStock();
}

function renderStock() {
  const term = (stockSearch.value || "").trim().toLowerCase();
  const cat = categoryFilter.value;

  const view = _stock.filter(s => {
    if (cat && String(s.category||"") !== cat) return false;
    if (!term) return true;
    const key = `${s.reference||""} ${s.model||""} ${s.category||""}`.toLowerCase();
    return key.includes(term);
  });

  stockTableEl.innerHTML = stockTable(view.slice(0, 200)) + (view.length>200 ? `<p class="small muted">Showing first 200 results.</p>` : "");
}

stockSearch?.addEventListener("input", renderStock);
categoryFilter?.addEventListener("change", renderStock);

async function loadKpis() {
  document.getElementById("kpiItems").textContent = _stock.length;

  let low = 0;
  _stock.forEach(s => {
    const th = Number(s.lowThreshold ?? 5);
    const avail = Number(s.availableQty ?? 0);
    if (avail < th) low++;
  });
  document.getElementById("kpiLow").textContent = low;
  const good = Math.max(0, _stock.length - low);
  const goodEl = document.getElementById("kpiGood");
  if (goodEl) goodEl.textContent = good;
  document.getElementById("kpiReqPending").textContent = _pending.length;

  const today = new Date(); today.setHours(0,0,0,0);
  const reqSnap = await getDocs(collection(db, "requests"));
  let approvedToday = 0;
  reqSnap.forEach(d => {
    const x = d.data() || {};
    if (x.status === "Approved") {
      const t = x.updatedAt?.toDate?.();
      if (t && t >= today) approvedToday++;
    }
  });
  document.getElementById("kpiReqApproved").textContent = approvedToday;
}

uploadBtn?.addEventListener("click", async () => {
  try {
    uploadBtn.disabled = true;
    await uploadStock();
  } catch (e) {
    console.error(e);
    showToast("Upload failed. Check console + Firestore rules.");
    statusEl.textContent = "";
  } finally {
    uploadBtn.disabled = false;
  }
});

await loadStock();
await loadPendingRequests();
await loadKpis();
