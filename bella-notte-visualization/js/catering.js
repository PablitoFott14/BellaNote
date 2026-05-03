/* ═══════════════════════════════════════════
   catering.js — Stripe pipeline + CRM
   companies and contacts
═══════════════════════════════════════════ */

function renderCatering(data) {
  _renderPipeline(data.stripe || {}, data.crm || {});
  _renderCRM(data.crm || {});
}

// Module-level stores so onclick handlers use indexes, not embedded JSON
const _bnPipelineItems  = [];
const _bnCRMContactStore = [];

// ══ PIPELINE (Stripe + CRM overview) ════════
function _renderPipeline(stripe, crm) {
  const customers      = stripe.customers      || [];
  const paymentIntents = stripe.payment_intents || [];
  const el = document.getElementById('cat-pipeline');

  const piByCustomer = {};
  paymentIntents.forEach(pi => {
    if (!piByCustomer[pi.customer]) piByCustomer[pi.customer] = [];
    piByCustomer[pi.customer].push(pi);
  });

  const totalConfirmed = paymentIntents.filter(pi => pi.status === 'succeeded').reduce((s, pi) => s + pi.amount / 100, 0);
  const totalPending   = paymentIntents.filter(pi => pi.status !== 'succeeded').reduce((s, pi) => s + pi.amount / 100, 0);
  const totalPipeline  = totalConfirmed + totalPending;

  let html = '';

  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px">'
    + '<div class="kpi-tile"><div class="kpi-label">Total Pipeline</div><div class="kpi-value" style="color:var(--amber)">' + fmtCurrency(totalPipeline) + '</div><div class="kpi-sub">' + paymentIntents.length + ' deposits</div></div>'
    + '<div class="kpi-tile"><div class="kpi-label">Confirmed</div><div class="kpi-value" style="color:var(--emerald)">' + fmtCurrency(totalConfirmed) + '</div><div class="kpi-sub">' + paymentIntents.filter(p=>p.status==='succeeded').length + ' received</div></div>'
    + '<div class="kpi-tile"><div class="kpi-label">Pending</div><div class="kpi-value" style="color:var(--orange)">' + fmtCurrency(totalPending) + '</div><div class="kpi-sub">' + paymentIntents.filter(p=>p.status!=='succeeded').length + ' awaiting</div></div>'
    + '<div class="kpi-tile"><div class="kpi-label">Events</div><div class="kpi-value" style="color:var(--sky)">' + customers.length + '</div><div class="kpi-sub">booked clients</div></div>'
    + '</div>';

  // Store pipeline items and reference by index to avoid JSON-in-onclick
  _bnPipelineItems.length = 0;
  html += '<div class="pipeline-cards">';

  customers.forEach(function(cust) {
    var pis         = piByCustomer[cust.id] || [];
    var total       = pis.reduce(function(s, pi) { return s + pi.amount / 100; }, 0);
    var allConfirmed= pis.length > 0 && pis.every(function(pi) { return pi.status === 'succeeded'; });
    var anyPending  = pis.some(function(pi) { return pi.status !== 'succeeded'; });
    var statusCls   = allConfirmed ? 'confirmed' : anyPending ? 'pending' : '';
    var meta        = cust.metadata || {};
    var pi0         = pis[0] || {};
    var eventDate   = (pi0.metadata && pi0.metadata.event_date) ? pi0.metadata.event_date : '';

    var idx = _bnPipelineItems.length;
    _bnPipelineItems.push({ cust: cust, pis: pis });

    html += '<div class="pipeline-card ' + statusCls + '" onclick="showCateringModal(' + idx + ')">'
      + '<div class="pc-event">' + escHtml(cust.description || cust.name) + '</div>'
      + '<div class="pc-client">' + escHtml(cust.name) + (cust.email ? ' &middot; ' + escHtml(cust.email) : '') + '</div>'
      + '<div class="pc-meta">'
      + (meta.event_type ? '<span class="pc-meta-item">🎉 ' + escHtml(meta.event_type.replace(/_/g,' ')) + '</span>' : '')
      + (meta.guest_count ? '<span class="pc-meta-item">👥 ' + escHtml(String(meta.guest_count)) + ' guests</span>' : '')
      + (eventDate ? '<span class="pc-meta-item">📅 ' + escHtml(eventDate) + '</span>' : '')
      + '</div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">'
      + '<div class="pc-amount">' + fmtCurrency(total) + '</div>'
      + '<span class="badge ' + (allConfirmed ? 'badge-emerald' : 'badge-amber') + '">' + (allConfirmed ? 'confirmed' : 'pending') + '</span>'
      + '</div></div>';
  });

  html += '</div>';
  el.innerHTML = html;
}

