/* ═══════════════════════════════════════════
   finances.js — FinTrack personal accounts
   + transactions · QuickBooks business
═══════════════════════════════════════════ */

let _ftTxns   = [];
let _ftPage   = 1;
let _ftSearch = '';
let _ftCat    = '';
const FT_PAGE = 40;

function renderFinances(data) {
  _renderPersonalFinances(data.fintrack || {});
  _renderBusinessFinances(data.quickbooks || {});
}

// ══ PERSONAL (FinTrack) ══════════════════════
function _renderPersonalFinances(ft) {
  const user     = (ft.users     || [])[0] || {};
  const accounts = ft.accounts   || [];
  const txns     = ft.transactions || [];
  const el       = document.getElementById('fin-personal');

  _ftTxns = [...txns].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Net liquid (checking + savings; exclude benefits tracking)
  const liquid = accounts
    .filter(a => ['checking', 'savings'].includes(a.account_type))
    .reduce((s, a) => s + (a.balance || 0), 0);
  const ccBalance = accounts.find(a => a.account_type === 'credit_card')?.balance || 0;

  let html = '';

  // Net worth bar
  html += `<div class="net-bar" style="margin-bottom:20px">
    <div>
      <div class="net-label">Liquid assets</div>
      <div style="font-size:11px;color:var(--text3)">Checking + savings accounts</div>
    </div>
    <div class="net-value">${fmtCurrency(liquid)}</div>
  </div>`;

  // Account cards
  html += '<div class="acct-grid">';
  accounts.forEach(a => {
    const pos = (a.balance || 0) >= 0;
    const isCC = a.account_type === 'credit_card';
    const isBen = a.account_type === 'benefits_tracking';
    html += `<div class="acct-card">
      <div class="acct-name">${escHtml(a.name)}</div>
      <div class="acct-type">${escHtml(a.institution_name || '—')}</div>
      <div class="acct-last4">${a.last_four && a.last_four !== 'N/A' ? `····${escHtml(a.last_four)}` : escHtml(a.last_four || '—')}</div>
      ${isBen ? `<div style="font-size:12px;color:var(--text2);line-height:1.5;margin-top:4px">${escHtml(a.notes || '')}</div>` : `<div class="acct-balance ${pos?'pos':'neg'}">${fmtCurrency(a.balance)}</div>`}
      ${isCC && a.credit_limit ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">Limit: ${fmtCurrency(a.credit_limit)} · Available: ${fmtCurrency(a.credit_limit + (a.balance||0))}</div>` : ''}
      <div style="margin-top:6px"><span class="badge badge-emerald">${escHtml(a.status || 'active')}</span></div>
    </div>`;
  });
  html += '</div>';

  // Transactions
  const cats = [...new Set(_ftTxns.map(t => t.category).filter(Boolean))].sort();

  html += `<div style="margin-bottom:12px">
    <div class="section-label" style="margin-bottom:10px">Transactions (${_ftTxns.length})</div>
    <div class="explorer-bar">
      <input id="ft-search" class="ex-search" type="text" placeholder="Search merchant…" />
      <select id="ft-cat" class="ex-filter">
        <option value="">All Categories</option>
        ${cats.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
      </select>
      <span class="ex-count" id="ft-count"></span>
    </div>
    <div id="ft-table"></div>
    <div class="pagination" id="ft-pag"></div>
  </div>`;

  el.innerHTML = html;

  document.getElementById('ft-search').addEventListener('input', e => { _ftSearch = e.target.value.toLowerCase(); _ftPage = 1; _drawFtTxns(); });
  document.getElementById('ft-cat').addEventListener('change', e => { _ftCat = e.target.value; _ftPage = 1; _drawFtTxns(); });
  _drawFtTxns();
}

function _drawFtTxns() {
  const filtered = _ftTxns.filter(t => {
    const matchSearch = !_ftSearch || (t.merchant||'').toLowerCase().includes(_ftSearch) || (t.description||'').toLowerCase().includes(_ftSearch);
    const matchCat    = !_ftCat || t.category === _ftCat;
    return matchSearch && matchCat;
  });

  const countEl = document.getElementById('ft-count');
  if (countEl) countEl.textContent = `${filtered.length} transaction${filtered.length!==1?'s':''}`;

  const page = paginate(filtered, _ftPage, FT_PAGE);
  let html = '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th>Account</th><th style="text-align:right">Amount</th></tr></thead><tbody>';

  page.forEach(t => {
    const pos = (t.amount || 0) >= 0;
    html += `<tr onclick='showTxnModal(${JSON.stringify(t).replace(/'/g,"&#39;")})'>
      <td class="mono">${escHtml(t.date)}</td>
      <td>${escHtml(t.merchant || t.description || '—')}</td>
      <td><span class="badge badge-amber" style="font-size:9px">${escHtml(t.category || '—')}</span></td>
      <td class="mono dim">····${escHtml(t.account_last_four || '—')}</td>
      <td class="${pos?'pos':'neg'}" style="text-align:right">${fmtCurrency(t.amount)}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  const tableEl = document.getElementById('ft-table');
  if (tableEl) tableEl.innerHTML = html;

  renderPagination('ft-pag', filtered.length, _ftPage, FT_PAGE,
    `function(p){ _ftPage=p; _drawFtTxns(); }`);
}

