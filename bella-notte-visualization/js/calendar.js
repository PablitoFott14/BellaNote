/* ═══════════════════════════════════════════
   calendar.js — Calendar events (month view)
   + Reminders list with filter
═══════════════════════════════════════════ */

const BN_TZ = 'America/Chicago';

function renderCalendarTab(data) {
  _renderBnCalendar(data.calendar || {});
  _renderBnReminders(data.reminder || {});
}

// ══ CALENDAR ════════════════════════════════
let _bnCalAll      = [];
let _bnCalSearch   = '';
let _bnCalMonth    = null;
let _bnCalSelKey   = '';

function _renderBnCalendar(calData) {
  _bnCalAll = (calData.events || [])
    .map((e, i) => ({ ...e, _idx: i }))
    .sort((a, b) => (a.start_datetime || 0) - (b.start_datetime || 0));

  const first = _bnCalAll.find(e => e.start_datetime);
  _bnCalMonth  = first ? _bnCalMOM(_bnCalFromTs(first.start_datetime)) : _bnCalMOM(new Date());
  _bnCalSelKey = first ? _bnCalKey(_bnCalFromTs(first.start_datetime)) : _bnCalKey(new Date());

  document.getElementById('cal-events').innerHTML = `
    <div class="explorer-bar" style="margin-bottom:12px">
      <input id="bn-cal-search" class="ex-search" type="text" placeholder="Search events…" />
      <span class="ex-count" id="bn-cal-count"></span>
    </div>
    <div id="bn-cal-body"></div>`;

  document.getElementById('bn-cal-search').addEventListener('input', e => {
    _bnCalSearch = e.target.value.toLowerCase();
    _bnCalMonth  = null;
    _bnCalSelKey = '';
    _drawBnCal();
  });
  _drawBnCal();
}

