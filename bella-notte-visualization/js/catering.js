/* ═══════════════════════════════════════════
   catering.js — Stripe pipeline + CRM
   companies and contacts
═══════════════════════════════════════════ */

function renderCatering(data) {
  _renderPipeline(data.stripe || {}, data.crm || {});
  _renderCRM(data.crm || {});
}

// ══ PIPELINE (Stripe + CRM overview) ════════
function _renderPipeline(stripe, crm) {
  const customers      = stripe.customers      || [];
  const paymentIntents = stripe.payment_intents || [];
  const crmCos         = crm.companies         || [];
  const crmContacts    = crm.contacts          || [];
  const el = document.getElementById('cat-pipeline');

  // Build customer map
  const custMap = Object.fromEntries(customers.map(c => [c.id, c]));

  // Map each customer to their payment intents
  const piByCustomer = {};
  paymentIntents.forEach(pi => {
    if (!piByCustomer[pi.customer]) piByCustomer[pi.customer] = [];
    piByCustomer[pi.customer].push(pi);
  });

  // Compute totals
  const totalConfirmed = paymentIntents
    .filter(pi => pi.status === 'succeeded')
    .reduce((s, pi) => s + pi.amount / 100, 0);
  const totalPending = paymentIntents
    .filter(pi => pi.status !== 'succeeded')
    .reduce((s, pi) => s + pi.amount / 100, 0);
  const totalPipeline = totalConfirmed + totalPending;

  let html = '';

  // Summary bar
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px">
    <div class="kpi-tile"><div class="kpi-label">Total Pipeline</div><div class="kpi-value" style="color:var(--amber)">${fmtCurrency(totalPipeline)}</div><div class="kpi-sub">${paymentIntents.length} deposits</div></div>
    <div class="kpi-tile"><div class="kpi-label">Confirmed</div><div class="kpi-value" style="color:var(--emerald)">${fmtCurrency(totalConfirmed)}</div><div class="kpi-sub">${paymentIntents.filter(p=>p.status==='succeeded').length} payments received</div></div>
    <div class="kpi-tile"><div class="kpi-label">Pending</div><div class="kpi-value" style="color:var(--orange)">${fmtCurrency(totalPending)}</div><div class="kpi-sub">${paymentIntents.filter(p=>p.status!=='succeeded').length} awaiting collection</div></div>
    <div class="kpi-tile"><div class="kpi-label">Events</div><div class="kpi-value" style="color:var(--sky)">${customers.length}</div><div class="kpi-sub">booked clients</div></div>
  </div>`;

  // Pipeline cards (one per customer)
  html += '<div class="pipeline-cards">';
  customers.forEach(cust => {
    const pis   = piByCustomer[cust.id] || [];
    const total = pis.reduce((s, pi) => s + pi.amount / 100, 0);
    const allConfirmed = pis.length > 0 && pis.every(pi => pi.status === 'succeeded');
    const anyPending   = pis.some(pi => pi.status !== 'succeeded');
    const statusCls    = allConfirmed ? 'confirmed' : anyPending ? 'pending' : '';

    const meta = cust.metadata || {};
    const pi0  = pis[0] || {};
    const eventDate = pi0.metadata?.event_date || '';

    const safe = JSON.stringify({ cust, pis }).replace(/'/g, '&#39;');
    html += `<div class="pipeline-card ${statusCls}" onclick="showCateringModal(${safe})">
      <div class="pc-event">${escHtml(cust.description || cust.name)}</div>
      <div class="pc-client">${escHtml(cust.name)}${cust.email ? ` · ${escHtml(cust.email)}` : ''}</div>
      <div class="pc-meta">
        ${meta.event_type ? `<span class="pc-meta-item">🎉 ${escHtml(meta.event_type.replace(/_/g,' '))}</span>` : ''}
        ${meta.guest_count ? `<span class="pc-meta-item">👥 ${escHtml(String(meta.guest_count))} guests</span>` : ''}
        ${eventDate ? `<span class="pc-meta-item">📅 ${escHtml(eventDate)}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
        <div class="pc-amount">${fmtCurrency(total)}</div>
        <span class="badge ${allConfirmed ? 'badge-emerald' : 'badge-amber'}">${allConfirmed ? 'confirmed' : 'pending'}</span>
      </div>
    </div>`;
  });
  html += '</div>';

  el.innerHTML = html;
}

