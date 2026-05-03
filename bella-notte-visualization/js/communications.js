/* ═══════════════════════════════════════════
   communications.js — Email (inbox/sent)
   + Direct messages (messaging service)
═══════════════════════════════════════════ */

function renderCommunications(data) {
  _renderEmail(data.email || {});
  _renderMessages(data.messaging || {});
}

// ══ EMAIL ═══════════════════════════════════
let _bnEmailAll    = [];
let _bnEmailFolder = 'ALL';
let _bnEmailSearch = '';

function _renderEmail(emailData) {
  _bnEmailAll = (emailData.emails || []).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const el = document.getElementById('comm-email');

  const inboxCount = _bnEmailAll.filter(e => (e.folder||'').toUpperCase() === 'INBOX').length;
  const sentCount  = _bnEmailAll.filter(e => (e.folder||'').toUpperCase() === 'SENT').length;
  const unreadCnt  = _bnEmailAll.filter(e => !e.is_read && (e.folder||'').toUpperCase() === 'INBOX').length;

  el.innerHTML = `
    <div class="email-filter-bar">
      <button class="folder-btn active" data-folder="ALL" onclick="bnSetEmailFolder('ALL')">All (${_bnEmailAll.length})</button>
      <button class="folder-btn" data-folder="INBOX" onclick="bnSetEmailFolder('INBOX')">Inbox (${inboxCount})</button>
      <button class="folder-btn" data-folder="SENT" onclick="bnSetEmailFolder('SENT')">Sent (${sentCount})</button>
      <input id="bn-email-search" class="ex-search" type="text" placeholder="Search subject, sender, or content…" style="max-width:300px" />
      <span class="ex-count" id="bn-email-count"></span>
    </div>
    <div id="bn-email-list" class="email-list"></div>`;

  document.getElementById('bn-email-search').addEventListener('input', e => {
    _bnEmailSearch = e.target.value.toLowerCase();
    _bnDrawEmails();
  });
  _bnDrawEmails();
}

function bnSetEmailFolder(folder) {
  _bnEmailFolder = folder;
  document.querySelectorAll('.folder-btn').forEach(b => b.classList.toggle('active', b.dataset.folder === folder));
  _bnDrawEmails();
}

function _bnDrawEmails() {
  const filtered = _bnEmailAll.filter(e => {
    const matchFolder = _bnEmailFolder === 'ALL' || (e.folder||'').toUpperCase() === _bnEmailFolder;
    const s = _bnEmailSearch;
    const matchSearch = !s
      || (e.subject||'').toLowerCase().includes(s)
      || (e.sender||'').toLowerCase().includes(s)
      || (e.content||'').toLowerCase().includes(s)
      || (e.recipients||[]).some(r => r.toLowerCase().includes(s));
    return matchFolder && matchSearch;
  });

  const countEl = document.getElementById('bn-email-count');
  if (countEl) countEl.textContent = `${filtered.length} email${filtered.length!==1?'s':''}`;

  if (!filtered.length) {
    document.getElementById('bn-email-list').innerHTML = '<div class="empty-state">No emails match.</div>';
    return;
  }

  let html = '';
  filtered.forEach(e => {
    const isInbox = (e.folder||'').toUpperCase() === 'INBOX';
    const from    = isInbox ? (e.sender||'—') : 'To: ' + (e.recipients||[]).slice(0,2).join(', ');
    const eid     = escHtml(e.email_id || e.id || Math.random());

    // Parse attachments
    let atts = [];
    try {
      if (typeof e.attachments === 'object' && e.attachments !== null && !Array.isArray(e.attachments)) {
        atts = Object.keys(e.attachments);
      } else if (typeof e.attachments === 'string') {
        atts = Object.keys(JSON.parse(e.attachments));
      }
    } catch {}

    html += `<div class="email-row">
      <div class="email-summary" onclick="bnToggleEmail('bn-eb-${eid}')">
        <span class="badge ${isInbox?'badge-inbox':'badge-sent'}">${escHtml(e.folder||'—')}</span>
        <div>
          <div class="email-subject ${!e.is_read && isInbox ? 'unread' : ''}">${escHtml(e.subject||'(no subject)')}</div>
          <div class="email-from">${escHtml(from)}</div>
        </div>
        <div class="email-date">${fmtTs(e.timestamp)}</div>
        <div style="text-align:right">
          ${!e.is_read && isInbox ? '<span class="badge badge-unread">unread</span>' : ''}
          ${atts.length ? `<div style="font-size:10px;color:var(--text3);margin-top:3px">📎 ${atts.length}</div>` : ''}
        </div>
      </div>
      <div class="email-body-wrap" id="bn-eb-${eid}">
        <div class="email-meta-line">
          <strong>From:</strong> ${escHtml(e.sender||'—')}<br>
          <strong>To:</strong> ${escHtml((e.recipients||[]).join(', '))}<br>
          ${e.cc&&e.cc.length ? `<strong>CC:</strong> ${escHtml(e.cc.join(', '))}<br>` : ''}
          <strong>Date:</strong> ${fmtTsTime(e.timestamp)}
        </div>
        <div class="email-content">${escHtml(e.content||'')}</div>
        ${atts.length ? `<div style="margin-top:8px">${atts.map(a=>`<span class="att-chip">📎 ${escHtml(a)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;
  });

  document.getElementById('bn-email-list').innerHTML = html;
}

function bnToggleEmail(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

// ══ MESSAGES ════════════════════════════════
function _renderMessages(msgData) {
  const convos = msgData.conversations || [];
  const el     = document.getElementById('comm-messages');

  if (!convos.length) {
    el.innerHTML = '<div class="empty-state">No message conversations.</div>';
    return;
  }

  // Participant ID → display name (derived from conversation titles)
  const pMap = {
    'p_victor':     'Victor Reyes',
    'p_alejandro':  'Alejandro Reyes',
    'p_maria_r':    'Maria Reyes',
    'p_dave':       'Dave K (Sponsor)',
  };

  let html = '<div class="convo-list">';
  convos.forEach((c, idx) => {
    const msgs    = c.messages || [];
    const last    = msgs[msgs.length - 1];
    const preview = last ? last.content.slice(0, 70) + (last.content.length > 70 ? '…' : '') : '';

    html += `<div class="convo-card">
      <div class="convo-header" onclick="bnToggleConvo('bn-convo-${idx}')">
        <div>
          <div class="convo-name">${escHtml(c.title || 'Conversation')}</div>
          <div class="convo-preview">${escHtml(preview)}</div>
        </div>
        <div class="convo-count">${msgs.length} msg${msgs.length!==1?'s':''}</div>
      </div>
      <div class="convo-messages" id="bn-convo-${idx}">
        <div class="msg-list">`;

    msgs.forEach(m => {
      const sid      = m.sender_id || '';
      const sName    = pMap[sid] || sid;
      const isVictor = sid === 'p_victor';
      const ts       = m.timestamp ? fmtTsTime(m.timestamp) : '';
      html += `<div class="msg-bubble ${isVictor ? 'from-user' : 'from-other'}">
        <div class="msg-sender ${isVictor ? 'user' : ''}">${escHtml(sName)}</div>
        ${escHtml(m.content)}
        ${m.attachment_name ? `<div style="margin-top:4px;font-size:11px;color:var(--text3)">📎 ${escHtml(m.attachment_name)}</div>` : ''}
        <div class="msg-time">${ts}</div>
      </div>`;
    });

    html += `</div></div></div>`;
  });
  html += '</div>';

  el.innerHTML = html;
}

function bnToggleConvo(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}
