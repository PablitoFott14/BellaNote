/* ═══════════════════════════════════════════
   overview.js — Victor profile, KPI tiles,
   upcoming events, unread emails
═══════════════════════════════════════════ */

function renderOverview(data) {
  const el = document.getElementById('overview-content');

  const contacts  = data.contacts?.contacts || [];
  const victor    = contacts.find(c => c.is_user) || {};
  const emails    = data.email?.emails     || [];
  const reminders = data.reminder?.reminders || [];
  const calEvents = data.calendar?.events  || [];
  const stripe    = data.stripe || {};
  const ft        = data.fintrack || {};
  const qb        = data.quickbooks || {};
  const crmCos    = data.crm?.companies   || [];

  // Personal accounts
  const accounts = ft.accounts || [];
  const checking = accounts.find(a => a.account_type === 'checking');
  const cc       = accounts.find(a => a.account_type === 'credit_card');

  // Stripe catering pipeline
  const paymentIntents = stripe.payment_intents || [];
  const confirmedDeposits = paymentIntents
    .filter(pi => pi.status === 'succeeded')
    .reduce((s, pi) => s + (pi.amount || 0) / 100, 0);
  const pendingDeposits = paymentIntents
    .filter(pi => pi.status !== 'succeeded')
    .reduce((s, pi) => s + (pi.amount || 0) / 100, 0);

  // QB business checking
  const qbAccounts = qb.accounts || [];
  const bizChecking = qbAccounts.find(a => a.AccountType === 'Bank' && a.Name?.toLowerCase().includes('checking'));

  // Upcoming events (future, sorted)
  const now = Date.now() / 1000;
  const upcoming = calEvents
    .filter(e => e.start_datetime >= now)
    .sort((a, b) => a.start_datetime - b.start_datetime)
    .slice(0, 5);

  // Upcoming reminders
  const upcomingRem = [...reminders]
    .sort((a, b) => (a.due_datetime || 0) - (b.due_datetime || 0))
    .slice(0, 4);

  // Unread inbox emails
  const unread = emails.filter(e => !e.is_read && (e.folder || '').toLowerCase() === 'inbox').slice(0, 4);

  let html = '';

  // ── Profile ───────────────────────────────
  html += `<div class="profile-card">
    <div class="profile-avatar">VR</div>
    <div>
      <div class="profile-name">Victor Reyes</div>
      <div class="profile-title">${escHtml(victor.job || 'General Manager')} · Bella Notte Ristorante</div>
      <div class="profile-meta">
        <div class="profile-meta-item">📍 ${escHtml(victor.address || '2215 N. Farwell Ave, Milwaukee, WI 53202')}</div>
        <div class="profile-meta-item">✉ ${escHtml(victor.email || 'victor.reyes@bellanotte.com')}</div>
        <div class="profile-meta-item">📞 ${escHtml(victor.phone || '(414) 555-0291')}</div>
        <div class="profile-meta-item">🎂 Age ${victor.age || 46}</div>
      </div>
    </div>
  </div>`;

  // ── KPIs ──────────────────────────────────
  const kpis = [
    { label: 'Confirmed Deposits',  value: fmtCurrency(confirmedDeposits),  sub: 'catering pipeline',                    color: 'var(--amber)' },
    { label: 'Pending Deposits',    value: fmtCurrency(pendingDeposits),    sub: 'awaiting collection',                  color: 'var(--orange)' },
    { label: 'Personal Checking',   value: fmtCurrency(checking?.balance),  sub: `Assoc Bank ····${checking?.last_four || ''}`,color: checking?.balance >= 0 ? 'var(--emerald)' : 'var(--rose)' },
    { label: 'Credit Card',         value: fmtCurrency(cc?.balance),        sub: `Discover ····${cc?.last_four || ''}`, color: cc?.balance >= 0 ? 'var(--emerald)' : 'var(--rose)' },
    { label: 'Contacts',            value: contacts.length,                  sub: `${contacts.filter(c=>!c.is_user).length} in directory`, color: 'var(--teal)' },
    { label: 'Catering Clients',    value: crmCos.length,                   sub: 'CRM companies',                        color: 'var(--violet)' },
    { label: 'Calendar Events',     value: calEvents.length,                 sub: `${upcoming.length} upcoming`,         color: 'var(--sky)' },
    { label: 'Reminders',           value: reminders.length,                 sub: `${reminders.filter(r=>r.repetition_unit).length} repeating`, color: 'var(--rose)' },
  ];

  html += '<div class="kpi-row">';
  kpis.forEach(k => {
    html += `<div class="kpi-tile">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value" style="color:${k.color}">${typeof k.value === 'number' ? k.value.toLocaleString() : k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>`;
  });
  html += '</div>';

  // ── Main grid ─────────────────────────────
  html += '<div class="grid-2" style="gap:16px">';

  // Left: Upcoming events + reminders
  html += '<div>';
  if (upcoming.length > 0) {
    html += '<div class="section-label" style="margin-bottom:10px">Upcoming Events</div>';
    html += '<div class="card" style="margin-bottom:16px">';
    upcoming.forEach(e => {
      const tagColor = { medical: 'var(--rose)', work: 'var(--sky)', personal: 'var(--violet)' }[e.tag] || 'var(--text3)';
      html += `<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer"
        onclick='showEventModal(${JSON.stringify(e).replace(/'/g,"&#39;")})'>
        <div style="width:8px;height:8px;border-radius:50%;background:${tagColor};flex-shrink:0;margin-top:4px"></div>
        <div>
          <div style="font-size:13px;font-weight:500">${escHtml(e.title)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${fmtTs(e.start_datetime)}${e.location ? ' · ' + escHtml(e.location) : ''}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  if (upcomingRem.length > 0) {
    html += '<div class="section-label" style="margin-bottom:10px">Reminders</div>';
    upcomingRem.forEach(r => {
      html += `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px;margin-bottom:6px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:var(--radius-sm)">
        <span style="font-size:14px">${r.repetition_unit ? '🔁' : '⏰'}</span>
        <div>
          <div style="font-size:13px;font-weight:500">${escHtml(r.title)}</div>
          <div style="font-size:11px;color:var(--amber);margin-top:2px">Due ${fmtTs(r.due_datetime)}${r.repetition_unit ? ` · every ${r.repetition_value} ${r.repetition_unit}` : ''}</div>
        </div>
      </div>`;
    });
  }
  html += '</div>';

  // Right: Unread emails
  html += '<div>';
  html += '<div class="section-label" style="margin-bottom:10px">Unread Emails</div>';
  html += '<div class="card">';
  if (unread.length === 0) {
    html += '<div style="font-size:13px;color:var(--text3)">No unread emails</div>';
  } else {
    unread.forEach(e => {
      html += `<div style="padding:9px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:13px;font-weight:600">${escHtml(e.subject || '(no subject)')}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px">${escHtml(e.sender)} · ${fmtTs(e.timestamp)}</div>
      </div>`;
    });
  }
  html += '</div>';
  html += '</div>';

  html += '</div>'; // grid-2

  el.innerHTML = html;
}

function showEventModal(e) {
  const attendees = (e.attendees || []);
  const dur = e.end_datetime && e.start_datetime ? Math.round((e.end_datetime - e.start_datetime) / 60) : null;
  const body = `<div class="mf-grid">
    <div class="mf-item"><label>Start</label><span class="val">${fmtTsTime(e.start_datetime)}</span></div>
    <div class="mf-item"><label>End</label><span class="val">${e.end_datetime ? fmtTsTime(e.end_datetime) : '—'}${dur ? ` (${dur}min)` : ''}</span></div>
    ${e.tag ? `<div class="mf-item"><label>Tag</label><span class="val">${escHtml(e.tag)}</span></div>` : ''}
    ${e.location ? `<div class="mf-item"><label>Location</label><span class="val">${escHtml(e.location)}</span></div>` : ''}
    ${e.description ? `<div class="mf-item mf-full"><label>Description</label><span class="val">${escHtml(e.description)}</span></div>` : ''}
    ${attendees.length ? `<div class="mf-item mf-full"><label>Attendees</label><span class="val">${attendees.map(a=>escHtml(a)).join(', ')}</span></div>` : ''}
  </div>`;
  openModal(e.tag || 'Event', e.title || '—', body);
}
