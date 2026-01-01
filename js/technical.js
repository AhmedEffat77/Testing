import { protectPage } from "./guard.js";
import { db } from "./firebase.js";
import {
  collection, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { escapeHtml, downloadText, toISODateInput } from "./utils.js";

protectPage(["technical"]);

const fromEl = document.getElementById("fromDate");
const toEl = document.getElementById("toDate");
const refreshBtn = document.getElementById("refreshBtn");
const qEl = document.getElementById("q");
const statusEl = document.getElementById("statusFilter");

const tableEl = document.getElementById("requestsTable");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");

let _all = [];
let deptChart, itemChart;

function inRange(t, from, to) {
  if (!t) return false;
  if (from && t < from) return false;
  if (to && t > to) return false;
  return true;
}

function buildCharts(rows) {
  const byDept = new Map();
  const byItem = new Map();

  for (const r of rows) {
    const dept = r.department || "Unknown";
    byDept.set(dept, (byDept.get(dept) || 0) + 1);

    const item = (r.itemReference || r.itemModel || "Unknown");
    byItem.set(item, (byItem.get(item) || 0) + 1);
  }

  const deptLabels = Array.from(byDept.keys());
  const deptValues = deptLabels.map(k => byDept.get(k));

  const itemPairs = Array.from(byItem.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const itemLabels = itemPairs.map(x=>x[0]);
  const itemValues = itemPairs.map(x=>x[1]);

  const deptCtx = document.getElementById("deptChart");
  const itemCtx = document.getElementById("itemChart");

  if (deptChart) deptChart.destroy();
  if (itemChart) itemChart.destroy();

  deptChart = new Chart(deptCtx, {
    type: "bar",
    data: { labels: deptLabels, datasets: [{ label: "Requests", data: deptValues }] },
    options: { responsive:true, plugins: { legend: { display:false } } }
  });

  itemChart = new Chart(itemCtx, {
    type: "bar",
    data: { labels: itemLabels, datasets: [{ label: "Requests", data: itemValues }] },
    options: { responsive:true, plugins: { legend: { display:false } } }
  });
}

function render() {
  const term = (qEl.value || "").trim().toLowerCase();
  const status = statusEl.value;

  const from = fromEl.value ? new Date(fromEl.value + "T00:00:00") : null;
  const to = toEl.value ? new Date(toEl.value + "T23:59:59") : null;

  const rows = _all.filter(r => {
    const t = r.createdAt?.toDate?.() || null;
    if (!inRange(t, from, to)) return false;
    if (status && r.status !== status) return false;
    if (term) {
      const key = `${r.requesterName||""} ${r.department||""} ${r.itemReference||""} ${r.itemModel||""} ${r.notes||""} ${r.status||""}`.toLowerCase();
      if (!key.includes(term)) return false;
    }
    return true;
  });

  document.getElementById("kpiTotal").textContent = rows.length;
  document.getElementById("kpiApproved").textContent = rows.filter(x=>x.status==="Approved").length;
  document.getElementById("kpiPending").textContent = rows.filter(x=>x.status==="Pending").length;
  document.getElementById("kpiRejected").textContent = rows.filter(x=>x.status==="Rejected").length;

  buildCharts(rows);

  const htmlRows = rows.slice(0, 300).map(r => `
    <tr>
      <td>${escapeHtml(r.status)}</td>
      <td>${escapeHtml(r.requesterName || "")}</td>
      <td>${escapeHtml(r.department || "")}</td>
      <td>${escapeHtml(r.itemReference || "")}</td>
      <td>${escapeHtml(r.itemModel || "")}</td>
      <td>${escapeHtml(r.qty)}</td>
      <td>${escapeHtml(r.managerComment || "")}</td>
      <td>${r.createdAt?.toDate?.()?.toLocaleString?.() || "-"}</td>
    </tr>`).join("");

  tableEl.innerHTML = `
    <table class="table">
      <thead><tr>
        <th>Status</th><th>Name</th><th>Dept</th><th>Reference</th><th>Model</th><th>Qty</th><th>Comment</th><th>Created</th>
      </tr></thead>
      <tbody>${htmlRows}</tbody>
    </table>
    ${rows.length>300 ? `<p class="small muted">Showing first 300 results.</p>` : ""}
  `;
}

async function load() {
  const snap = await getDocs(query(collection(db, "requests"), orderBy("createdAt", "desc")));
  _all = [];
  snap.forEach(d => _all.push({ id:d.id, ...d.data() }));
  render();
}

function toCsv(rows) {
  const cols = ["status","requesterName","department","itemReference","itemModel","qty","notes","managerComment","createdAt","updatedAt"];
  const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
  const lines = [cols.join(",")];
  for (const r of rows) {
    lines.push(cols.map(c => {
      if (c.endsWith("At")) {
        const t = r[c]?.toDate?.();
        return esc(t ? t.toISOString() : "");
      }
      return esc(r[c]);
    }).join(","));
  }
  return lines.join("\n");
}

exportCsvBtn?.addEventListener("click", () => {
  const term = (qEl.value || "").trim().toLowerCase();
  const status = statusEl.value;
  const from = fromEl.value ? new Date(fromEl.value + "T00:00:00") : null;
  const to = toEl.value ? new Date(toEl.value + "T23:59:59") : null;

  const rows = _all.filter(r => {
    const t = r.createdAt?.toDate?.() || null;
    if (!inRange(t, from, to)) return false;
    if (status && r.status !== status) return false;
    if (term) {
      const key = `${r.requesterName||""} ${r.department||""} ${r.itemReference||""} ${r.itemModel||""} ${r.notes||""} ${r.status||""}`.toLowerCase();
      if (!key.includes(term)) return false;
    }
    return true;
  });

  downloadText(`requests_${new Date().toISOString().slice(0,10)}.csv`, toCsv(rows), "text/csv");
});

exportPdfBtn?.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text("Technical Summary - Requests", 14, 16);
  doc.setFontSize(9);

  const rows = _all.slice(0, 40);
  let y = 26;
  for (const r of rows) {
    const line = `${r.status} | ${r.department||""} | ${(r.itemReference||r.itemModel||"")} | Qty: ${r.qty}`;
    doc.text(line.slice(0, 110), 14, y);
    y += 6;
    if (y > 280) { doc.addPage(); y = 20; }
  }
  doc.save(`requests_${new Date().toISOString().slice(0,10)}.pdf`);
});

refreshBtn?.addEventListener("click", load);
qEl?.addEventListener("input", render);
statusEl?.addEventListener("change", render);

const today = new Date();
fromEl.value = toISODateInput(today);
toEl.value = toISODateInput(today);

await load();
