import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  Database,
  Filter,
  FolderInput,
  Gauge,
  Layers3,
  LineChart as LineIcon,
  Loader2,
  PieChart,
  Plus,
  RefreshCcw,
  Search,
  Tag,
  Upload,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

const number = new Intl.NumberFormat("en-IN");

const navItems = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "import", label: "Import", icon: FolderInput },
  { id: "transactions", label: "Transactions", icon: WalletCards },
  { id: "categorize", label: "Categorize", icon: Tag },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

const categoryColors = [
  "#2563eb",
  "#0f766e",
  "#b45309",
  "#be123c",
  "#7c3aed",
  "#15803d",
  "#c2410c",
  "#0e7490",
  "#9333ea",
  "#4b5563",
  "#ca8a04",
  "#dc2626",
];

const emptySummary = {
  period: {},
  kpis: {
    spend: 0,
    income: 0,
    net_cashflow: 0,
    transaction_count: 0,
    debit_count: 0,
    credit_count: 0,
    average_debit: 0,
    average_credit: 0,
    average_daily_spend: 0,
    monthly_run_rate: 0,
    largest_expense: 0,
    largest_income: 0,
    savings_rate: 0,
    category_count: 0,
    uncategorized_count: 0,
    uncategorized_spend: 0,
    category_coverage: 0,
  },
  largest_expense: null,
  top_categories: [],
  top_merchants: [],
  top_income_sources: [],
  category_breakdown: [],
  monthly: [],
  daily_spend: [],
  recent: [],
};

