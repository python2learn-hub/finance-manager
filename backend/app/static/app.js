const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const state = {
  accounts: [],
  accountId: null,
};

const els = {
  accountForm: document.querySelector("#account-form"),
  accountName: document.querySelector("#account-name"),
  accountType: document.querySelector("#account-type"),
  accountSelect: document.querySelector("#account-select"),
  startDate: document.querySelector("#start-date"),
  endDate: document.querySelector("#end-date"),
  refreshButton: document.querySelector("#refresh-button"),
  uploadForm: document.querySelector("#upload-form"),
  statementFile: document.querySelector("#statement-file"),
  statusLine: document.querySelector("#status-line"),
  kpiSpend: document.querySelector("#kpi-spend"),
  kpiIncome: document.querySelector("#kpi-income"),
  kpiNet: document.querySelector("#kpi-net"),
  kpiCount: document.querySelector("#kpi-count"),
  categoryBars: document.querySelector("#category-bars"),
  chart: document.querySelector("#cashflow-chart"),
  transactionTable: document.querySelector("#transaction-table"),
};

async function api(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed: ${response.status}`);
  }
  return response.json();
}

async function loadAccounts() {
  state.accounts = await api("/api/accounts/");
  els.accountSelect.innerHTML = "";

  if (!state.accounts.length) {
    const option = document.createElement("option");
    option.textContent = "Create an account first";
    option.value = "";
    els.accountSelect.append(option);
    state.accountId = null;
    return;
  }

  for (const account of state.accounts) {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = `${account.name} (${account.type})`;
    els.accountSelect.append(option);
  }
  state.accountId = Number(els.accountSelect.value);
}

function filters() {
  const params = new URLSearchParams();
  if (state.accountId) params.set("account_id", state.accountId);
  if (els.startDate.value) params.set("start_date", els.startDate.value);
  if (els.endDate.value) params.set("end_date", els.endDate.value);
  return params.toString();
}

async function refreshDashboard() {
  if (!state.accountId) {
    clearDashboard();
    return;
  }

  const query = filters();
  const summary = await api(`/api/dashboard/summary?${query}`);
  const transactions = await api(`/api/transactions/?${query}`);

  els.kpiSpend.textContent = money.format(summary.kpis.spend);
  els.kpiIncome.textContent = money.format(summary.kpis.income);
  els.kpiNet.textContent = money.format(summary.kpis.net_cashflow);
  els.kpiCount.textContent = summary.kpis.transaction_count;

  renderCategoryBars(summary.top_categories);
  renderCashflow(summary.monthly);
  renderTransactions(transactions);
}

function clearDashboard() {
  els.kpiSpend.textContent = "-";
  els.kpiIncome.textContent = "-";
  els.kpiNet.textContent = "-";
  els.kpiCount.textContent = "-";
  els.categoryBars.innerHTML = "";
  els.transactionTable.innerHTML = "";
  renderCashflow([]);
}

function renderCategoryBars(categories) {
  els.categoryBars.innerHTML = "";
  const max = Math.max(...categories.map((item) => item.amount), 1);
  for (const item of categories) {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label">
        <span>${escapeHtml(item.category)}</span>
        <strong>${money.format(item.amount)}</strong>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${(item.amount / max) * 100}%"></div></div>
    `;
    els.categoryBars.append(row);
  }
  if (!categories.length) {
    els.categoryBars.textContent = "No spend yet.";
  }
}

function renderCashflow(rows) {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    const bucket = grouped.get(key) || { label: key, debit: 0, credit: 0 };
    bucket[row.direction] = row.amount;
    grouped.set(key, bucket);
  }
  const data = [...grouped.values()].slice(-12);
  if (!data.length) {
    ctx.fillStyle = "#667085";
    ctx.font = "16px Segoe UI";
    ctx.fillText("No monthly data yet.", 24, 48);
    return;
  }

  const max = Math.max(...data.flatMap((item) => [item.debit, item.credit]), 1);
  const left = 48;
  const bottom = canvas.height - 44;
  const top = 24;
  const width = canvas.width - left - 24;
  const groupWidth = width / data.length;
  const barWidth = Math.min(26, groupWidth / 3);

  ctx.strokeStyle = "#d8dde6";
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(canvas.width - 20, bottom);
  ctx.stroke();

  data.forEach((item, index) => {
    const x = left + index * groupWidth + groupWidth / 2;
    const creditHeight = (item.credit / max) * (bottom - top);
    const debitHeight = (item.debit / max) * (bottom - top);

    ctx.fillStyle = "#18794e";
    ctx.fillRect(x - barWidth - 2, bottom - creditHeight, barWidth, creditHeight);
    ctx.fillStyle = "#c2413b";
    ctx.fillRect(x + 2, bottom - debitHeight, barWidth, debitHeight);
    ctx.fillStyle = "#667085";
    ctx.font = "11px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(item.label.slice(2), x, bottom + 18);
  });
}

function renderTransactions(transactions) {
  els.transactionTable.innerHTML = "";
  for (const txn of transactions.slice(0, 50)) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${txn.txn_date}</td>
      <td>${escapeHtml(txn.merchant || txn.narration || "-")}</td>
      <td>${escapeHtml(txn.category_name || "Uncategorized")}</td>
      <td class="${txn.direction}">${txn.direction}</td>
      <td class="amount ${txn.direction}">${money.format(txn.amount)}</td>
    `;
    els.transactionTable.append(row);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

els.accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/accounts/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: els.accountName.value,
      type: els.accountType.value,
      currency: "INR",
    }),
  });
  els.accountName.value = "";
  await loadAccounts();
  await refreshDashboard();
});

els.accountSelect.addEventListener("change", async () => {
  state.accountId = Number(els.accountSelect.value);
  await refreshDashboard();
});

els.refreshButton.addEventListener("click", refreshDashboard);

els.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.accountId) {
    els.statusLine.textContent = "Create or select an account first.";
    return;
  }
  const form = new FormData();
  form.append("file", els.statementFile.files[0]);
  els.statusLine.textContent = "Uploading statement...";
  const result = await api(`/api/files/import?account_id=${state.accountId}`, {
    method: "POST",
    body: form,
  });
  els.statusLine.textContent = result.duplicate_file
    ? "This statement was already imported."
    : `Imported ${result.imported} transactions. Skipped ${result.skipped}.`;
  els.statementFile.value = "";
  await refreshDashboard();
});

loadAccounts()
  .then(refreshDashboard)
  .catch((error) => {
    els.statusLine.textContent = error.message;
  });