function _drawBnCal() {
  const filtered = _bnCalAll.filter(e => {
    if (!_bnCalSearch) return true;
    return (e.title||'').toLowerCase().includes(_bnCalSearch)
      || (e.description||'').toLowerCase().includes(_bnCalSearch)
      || (e.location||'').toLowerCase().includes(_bnCalSearch)
      || (e.attendees||[]).some(a => a.toLowerCase().includes(_bnCalSearch));
  });

  const countEl = document.getElementById('bn-cal-count');
  if (countEl) countEl.textContent = `${filtered.length} event${filtered.length!==1?'s':''}`;

  if (!filtered.length) { document.getElementById('bn-cal-body').innerHTML = '<div class="empty-state">No events.</div>'; return; }

  if (!_bnCalMonth) _bnCalMonth = _bnCalMOM(_bnCalFromTs(filtered[0].start_datetime));

  const grouped = {};
  filtered.forEach(e => {
    const k = _bnCalKey(_bnCalFromTs(e.start_datetime));
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(e);
  });

  const visKeys  = _bnMonthKeys(_bnCalMonth);
  const withItems= visKeys.filter(k => grouped[k]?.length);
  if (!_bnCalSelKey || !visKeys.includes(_bnCalSelKey)) {
    _bnCalSelKey = withItems[0] || _bnCalKey(_bnCalMonth);
  }

  const monthLabel   = _bnCalMonth.toLocaleDateString('en-US', { timeZone: BN_TZ, month: 'long', year: 'numeric' });
  const selectedItems = grouped[_bnCalSelKey] || [];

  // Tag colors
  const tagColor = { medical: 'var(--teal)', work: 'var(--sky)', personal: 'var(--violet)' };

  let html = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)">
      <button class="page-btn" onclick="_bnCalShift(-1)">‹</button>
      <div style="text-align:center">
        <div style="font-size:15px;font-weight:700">📅 ${monthLabel}</div>
        <div style="font-size:11px;color:var(--text3)">${filtered.length} events</div>
      </div>
      <button class="page-btn" onclick="_bnCalShift(1)">›</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);background:var(--surface2);border-bottom:1px solid var(--border)">
      ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div style="padding:6px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text3)">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr)">`;

  _bnMonthDays(_bnCalMonth).forEach(day => {
    const key      = _bnCalKey(day);
    const items    = grouped[key] || [];
    const sameMo   = day.getUTCMonth() === _bnCalMonth.getUTCMonth();
    const isSel    = key === _bnCalSelKey;
    html += `<button type="button" onclick="_bnCalSelectDay('${key}')"
      style="min-height:70px;padding:4px;border:none;background:${isSel?'rgba(251,191,36,0.1)':sameMo?'var(--surface)':'var(--surface2)'};
        border-right:1px solid var(--border);border-bottom:1px solid var(--border);cursor:pointer;text-align:left;vertical-align:top;
        outline:${isSel?'2px solid var(--amber)':'none'};outline-offset:-2px">
      <div style="font-size:12px;font-weight:600;color:${sameMo?'var(--text)':'var(--text3)'};padding:2px 4px">${day.getUTCDate()}</div>
      <div style="display:flex;flex-direction:column;gap:1px;padding:0 2px">
        ${items.slice(0,2).map(e => {
          const col = tagColor[e.tag] || 'var(--amber)';
          return `<span style="font-size:9px;background:${col}22;color:${col};border-radius:2px;padding:1px 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;cursor:pointer" onclick="event.stopPropagation();showBnEventModal(${e._idx})">${escHtml(e.title||'Event')}</span>`;
        }).join('')}
        ${items.length > 2 ? `<span style="font-size:9px;color:var(--text3)">+${items.length-2}</span>` : ''}
      </div>
    </button>`;
  });

  html += `</div>
    <div style="padding:14px 16px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3);margin-bottom:8px">
        ${_bnFmtKey(_bnCalSelKey)} · ${selectedItems.length} event${selectedItems.length!==1?'s':''}
      </div>
      ${selectedItems.length ? selectedItems.map(e => {
        const col = tagColor[e.tag] || 'var(--amber)';
        const dur = e.end_datetime && e.start_datetime ? Math.round((e.end_datetime-e.start_datetime)/60) : null;
        return `<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer"
          onclick="showBnEventModal(${e._idx})">
          <div style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0;margin-top:4px"></div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500">${escHtml(e.title||'—')}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">
              ${fmtTsTime(e.start_datetime)}${dur?' · '+fmtMins(dur):''}${e.location?' · '+escHtml(e.location):''}
            </div>
            ${e.description ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">${escHtml(e.description.slice(0,80))}${e.description.length>80?'…':''}</div>` : ''}
          </div>
          ${e.tag ? `<span class="badge" style="flex-shrink:0;background:${col}22;color:${col};border:1px solid ${col}44">${escHtml(e.tag)}</span>` : ''}
        </div>`;
      }).join('') : '<div style="font-size:12px;color:var(--text3)">No events on this day.</div>'}
    </div>
  </div>`;

  document.getElementById('bn-cal-body').innerHTML = html;
}

