/* ═══════════════════════════════════════════
   personal.js — Contacts directory,
   Notion databases + pages, Apple Health
═══════════════════════════════════════════ */

function renderPersonal(data) {
  _renderContacts(data.contacts || {});
  _renderNotion(data.notion || {});
  _renderHealth(data.appleHealth || {});
}

// ══ CONTACTS ════════════════════════════════
let _bnAllContacts = [];

function _renderContacts(contactsData) {
  _bnAllContacts = (contactsData.contacts || []).sort((a, b) => {
    if (a.is_user) return -1;
    if (b.is_user) return 1;
    return ((a.first_name||'') + (a.last_name||'')).localeCompare((b.first_name||'') + (b.last_name||''));
  });

  document.getElementById('contacts-search').addEventListener('input', e => _drawContacts(e.target.value.toLowerCase()));
  _drawContacts('');
}

function _contactRole(c) {
  const job  = (c.job || '').toLowerCase();
  const desc = (c.description || '').toLowerCase();
  if (c.is_user) return 'you';
  if (/manager|chef|bartender|server|host|lead|cook|staff/i.test(job)) return 'staff';
  if (/brother|sister|family|mother|father|son|daughter/i.test(desc) || c.last_name === 'Reyes') return 'family';
  if (/attorney|lawyer|legal/i.test(job)) return 'legal';
  if (/doctor|md|physician|neuro|nurse|health|medical|dr\./i.test(job)) return 'medical';
  if (/sponsor|aa\b/i.test(desc)) return 'support';
  if (/supplier|sysco|food|beverage|wine|vendor/i.test(job||desc)) return 'vendor';
  return 'other';
}

const ROLE_LABELS = { you: 'You', staff: 'Restaurant Staff', family: 'Family', legal: 'Legal', medical: 'Medical', support: 'Support Network', vendor: 'Vendors & Suppliers', other: 'Other' };
const ROLE_COLORS = { you: 'var(--amber)', staff: 'var(--sky)', family: 'var(--rose)', legal: 'var(--violet)', medical: 'var(--teal)', support: 'var(--emerald)', vendor: 'var(--orange)', other: 'var(--text3)' };

