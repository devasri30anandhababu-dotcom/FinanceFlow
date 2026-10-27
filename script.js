'use strict';
/* ---------- Constants & helpers ---------- */
const KEY = 'financeflow-data-v1';
const CATS = {
  expense: ['Food', 'Transport', 'Shopping', 'Education', 'Bills', 'Entertainment', 'Health', 'Rent', 'Subscriptions', 'Other'],
  income: ['Salary', 'Freelance', 'Scholarship', 'Allowance', 'Business', 'Other']
};
const PAY = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other'];
const TITLES = { dashboard: 'Dashboard', transactions: 'Transactions', add: 'Add Transaction', budgets: 'Budgets', analytics: 'Analytics', recurring: 'Recurring Transactions', settings: 'Settings' };
const PAL = ['#4f46e5', '#0ea5e9', '#16a34a', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6', '#ec4899', '#84cc16', '#64748b'];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const today = () => iso(new Date());
const thisMonth = () => today().slice(0, 7);
const empty = m => `<p class="empty">${m}</p>`;
const bar = (pct, cls) => `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(pct, 100).toFixed(0)}"><i class="${cls}" style="width:${Math.min(pct, 100)}%"></i></div>`;

/* ---------- Storage ---------- */
function demoData() {
  const m = thisMonth();
  const t = (type, amount, category, day, payment, description) => ({ id: uid(), type, amount, category, date: `${m}-${day}`, payment, description, demo: true });
  return [
    t('income', 25000, 'Salary', '01', 'Bank Transfer', 'Monthly salary'),
    t('income', 5000, 'Freelance', '03', 'UPI', 'Freelance project'),
    t('expense', 2500, 'Food', '02', 'UPI', 'Groceries and meals'),
    t('expense', 1500, 'Transport', '04', 'Cash', 'Bus pass and fuel'),
    t('expense', 3000, 'Shopping', '05', 'Debit Card', 'Clothes'),
    t('expense', 2000, 'Education', '06', 'UPI', 'Online course'),
    t('expense', 1000, 'Entertainment', '07', 'Credit Card', 'Movies')
  ];
}
function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.transactions)) return { budgets: [], recurring: [], settings: { theme: 'light' }, ...d };
  } catch { /* fall through to demo data */ }
  return {
    transactions: demoData(),
    budgets: [{ id: uid(), category: 'Food', limit: 3000, month: thisMonth(), demo: true }],
    recurring: [],
    settings: { theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' }
  };
}
let state = loadData();
const saveData = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast('Could not save: browser storage is full or blocked.', 'bad'); } };
const commit = () => { saveData(); renderAll(); };

/* ---------- Calculations ---------- */
const total = (list, type) => list.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);
const calculateIncome = (l = state.transactions) => total(l, 'income');
const calculateExpenses = (l = state.transactions) => total(l, 'expense');
const calculateBalance = l => calculateIncome(l) - calculateExpenses(l);
const calculateSavingsRate = l => { const i = calculateIncome(l); return i > 0 ? (i - calculateExpenses(l)) / i * 100 : 0; };
function byCategory(list) {
  const o = {};
  list.filter(t => t.type === 'expense').forEach(t => { o[t.category] = (o[t.category] || 0) + t.amount; });
  return o;
}
function calculateBudgetStatus(b) {
  const spent = byCategory(state.transactions.filter(t => t.date.startsWith(b.month)))[b.category] || 0;
  const pct = b.limit > 0 ? spent / b.limit * 100 : 0;
  return { spent, remaining: b.limit - spent, pct, status: pct >= 100 ? 'Over Budget' : pct >= 80 ? 'Near Limit' : 'Within Budget', cls: pct >= 100 ? 'bad' : pct >= 80 ? 'warn' : 'good' };
}
function monthlyTotals() {
  const m = {};
  state.transactions.forEach(t => { const k = t.date.slice(0, 7); (m[k] ??= { income: 0, expense: 0 })[t.type] += t.amount; });
  return Object.keys(m).sort().map(k => ({ month: k, ...m[k] }));
}

/* ---------- Transaction CRUD ---------- */
const addTransaction = t => { state.transactions.push({ id: uid(), ...t }); commit(); };
const updateTransaction = (id, t) => { const i = state.transactions.findIndex(x => x.id === id); if (i > -1) { state.transactions[i] = { ...state.transactions[i], ...t, demo: false }; commit(); } };
const deleteTransaction = id => { state.transactions = state.transactions.filter(t => t.id !== id); commit(); };

