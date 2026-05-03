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
function _renderAirtable(atData) {
  const tables  = atData.tables  || [];
  const records = atData.records || [];
  const el = document.getElementById('rest-airtable');

  if (!tables.length && !records.length) {
    el.innerHTML = '<div class="empty-state">No Airtable data.</div>';
    return;
  }

  // Group records by table_id
  const recByTable = {};
  records.forEach(r => {
    if (!recByTable[r.table_id]) recByTable[r.table_id] = [];
    recByTable[r.table_id].push(r);
  });

  let html = '';
  tables.forEach(t => {
    const tRecords = recByTable[t.id] || [];
    html += `<div class="at-table-section">
      <div class="at-table-header" onclick="toggleAtTable('at-body-${escHtml(t.id)}')">
        <span class="at-table-name">${escHtml(t.name)}</span>
        <span style="font-size:11px;color:var(--text3)">${(t.fields||[]).length} fields</span>
        <span class="at-table-count">${tRecords.length} record${tRecords.length!==1?'s':''}</span>
      </div>
      <div class="at-records" id="at-body-${escHtml(t.id)}">`;

    if (!tRecords.length) {
      html += '<div style="padding:12px 14px;color:var(--text3);font-size:12px">No records</div>';
    } else {
      tRecords.forEach(r => {
        const fields = r.fields || {};
        const populated = Object.entries(fields).filter(([,v]) => v != null && v !== '');
        // Get primary display fields
        const nameField = populated.find(([k]) => /name|employee|client|title/i.test(k));
        const dateField = populated.find(([k]) => /date/i.test(k));
        const statField = populated.find(([k]) => /status|discrepancy/i.test(k));
        const noteField = populated.find(([k]) => /notes/i.test(k));

        const primaryLabel = nameField ? escHtml(String(nameField[1])) : escHtml(r.id);

        html += `<div class="at-record" onclick='showAtRecordModal(${JSON.stringify(r).replace(/'/g,"&#39;")}, ${JSON.stringify(t.name).replace(/'/g,"&#39;")})'>
          <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
            <div style="flex:1;min-width:120px">
              <div style="font-size:13px;font-weight:600;margin-bottom:3px">${primaryLabel}</div>
              ${dateField ? `<div style="font-size:11px;color:var(--text3)">📅 ${escHtml(String(dateField[1]))}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              ${statField ? `<span class="badge badge-amber">${escHtml(String(statField[1]).slice(0,20))}</span>` : ''}
              ${noteField ? `<span style="font-size:11px;color:var(--text2)">${escHtml(String(noteField[1]).slice(0,60))}${String(noteField[1]).length>60?'…':''}</span>` : ''}
            </div>
          </div>
        </div>`;
      });
    }
    html += '</div></div>';
  });

  el.innerHTML = html;
}

function toggleAtTable(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

function showAtRecordModal(r, tableName) {
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