function showCateringModal(obj) {
  const { cust, pis } = obj;
  const meta = cust.metadata || {};
  const piRows = pis.map(pi => {
    const charge = (pi.charges?.data || [])[0] || {};
    const pm     = charge.payment_method_details?.card || {};
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:13px;font-weight:500">${escHtml(pi.description || pi.id)}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${fmtTs(pi.created)} · ${escHtml(pi.id)}</div>
          ${pm.brand ? `<div style="font-size:11px;color:var(--text3)">${escHtml(pm.brand)} ····${escHtml(pm.last4||'')}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:15px;font-weight:700;color:var(--amber)">${fmtCurrency(pi.amount / 100)}</div>
          <span class="badge ${pi.status === 'succeeded' ? 'badge-emerald' : 'badge-amber'}">${escHtml(pi.status)}</span>
        </div>
      </div>
    </div>`;
  }).join('') || '<div style="color:var(--text3);font-size:12px">No payments on file</div>';

  const body = `<div class="mf-grid">
    <div class="mf-item"><label>Client</label><span class="val">${escHtml(cust.name)}</span></div>
    <div class="mf-item"><label>Email</label><span class="val">${escHtml(cust.email || '—')}</span></div>
    ${meta.event_type ? `<div class="mf-item"><label>Event Type</label><span class="val">${escHtml(meta.event_type.replace(/_/g,' '))}</span></div>` : ''}
    ${meta.guest_count ? `<div class="mf-item"><label>Guests</label><span class="val">${escHtml(String(meta.guest_count))}</span></div>` : ''}
    <div class="mf-item mf-full"><label>Description</label><span class="val">${escHtml(cust.description || '—')}</span></div>
  </div>
  <div class="mf-sep"></div>
  <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3);margin-bottom:8px">Payments</div>
  ${piRows}`;

  openModal('Catering', cust.description || cust.name, body);
}

// ══ CRM ════════════════════════════════════
function _renderCRM(crm) {
  const companies = crm.companies || [];
  const contacts  = crm.contacts  || [];
  const el = document.getElementById('cat-crm');

  if (!companies.length && !contacts.length) {
    el.innerHTML = '<div class="empty-state">No CRM data.</div>';
    return;
  }

  // Map contact_id → contact
  const contMap = Object.fromEntries(contacts.map(c => [c.id, c]));

  let html = '';
  companies.forEach(co => {
    const coContacts = (co.contact_ids || []).map(id => contMap[id]).filter(Boolean);
    html += `<div class="crm-company">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div>
          <div class="crm-company-name">${escHtml(co.name)}</div>
          <div class="crm-company-industry">${escHtml(co.industry || '—')}</div>
        </div>
        <span class="badge badge-amber" style="flex-shrink:0">${coContacts.length} contact${coContacts.length!==1?'s':''}</span>
      </div>
      ${co.notes ? `<div class="crm-company-notes">${escHtml(co.notes)}</div>` : ''}
      <div class="crm-contacts">
        ${coContacts.map(c => {
          const safe = JSON.stringify(c).replace(/'/g, '&#39;');
          return `<div class="crm-contact-chip" onclick='showCRMContactModal(${safe})'>
            <div class="crm-contact-name">${escHtml(c.full_name || '—')}</div>
            <div class="crm-contact-title">${escHtml(c.jobtitle || c.email || '—')}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });

  // Contacts not linked to any company
  const linkedIds = new Set(companies.flatMap(co => co.contact_ids || []));
  const unlinked  = contacts.filter(c => !linkedIds.has(c.id));
  if (unlinked.length > 0) {
    html += `<div style="margin-top:16px"><div class="section-label" style="margin-bottom:10px">Other Contacts (${unlinked.length})</div>
      <div class="crm-contacts">
        ${unlinked.map(c => {
          const safe = JSON.stringify(c).replace(/'/g, '&#39;');
          return `<div class="crm-contact-chip" onclick='showCRMContactModal(${safe})'>
            <div class="crm-contact-name">${escHtml(c.full_name || '—')}</div>
            <div class="crm-contact-title">${escHtml(c.jobtitle || c.email || '—')}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  el.innerHTML = html;
}

function showCRMContactModal(c) {
  const fields = [
    { k: 'Name',       v: c.full_name },
    { k: 'Title',      v: c.jobtitle },
    { k: 'Email',      v: c.email },
    { k: 'Phone',      v: c.phone },
    { k: 'Mobile',     v: c.mobilephone },
    { k: 'City',       v: c.city },
    { k: 'State',      v: c.state },
  ].filter(f => f.v);

  let body = '<div class="mf-grid">';
  fields.forEach(f => {
    body += `<div class="mf-item"><label>${escHtml(f.k)}</label><span class="val">${escHtml(f.v)}</span></div>`;
  });
  body += '</div>';
  if (c.notes) {
    body += `<div class="mf-sep"></div>
      <div class="mf-item mf-full">
        <label style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3);display:block;margin-bottom:6px">Notes</label>
        <div style="font-size:13px;color:var(--text2);line-height:1.6">${escHtml(c.notes)}</div>
      </div>`;
  }
  openModal('Contact', c.full_name || '—', body);
}