/* ---------- UI helpers ---------- */
function toast(msg, kind = 'good') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), 3800);
}
function confirmBox(msg) {
  return new Promise(res => {
    const d = $('#dlg'); $('#dlgMsg').textContent = msg; d.returnValue = '';
    d.onclose = () => res(d.returnValue === 'yes'); d.showModal();
  });
}
function fillSelect(sel, items, selected, placeholder) {
  sel.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') + items.map(i => `<option>${esc(i)}</option>`).join('');
  if (selected) sel.value = selected;
}
function draw(id, hasData, config) {
  const c = document.getElementById(id), msg = c.nextElementSibling;
  charts[id]?.destroy(); delete charts[id];
  c.hidden = !hasData; msg.hidden = hasData;
  if (hasData && window.Chart) charts[id] = new Chart(c, config);
}
const charts = {};
const chartOpts = extra => ({ maintainAspectRatio: false, ...extra });

/* ---------- Navigation ---------- */
function go(p) {
  if (!$('#p-' + p)) p = 'dashboard';
  $$('.page').forEach(s => { s.hidden = s.id !== 'p-' + p; });
  $$('.side button').forEach(b => b.classList.toggle('active', b.dataset.id === p));
  $('#title').textContent = TITLES[p];
  history.replaceState(null, '', '#' + p);
  scrollTo(0, 0); renderAll();
}

