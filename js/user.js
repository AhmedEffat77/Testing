import { protectPage } from "./guard.js";
import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, escapeHtml } from "./utils.js";

protectPage(["user", "warehouse", "admin", "technical"]); // allow any logged-in approved user to open this page, but typically role=user

const nameEl = document.getElementById("reqName");
const deptEl = document.getElementById("reqDept");
const catEl = document.getElementById("reqCategory");
const refEl = document.getElementById("reqRef");
const modelEl = document.getElementById("reqModel");
const qtyEl = document.getElementById("reqQty");
const notesEl = document.getElementById("reqNotes");
const submitBtn = document.getElementById("submitBtn");

const myStatusEl = document.getElementById("myStatus");
const mySearchEl = document.getElementById("mySearch");
const myRequestsEl = document.getElementById("myRequests");

const refListEl = document.getElementById("refList");
const modelListEl = document.getElementById("modelList");
const catListEl = document.getElementById("catList");

let STOCK_INDEX = {
  refs: new Set(),
  models: new Set(),
  cats: new Set(),
  // map for quick lookup
  refToItem: new Map(),
  modelToItem: new Map(),
};

function norm(s) {
  return String(s || "").trim();
}

function fillDatalist(el, values) {
  if (!el) return;
  el.innerHTML = Array.from(values)
    .sort((a, b) => a.localeCompare(b))
    .map((v) => `<option value="${escapeHtml(v)}"></option>`)
    .join("");
}

async function loadStockLists() {
  try {
    const snap = await getDocs(collection(db, "stockItems"));
    STOCK_INDEX = { refs: new Set(), models: new Set(), cats: new Set(), refToItem: new Map(), modelToItem: new Map() };

    snap.forEach((d) => {
      const x = d.data() || {};
      const reference = norm(x.reference);
      const model = norm(x.model);
      const category = norm(x.category);

      if (reference) {
        STOCK_INDEX.refs.add(reference);
        STOCK_INDEX.refToItem.set(reference.toLowerCase(), { id: d.id, ...x });
      }
      if (model) {
        STOCK_INDEX.models.add(model);
        STOCK_INDEX.modelToItem.set(model.toLowerCase(), { id: d.id, ...x });
      }
      if (category) STOCK_INDEX.cats.add(category);
    });

    fillDatalist(refListEl, STOCK_INDEX.refs);
    fillDatalist(modelListEl, STOCK_INDEX.models);
    fillDatalist(catListEl, STOCK_INDEX.cats);
  } catch (e) {
    console.error(e);
    showToast("Could not load stock lists. Check Firestore Rules.");
  }
}

function validateChoice(value, set, label) {
  const v = norm(value);
  if (!v) return { ok: false, msg: `${label} is required.` };
  // Case-insensitive membership check
  const found = Array.from(set).some((x) => x.toLowerCase() === v.toLowerCase());
  if (!found) return { ok: false, msg: `${label} not found in uploaded stock.` };
  return { ok: true, value: v };
}