function _drawContacts(search) {
  const filtered = _bnAllContacts.filter(c => {
    if (!search) return true;
    const full = ((c.first_name||'') + ' ' + (c.last_name||'')).toLowerCase();
    return full.includes(search)
      || (c.job||'').toLowerCase().includes(search)
      || (c.email||'').toLowerCase().includes(search)
      || (c.description||'').toLowerCase().includes(search);
  });

  const countEl = document.getElementById('contacts-count');
  if (countEl) countEl.textContent = `${filtered.length} contact${filtered.length!==1?'s':''}`;

  if (!filtered.length) {
    document.getElementById('contacts-list').innerHTML = '<div class="empty-state">No contacts match.</div>';
    return;
  }

  // Group by role
  const groups = {};
  filtered.forEach(c => {
    const r = _contactRole(c);
    if (!groups[r]) groups[r] = [];
    groups[r].push(c);
  });

  const roleOrder = ['you', 'staff', 'family', 'medical', 'legal', 'support', 'vendor', 'other'];
  let html = '';

  roleOrder.forEach(role => {
    const members = groups[role];
    if (!members?.length) return;
    html += `<div style="margin-bottom:20px">
      <div class="section-label" style="margin-bottom:10px;color:${ROLE_COLORS[role]}">${ROLE_LABELS[role]} (${members.length})</div>
      <div class="contacts-grid">`;
    members.forEach(c => {
      const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ');
      const initials = [c.first_name, c.last_name].filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const safe = JSON.stringify(c).replace(/'/g, '&#39;');
      html += `<div class="contact-card ${c.is_user ? 'is-user' : ''}" onclick='showBnContactModal(${safe})'>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="width:32px;height:32px;border-radius:6px;background:var(--surface3);
            display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;
            color:${ROLE_COLORS[role]};flex-shrink:0">
            ${escHtml(initials)}
          </div>
          <div>
            <div class="contact-name">${escHtml(fullName)}</div>
            ${c.job ? `<div class="contact-job" style="color:${ROLE_COLORS[role]}">${escHtml(c.job)}</div>` : ''}
          </div>
        </div>
        ${c.description ? `<div class="contact-desc">${escHtml(c.description.slice(0, 90))}${c.description.length>90?'…':''}</div>` : ''}
        <div class="contact-email">${escHtml(c.email || '—')}</div>
      </div>`;
    });
    html += '</div></div>';
  });

  document.getElementById('contacts-list').innerHTML = html;
}

function showBnContactModal(c) {
  const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ');
  const fields = [
    { k: 'Job', v: c.job },
    { k: 'Email', v: c.email },
    { k: 'Phone', v: c.phone },
    { k: 'Address', v: c.address },
    { k: 'Age', v: c.age },
    { k: 'Status', v: c.status },
    { k: 'Nationality', v: c.nationality },
    { k: 'City', v: c.city_living },
  ].filter(f => f.v != null && f.v !== '');

  let body = '<div class="mf-grid">';
  fields.forEach(f => {
    body += `<div class="mf-item"><label>${escHtml(f.k)}</label><span class="val">${escHtml(String(f.v))}</span></div>`;
  });
  body += '</div>';
  if (c.description) {
    body += `<div class="mf-sep"></div>
      <div style="font-size:13px;color:var(--text2);line-height:1.6">${escHtml(c.description)}</div>`;
  }
  openModal(_contactRole(c), fullName, body);
}

// ══ NOTION ══════════════════════════════════
function _renderNotion(notion) {
  const databases = notion.databases  || [];
  const properties= notion.properties || [];
  const pages     = notion.pages      || [];
  const el        = document.getElementById('pers-notion');

  if (!databases.length) {
    el.innerHTML = '<div class="empty-state">No Notion data.</div>';
    return;
  }

  // Map database_id → pages
  const pagesByDb = {};
  pages.forEach(p => {
    const dbId = p.parent?.database_id;
    if (!dbId) return;
    if (!pagesByDb[dbId]) pagesByDb[dbId] = [];
    pagesByDb[dbId].push(p);
  });

  // Map database_id → properties
  const propsByDb = {};
  properties.forEach(p => {
    if (!propsByDb[p.database_id]) propsByDb[p.database_id] = [];
    propsByDb[p.database_id].push(p);
  });

  const DB_ICONS = {
    'Daily Manager Log':  '📋',
    'Kitchen SOPs':       '👨‍🍳',
    'Catering Events':    '🎉',
    'Sobriety Journal':   '💪',
    "Mom's Care Log":     '❤️',
  };

  let html = '';
  databases.forEach(db => {
    const title = db.title?.[0]?.text?.content || 'Untitled';
    const dbPages = pagesByDb[db.id] || [];
    const dbProps = propsByDb[db.id] || [];
    const icon = DB_ICONS[title] || '📄';

    // Sort pages by created_time
    const sortedPages = [...dbPages].sort((a, b) => new Date(a.created_time) - new Date(b.created_time));
    const firstDate = sortedPages[0]?.created_time?.slice(0, 10) || '—';
    const lastDate  = sortedPages[sortedPages.length - 1]?.created_time?.slice(0, 10) || '—';

    html += `<div class="notion-db">
      <div class="notion-db-title">
        <span style="font-size:18px">${icon}</span>
        <span>${escHtml(title)}</span>
        <span style="font-size:11px;color:var(--text3);margin-left:auto">${dbPages.length} page${dbPages.length!==1?'s':''}</span>
      </div>
      ${dbPages.length > 0 ? `<div style="font-size:11px;color:var(--text3)">
        ${firstDate} – ${lastDate}
      </div>` : ''}
      <div class="notion-fields" style="margin-top:10px">
        ${dbProps.map(p => `<span class="notion-field-chip type-${p.type}">${escHtml(p.name)} <span style="opacity:0.6">${escHtml(p.type)}</span></span>`).join('')}
      </div>
    </div>`;
  });

  el.innerHTML = html;
}

// ══ APPLE HEALTH ════════════════════════════
function _renderHealth(healthData) {
  const profiles = healthData.user_profiles || [];
  const sleep    = healthData.sleep_records || [];
  const el       = document.getElementById('pers-health');
  const user     = profiles.find(p => p.is_user) || profiles[0] || {};

  if (!user.name && !sleep.length) {
    el.innerHTML = '<div class="empty-state">No Apple Health data.</div>';
    return;
  }

  let html = '';

  // User profile
  if (user.name) {
    html += `<div class="card" style="margin-bottom:18px">
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div><div style="font-size:15px;font-weight:600">${escHtml(user.name)}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">DOB: ${escHtml(user.date_of_birth||'—')} · ${escHtml(user.sex||'—')}</div>
        </div>
        ${user.height_cm ? `<div class="sleep-stat"><div class="sleep-stat-value">${user.height_cm}<span style="font-size:14px">cm</span></div><div class="sleep-stat-label">Height</div></div>` : ''}
        ${user.weight_kg ? `<div class="sleep-stat"><div class="sleep-stat-value">${user.weight_kg}<span style="font-size:14px">kg</span></div><div class="sleep-stat-label">Weight</div></div>` : ''}
      </div>
    </div>`;
  }

  if (!sleep.length) { el.innerHTML = html; return; }

  // Group sleep records by night (date of start)
  const nights = {};
  sleep.forEach(r => {
    const dateKey = r.start.slice(0, 10);
    if (!nights[dateKey]) nights[dateKey] = [];
    nights[dateKey].push(r);
  });

  // Compute per-night stats
  const nightStats = Object.entries(nights).sort((a, b) => a[0].localeCompare(b[0])).map(([date, records]) => {
    let inBedMin = 0, asleepMin = 0;
    const stages = { asleepCore: 0, asleepDeep: 0, asleepREM: 0, inBed: 0 };
    records.forEach(r => {
      const start = new Date(r.start);
      const end   = new Date(r.end);
      const mins  = Math.round((end - start) / 60000);
      if (mins > 0) {
        stages[r.stage] = (stages[r.stage] || 0) + mins;
        if (r.stage !== 'inBed') asleepMin += mins;
        inBedMin += mins;
      }
    });
    // inBed stage is separate from sleep stages; total = inBed + asleepCore + asleepDeep + asleepREM
    const totalInBed = stages.inBed + stages.asleepCore + stages.asleepDeep + stages.asleepREM;
    const totalAsleep = stages.asleepCore + stages.asleepDeep + stages.asleepREM;
    const eff = totalInBed > 0 ? Math.round(totalAsleep / totalInBed * 100) : 0;
    return { date, totalInBed, totalAsleep, eff, stages };
  });

  // Averages
  const avgInBed  = Math.round(nightStats.reduce((s, n) => s + n.totalInBed, 0) / nightStats.length);
  const avgAsleep = Math.round(nightStats.reduce((s, n) => s + n.totalAsleep, 0) / nightStats.length);
  const avgEff    = Math.round(nightStats.reduce((s, n) => s + n.eff, 0) / nightStats.length);

  html += '<div class="section-label" style="margin-bottom:10px">Sleep Data</div>';
  html += `<div class="sleep-stat-row" style="margin-bottom:18px">
    <div class="sleep-stat"><div class="sleep-stat-value">${nightStats.length}</div><div class="sleep-stat-label">Nights Recorded</div></div>
    <div class="sleep-stat"><div class="sleep-stat-value">${fmtMins(avgInBed)}</div><div class="sleep-stat-label">Avg Time in Bed</div></div>
    <div class="sleep-stat"><div class="sleep-stat-value">${fmtMins(avgAsleep)}</div><div class="sleep-stat-label">Avg Time Asleep</div></div>
    <div class="sleep-stat"><div class="sleep-stat-value">${avgEff}%</div><div class="sleep-stat-label">Avg Efficiency</div></div>
  </div>`;

  html += '<div class="table-wrap"><table><thead><tr><th>Date</th><th>In Bed</th><th>Asleep</th><th>Efficiency</th><th>Core</th><th>Deep</th><th>REM</th></tr></thead><tbody>';
  nightStats.forEach(n => {
    html += `<tr>
      <td class="mono">${escHtml(n.date)}</td>
      <td class="dim">${fmtMins(n.totalInBed)}</td>
      <td style="color:var(--violet);font-weight:500">${fmtMins(n.totalAsleep)}</td>
      <td class="${n.eff >= 85 ? 'pos' : n.eff >= 70 ? '' : 'neg'}">${n.eff}%</td>
      <td class="dim">${fmtMins(n.stages.asleepCore)}</td>
      <td class="dim">${fmtMins(n.stages.asleepDeep)}</td>
      <td class="dim">${fmtMins(n.stages.asleepREM)}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';

  el.innerHTML = html;
}