/* ---------- Rendering ---------- */
function renderAll() {
  if (window.Chart) {
    const cs = getComputedStyle(document.documentElement);
    Chart.defaults.color = cs.getPropertyValue('--muted').trim();
    Chart.defaults.borderColor = cs.getPropertyValue('--line').trim();
  }
  renderDashboard(); renderTransactions(); renderBudgets(); renderAnalytics(); renderRecurring();
}
function renderDashboard() {
  const tx = state.transactions, bal = calculateBalance(), rate = calculateSavingsRate();
  const big = tx.filter(t => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0];
  const cards = [
    ['Total Balance', inr(bal), bal < 0 ? 'bad' : '', ''],
    ['Total Income', inr(calculateIncome()), 'good', ''],
    ['Total Expenses', inr(calculateExpenses()), 'bad', ''],
    ['Savings Rate', rate.toFixed(1) + '%', rate < 0 ? 'bad' : '', ''],
    ['Biggest Expense', big ? inr(big.amount) : '—', '', big ? `${esc(big.category)}, ${big.date}` : 'No expenses yet']
  ];
  $('#cards').innerHTML = cards.map(([l, v, c, s]) => `<div class="card stat"><span>${l}</span><b class="${c}">${v}</b><small>${s}</small></div>`).join('');
  $('#demoNote').innerHTML = tx.some(t => t.demo) ? `<div class="note"><span><b>Sample data:</b> the transactions marked as demo are examples, not your real data.</span><button class="btn sm" data-act="clearDemo">Clear sample data</button></div>` : '';
  const recent = [...tx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $('#recent').innerHTML = recent.length ? recent.map(t => `<div class="between brow"><span>${esc(t.description) || esc(t.category)}<br><small>${t.date} · ${esc(t.category)}</small></span><b class="${t.type === 'income' ? 'good' : 'bad'}">${t.type === 'income' ? '+' : '−'}${inr(t.amount)}</b></div>`).join('') : empty('No transactions yet. Add your first transaction to start tracking your finances.');
  const bs = state.budgets.filter(b => b.month === thisMonth());
  $('#dashBudgets').innerHTML = bs.length ? bs.map(b => { const s = calculateBudgetStatus(b); return `<div class="brow"><div class="between"><span>${esc(b.category)}</span><span class="pill ${s.cls}">${s.status}</span></div>${bar(s.pct, s.cls)}<small>${inr(s.spent)} of ${inr(b.limit)}</small></div>`; }).join('') : empty('No budgets for this month. Create one in Budgets.');
  const mt = monthlyTotals().slice(-6), cat = byCategory(tx), keys = Object.keys(cat);
  draw('chMonthly', mt.some(m => m.expense > 0), { type: 'bar', data: { labels: mt.map(m => m.month), datasets: [{ label: 'Expenses (₹)', data: mt.map(m => m.expense), backgroundColor: PAL[0], borderRadius: 6 }] }, options: chartOpts({ plugins: { legend: { display: false } } }) });
  draw('chCat', keys.length > 0, { type: 'doughnut', data: { labels: keys, datasets: [{ data: keys.map(k => cat[k]), backgroundColor: PAL, borderWidth: 0 }] }, options: chartOpts({ plugins: { legend: { position: 'bottom' } } }) });
}
let sortDir = -1;
function getFiltered() {
  const q = $('#fSearch').value.trim().toLowerCase(), ty = $('#fType').value, ca = $('#fCat').value, pa = $('#fPay').value, mo = $('#fMonth').value;
  const cmp = { date: (a, b) => a.date.localeCompare(b.date), amount: (a, b) => a.amount - b.amount, category: (a, b) => a.category.localeCompare(b.category) }[$('#fSort').value];
  return state.transactions
    .filter(t => (!q || [t.description, t.category, t.amount].some(v => String(v ?? '').toLowerCase().includes(q))) && (!ty || t.type === ty) && (!ca || t.category === ca) && (!pa || t.payment === pa) && (!mo || t.date.startsWith(mo)))
    .sort((a, b) => cmp(a, b) * sortDir);
}
function renderTransactions() {
  const list = getFiltered();
  $('#txBody').innerHTML = list.map(t => {
    const inc = t.type === 'income', cls = inc ? 'good' : 'bad';
    return `<tr><td data-label="Date">${t.date}</td><td data-label="Description">${esc(t.description) || '—'}${t.demo ? ' <span class="pill">demo</span>' : ''}</td><td data-label="Category">${esc(t.category)}</td><td data-label="Payment">${esc(t.payment)}</td><td data-label="Type"><span class="pill ${cls}">${inc ? '▲ Income' : '▼ Expense'}</span></td><td data-label="Amount" class="amt ${cls}">${inc ? '+' : '−'}${inr(t.amount)}</td><td data-label="Actions"><button class="btn sm ghost" data-act="editTx" data-id="${t.id}" aria-label="Edit transaction">✏️</button> <button class="btn sm ghost" data-act="delTx" data-id="${t.id}" aria-label="Delete transaction">🗑️</button></td></tr>`;
  }).join('');
  $('#txEmpty').innerHTML = list.length ? '' : empty(state.transactions.length ? 'No transactions match your filters.' : 'No transactions yet. Add your first transaction to start tracking your finances.');
}
function renderBudgets() {
  const list = [...state.budgets].sort((a, b) => b.month.localeCompare(a.month) || a.category.localeCompare(b.category));
  const st = list.map(b => ({ b, s: calculateBudgetStatus(b) }));
  $('#bWarn').innerHTML = st.filter(x => x.s.pct >= 100).map(x => `<div class="alert" role="alert">Warning: Your ${esc(x.b.category)} budget has been exceeded (${x.b.month}).</div>`).join('');
  $('#bBody').innerHTML = st.map(({ b, s }) => `<tr><td data-label="Category">${esc(b.category)}</td><td data-label="Month">${b.month}</td><td data-label="Limit">${inr(b.limit)}</td><td data-label="Spent">${inr(s.spent)}</td><td data-label="Remaining" class="${s.remaining < 0 ? 'bad' : ''}">${inr(s.remaining)}</td><td data-label="Progress">${bar(s.pct, s.cls)}</td><td data-label="Status"><span class="pill ${s.cls}">${s.status}</span></td><td data-label="Actions"><button class="btn sm ghost" data-act="delBudget" data-id="${b.id}" aria-label="Delete budget">🗑️</button></td></tr>`).join('');
  $('#bEmpty').innerHTML = st.length ? '' : empty('No budgets yet. Set a monthly limit for a category above.');
}
function renderAnalytics() {
  const sel = $('#anMonth'), cur = sel.value || thisMonth();
  const months = [...new Set([thisMonth(), ...state.transactions.map(t => t.date.slice(0, 7))])].sort().reverse();
  sel.innerHTML = months.map(m => `<option>${m}</option>`).join(''); sel.value = months.includes(cur) ? cur : months[0];
  const mo = sel.value, list = state.transactions.filter(t => t.date.startsWith(mo));
  const [y, m] = mo.split('-').map(Number), days = new Date(y, m, 0).getDate();
  const elapsed = mo === thisMonth() ? new Date().getDate() : days;
  const cat = byCategory(list), keys = Object.keys(cat).sort((a, b) => cat[b] - cat[a]), exp = calculateExpenses(list);
  const stats = [['Total income', inr(calculateIncome(list)), 'good'], ['Total expenses', inr(exp), 'bad'], ['Avg daily spending', inr(exp / elapsed), ''], ['Top category', keys[0] || '—', ''], ['Savings rate', calculateSavingsRate(list).toFixed(1) + '%', ''], ['Transactions', list.length, '']];
  $('#anStats').innerHTML = stats.map(([l, v, c]) => `<div class="card stat"><span>${l}</span><b class="${c}">${esc(v)}</b></div>`).join('');
  draw('anCat', keys.length > 0, { type: 'doughnut', data: { labels: keys, datasets: [{ data: keys.map(k => cat[k]), backgroundColor: PAL, borderWidth: 0 }] }, options: chartOpts({ plugins: { legend: { position: 'bottom' } } }) });
  const daily = type => Array.from({ length: days }, (_, i) => total(list.filter(t => +t.date.slice(8, 10) === i + 1), type));
  draw('anLine', list.length > 0, { type: 'line', data: { labels: Array.from({ length: days }, (_, i) => i + 1), datasets: [{ label: 'Income', data: daily('income'), borderColor: '#16a34a', tension: .3 }, { label: 'Expenses', data: daily('expense'), borderColor: '#ef4444', tension: .3 }] }, options: chartOpts({ plugins: { legend: { position: 'bottom' } } }) });
  const mt = monthlyTotals();
  draw('anBar', mt.some(x => x.expense > 0), { type: 'bar', data: { labels: mt.map(x => x.month), datasets: [{ label: 'Expenses (₹)', data: mt.map(x => x.expense), backgroundColor: PAL[1], borderRadius: 6 }] }, options: chartOpts({ plugins: { legend: { display: false } } }) });
  $('#anTable').innerHTML = keys.length ? keys.map(k => `<div class="brow"><div class="between"><span>${esc(k)}</span><b>${inr(cat[k])} (${(cat[k] / exp * 100).toFixed(0)}%)</b></div>${bar(cat[k] / exp * 100, '')}</div>`).join('') : empty('No expenses this month.');
}
function renderRecurring() {
  $('#rBody').innerHTML = state.recurring.map(r => `<tr><td data-label="Name">${esc(r.name)}</td><td data-label="Amount">${inr(r.amount)}</td><td data-label="Type"><span class="pill ${r.type === 'income' ? 'good' : 'bad'}">${r.type}</span></td><td data-label="Category">${esc(r.category)}</td><td data-label="Frequency">${r.frequency}</td><td data-label="Next date">${r.nextDate}</td><td data-label="Status"><button class="btn sm ghost" data-act="toggleRec" data-id="${r.id}" aria-pressed="${r.active}">${r.active ? '✅ Enabled' : '⏸ Disabled'}</button></td><td data-label="Actions"><button class="btn sm ghost" data-act="editRec" data-id="${r.id}" aria-label="Edit recurring">✏️</button> <button class="btn sm ghost" data-act="delRec" data-id="${r.id}" aria-label="Delete recurring">🗑️</button></td></tr>`).join('');
  $('#rEmpty').innerHTML = state.recurring.length ? '' : empty('No recurring transactions yet. Add rent, subscriptions, salary or allowance above.');
}

/* ---------- Recurring engine ---------- */
function advance(d, f) {
  const x = new Date(d + 'T00:00:00');
  if (f === 'daily') x.setDate(x.getDate() + 1); else if (f === 'weekly') x.setDate(x.getDate() + 7);
  else if (f === 'monthly') x.setMonth(x.getMonth() + 1); else x.setFullYear(x.getFullYear() + 1);
  return iso(x);
}
function applyRecurring() {
  let n = 0;
  state.recurring.forEach(r => {
    while (r.active && r.nextDate <= today() && n < 500) {
      state.transactions.push({ id: uid(), type: r.type, amount: r.amount, category: r.category, date: r.nextDate, payment: 'Other', description: r.name + ' (recurring)' });
      r.nextDate = advance(r.nextDate, r.frequency); n++;
    }
  });
  if (n) { saveData(); toast(`${n} recurring transaction(s) added.`); }
}

/* ---------- Forms ---------- */
function resetTxForm() {
  $('#txForm').reset(); $('#tId').value = ''; $('#tDate').value = today(); $('#txErr').textContent = '';
  $('#txFormTitle').textContent = 'Add Transaction'; fillSelect($('#tCat'), CATS.expense, '', 'Select category');
}
function checkBudget(t) {
  if (t.type !== 'expense') return;
  state.budgets.filter(b => b.category === t.category && t.date.startsWith(b.month)).forEach(b => {
    const s = calculateBudgetStatus(b);
    if (s.pct >= 100) toast(`Warning: Your ${b.category} budget has been exceeded.`, 'bad');
    else if (s.pct >= 80) toast(`Your ${b.category} budget is ${s.pct.toFixed(0)}% used.`, 'warn');
  });
}
$('#tType').addEventListener('change', e => fillSelect($('#tCat'), CATS[e.target.value], '', 'Select category'));
$('#txForm').addEventListener('submit', e => {
  e.preventDefault();
  const t = { type: $('#tType').value, amount: parseFloat($('#tAmount').value), category: $('#tCat').value, date: $('#tDate').value, payment: $('#tPay').value, description: $('#tDesc').value.trim() };
  const err = !t.type ? 'Choose a transaction type.' : !(t.amount > 0) ? 'Amount must be greater than 0.' : !t.category ? 'Category is required.' : !t.date ? 'Date is required.' : '';
  $('#txErr').textContent = err; if (err) return;
  const id = $('#tId').value;
  id ? updateTransaction(id, t) : addTransaction(t);
  toast(id ? 'Transaction updated.' : 'Transaction saved.'); checkBudget(t); resetTxForm(); go('transactions');
});
$('#bForm').addEventListener('submit', e => {
  e.preventDefault();
  const category = $('#bCat').value, limit = parseFloat($('#bLimit').value), month = $('#bMonth').value;
  if (!(limit > 0) || !month) return toast('Enter a limit above 0 and choose a month.', 'bad');
  const ex = state.budgets.find(b => b.category === category && b.month === month);
  ex ? Object.assign(ex, { limit, demo: false }) : state.budgets.push({ id: uid(), category, limit, month });
  commit(); toast('Budget saved.'); $('#bLimit').value = '';
});
function resetRecForm() {
  $('#rForm').reset(); $('#rId').value = ''; $('#rNext').value = today(); $('#rFormTitle').textContent = 'Add recurring transaction'; fillSelect($('#rCat'), CATS.expense, '', 'Select category');
}
$('#rType').addEventListener('change', e => fillSelect($('#rCat'), CATS[e.target.value], '', 'Select category'));
$('#rForm').addEventListener('submit', e => {
  e.preventDefault();
  const r = { name: $('#rName').value.trim(), amount: parseFloat($('#rAmount').value), type: $('#rType').value, category: $('#rCat').value, frequency: $('#rFreq').value, nextDate: $('#rNext').value };
  if (!r.name || !(r.amount > 0) || !r.category || !r.nextDate) return toast('Fill in name, amount, category and next date.', 'bad');
  const id = $('#rId').value, ex = state.recurring.find(x => x.id === id);
  ex ? Object.assign(ex, r) : state.recurring.push({ id: uid(), active: true, ...r });
  applyRecurring(); commit(); toast('Recurring transaction saved.'); resetRecForm();
});
['fSearch', 'fType', 'fCat', 'fPay', 'fMonth', 'fSort'].forEach(id => $('#' + id).addEventListener('input', renderTransactions));
$('#anMonth').addEventListener('input', renderAnalytics);

/* ---------- Export / Import ---------- */
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const exportData = () => download(`financeflow-backup-${today()}.json`, JSON.stringify({ app: 'FinanceFlow', version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2), 'application/json');
function exportCsv() {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = state.transactions.map(t => [t.id, t.date, t.type, t.category, t.payment, t.amount, t.description].map(q).join(','));
  download(`financeflow-transactions-${today()}.csv`, ['ID,Date,Type,Category,Payment,Amount,Description', ...rows].join('\n'), 'text/csv');
}
const validBackup = d => d && Array.isArray(d.transactions) &&
  d.transactions.every(t => t && ['income', 'expense'].includes(t.type) && Number(t.amount) > 0 && typeof t.category === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) &&
  ['budgets', 'recurring'].every(k => d[k] === undefined || Array.isArray(d[k]));
async function importData(file) {
  let d; try { d = JSON.parse(await file.text()); } catch { return toast('That file is not valid JSON.', 'bad'); }
  if (!validBackup(d)) return toast('Backup structure is not valid.', 'bad');
  if (!await confirmBox('Importing this backup may replace your current data. Do you want to continue?')) return;
  state = {
    transactions: d.transactions.map(t => ({ ...t, id: t.id || uid(), amount: Number(t.amount), payment: t.payment || 'Other', description: t.description || '' })),
    budgets: d.budgets || [], recurring: d.recurring || [], settings: { ...state.settings, ...(d.settings || {}) }
  };
  applyTheme(); commit(); toast('Backup imported.');
}
$('#impFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importData(f); });

/* ---------- Theme ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  $('#themeBtn').textContent = state.settings.theme === 'dark' ? '☀️' : '🌙';
  document.querySelector('meta[name=theme-color]').content = state.settings.theme === 'dark' ? '#0f1420' : '#4f46e5';
}

/* ---------- Click actions ---------- */
const actions = {
  go: p => { if (p === 'add') resetTxForm(); go(p); },
  theme: () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; applyTheme(); commit(); },
  sortDir: () => { sortDir *= -1; $('#sortDir').textContent = sortDir < 0 ? '↓ Desc' : '↑ Asc'; renderTransactions(); },
  clearFilters: () => { ['fSearch', 'fType', 'fCat', 'fPay', 'fMonth'].forEach(id => { $('#' + id).value = ''; }); $('#fSort').value = 'date'; sortDir = -1; $('#sortDir').textContent = '↓ Desc'; renderTransactions(); },
  cancelTx: () => { resetTxForm(); go('transactions'); },
  editTx: id => {
    const t = state.transactions.find(x => x.id === id); if (!t) return;
    resetTxForm(); $('#tId').value = id; $('#tType').value = t.type; fillSelect($('#tCat'), CATS[t.type], '', 'Select category');
    if (!CATS[t.type].includes(t.category)) $('#tCat').add(new Option(t.category, t.category));
    $('#tCat').value = t.category; $('#tAmount').value = t.amount; $('#tDate').value = t.date; $('#tPay').value = t.payment; $('#tDesc').value = t.description || '';
    $('#txFormTitle').textContent = 'Edit Transaction'; go('add');
  },
  delTx: async id => { if (await confirmBox('Delete this transaction? This cannot be undone.')) { deleteTransaction(id); toast('Transaction deleted.'); } },
  delBudget: async id => { if (await confirmBox('Delete this budget?')) { state.budgets = state.budgets.filter(b => b.id !== id); commit(); toast('Budget deleted.'); } },
  toggleRec: id => { const r = state.recurring.find(x => x.id === id); r.active = !r.active; applyRecurring(); commit(); },
  editRec: id => {
    const r = state.recurring.find(x => x.id === id); if (!r) return;
    $('#rId').value = id; $('#rName').value = r.name; $('#rAmount').value = r.amount; $('#rType').value = r.type;
    fillSelect($('#rCat'), CATS[r.type], r.category, 'Select category'); $('#rFreq').value = r.frequency; $('#rNext').value = r.nextDate;
    $('#rFormTitle').textContent = 'Edit recurring transaction'; $('#rName').focus();
  },
  delRec: async id => { if (await confirmBox('Delete this recurring transaction?')) { state.recurring = state.recurring.filter(r => r.id !== id); commit(); } },
  resetRec: resetRecForm,
  exportCsv, exportJson: exportData,
  importBtn: () => $('#impFile').click(),
  clearDemo: async () => {
    if (!await confirmBox('Remove all sample data? Your own entries are kept.')) return;
    state.transactions = state.transactions.filter(t => !t.demo); state.budgets = state.budgets.filter(b => !b.demo); commit(); toast('Sample data cleared.');
  },
  resetAll: async () => {
    if (!await confirmBox('Delete ALL transactions, budgets and recurring items? This cannot be undone.')) return;
    state = { transactions: [], budgets: [], recurring: [], settings: state.settings }; commit(); toast('All data deleted.');
  }
};
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) actions[b.dataset.act]?.(b.dataset.id); });

/* ---------- Init ---------- */
fillSelect($('#tPay'), PAY);
fillSelect($('#fPay'), PAY, '', 'All payment methods');
fillSelect($('#fCat'), [...new Set([...CATS.expense, ...CATS.income])], '', 'All categories');
fillSelect($('#bCat'), CATS.expense);
$('#bMonth').value = thisMonth();
resetTxForm(); resetRecForm(); applyTheme(); applyRecurring(); saveData();
go(location.hash.slice(1) || 'dashboard');
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('service-worker.js').catch(() => {});
