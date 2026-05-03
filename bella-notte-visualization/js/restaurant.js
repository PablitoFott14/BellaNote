/* ═══════════════════════════════════════════
   restaurant.js — Slack channels/messages
   + Airtable operational tables
═══════════════════════════════════════════ */

function renderRestaurant(data) {
  _renderSlack(data.slack || {});
  _renderAirtable(data.airtable || {});
}

// ══ SLACK ════════════════════════════════════
let _bnSlackCache = {};
let _bnSlackActiveChannel = null;
let _bnSlackPage = 1;
const BN_SLACK_PAGE = 40;

function _renderSlack(slackData) {
  const channels = slackData.channels || [];
  const messages = slackData.messages || [];
  const users    = slackData.users    || [];
  const el = document.getElementById('rest-slack');

  // User map
  const uMap = {};
  users.forEach(u => { uMap[u.id] = u.real_name || u.display_name || u.name; });

  // Group messages by channel, sorted by ts
  const byChannel = {};
  messages.forEach(m => {
    const ch = m.channel || 'unknown';
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push(m);
  });
  Object.values(byChannel).forEach(arr => arr.sort((a,b) => parseFloat(a.ts||0) - parseFloat(b.ts||0)));

  // Derive channel names
  const chNames = {}; const chPurposes = {};
  messages.forEach(m => {
    if (m.channel) {
      if (m.channel_name) chNames[m.channel] = m.channel_name;
      if (m.channel_purpose) chPurposes[m.channel] = m.channel_purpose;
    }
  });
  channels.forEach(ch => {
    if (!chNames[ch.id]) chNames[ch.id] = ch.name || ch.id;
    if (ch.purpose && !chPurposes[ch.id]) chPurposes[ch.id] = ch.purpose;
  });

  // Channel list
  const channelList = channels.length > 0 ? channels
    : Object.keys(byChannel).map(id => ({ id, name: chNames[id] || id }));

  // Pre-populate cache
  channelList.forEach(ch => {
    _bnSlackCache[ch.id] = {
      msgs: byChannel[ch.id] || [],
      uMap, name: chNames[ch.id] || ch.name || ch.id,
      purpose: chPurposes[ch.id] || ch.purpose || '',
      private: ch.is_private || false,
    };
  });

  el.innerHTML = `<div class="slack-layout">
    <div class="slack-channels">
      <div class="slack-ch-title">Channels</div>
      <div id="bn-ch-list"></div>
      <div style="padding:10px 14px;border-top:1px solid var(--border);margin-top:8px">
        <div class="slack-ch-title">Members (${users.length})</div>
        ${users.map(u => `<div style="font-size:12px;color:var(--text2);padding:3px 0">
          <span style="font-weight:500">${escHtml(u.real_name)}</span>
          <span style="color:var(--text3);font-size:10px"> · ${escHtml(u.title || '')}</span>
        </div>`).join('')}
      </div>
    </div>
    <div class="slack-messages" id="bn-msgs-panel">
      <div class="empty-state" style="padding:40px">Select a channel</div>
    </div>
  </div>`;

  let chHtml = '';
  channelList.forEach(ch => {
    const count = (byChannel[ch.id] || []).length;
    const name  = chNames[ch.id] || ch.name || ch.id;
    chHtml += `<div class="slack-ch-item" id="bn-ch-${escHtml(ch.id)}" onclick="bnLoadChannel('${escHtml(ch.id)}')">
      <span class="slack-ch-hash">${ch.is_private ? '🔒' : '#'}</span>
      <span>${escHtml(name)}</span>
      ${count ? `<span class="slack-ch-count">${count}</span>` : ''}
    </div>`;
  });
  document.getElementById('bn-ch-list').innerHTML = chHtml;

  if (channelList.length > 0) bnLoadChannel(channelList[0].id);
}

