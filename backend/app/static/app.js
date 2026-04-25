const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const compactMoney = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const state = {
  accounts: [],
  accountId: null,
  summary: null,
  transactions: [],
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
  kpiSavings: document.querySelector("#kpi-savings"),
  kpiDaily: document.querySelector("#kpi-daily"),
  kpiCount: document.querySelector("#kpi-count"),
  categoryBars: document.querySelector("#category-bars"),
  categoryCount: document.querySelector("#category-count"),
  periodLabel: document.querySelector("#period-label"),
  cashflowChart: document.querySelector("#cashflow-chart"),
  dailyChart: document.querySelector("#daily-chart"),
  merchantList: document.querySelector("#merchant-list"),
  largestExpense: document.querySelector("#largest-expense"),
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

  try {
    const query = filters();
    state.summary = await api(`/api/dashboard/summary?${query}`);
    state.transactions = await api(`/api/transactions/?${query}`);
    renderDashboard();
    els.statusLine.textContent = "";
  } catch (error) {
    els.statusLine.textContent = error.message;
  }
}

function renderDashboard() {
  const summary = state.summary;
  if (!summary) {
    clearDashboard();
    return;
  }

  els.kpiSpend.textContent = money.format(summary.kpis.spend);
  els.kpiIncome.textContent = money.format(summary.kpis.income);
  els.kpiNet.textContent = money.format(summary.kpis.net_cashflow);
  els.kpiSavings.textContent = `${summary.kpis.savings_rate}%`;
  els.kpiDaily.textContent = money.format(summary.kpis.average_daily_spend);
  els.kpiCount.textContent = summary.kpis.transaction_count;
  els.categoryCount.textContent = `${summary.kpis.category_count} categories`;
  els.periodLabel.textContent = formatPeriod(summary.period);
  els.largestExpense.textContent = summary.largest_expense
    ? `Largest: ${money.format(summary.largest_expense.amount)}`
    : "";

  renderCategoryBars(summary.top_categories);
  renderMerchants(summary.top_merchants);
  renderCashflow(summary.monthly);
  renderDailySpend(summary.daily_spend);
  renderTransactions(state.transactions);
}

function clearDashboard() {
  state.summary = null;
  state.transactions = [];
  els.kpiSpend.textContent = "-";
  els.kpiIncome.textContent = "-";
  els.kpiNet.textContent = "-";
  els.kpiSavings.textContent = "-";
  els.kpiDaily.textContent = "-";
  els.kpiCount.textContent = "-";
  els.categoryCount.textContent = "";
  els.periodLabel.textContent = "";
  els.largestExpense.textContent = "";
  els.categoryBars.innerHTML = "";
  els.merchantList.innerHTML = "";
  els.transactionTable.innerHTML = "";
  renderCashflow([]);
  renderDailySpend([]);
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
      <div class="bar-meta">${item.count} txns | ${item.share}% of spend</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(item.amount / max) * 100}%"></div></div>
    `;
    els.categoryBars.append(row);
  }
  if (!categories.length) {
    els.categoryBars.textContent = "No spend yet.";
  }
}

function renderMerchants(merchants) {
  els.merchantList.innerHTML = "";
  const max = Math.max(...merchants.map((item) => item.amount), 1);
  for (const item of merchants) {
    const row = document.createElement("div");
    row.className = "merchant-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.merchant)}</strong>
        <span>${item.count} txns</span>
      </div>
      <div class="merchant-amount">${money.format(item.amount)}</div>
      <div class="mini-track"><div style="width:${(item.amount / max) * 100}%"></div></div>
    `;
    els.merchantList.append(row);
  }
  if (!merchants.length) {
    els.merchantList.textContent = "No merchants yet.";
  }
}

function renderCashflow(rows) {
  const { ctx, width, height } = canvasContext(els.cashflowChart, 320);
  ctx.clearRect(0, 0, width, height);

  const data = rows.slice(-12);
  if (!data.length) {
    drawEmpty(ctx, "No monthly data yet.");
    return;
  }

  const max = Math.max(...data.flatMap((item) => [item.debit, item.credit]), 1);
  const left = 56;
  const bottom = height - 42;
  const top = 22;
  const plotWidth = width - left - 22;
  const groupWidth = plotWidth / data.length;
  const barWidth = Math.min(24, Math.max(8, groupWidth / 3.4));

  drawAxes(ctx, left, top, width - 18, bottom);

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
    ctx.fillText(item.label.split(" ")[0], x, bottom + 18);
  });

  ctx.fillStyle = "#20242a";
  ctx.textAlign = "left";
  ctx.font = "12px Segoe UI";
  ctx.fillText(`Peak ${compactMoney.format(max)}`, left, 14);
}

function renderDailySpend(rows) {
  const { ctx, width, height } = canvasContext(els.dailyChart, 260);
  ctx.clearRect(0, 0, width, height);

  const data = rows.slice(-90);
  if (!data.length) {
    drawEmpty(ctx, "No daily spend yet.");
    return;
  }

  const max = Math.max(...data.map((item) => item.amount), 1);
  const left = 56;
  const bottom = height - 36;
  const top = 22;
  const plotWidth = width - left - 22;
  drawAxes(ctx, left, top, width - 18, bottom);

  ctx.strokeStyle = "#2764b8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((item, index) => {
    const x = left + (plotWidth * index) / Math.max(1, data.length - 1);
    const y = bottom - (item.amount / max) * (bottom - top);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#2764b8";
  data.forEach((item, index) => {
    if (data.length > 35 && index % 4 !== 0) return;
    const x = left + (plotWidth * index) / Math.max(1, data.length - 1);
    const y = bottom - (item.amount / max) * (bottom - top);
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  });

  const first = data[0].date.slice(5);
  const last = data[data.length - 1].date.slice(5);
  ctx.fillStyle = "#667085";
  ctx.font = "11px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText(first, left, bottom + 18);
  ctx.textAlign = "right";
  ctx.fillText(last, width - 18, bottom + 18);
}

function renderTransactions(transactions) {
  els.transactionTable.innerHTML = "";
  for (const txn of transactions.slice(0, 75)) {
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

function canvasContext(canvas, height) {
  const width = Math.max(320, Math.floor(canvas.clientWidth || Number(canvas.getAttribute("width")) || 720));
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

function drawAxes(ctx, left, top, right, bottom) {
  ctx.strokeStyle = "#d8dde6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();
}

function drawEmpty(ctx, message) {
  ctx.fillStyle = "#667085";
  ctx.font = "16px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText(message, 24, 48);
}

function formatPeriod(period) {
  if (!period || !period.start || !period.end) return "";
  return `${period.start} to ${period.end}`;
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
  try {
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
  } catch (error) {
    els.statusLine.textContent = error.message;
  }
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
  if (!els.statementFile.files.length) {
    els.statusLine.textContent = "Choose a statement file.";
    return;
  }

  try {
    const form = new FormData();
    form.append("file", els.statementFile.files[0]);
    els.statusLine.textContent = "Uploading statement...";
    const result = await api(`/api/files/import?account_id=${state.accountId}`, {
      method: "POST",
      body: form,
    });
    els.statusLine.textContent = result.duplicate_file
      ? "This statement was already imported."
      : `Imported ${result.imported} of ${result.total_rows} rows. Skipped ${result.skipped}.`;
    els.statementFile.value = "";
    await refreshDashboard();
  } catch (error) {
    els.statusLine.textContent = error.message;
  }
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderDashboard, 120);
});

loadAccounts()
  .then(refreshDashboard)
  .catch((error) => {
    els.statusLine.textContent = error.message;
  });
