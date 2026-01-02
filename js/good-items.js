import { protectPage } from "./guard.js";
import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { escapeHtml } from "./utils.js";

protectPage(["warehouse","admin","technical"]);

const searchEl = document.getElementById("goodSearch");
const catEl = document.getElementById("goodCategory");
const tableEl = document.getElementById("goodTable");

let all = [];

function buildTable(items) {
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

function render() {
  const term = (searchEl.value||"").trim().toLowerCase();
  const cat = catEl.value;
  const view = all.filter(x => {
    const th = Number(x.lowThreshold ?? 5);
    const avail = Number(x.availableQty ?? 0);
    if (!(avail >= th)) return false;
    if (cat && String(x.category||"") !== cat) return false;
    if (!term) return true;
    const key = `${x.reference||""} ${x.model||""} ${x.category||""}`.toLowerCase();
    return key.includes(term);
  });
  tableEl.innerHTML = buildTable(view);
}

async function load() {
  const snap = await getDocs(collection(db, "stockItems"));
  all = [];
  const cats = new Set();
  snap.forEach(d => {
    const x = d.data() || {};
    all.push({ id:d.id, ...x });
    if (x.category) cats.add(String(x.category));
  });
  catEl.innerHTML = `<option value="">All categories</option>` + Array.from(cats).sort().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  render();
}

searchEl?.addEventListener("input", render);
catEl?.addEventListener("change", render);

await load();