async function api(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed: ${response.status}`);
  }
  return response.json();
}

function queryString(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

function monthRange(value) {
  if (!value) return { start: "", end: "" };
  const [year, month] = value.split("-").map(Number);
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function periodText(period) {
  if (!period?.start || !period?.end) return "All dates";
  return `${period.start} to ${period.end}`;
}

function amountTone(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function App() {
  const [page, setPage] = useState("overview");
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [month, setMonth] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summary, setSummary] = useState(emptySummary);
  const [transactions, setTransactions] = useState([]);
  const [uncategorized, setUncategorized] = useState([]);
  const [status, setStatus] = useState({ text: "", tone: "neutral" });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [recategorizing, setRecategorizing] = useState(false);
  const [categoryEdits, setCategoryEdits] = useState({});
  const [newAccount, setNewAccount] = useState({ name: "", type: "bank" });
  const [statementFile, setStatementFile] = useState(null);
  const [search, setSearch] = useState("");

  const selectedAccount = useMemo(
    () => accounts.find((account) => String(account.id) === String(accountId)),
    [accounts, accountId],
  );

  const filters = useMemo(
    () => ({
      account_id: accountId,
      start_date: startDate,
      end_date: endDate,
    }),
    [accountId, startDate, endDate],
  );

  const filteredTransactions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return transactions;
    return transactions.filter((txn) =>
      [txn.account_name, txn.merchant, txn.narration, txn.category_name, txn.direction]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [transactions, search]);

  useEffect(() => {
    const hashPage = window.location.hash.replace("#", "");
    if (navItems.some((item) => item.id === hashPage)) {
      setPage(hashPage);
    }

    const onHashChange = () => {
      const next = window.location.hash.replace("#", "");
      if (navItems.some((item) => item.id === next)) setPage(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    if (!accounts.length && !loading) {
      setSummary(emptySummary);
      setTransactions([]);
      setUncategorized([]);
      return;
    }
    if (accounts.length) refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, accounts.length]);

  function navigate(nextPage) {
    setPage(nextPage);
    window.history.replaceState(null, "", `#${nextPage}`);
  }

  async function loadLookups() {
    try {
      setLoading(true);
      const [accountRows, categoryRows] = await Promise.all([
        api("/api/accounts/"),
        api("/api/transactions/categories"),
      ]);
      setAccounts(accountRows);
      setCategories(categoryRows);
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function refreshData() {
    if (!accounts.length) return;
    try {
      setLoading(true);
      showStatus("");
      const baseQuery = queryString(filters);
      const uncategorizedQuery = queryString({ ...filters, uncategorized: true });
      const [summaryPayload, transactionRows, uncategorizedRows, categoryRows] = await Promise.all([
        api(`/api/dashboard/summary${baseQuery}`),
        api(`/api/transactions/${baseQuery}`),
        api(`/api/transactions/${uncategorizedQuery}`),
        api("/api/transactions/categories"),
      ]);
      setSummary(summaryPayload);
      setTransactions(transactionRows);
      setUncategorized(uncategorizedRows);
      setCategories(categoryRows);
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function showStatus(text, tone = "neutral") {
    setStatus({ text, tone });
  }

  function handleMonthChange(value) {
    setMonth(value);
    const range = monthRange(value);
    setStartDate(range.start);
    setEndDate(range.end);
  }

  function handleManualDate(setter) {
    return (event) => {
      setMonth("");
      setter(event.target.value);
    };
  }

  async function createAccount(event) {
    event.preventDefault();
    if (!newAccount.name.trim()) return;
    try {
      await api("/api/accounts/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newAccount, name: newAccount.name.trim(), currency: "INR" }),
      });
      setNewAccount({ name: "", type: "bank" });
      await loadLookups();
      showStatus("Account added.", "success");
    } catch (error) {
      showStatus(error.message, "error");
    }
  }

  async function uploadStatement(event) {
    event.preventDefault();
    if (!accountId) {
      showStatus("Select one account before upload.", "error");
      return;
    }
    if (!statementFile) {
      showStatus("Choose a statement file.", "error");
      return;
    }

    try {
      setUploading(true);
      const form = new FormData();
      form.append("file", statementFile);
      const result = await api(`/api/files/import?account_id=${accountId}`, {
        method: "POST",
        body: form,
      });
      setStatementFile(null);
      event.currentTarget.reset();
      await refreshData();
      showStatus(
        result.duplicate_file
          ? "This statement was already imported."
          : `Imported ${result.imported} of ${result.total_rows} rows.`,
        "success",
      );
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setUploading(false);
    }
  }

  function updateCategoryEdit(id, patch) {
    setCategoryEdits((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), ...patch },
    }));
  }

  async function saveCategory(txn) {
    const edit = categoryEdits[txn.id] || {};
    let payload = null;
    if (edit.categoryId === "__new") {
      const categoryName = (edit.categoryName || "").trim();
      if (!categoryName) {
        showStatus("Enter a category name.", "error");
        return;
      }
      payload = { category_name: categoryName };
    } else if (edit.categoryId) {
      payload = { category_id: Number(edit.categoryId) };
    }

    if (!payload) {
      showStatus("Choose a category.", "error");
      return;
    }

    try {
      setSavingId(txn.id);
      await api(`/api/transactions/${txn.id}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setCategoryEdits((current) => {
        const next = { ...current };
        delete next[txn.id];
        return next;
      });
      await refreshData();
      showStatus("Category saved.", "success");
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setSavingId(null);
    }
  }

  async function autoCategorize() {
    try {
      setRecategorizing(true);
      const params = queryString({ account_id: accountId, only_uncategorized: true });
      const result = await api(`/api/transactions/recategorize${params}`, { method: "POST" });
      await refreshData();
      showStatus(`Updated ${result.updated} transactions.`, "success");
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setRecategorizing(false);
    }
  }

  const kpis = summary.kpis || emptySummary.kpis;
  const period = periodText(summary.period);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <Layers3 size={22} />
          </div>
          <div>
            <h1>Finance Manager</h1>
            <span>{selectedAccount ? selectedAccount.name : "All accounts"}</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                type="button"
                onClick={() => navigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                <ChevronRight size={16} />
              </button>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <span>Period</span>
          <strong>{period}</strong>
        </div>
      </aside>

      <main className="workspace">
        <header className="top-panel">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h2>{pageTitle(page)}</h2>
          </div>
          <div className="status-wrap">
            {loading && (
              <span className="loading-pill">
                <Loader2 size={15} className="spin" />
                Loading
              </span>
            )}
            {status.text && <span className={`status-pill ${status.tone}`}>{status.text}</span>}
          </div>
        </header>

        <section className="filter-panel">
          <label>
            Account
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </option>
              ))}
            </select>
          </label>
          <label>
            Month
            <input type="month" value={month} onChange={(event) => handleMonthChange(event.target.value)} />
          </label>
          <label>
            From
            <input type="date" value={startDate} onChange={handleManualDate(setStartDate)} />
          </label>
          <label>
            To
            <input type="date" value={endDate} onChange={handleManualDate(setEndDate)} />
          </label>
          <div className="filter-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setMonth("");
                setStartDate("");
                setEndDate("");
              }}
            >
              <Filter size={16} />
              Clear
            </button>
            <button type="button" onClick={refreshData}>
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
        </section>

        {page === "overview" && (
          <OverviewPage
            kpis={kpis}
            summary={summary}
            period={period}
            transactions={transactions}
            onCategorize={() => navigate("categorize")}
          />
        )}
        {page === "import" && (
          <ImportPage
            accounts={accounts}
            accountId={accountId}
            newAccount={newAccount}
            setNewAccount={setNewAccount}
            createAccount={createAccount}
            uploadStatement={uploadStatement}
            setStatementFile={setStatementFile}
            uploading={uploading}
          />
        )}
        {page === "transactions" && (
          <TransactionsPage search={search} setSearch={setSearch} transactions={filteredTransactions} />
        )}
        {page === "categorize" && (
          <CategorizePage
            uncategorized={uncategorized}
            categories={categories}
            categoryEdits={categoryEdits}
            updateCategoryEdit={updateCategoryEdit}
            saveCategory={saveCategory}
            savingId={savingId}
            autoCategorize={autoCategorize}
            recategorizing={recategorizing}
          />
        )}
        {page === "analytics" && <AnalyticsPage kpis={kpis} summary={summary} />}
      </main>
    </div>
  );
}

function pageTitle(page) {
  return navItems.find((item) => item.id === page)?.label || "Overview";
}

function OverviewPage({ kpis, summary, period, transactions, onCategorize }) {
  return (
    <div className="page-grid">
      <section className="kpi-grid">
        <KpiCard label="Spend" value={money.format(kpis.spend)} icon={ArrowDownRight} tone="negative" />
        <KpiCard label="Income" value={money.format(kpis.income)} icon={ArrowUpRight} tone="positive" />
        <KpiCard
          label="Net cashflow"
          value={money.format(kpis.net_cashflow)}
          icon={Activity}
          tone={amountTone(kpis.net_cashflow)}
        />
        <KpiCard label="Savings rate" value={`${kpis.savings_rate}%`} icon={Gauge} tone="accent" />
        <KpiCard label="Avg daily spend" value={money.format(kpis.average_daily_spend)} icon={LineIcon} />
        <KpiCard label="Run rate" value={money.format(kpis.monthly_run_rate)} icon={BarChart3} />
        <KpiCard label="Transactions" value={number.format(kpis.transaction_count)} icon={Database} />
        <KpiCard
          label="Uncategorized"
          value={number.format(kpis.uncategorized_count)}
          icon={Tag}
          action={kpis.uncategorized_count ? onCategorize : null}
        />
      </section>

      <section className="chart-grid">
        <Panel title="Monthly Cashflow" meta={period}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={summary.monthly || []} barGap={4}>
              <CartesianGrid vertical={false} stroke="#e4e8ef" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => compactMoney.format(value)} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="credit" fill="#0f766e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="debit" fill="#be123c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Daily Spend" meta={`${summary.daily_spend?.length || 0} active days`}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={summary.daily_spend || []}>
              <CartesianGrid vertical={false} stroke="#e4e8ef" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => compactMoney.format(value)} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2.4} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </section>

      <section className="split-content">
        <Panel title="Category Spend" meta={`${kpis.category_count} categories`}>
          <CategoryBars rows={summary.top_categories || []} />
        </Panel>
        <Panel title="Top Merchants" meta="Debit activity">
          <MerchantList rows={summary.top_merchants || []} labelKey="merchant" />
        </Panel>
      </section>

      <Panel title="Recent Transactions" meta={`${transactions.length} loaded`}>
        <TransactionsTable transactions={transactions.slice(0, 12)} compact />
      </Panel>
    </div>
  );
}

function ImportPage({
  accounts,
  accountId,
  newAccount,
  setNewAccount,
  createAccount,
  uploadStatement,
  setStatementFile,
  uploading,
}) {
  return (
    <div className="split-content">
      <Panel title="Accounts" meta={`${accounts.length} total`}>
        <form className="stack-form" onSubmit={createAccount}>
          <label>
            Name
            <input
              value={newAccount.name}
              onChange={(event) => setNewAccount((current) => ({ ...current, name: event.target.value }))}
              placeholder="Account name"
              required
            />
          </label>
          <label>
            Type
            <select
              value={newAccount.type}
              onChange={(event) => setNewAccount((current) => ({ ...current, type: event.target.value }))}
            >
              <option value="bank">Bank</option>
              <option value="credit">Credit card</option>
              <option value="wallet">Wallet</option>
              <option value="cash">Cash</option>
              <option value="broker">Broker</option>
            </select>
          </label>
          <button type="submit">
            <Plus size={16} />
            Add Account
          </button>
        </form>
        <div className="account-list">
          {accounts.map((account) => (
            <div className="account-row" key={account.id}>
              <div>
                <strong>{account.name}</strong>
                <span>{account.type}</span>
              </div>
              <span>{account.currency}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Statement Upload" meta={accountId ? "Ready" : "Select account"}>
        <form className="stack-form" onSubmit={uploadStatement}>
          <label>
            File
            <input
              type="file"
              accept=".csv,.xlsx,.xlsm,.pdf"
              onChange={(event) => setStatementFile(event.target.files?.[0] || null)}
              required
            />
          </label>
          <button type="submit" disabled={uploading}>
            {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
            Upload
          </button>
        </form>
      </Panel>
    </div>
  );
}

function TransactionsPage({ search, setSearch, transactions }) {
  return (
    <Panel title="Transactions" meta={`${transactions.length} visible`}>
      <div className="table-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" />
        </label>
      </div>
      <TransactionsTable transactions={transactions} />
    </Panel>
  );
}

function CategorizePage({
  uncategorized,
  categories,
  categoryEdits,
  updateCategoryEdit,
  saveCategory,
  savingId,
  autoCategorize,
  recategorizing,
}) {
  return (
    <Panel
      title="Uncategorized Transactions"
      meta={`${uncategorized.length} open`}
      action={
        <button className="secondary-button" type="button" onClick={autoCategorize} disabled={recategorizing}>
          {recategorizing ? <Loader2 size={16} className="spin" /> : <RefreshCcw size={16} />}
          Auto-categorize
        </button>
      }
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Narration</th>
              <th className="amount">Amount</th>
              <th>Category</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {uncategorized.map((txn) => {
              const edit = categoryEdits[txn.id] || {};
              const isNew = edit.categoryId === "__new";
              return (
                <tr key={txn.id}>
                  <td>{txn.txn_date}</td>
                  <td>{txn.merchant || "-"}</td>
                  <td className="narration-cell">{txn.narration || "-"}</td>
                  <td className={`amount ${txn.direction}`}>{money.format(txn.amount)}</td>
                  <td className="category-editor">
                    <select
                      value={edit.categoryId || ""}
                      onChange={(event) => updateCategoryEdit(txn.id, { categoryId: event.target.value })}
                    >
                      <option value="">Choose</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                      <option value="__new">New category</option>
                    </select>
                    {isNew && (
                      <input
                        value={edit.categoryName || ""}
                        onChange={(event) => updateCategoryEdit(txn.id, { categoryName: event.target.value })}
                        placeholder="Category"
                      />
                    )}
                  </td>
                  <td>
                    <button className="icon-button" type="button" onClick={() => saveCategory(txn)}>
                      {savingId === txn.id ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!uncategorized.length && <EmptyState text="No open transactions." />}
      </div>
    </Panel>
  );
}

function AnalyticsPage({ kpis, summary }) {
  return (
    <div className="page-grid">
      <section className="kpi-grid">
        <KpiCard label="Category coverage" value={`${kpis.category_coverage}%`} icon={PieChart} tone="positive" />
        <KpiCard label="Categories" value={number.format(kpis.category_count)} icon={Layers3} />
        <KpiCard label="Debit txns" value={number.format(kpis.debit_count)} icon={ArrowDownRight} tone="negative" />
        <KpiCard label="Credit txns" value={number.format(kpis.credit_count)} icon={ArrowUpRight} tone="positive" />
        <KpiCard label="Average debit" value={money.format(kpis.average_debit)} icon={Activity} />
        <KpiCard label="Average credit" value={money.format(kpis.average_credit)} icon={Activity} />
        <KpiCard label="Largest expense" value={money.format(kpis.largest_expense)} icon={ArrowDownRight} tone="negative" />
        <KpiCard label="Largest income" value={money.format(kpis.largest_income)} icon={ArrowUpRight} tone="positive" />
      </section>

      <section className="split-content">
        <Panel title="Category Mix" meta="Debit share">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={(summary.category_breakdown || []).filter((row) => row.debit > 0).slice(0, 12)} layout="vertical">
              <CartesianGrid horizontal={false} stroke="#e4e8ef" />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => compactMoney.format(value)} />
              <YAxis dataKey="category" type="category" width={118} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="debit" radius={[0, 4, 4, 0]}>
                {(summary.category_breakdown || []).map((_, index) => (
                  <Cell key={index} fill={categoryColors[index % categoryColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Income Sources" meta="Credit activity">
          <MerchantList rows={summary.top_income_sources || []} labelKey="source" />
        </Panel>
      </section>

      <Panel title="Category Breakdown" meta={`${summary.category_breakdown?.length || 0} rows`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th className="amount">Debit</th>
                <th className="amount">Credit</th>
                <th className="amount">Net</th>
                <th className="amount">Share</th>
                <th className="amount">Txns</th>
              </tr>
            </thead>
            <tbody>
              {(summary.category_breakdown || []).map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td className="amount debit">{money.format(row.debit)}</td>
                  <td className="amount credit">{money.format(row.credit)}</td>
                  <td className={`amount ${amountTone(row.net)}`}>{money.format(row.net)}</td>
                  <td className="amount">{row.share}%</td>
                  <td className="amount">{number.format(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone = "neutral", action }) {
  return (
    <article className={`kpi-card ${tone}`}>
      <div className="kpi-icon">
        <Icon size={18} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {action && (
        <button className="micro-button" type="button" onClick={action}>
          Open
        </button>
      )}
    </article>
  );
}

function Panel({ title, meta, action, children }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>{title}</h3>
          {meta && <span>{meta}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function CategoryBars({ rows }) {
  const data = rows.filter((row) => (row.amount || row.debit || 0) > 0).slice(0, 12);
  const max = Math.max(...data.map((row) => row.amount || row.debit || 0), 1);

  if (!data.length) return <EmptyState text="No spend found." />;

  return (
    <div className="bar-list">
      {data.map((row, index) => {
        const amount = row.amount || row.debit || 0;
        return (
          <div className="bar-row" key={row.category}>
            <div className="bar-label">
              <span>{row.category}</span>
              <strong>{money.format(amount)}</strong>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${(amount / max) * 100}%`,
                  backgroundColor: categoryColors[index % categoryColors.length],
                }}
              />
            </div>
            <span className="bar-meta">
              {number.format(row.count || 0)} txns · {row.share || 0}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MerchantList({ rows, labelKey }) {
  const max = Math.max(...rows.map((row) => row.amount), 1);
  if (!rows.length) return <EmptyState text="No rows found." />;

  return (
    <div className="merchant-list">
      {rows.map((row, index) => (
        <div className="merchant-row" key={`${row[labelKey]}-${index}`}>
          <div>
            <strong>{row[labelKey] || "Unknown"}</strong>
            <span>{number.format(row.count)} txns</span>
          </div>
          <em>{money.format(row.amount)}</em>
          <div className="mini-track">
            <div style={{ width: `${(row.amount / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TransactionsTable({ transactions, compact = false }) {
  if (!transactions.length) return <EmptyState text="No transactions found." />;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            {!compact && <th>Account</th>}
            <th>Merchant</th>
            {!compact && <th>Narration</th>}
            <th>Category</th>
            <th>Type</th>
            <th className="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => (
            <tr key={txn.id}>
              <td>{txn.txn_date}</td>
              {!compact && <td>{txn.account_name || "-"}</td>}
              <td>{txn.merchant || "-"}</td>
              {!compact && <td className="narration-cell">{txn.narration || "-"}</td>}
              <td>{txn.category_name || "Uncategorized"}</td>
              <td>
                <span className={`direction-pill ${txn.direction}`}>{txn.direction}</span>
              </td>
              <td className={`amount ${txn.direction}`}>{money.format(txn.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey}>
          {item.name || item.dataKey}: {money.format(item.value || 0)}
        </span>
      ))}
    </div>
  );
}

export default App;