function _bnCalShift(delta) {
  _bnCalMonth  = new Date(Date.UTC(_bnCalMonth.getUTCFullYear(), _bnCalMonth.getUTCMonth()+delta, 1));
  _bnCalSelKey = '';
  _drawBnCal();
}
function _bnCalSelectDay(key) { _bnCalSelKey = key; _drawBnCal(); }
function _bnCalKey(d)   { return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`; }
function _bnCalFromTs(ts) { const ms = ts > 1e12 ? ts : ts*1000; return new Date(ms); }
function _bnCalMOM(d)   { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); }
function _bnMonthKeys(m){ return _bnMonthDays(m).map(d => _bnCalKey(d)); }
function _bnMonthDays(m){
  const first = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1));
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - first.getUTCDay());
  return Array.from({length:42}, (_,i) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()+i)));
}
function _bnFmtKey(key) {
  if (!key) return '—';
  try { return new Date(key+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}); }
  catch { return key; }
}

function showBnEventModal(idx) {
  const e = _bnCalAll.find(x => x._idx === idx);
  if (!e) return;
  const attendees = (e.attendees || []);
  const dur = e.end_datetime && e.start_datetime ? Math.round((e.end_datetime-e.start_datetime)/60) : null;
  const body = `<div class="mf-grid">
    <div class="mf-item"><label>Start</label><span class="val">${fmtTsTime(e.start_datetime)}</span></div>
    <div class="mf-item"><label>End</label><span class="val">${e.end_datetime ? fmtTsTime(e.end_datetime) : '—'}${dur?` (${fmtMins(dur)})`:''}</span></div>
    ${e.tag ? `<div class="mf-item"><label>Tag</label><span class="val">${escHtml(e.tag)}</span></div>` : ''}
    ${e.location ? `<div class="mf-item"><label>Location</label><span class="val">${escHtml(e.location)}</span></div>` : ''}
    ${e.description ? `<div class="mf-item mf-full"><label>Description</label><span class="val">${escHtml(e.description)}</span></div>` : ''}
    ${attendees.length ? `<div class="mf-item mf-full"><label>Attendees</label><span class="val">${attendees.map(a=>escHtml(a)).join(', ')}</span></div>` : ''}
  </div>`;
  openModal(e.tag || 'Event', e.title || '—', body);
}

// ══ REMINDERS ═══════════════════════════════
let _bnRemAll    = [];
let _bnRemSearch = '';
let _bnRemRepeat = '';
let _bnRemPage   = 1;
const BN_REM_PAGE = 30;

function _renderBnReminders(reminderData) {
  _bnRemAll = (reminderData.reminders || [])
    .sort((a, b) => (a.due_datetime||0) - (b.due_datetime||0));

  const el = document.getElementById('cal-reminders');
  el.innerHTML = `
    <div class="explorer-bar">
      <input id="bn-rem-search" class="ex-search" type="text" placeholder="Search reminders…" />
      <select id="bn-rem-repeat" class="ex-filter">
        <option value="">All</option>
        <option value="repeating">Repeating</option>
        <option value="once">One-time</option>
      </select>
      <span class="ex-count" id="bn-rem-count"></span>
    </div>
    <div id="bn-rem-list"></div>
    <div class="pagination" id="bn-rem-pag"></div>`;

  document.getElementById('bn-rem-search').addEventListener('input', e => { _bnRemSearch = e.target.value.toLowerCase(); _bnRemPage=1; _drawBnRem(); });
  document.getElementById('bn-rem-repeat').addEventListener('change', e => { _bnRemRepeat = e.target.value; _bnRemPage=1; _drawBnRem(); });
  _drawBnRem();
}

function _drawBnRem() {
  const filtered = _bnRemAll.filter(r => {
    const matchRep = !_bnRemRepeat
      || (_bnRemRepeat === 'repeating' && r.repetition_unit)
      || (_bnRemRepeat === 'once' && !r.repetition_unit);
    if (!matchRep) return false;
    if (!_bnRemSearch) return true;
    return (r.title||'').toLowerCase().includes(_bnRemSearch) || (r.description||'').toLowerCase().includes(_bnRemSearch);
  });

  const countEl = document.getElementById('bn-rem-count');
  if (countEl) countEl.textContent = `${filtered.length} reminder${filtered.length!==1?'s':''}`;

  const page = paginate(filtered, _bnRemPage, BN_REM_PAGE);
  let html = '';

  page.forEach(r => {
    html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start">
      <span style="font-size:16px;flex-shrink:0">${r.repetition_unit ? '🔁' : '⏰'}</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">${escHtml(r.title)}</div>
        <div style="font-size:11px;color:var(--amber);font-family:var(--mono);margin-top:2px">Due ${fmtTs(r.due_datetime)}</div>
        ${r.description ? `<div style="font-size:12px;color:var(--text2);margin-top:4px;line-height:1.5">${escHtml(r.description)}</div>` : ''}
        ${r.repetition_unit ? `<div style="font-size:10px;color:var(--violet);margin-top:4px">Repeats every ${r.repetition_value||1} ${escHtml(r.repetition_unit)}</div>` : ''}
      </div>
    </div>`;
  });

  if (!filtered.length) html = '<div class="empty-state">No reminders match.</div>';
  document.getElementById('bn-rem-list').innerHTML = html;
  renderPagination('bn-rem-pag', filtered.length, _bnRemPage, BN_REM_PAGE, `function(p){_bnRemPage=p;_drawBnRem();}`);
}