function showTxnModal(t) {
  const body = `<div class="mf-grid">
    <div class="mf-item"><label>Date</label><span class="val">${escHtml(t.date)}</span></div>
    <div class="mf-item"><label>Amount</label><span class="val" style="color:${(t.amount||0)>=0?'var(--emerald)':'var(--rose)'}">${fmtCurrency(t.amount)}</span></div>
    <div class="mf-item"><label>Category</label><span class="val">${escHtml(t.category||'—')}</span></div>
    <div class="mf-item"><label>Account</label><span class="val mono">····${escHtml(t.account_last_four||'—')}</span></div>
    <div class="mf-item mf-full"><label>Description</label><span class="val">${escHtml(t.description||'—')}</span></div>
    <div class="mf-item"><label>Status</label><span class="val">${escHtml(t.status||'—')}</span></div>
    <div class="mf-item"><label>Type</label><span class="val">${escHtml(t.type||'—')}</span></div>
    ${t.notes ? `<div class="mf-item mf-full"><label>Notes</label><span class="val">${escHtml(t.notes)}</span></div>` : ''}
  </div>`;
  openModal('Transaction', t.merchant || t.description || '—', body);
}

// ══ BUSINESS (QuickBooks) ═══════════════════
function _renderBusinessFinances(qb) {
  const company   = qb.company   || {};
  const customers = qb.customers || [];
  const vendors   = qb.vendors   || [];
  const accounts  = qb.accounts  || [];
  const invoices  = qb.invoices  || [];
  const el        = document.getElementById('fin-business');

  let html = '';

  // Company info
  html += `<div class="card" style="margin-bottom:16px">
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div>
        <div style="font-size:16px;font-weight:700">${escHtml(company.name || 'Bella Notte Ristorante LLC')}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${escHtml(company.address || '—')}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px">EIN: ${escHtml(company.ein || '—')} · FY starts ${escHtml(company.fiscal_year_start || '—')}</div>
      </div>
    </div>
  </div>`;

  // QB Accounts summary
  const incomeAccts  = accounts.filter(a => a.AccountType === 'Income');
  const expenseAccts = accounts.filter(a => a.AccountType === 'Expense');
  const bankAccts    = accounts.filter(a => a.AccountType === 'Bank');
  const liabAccts    = accounts.filter(a => a.AccountType === 'Other Current Liability' || a.AccountType === 'Long Term Liability');

  html += `<div class="grid-2" style="gap:14px;margin-bottom:18px">`;
  [[incomeAccts, 'Income', 'var(--emerald)'], [expenseAccts, 'Expenses', 'var(--rose)'],
   [bankAccts, 'Bank / Asset', 'var(--sky)'], [liabAccts, 'Liabilities', 'var(--violet)']].forEach(([accs, label, color]) => {
    if (!accs.length) return;
    const total = accs.reduce((s, a) => s + (a.CurrentBalance || 0), 0);
    html += `<div class="card">
      <h4>${label}</h4>
      ${accs.map(a => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span style="color:var(--text2)">${escHtml(a.Name)}</span>
        <span style="color:${color};font-weight:600;font-family:var(--mono)">${fmtCurrency(a.CurrentBalance)}</span>
      </div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:13px;font-weight:700">
        <span>Total</span><span style="color:${color}">${fmtCurrency(total)}</span>
      </div>
    </div>`;
  });
  html += '</div>';

  // Invoices
  if (invoices.length > 0) {
    html += `<div class="section-label" style="margin-bottom:10px">Invoices (${invoices.length})</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Customer</th><th>Description</th><th>Date</th><th>Due</th><th style="text-align:right">Total</th><th>Status</th></tr></thead>
      <tbody>`;
    invoices.forEach(inv => {
      const paid = (inv.Balance || 0) === 0;
      const desc = (inv.Line || []).map(l => l.Description).filter(Boolean).join('; ').slice(0, 50);
      html += `<tr onclick='showInvModal(${JSON.stringify(inv).replace(/'/g,"&#39;")})'>
        <td>${escHtml(inv.CustomerRef?.name || '—')}</td>
        <td class="dim">${escHtml(desc)}${desc.length>=50?'…':''}</td>
        <td class="mono dim">${escHtml(inv.TxnDate || '—')}</td>
        <td class="mono dim">${escHtml(inv.DueDate || '—')}</td>
        <td class="${paid?'pos':'neg'}" style="text-align:right">${fmtCurrency(inv.TotalAmt)}</td>
        <td><span class="badge ${paid?'badge-emerald':'badge-amber'}">${paid?'paid':'open'}</span></td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }

  // Vendors (amounts owed)
  const vendorsWithBalance = vendors.filter(v => (v.Balance || 0) > 0);
  if (vendorsWithBalance.length > 0) {
    html += `<div style="margin-top:18px"><div class="section-label" style="margin-bottom:10px">Vendor Balances</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Vendor</th><th>Email</th><th style="text-align:right">Balance Owed</th></tr></thead>
      <tbody>`;
    vendorsWithBalance.forEach(v => {
      html += `<tr>
        <td>${escHtml(v.DisplayName)}</td>
        <td class="dim">${escHtml(v.PrimaryEmailAddr?.Address || '—')}</td>
        <td class="neg" style="text-align:right">${fmtCurrency(v.Balance)}</td>
      </tr>`;
    });
    html += '</tbody></table></div></div>';
  }

  el.innerHTML = html;
}

function showInvModal(inv) {
  const lines = (inv.Line || []).map(l =>
    `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:13px">${escHtml(l.Description || '—')}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">${fmtCurrency(l.Amount)}</div>
    </div>`
  ).join('');
  const paid = (inv.Balance || 0) === 0;
  const body = `<div class="mf-grid">
    <div class="mf-item"><label>Customer</label><span class="val">${escHtml(inv.CustomerRef?.name || '—')}</span></div>
    <div class="mf-item"><label>Status</label><span class="val"><span class="badge ${paid?'badge-emerald':'badge-amber'}">${paid?'paid':'open'}</span></span></div>
    <div class="mf-item"><label>Date</label><span class="val">${escHtml(inv.TxnDate || '—')}</span></div>
    <div class="mf-item"><label>Due</label><span class="val">${escHtml(inv.DueDate || '—')}</span></div>
    <div class="mf-item"><label>Total</label><span class="val" style="color:var(--amber)">${fmtCurrency(inv.TotalAmt)}</span></div>
    <div class="mf-item"><label>Balance</label><span class="val" style="color:${paid?'var(--emerald)':'var(--rose)'}">${fmtCurrency(inv.Balance)}</span></div>
  </div>
  <div class="mf-sep"></div>
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3);margin-bottom:8px">Line Items</div>
  ${lines}`;
  openModal('Invoice', inv.CustomerRef?.name || '—', body);
}