function showCateringModal(idx) {
  var item = _bnPipelineItems[idx];
  if (!item) return;
  var cust = item.cust;
  var pis  = item.pis;
  var meta = cust.metadata || {};

  var piRows = pis.map(function(pi) {
    var charge = (pi.charges && pi.charges.data && pi.charges.data[0]) ? pi.charges.data[0] : {};
    var pm     = (charge.payment_method_details && charge.payment_method_details.card) ? charge.payment_method_details.card : {};
    return '<div style="padding:8px 0;border-bottom:1px solid var(--border)">'
      + '<div style="display:flex;justify-content:space-between;align-items:center">'
      + '<div><div style="font-size:13px;font-weight:500">' + escHtml(pi.description || pi.id) + '</div>'
      + '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + fmtTs(pi.created) + ' &middot; ' + escHtml(pi.id) + '</div>'
      + (pm.brand ? '<div style="font-size:11px;color:var(--text3)">' + escHtml(pm.brand) + ' &bull;&bull;&bull;&bull;' + escHtml(pm.last4||'') + '</div>' : '')
      + '</div>'
      + '<div style="text-align:right">'
      + '<div style="font-size:15px;font-weight:700;color:var(--amber)">' + fmtCurrency(pi.amount / 100) + '</div>'
      + '<span class="badge ' + (pi.status === 'succeeded' ? 'badge-emerald' : 'badge-amber') + '">' + escHtml(pi.status) + '</span>'
      + '</div></div></div>';
  }).join('') || '<div style="color:var(--text3);font-size:12px">No payments on file</div>';

  var body = '<div class="mf-grid">'
    + '<div class="mf-item"><label>Client</label><span class="val">' + escHtml(cust.name) + '</span></div>'
    + '<div class="mf-item"><label>Email</label><span class="val">' + escHtml(cust.email || '—') + '</span></div>'
    + (meta.event_type ? '<div class="mf-item"><label>Event Type</label><span class="val">' + escHtml(meta.event_type.replace(/_/g,' ')) + '</span></div>' : '')
    + (meta.guest_count ? '<div class="mf-item"><label>Guests</label><span class="val">' + escHtml(String(meta.guest_count)) + '</span></div>' : '')
    + '<div class="mf-item mf-full"><label>Description</label><span class="val">' + escHtml(cust.description || '—') + '</span></div>'
    + '</div>'
    + '<div class="mf-sep"></div>'
    + '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3);margin-bottom:8px">Payments</div>'
    + piRows;

  openModal('Catering', cust.description || cust.name, body);
}

// ══ CRM ════════════════════════════════════
function _renderCRM(crm) {
  var companies = crm.companies || [];
  var contacts  = crm.contacts  || [];
  var el        = document.getElementById('cat-crm');

  if (!companies.length && !contacts.length) {
    el.innerHTML = '<div class="empty-state">No CRM data.</div>';
    return;
  }

  // Store contacts in module-level array for index-based onclick
  _bnCRMContactStore.length = 0;
  contacts.forEach(function(c) { _bnCRMContactStore.push(c); });

  var contMap = Object.fromEntries(contacts.map(function(c) { return [c.id, c]; }));

  var html = '';
  companies.forEach(function(co) {
    var coContacts = (co.contact_ids || []).map(function(id) { return contMap[id]; }).filter(Boolean);
    html += '<div class="crm-company">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">'
      + '<div><div class="crm-company-name">' + escHtml(co.name) + '</div>'
      + '<div class="crm-company-industry">' + escHtml(co.industry || '—') + '</div></div>'
      + '<span class="badge badge-amber" style="flex-shrink:0">' + coContacts.length + ' contact' + (coContacts.length!==1?'s':'') + '</span>'
      + '</div>'
      + (co.notes ? '<div class="crm-company-notes">' + escHtml(co.notes) + '</div>' : '')
      + '<div class="crm-contacts">'
      + coContacts.map(function(c) {
          var cidx = _bnCRMContactStore.indexOf(c);
          return '<div class="crm-contact-chip" onclick="showCRMContactModal(' + cidx + ')">'
            + '<div class="crm-contact-name">' + escHtml(c.full_name || '—') + '</div>'
            + '<div class="crm-contact-title">' + escHtml(c.jobtitle || c.email || '—') + '</div>'
            + '</div>';
        }).join('')
      + '</div></div>';
  });

  var linkedIds = new Set(companies.flatMap(function(co) { return co.contact_ids || []; }));
  var unlinked  = contacts.filter(function(c) { return !linkedIds.has(c.id); });
  if (unlinked.length > 0) {
    html += '<div style="margin-top:16px"><div class="section-label" style="margin-bottom:10px">Other Contacts (' + unlinked.length + ')</div>'
      + '<div class="crm-contacts">'
      + unlinked.map(function(c) {
          var cidx = _bnCRMContactStore.indexOf(c);
          return '<div class="crm-contact-chip" onclick="showCRMContactModal(' + cidx + ')">'
            + '<div class="crm-contact-name">' + escHtml(c.full_name || '—') + '</div>'
            + '<div class="crm-contact-title">' + escHtml(c.jobtitle || c.email || '—') + '</div>'
            + '</div>';
        }).join('')
      + '</div></div>';
  }

  el.innerHTML = html;
}

function showCRMContactModal(idx) {
  var c = _bnCRMContactStore[idx];
  if (!c) return;
  var fields = [
    { k: 'Name',    v: c.full_name },
    { k: 'Title',   v: c.jobtitle },
    { k: 'Email',   v: c.email },
    { k: 'Phone',   v: c.phone },
    { k: 'Mobile',  v: c.mobilephone },
    { k: 'City',    v: c.city },
    { k: 'State',   v: c.state },
  ].filter(function(f) { return f.v; });

  var body = '<div class="mf-grid">';
  fields.forEach(function(f) {
    body += '<div class="mf-item"><label>' + escHtml(f.k) + '</label><span class="val">' + escHtml(f.v) + '</span></div>';
  });
  body += '</div>';
  if (c.notes) {
    body += '<div class="mf-sep"></div>'
      + '<div class="mf-item mf-full">'
      + '<label style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3);display:block;margin-bottom:6px">Notes</label>'
      + '<div style="font-size:13px;color:var(--text2);line-height:1.6">' + escHtml(c.notes) + '</div>'
      + '</div>';
  }
  openModal('Contact', c.full_name || '—', body);
}