function bnLoadChannel(id) {
  _bnSlackActiveChannel = id;
  _bnSlackPage = 1;
  document.querySelectorAll('.slack-ch-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('bn-ch-' + id);
  if (el) el.classList.add('active');
  _bnDrawMessages();
}

function _bnDrawMessages() {
  const id     = _bnSlackActiveChannel;
  const cached = _bnSlackCache[id];
  if (!cached) return;
  const { msgs, uMap, name, purpose } = cached;
  const panel  = document.getElementById('bn-msgs-panel');
  const page   = paginate(msgs, _bnSlackPage, BN_SLACK_PAGE);

  let html = `<div class="slack-msg-header">
    <div><h4># ${escHtml(name)}</h4>${purpose ? `<p>${escHtml(purpose)}</p>` : ''}</div>
    <div style="margin-left:auto;font-size:11px;color:var(--text3)">${msgs.length} messages</div>
  </div><div class="slack-msg-list">`;

  if (!page.length) {
    html += '<div style="padding:20px;text-align:center;color:var(--text3)">No messages</div>';
  } else {
    page.forEach(m => {
      const uid   = m.user || '';
      const uName = uMap[uid] || uid;
      const initials = uName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?';
      const isVictor = uid === 'U_VREYES';
      html += `<div class="slack-msg-item">
        <div class="slack-avatar" style="${isVictor?'background:rgba(251,191,36,0.2);color:var(--amber)':''}">${escHtml(initials)}</div>
        <div class="slack-msg-body">
          <span class="slack-msg-name" style="${isVictor?'color:var(--amber)':''}">${escHtml(uName)}</span>
          <span class="slack-msg-ts">${m.ts ? fmtTsTime(parseFloat(m.ts)) : ''}</span>
          <div class="slack-msg-text">${escHtml(m.text||'')}</div>
          ${m.reactions?.length ? `<div style="margin-top:3px;font-size:11px;color:var(--text3)">${m.reactions.map(r=>`${r.name} (${r.count||1})`).join(' · ')}</div>` : ''}
        </div>
      </div>`;
    });
  }
  html += '</div>';

  const totalPages = Math.ceil(msgs.length / BN_SLACK_PAGE);
  if (totalPages > 1) {
    html += `<div class="slack-pag">
      <button class="page-btn" ${_bnSlackPage===1?'disabled':''} onclick="_bnSlackPage--;_bnDrawMessages()">‹</button>
      <span style="font-size:12px;color:var(--text2);padding:4px 8px">${_bnSlackPage} / ${totalPages}</span>
      <button class="page-btn" ${_bnSlackPage===totalPages?'disabled':''} onclick="_bnSlackPage++;_bnDrawMessages()">›</button>
    </div>`;
  }

  panel.innerHTML = html;
}

// ══ AIRTABLE ════════════════════════════════
const _bnAtRecordStore = []; // index-based modal store for generic tables

const AT_STAFF_SCHEDULE_ID = 'tblac723cae9a0323';
const AT_REGISTER_LOG_ID   = 'tbla0aa96fd8e5664';

function _renderAirtable(atData) {
  const tables  = atData.tables  || [];
  const records = atData.records || [];
  const el = document.getElementById('rest-airtable');

  if (!tables.length && !records.length) {
    el.innerHTML = '<div class="empty-state">No Airtable data.</div>';
    return;
  }

  const recByTable = {};
  records.forEach(r => {
    if (!recByTable[r.table_id]) recByTable[r.table_id] = [];
    recByTable[r.table_id].push(r);
  });

  _bnAtRecordStore.length = 0;
  let html = '';

  tables.forEach(t => {
    const tRecords = recByTable[t.id] || [];

    html += '<div class="at-table-section">'
      + '<div class="at-table-header" onclick="toggleAtTable(\'at-body-' + t.id + '\')">'
      + '<span class="at-table-name">' + escHtml(t.name) + '</span>'
      + '<span style="font-size:11px;color:var(--text3)">' + (t.fields||[]).length + ' fields</span>'
      + '<span class="at-table-count">' + tRecords.length + ' record' + (tRecords.length!==1?'s':'') + '</span>'
      + '</div>'
      + '<div class="at-records" id="at-body-' + t.id + '">';

    if (!tRecords.length) {
      html += '<div style="padding:12px 14px;color:var(--text3);font-size:12px">No records</div>';
    } else if (t.id === AT_STAFF_SCHEDULE_ID) {
      html += _renderStaffScheduleByPerson(tRecords);
    } else if (t.id === AT_REGISTER_LOG_ID) {
      html += _renderRegisterLogByPerson(tRecords);
    } else {
      // Generic: flat record list with index-based modal
      tRecords.forEach(r => {
        const fields    = r.fields || {};
        const populated = Object.entries(fields).filter(([,v]) => v != null && v !== '');
        const nameField = populated.find(([k]) => /name|client|title/i.test(k));
        const dateField = populated.find(([k]) => /^date$|date_/i.test(k));
        const statField = populated.find(([k]) => /status/i.test(k));
        const noteField = populated.find(([k]) => /notes/i.test(k));
        const idx = _bnAtRecordStore.length;
        _bnAtRecordStore.push({ r, tableName: t.name });

        html += '<div class="at-record" onclick="showAtRecordModal(' + idx + ')">'
          + '<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">'
          + '<div style="flex:1;min-width:120px">'
          + '<div style="font-size:13px;font-weight:600;margin-bottom:3px">' + escHtml(nameField ? String(nameField[1]) : r.id) + '</div>'
          + (dateField ? '<div style="font-size:11px;color:var(--text3)">📅 ' + escHtml(String(dateField[1])) + '</div>' : '')
          + '</div>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
          + (statField ? '<span class="badge badge-amber">' + escHtml(String(statField[1]).slice(0,20)) + '</span>' : '')
          + (noteField && String(noteField[1]) ? '<span style="font-size:11px;color:var(--text2)">' + escHtml(String(noteField[1]).slice(0,60)) + (String(noteField[1]).length>60?'…':'') + '</span>' : '')
          + '</div></div></div>';
      });
    }

    html += '</div></div>';
  });

  el.innerHTML = html;
}

// ── Staff Schedule: group by employee_name ──
function _renderStaffScheduleByPerson(records) {
  const byPerson = {};
  records.forEach(r => {
    const name = r.fields.employee_name || 'Unknown';
    if (!byPerson[name]) byPerson[name] = { role: r.fields.role || '', shifts: [] };
    byPerson[name].shifts.push(r.fields);
  });

  let html = '';
  Object.entries(byPerson)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, data]) => {
      const shifts = data.shifts.sort((a, b) => (a.shift_date||'').localeCompare(b.shift_date||''));
      const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const isVictor = name === 'Victor Reyes';
      const avatarColor = isVictor ? 'background:rgba(251,191,36,0.2);color:var(--amber)' : 'background:var(--surface3);color:var(--text2)';
      const first = shifts[0]?.shift_date || '';
      const last  = shifts[shifts.length - 1]?.shift_date || '';

      html += '<div style="padding:14px;border-bottom:1px solid var(--border)">'
        // Person header
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
        + '<div style="width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;' + avatarColor + '">' + escHtml(initials) + '</div>'
        + '<div style="flex:1">'
        + '<div style="font-size:14px;font-weight:600">' + escHtml(name) + '</div>'
        + '<div style="font-size:11px;color:var(--amber);margin-top:1px">' + escHtml(data.role) + '</div>'
        + '</div>'
        + '<div style="text-align:right;font-size:11px;color:var(--text3)">'
        + shifts.length + ' shift' + (shifts.length!==1?'s':'')
        + (first ? '<br>' + escHtml(first) + (last !== first ? ' – ' + escHtml(last) : '') : '')
        + '</div></div>'
        // Shift rows
        + '<div style="display:flex;flex-direction:column;gap:3px;padding-left:44px">';

      shifts.forEach(s => {
        const hasNote = s.notes && String(s.notes).trim();
        html += '<div style="display:grid;grid-template-columns:90px 90px 1fr;gap:6px;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px;align-items:baseline">'
          + '<span class="mono" style="color:var(--text2)">' + escHtml(s.shift_date || '—') + '</span>'
          + '<span style="color:var(--text3)">' + escHtml((s.shift_start||'') + '–' + (s.shift_end||'')) + '</span>'
          + '<span style="color:var(--text2)">' + escHtml(s.station || '—')
          + (hasNote ? ' <span style="color:var(--text3);font-style:italic">· ' + escHtml(String(s.notes).trim()) + '</span>' : '')
          + '</span>'
          + '</div>';
      });

      html += '</div></div>';
    });

  return html;
}