async function submitRequest() {
  const user = auth.currentUser;
  if (!user) {
    showToast("Please login first.");
    location.replace("index.html");
    return;
  }

  const requesterName = norm(nameEl.value);
  const department = norm(deptEl.value);
  const category = norm(catEl.value);
  const itemReference = norm(refEl.value);
  const itemModel = norm(modelEl.value);
  const qty = Number(qtyEl.value);

  if (!requesterName) return showToast("Your name is required.");
  if (!department) return showToast("Department/Team is required.");
  if (!category) return showToast("Category is required.");
  if (!Number.isFinite(qty) || qty <= 0) return showToast("Quantity must be a positive number.");

  // Validate department is from list? (We allow free text, but you requested strict validation)
  const deptList = document.getElementById("deptList");
  if (deptList) {
    const allowed = Array.from(deptList.querySelectorAll("option")).map((o) => o.value.toLowerCase());
    if (!allowed.includes(department.toLowerCase())) return showToast("Department/Team must be selected from the list.");
  }

  const catCheck = validateChoice(category, STOCK_INDEX.cats, "Category");
  if (!catCheck.ok) return showToast(catCheck.msg);

  // Require ref or model and validate against stock
  let matched = null;
  if (itemReference) matched = STOCK_INDEX.refToItem.get(itemReference.toLowerCase()) || null;
  if (!matched && itemModel) matched = STOCK_INDEX.modelToItem.get(itemModel.toLowerCase()) || null;

  if (!matched) {
    return showToast("Item Reference/Model not found in uploaded stock. Please select from the suggestions.");
  }

  // Force exact ref/model values from stock for consistency
  const finalRef = norm(matched.reference) || itemReference;
  const finalModel = norm(matched.model) || itemModel;

  // Optional: if user selected a category that doesn't match the item, block
  const itemCat = norm(matched.category);
  if (itemCat && itemCat.toLowerCase() !== category.toLowerCase()) {
    return showToast(`Selected category does not match this item. Expected: ${itemCat}`);
  }

  try {
    await addDoc(collection(db, "requests"), {
      requesterName,
      department,
      category,
      itemReference: finalRef,
      itemModel: finalModel,
      stockId: matched.id || null,
      qty,
      notes: norm(notesEl.value),
      status: "Pending",
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });

    showToast("Request submitted.");
    refEl.value = "";
    modelEl.value = "";
    qtyEl.value = "";
    notesEl.value = "";
    await loadMine();
  } catch (e) {
    console.error(e);
    showToast("Submit failed. Check Firestore Rules.");
  }
}

function requestCard(r) {
  const status = r.status || "Pending";
  return `
    <div class="card" style="margin:10px 0; padding:12px;">
      <div class="row" style="justify-content:space-between;">
        <div>
          <div style="font-weight:700">${escapeHtml(r.itemReference || "-")} <span class="muted">(${escapeHtml(r.itemModel || "-")})</span></div>
          <div class="muted small">${escapeHtml(r.department || "")} • ${escapeHtml(r.category || "")} • Qty: <b>${escapeHtml(r.qty)}</b></div>
          <div class="muted small">Notes: ${escapeHtml(r.notes || "")}</div>
        </div>
        <div style="text-align:right; min-width:120px;">
          <div class="badge ${status.toLowerCase()}">${escapeHtml(status)}</div>
          <div class="muted small" style="margin-top:6px;">${r.createdAt?.toDate?.() ? r.createdAt.toDate().toLocaleString() : ""}</div>
        </div>
      </div>
      ${r.managerComment ? `<div class="muted small" style="margin-top:8px;">Manager: ${escapeHtml(r.managerComment)}</div>` : ""}
    </div>
  `;
}

async function loadMine() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // Avoid composite index: do NOT orderBy server-side. Sort in JS.
    const q = query(collection(db, "requests"), where("createdBy", "==", user.uid));
    const snap = await getDocs(q);

    let items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));

    // Client-side sort by createdAt desc if present
    items.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

    const statusFilter = myStatusEl?.value || "All";
    const term = (mySearchEl?.value || "").trim().toLowerCase();

    items = items.filter((r) => {
      if (statusFilter !== "All" && (r.status || "Pending") !== statusFilter) return false;
      if (!term) return true;
      const key = `${r.itemReference || ""} ${r.itemModel || ""} ${r.department || ""} ${r.category || ""} ${r.notes || ""}`.toLowerCase();
      return key.includes(term);
    });

    myRequestsEl.innerHTML = items.map(requestCard).join("") || `<p class="small muted">No requests yet.</p>`;
  } catch (e) {
    console.error(e);
    showToast("Could not load requests. Check Firestore Rules.");
  }
}

// Wire up
submitBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  try {
    await submitRequest();
  } finally {
    submitBtn.disabled = false;
  }
});

myStatusEl?.addEventListener("change", loadMine);
mySearchEl?.addEventListener("input", loadMine);

// When user types in ref/model, auto-clear the other to reduce mismatches
refEl?.addEventListener("input", () => { if (norm(refEl.value)) modelEl.value = ""; });
modelEl?.addEventListener("input", () => { if (norm(modelEl.value)) refEl.value = ""; });

// Init
await loadStockLists();
await loadMine();