// ── Register Close-Out Log: group by shift_lead_closing ──
function _renderRegisterLogByPerson(records) {
  const byPerson = {};
  records.forEach(r => {
    const name = r.fields.shift_lead_closing || 'Unknown';
    if (!byPerson[name]) byPerson[name] = [];
    byPerson[name].push(r.fields);
  });

  let html = '';
  Object.entries(byPerson)
    .sort((a, b) => b[1].length - a[1].length) // most closings first
    .forEach(([name, closings]) => {
      const sorted = closings.sort((a, b) => (a.date||'').localeCompare(b.date||''));
      const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const isVictor = name === 'Victor Reyes';
      const avatarColor = isVictor ? 'background:rgba(251,191,36,0.2);color:var(--amber)' : 'background:var(--surface3);color:var(--text2)';

      // Aggregate stats
      const totalDiscrepancy = closings.reduce((s, c) => s + (c.discrepancy || 0), 0);
      const totalTips        = closings.reduce((s, c) => s + (c.tip_total || 0), 0);
      const anyDiscrepancy   = closings.some(c => c.discrepancy && c.discrepancy !== 0);

      html += '<div style="padding:14px;border-bottom:1px solid var(--border)">'
        // Person header
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
        + '<div style="width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;' + avatarColor + '">' + escHtml(initials) + '</div>'
        + '<div style="flex:1">'
        + '<div style="font-size:14px;font-weight:600">' + escHtml(name) + '</div>'
        + '<div style="font-size:11px;color:var(--amber);margin-top:1px">' + closings.length + ' closing' + (closings.length!==1?'s':'') + '</div>'
        + '</div>'
        + '<div style="text-align:right;font-size:11px">'
        + '<div style="color:var(--text3)">Tips handled: <span style="color:var(--emerald);font-weight:600">' + fmtCurrency(totalTips) + '</span></div>'
        + '<div style="color:var(--text3)">Net discrepancy: <span style="color:' + (totalDiscrepancy === 0 ? 'var(--emerald)' : 'var(--rose)') + ';font-weight:600">' + fmtCurrency(totalDiscrepancy) + '</span></div>'
        + '</div></div>'
        // Closing rows
        + '<div style="padding-left:44px">'
        + '<div style="display:grid;grid-template-columns:90px 80px 100px 100px 70px 1fr;gap:6px;padding:4px 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text3)">'
        + '<span>Date</span><span>Day</span><span>Expected</span><span>Actual</span><span>Diff</span><span>Status</span>'
        + '</div>';

      sorted.forEach(c => {
        const disc = c.discrepancy || 0;
        const discColor = disc === 0 ? 'var(--text3)' : disc > 0 ? 'var(--sky)' : 'var(--rose)';
        const discStr   = disc === 0 ? '—' : (disc > 0 ? '+' : '') + fmtCurrency(disc);
        const statusBadge = c.status === 'reconciled'
          ? '<span class="badge badge-emerald" style="font-size:9px">reconciled</span>'
          : '<span class="badge badge-amber" style="font-size:9px">' + escHtml(c.status || '—') + '</span>';
        const hasNote = c.notes && String(c.notes).trim();

        html += '<div style="display:grid;grid-template-columns:90px 80px 100px 100px 70px 1fr;gap:6px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px;align-items:center">'
          + '<span class="mono" style="color:var(--text2)">' + escHtml(c.date || '—') + '</span>'
          + '<span style="color:var(--text3)">' + escHtml(c.day_of_week || '—') + '</span>'
          + '<span style="color:var(--text2);font-family:var(--mono)">' + fmtCurrency(c.expected_amount) + '</span>'
          + '<span style="color:var(--text2);font-family:var(--mono)">' + fmtCurrency(c.actual_amount) + '</span>'
          + '<span style="color:' + discColor + ';font-family:var(--mono);font-weight:600">' + discStr + '</span>'
          + '<span>' + statusBadge + (hasNote ? ' <span style="font-size:11px;color:var(--text3);font-style:italic">' + escHtml(String(c.notes).trim()) + '</span>' : '') + '</span>'
          + '</div>';
      });

      html += '</div></div>';
    });

  return html;
}

function toggleAtTable(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

function showAtRecordModal(idx) {
  const entry = _bnAtRecordStore[idx];
  if (!entry) return;
  const { r, tableName } = entry;
  const fields = r.fields || {};
  const populated = Object.entries(fields).filter(([,v]) => v != null && v !== '');
  let grid = '<div class="mf-grid">';
  populated.forEach(([k, v]) => {
    const isLong = String(v).length > 60;
    grid += `<div class="mf-item ${isLong?'mf-full':''}"><label>${escHtml(k)}</label><span class="val">${escHtml(String(v))}</span></div>`;
  });
  grid += '</div>';
  grid += `<div style="margin-top:10px;font-size:10px;color:var(--text3)">Record ID: ${escHtml(r.id)} · Created: ${escHtml(r.created_time||'—')}</div>`;
  openModal(escHtml(tableName), populated[0] ? escHtml(String(populated[0][1])) : r.id, grid);
}
