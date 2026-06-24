import { sb, ctx } from '../lib/supabase';
import { getReservations, addReservation, cancelReservation } from '../services/reservationService';
import { getShifts } from '../services/shiftService';
import { getCustomer } from '../services/customerService';
import { getStoreSettings } from '../services/storeService';
import { getTherapists, getTherapistInterval } from '../services/therapistService';

// ── 状態 ─────────────────────────────────────────────
let currentResvDate = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

let _resvData: any[]                     = [];
let _resvViewMode: 'therapist' | 'time' = 'therapist';
let _resvShiftMap: Record<string, any[]> = {};
let _resvRoomMap:  Record<string, string> = {};
let _therapists: any[]                   = [];
let _menus: any[]                        = [];
let _nominationFee = { free: 0, nomination: 1000, honshimei: 1000 };
let _lookupNameTimer: any = null;
let _lookupTelTimer:  any = null;

const NOMINATION_LABEL: Record<string, string> = { free: 'フリー', nomination: '指名', honshimei: '本指名' };
const pad = (n: number) => String(n).padStart(2, '0');

// ── HTML ─────────────────────────────────────────────
export function renderReservationPage(): string {
  return `
    <div class="date-nav">
      <button onclick="window._resv.changeDate(-1)">◀</button>
      <span id="resv-date-label"></span>
      <button onclick="window._resv.changeDate(1)">▶</button>
      <button class="btn btn-secondary btn-sm" onclick="window._resv.load()">更新</button>
    </div>

    <div style="display:flex;gap:6px;margin-bottom:10px">
      <button class="btn btn-secondary btn-sm" id="resv-view-therapist" onclick="window._resv.setView('therapist')">セラピスト別</button>
      <button class="btn btn-secondary btn-sm" id="resv-view-time" onclick="window._resv.setView('time')">時間順</button>
    </div>

    <div id="hime-pending-banner" style="margin-bottom:8px"></div>

    <div class="card" style="margin-bottom:16px">
      <div id="resv-table-wrap">読み込み中...</div>
    </div>

    <div class="card">
      <div class="sec-title" style="margin-bottom:14px">予約登録</div>
      <div class="grid2">
        <div class="form-group">
          <label>日時</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input type="date" id="resv-date-part" style="flex:1.2" onchange="window._resv.syncDatetime()">
            <select id="resv-time-sel" style="flex:1" onchange="window._resv.syncDatetime()"></select>
          </div>
          <input type="hidden" id="resv-date">
        </div>
        <div class="form-group">
          <label>セラピスト</label>
          <select id="resv-therapist" onchange="window._resv.onTherapistChange(this.value)"></select>
        </div>
      </div>
      <div class="grid2">
        <div class="form-group">
          <label>コース（分）</label>
          <select id="resv-course" onchange="window._resv.calcPrice()"></select>
        </div>
        <div class="form-group">
          <label id="resv-course-input-label">料金</label>
          <input type="number" id="resv-custom-minutes" placeholder="時間（分）例: 70" style="display:none;margin-bottom:6px" oninput="window._resv.calcPrice()">
          <input type="number" id="resv-custom-price" placeholder="料金（円）例: 17000" style="display:none;width:100%;padding:10px 13px;border:1px solid var(--border);border-radius:var(--radius);font-size:15px">
          <div id="course-price-display" style="padding:10px 0;font-size:15px;font-weight:600"></div>
        </div>
      </div>
      <div class="grid2">
        <div class="form-group">
          <label>指名種別</label>
          <select id="resv-nomination"></select>
        </div>
        <div class="form-group">
          <label>割引（円）</label>
          <input type="number" id="resv-discount" value="0" min="0">
        </div>
      </div>
      <input type="hidden" id="resv-customer-no" value="">
      <input type="hidden" id="resv-customer-tel" value="">
      <div class="grid2">
        <div class="form-group">
          <label>お客様名 <span style="color:var(--accent);font-size:11px">※必須</span></label>
          <input type="text" id="resv-customer-name" placeholder="例: サカバ"
            oninput="window._resv.lookupByName(this.value)">
        </div>
        <div class="form-group">
          <label>電話番号</label>
          <input type="text" id="resv-customer-tel-full" placeholder="例: 09012341234"
            oninput="this.value=this.value.replace(/[^0-9]/g,'');window._resv.lookupByTel(this.value)">
        </div>
      </div>
      <div id="resv-customer-info" style="font-size:13px;color:var(--success);margin-bottom:8px;display:none"></div>
      <div class="form-group" style="margin-bottom:12px">
        <label>メモ（任意）</label>
        <textarea id="resv-memo" rows="2" placeholder="例: 首・肩を重点的に"
          style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--radius);font-size:14px;font-family:inherit;resize:vertical"></textarea>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="window._resv.submit()">保存</button>
        <button class="btn btn-secondary" onclick="window._resv.reset()">リセット</button>
      </div>
    </div>
  `;
}

// ── 初期化 ────────────────────────────────────────────
export async function initReservation() {
  updateDateLabel();
  await Promise.all([_loadTherapists(), _loadMenus(), _loadStoreSettings()]);
  _populateTimeSelect();
  _populateTherapistSelect();
  _populateCourseSelect();
  _populateNominationSelect('');
  _setDefaultDate();
  load();
}

async function _loadTherapists() {
  try { _therapists = await getTherapists(); } catch { _therapists = []; }
}

async function _loadMenus() {
  try {
    const { data } = await sb.from('menus').select('*')
      .eq('store_id', ctx.storeId).eq('active', true).order('display_order');
    _menus = data || [];
  } catch { _menus = []; }
}

async function _loadStoreSettings() {
  try {
    const s = await getStoreSettings();
    _nominationFee = {
      free:       s.nomination_fee_free      || 0,
      nomination: s.nomination_fee_nomination || 1000,
      honshimei:  s.nomination_fee_honshimei  || 1000,
    };
  } catch { /* use defaults */ }
}

// ── 日付 ─────────────────────────────────────────────
function updateDateLabel() {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const d = currentResvDate;
  const el = document.getElementById('resv-date-label');
  if (el) el.textContent = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]})`;
}

function _setDefaultDate() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const el = document.getElementById('resv-date-part') as HTMLInputElement | null;
  if (el && !el.value) el.value = dateStr;
  syncDatetime();
}

function syncDatetime() {
  const datePart = (document.getElementById('resv-date-part') as HTMLInputElement)?.value || '';
  const timeVal  = (document.getElementById('resv-time-sel') as HTMLSelectElement)?.value || '09:00';
  if (!datePart) return;
  const [hStr, mStr] = timeVal.split(':');
  const h = parseInt(hStr), m = parseInt(mStr || '0');
  let dateVal: string;
  if (h >= 24) {
    const base = new Date(datePart + 'T00:00:00');
    base.setDate(base.getDate() + 1);
    base.setHours(h - 24, m, 0, 0);
    dateVal = `${base.getFullYear()}-${pad(base.getMonth()+1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
  } else {
    dateVal = `${datePart}T${pad(h)}:${pad(m)}`;
  }
  const hidden = document.getElementById('resv-date') as HTMLInputElement | null;
  if (hidden) hidden.value = dateVal;
}

function _populateTimeSelect() {
  const sel = document.getElementById('resv-time-sel') as HTMLSelectElement | null;
  if (!sel) return;
  const opts: string[] = [];
  for (let h = 9; h <= 27; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 27 && m > 0) break;
      opts.push(`<option value="${pad(h)}:${pad(m)}">${pad(h)}:${pad(m)}</option>`);
    }
  }
  sel.innerHTML = opts.join('');
  sel.value = '12:00';
}

function _populateTherapistSelect() {
  const sel = document.getElementById('resv-therapist') as HTMLSelectElement | null;
  if (!sel) return;
  const opts = _therapists.map(t => `<option value="${t.name}">${t.name}</option>`);
  sel.innerHTML = '<option value="">選択してください</option>' + opts.join('') + '<option value="__unassigned__">【未割り当て】</option>';
}

function _populateCourseSelect() {
  const sel = document.getElementById('resv-course') as HTMLSelectElement | null;
  if (!sel) return;
  let opts = '';
  if (_menus.length) {
    opts = _menus.map((m: any) =>
      `<option value="${m.duration_min}" data-price="${m.price}">${m.duration_min}分 ¥${Number(m.price).toLocaleString()}</option>`
    ).join('');
  } else {
    opts = [60, 90, 120, 150, 180].map(m => `<option value="${m}">${m}分</option>`).join('');
  }
  sel.innerHTML = opts + '<option value="custom">その他（手入力）</option>';
  calcPrice();
}

function _populateNominationSelect(therapistName: string) {
  const th = therapistName ? _therapists.find(t => t.name === therapistName) : null;
  const fee = (th && th.nominationFee != null) ? Number(th.nominationFee) : null;

  const items = [
    { value: 'free',       label: 'フリー',  f: 0 },
    { value: 'nomination', label: '指名',    f: fee ?? _nominationFee.nomination },
    { value: 'honshimei',  label: '本指名',  f: fee ?? _nominationFee.honshimei  },
  ];
  const html = items.map(i => `<option value="${i.value}">${i.label} ¥${i.f.toLocaleString()}</option>`).join('');
  const sel = document.getElementById('resv-nomination') as HTMLSelectElement | null;
  if (sel) { const cur = sel.value; sel.innerHTML = html; if ([...sel.options].some(o => o.value === cur)) sel.value = cur; }
}

// ── コース料金 ────────────────────────────────────────
function calcPrice() {
  const sel     = document.getElementById('resv-course') as HTMLSelectElement | null;
  const val     = sel?.value || '';
  const custMin = document.getElementById('resv-custom-minutes') as HTMLInputElement | null;
  const custPrc = document.getElementById('resv-custom-price') as HTMLInputElement | null;
  const disp    = document.getElementById('course-price-display');
  const label   = document.getElementById('resv-course-input-label');
  if (val === 'custom') {
    if (custMin) custMin.style.display = '';
    if (custPrc) custPrc.style.display = '';
    if (disp)    disp.style.display    = 'none';
    if (label)   label.textContent     = '時間（分）/ 料金';
  } else {
    if (custMin) custMin.style.display = 'none';
    if (custPrc) custPrc.style.display = 'none';
    if (disp)    disp.style.display    = '';
    if (label)   label.textContent     = '料金';
    const opt   = sel?.options[sel.selectedIndex];
    const price = opt?.dataset?.price ? Number(opt.dataset.price) : _defaultPrice(Number(val));
    if (disp)   disp.textContent = '¥' + price.toLocaleString();
  }
}

function _defaultPrice(min: number): number {
  const MAP: Record<number, number> = { 60: 13000, 90: 18000, 120: 22000, 150: 27000, 180: 32000 };
  return MAP[min] || 0;
}

function _courseMinutes(): number {
  const sel = document.getElementById('resv-course') as HTMLSelectElement | null;
  if (!sel) return 0;
  if (sel.value === 'custom') return Number((document.getElementById('resv-custom-minutes') as HTMLInputElement)?.value) || 0;
  return Number(sel.value) || 0;
}

function _coursePrice(): number {
  const sel = document.getElementById('resv-course') as HTMLSelectElement | null;
  if (!sel) return 0;
  if (sel.value === 'custom') return Number((document.getElementById('resv-custom-price') as HTMLInputElement)?.value) || 0;
  const opt = sel.options[sel.selectedIndex];
  return opt?.dataset?.price ? Number(opt.dataset.price) : _defaultPrice(Number(sel.value));
}

function _nomFee(therapistName: string, nomination: string): number {
  const th = _therapists.find(t => t.name === therapistName);
  if (th && th.nominationFee != null) return nomination === 'free' ? 0 : Number(th.nominationFee);
  if (nomination === 'free')       return 0;
  return nomination === 'honshimei' ? _nominationFee.honshimei : _nominationFee.nomination;
}

// ── セラピスト変更 ────────────────────────────────────
function onTherapistChange(name: string) {
  _populateNominationSelect(name);
}

// ── 顧客検索 ──────────────────────────────────────────
function lookupByName(name: string) {
  clearTimeout(_lookupNameTimer);
  if (!name || name.length < 1) return;
  _lookupNameTimer = setTimeout(async () => {
    try { const res = await getCustomer({ name }); if (res.found) _fillCustomer(res); } catch { /* ignore */ }
  }, 600);
}

function lookupByTel(tel: string) {
  clearTimeout(_lookupTelTimer);
  if (!tel || tel.length < 4) return;
  _lookupTelTimer = setTimeout(async () => {
    try { const res = await getCustomer({ tel }); if (res.found) _fillCustomer(res); } catch { /* ignore */ }
  }, 600);
}

function _fillCustomer(res: any) {
  const setIfEmpty = (id: string, val: string) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el && !el.value) el.value = val;
  };
  (document.getElementById('resv-customer-no') as HTMLInputElement).value  = res.customerNo || '';
  (document.getElementById('resv-customer-tel') as HTMLInputElement).value = res.tel || '';
  setIfEmpty('resv-customer-name',     res.name || '');
  setIfEmpty('resv-customer-tel-full', res.tel  || '');
  const info = document.getElementById('resv-customer-info');
  if (info) { info.textContent = '✓ 顧客データを取得しました'; info.style.display = ''; setTimeout(() => { info.style.display = 'none'; }, 3500); }
}

// ── データ読み込み ────────────────────────────────────
async function load() {
  updateDateLabel();
  const d   = currentResvDate;
  const fmt = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const wrapEl = document.getElementById('resv-table-wrap');
  if (wrapEl) wrapEl.innerHTML = '<p style="color:var(--muted)">読み込み中...</p>';

  try {
    const [data, shiftData] = await Promise.all([
      getReservations(fmt),
      getShifts({ date: fmt, status: 'approved' }),
    ]);

    _resvShiftMap = {};
    _resvRoomMap  = {};

    (shiftData || []).forEach((s: any) => {
      const att = s.attendanceType || s.attendance_type || 'normal';
      if (att === 'absent' || att === 'pre_absent' || att === 'noshow') return;
      const name = s.therapistName || s.therapist_name || '';
      if (!name) return;
      if (!_resvShiftMap[name]) _resvShiftMap[name] = [];
      const intv = _therapists.find(t => t.name === name)?.interval || 30;
      _resvShiftMap[name].push({
        start: s.startTime || s.start_time || '',
        end:   s.endTime   || s.end_time   || '',
        roomName: s.roomName || s.room_name || '',
        attendanceType: att,
        intervalMin: intv,
      });
    });

    Object.keys(_resvShiftMap).forEach(name => {
      _resvShiftMap[name].sort((a, b) => toMin27(a.start) - toMin27(b.start));
      const rooms = [...new Set(_resvShiftMap[name].map((s: any) => s.roomName).filter(Boolean))];
      if (rooms.length) _resvRoomMap[name] = rooms.join(' / ');
    });

    // 承認待ち姫予約バナー
    const { data: pendingAll } = await sb.from('reservations').select('*')
      .eq('store_id', ctx.storeId).eq('is_hime', true).eq('is_hime_approved', false).neq('status', 'cancelled');
    const existIds = new Set((data || []).map((r: any) => r.id));
    const extra = (pendingAll || []).filter((r: any) => !existIds.has(r.id));
    const bannerEl = document.getElementById('hime-pending-banner');
    if (bannerEl) {
      bannerEl.innerHTML = extra.map((r: any) => {
        const dt = new Date(r.date + (r.date.includes('T') ? '' : 'T00:00:00'));
        const lbl = `${dt.getMonth()+1}/${dt.getDate()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        return `<div style="padding:8px 12px;background:#fff7ed;border:1.5px solid #fb923c;border-radius:8px;margin-bottom:6px;font-size:12px">
          <span style="font-weight:700;color:#ea580c">🌸 承認待ち姫予約</span>
          <span style="margin-left:8px">${lbl} ${r.therapist_name} / ${r.customer_name}様</span>
        </div>`;
      }).join('');
    }

    _resvData = data || [];
    renderTable(_resvData);
  } catch (e: any) {
    if (wrapEl) wrapEl.innerHTML = `<p style="color:red">読み込みエラー: ${e.message}</p>`;
  }
}

// ── 表示 ─────────────────────────────────────────────
function toMin27(t: string): number {
  const [hStr, mStr] = (t || '00:00').split(':');
  const h = parseInt(hStr || '0'), m = parseInt(mStr || '0');
  return (h < 3 ? h + 24 : h) * 60 + m;
}

function renderTable(data: any[]) {
  const el = document.getElementById('resv-table-wrap');
  if (!el) return;
  if (!data.length && !Object.keys(_resvShiftMap).length) {
    el.innerHTML = '<p style="color:var(--muted)">予約なし</p>'; return;
  }
  if (_resvViewMode === 'therapist') _renderByTherapist(data, el);
  else _renderByTime(data, el);
}

function _renderByTherapist(data: any[], el: HTMLElement) {
  const groups: Record<string, any[]> = {};
  data.forEach(r => { const th = r.therapist || '未割り当て'; if (!groups[th]) groups[th] = []; groups[th].push(r); });
  Object.keys(_resvShiftMap).forEach(name => { if (!groups[name]) groups[name] = []; });

  const names = Object.keys(groups).sort();
  const total = data.filter(r => r.status !== 'cancelled').length;
  const totalSales = data.filter(r => r.status !== 'cancelled').reduce((s, r) => s + Number(r.price || 0), 0);

  const now = new Date();
  let nowMin = now.getHours() * 60 + now.getMinutes();
  if (now.getHours() < 3) nowMin += 24 * 60;
  const today = new Date(); if (today.getHours() < 3) today.setDate(today.getDate()-1); today.setHours(0,0,0,0);
  const isToday = currentResvDate.toDateString() === today.toDateString();

  el.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
      合計 ${total} 件　有効売上 ¥${totalSales.toLocaleString()}
    </div>
    ${names.map(th => {
      const rows   = groups[th];
      const valid  = rows.filter(r => r.status !== 'cancelled');
      const sales  = valid.reduce((s, r) => s + Number(r.price || 0), 0);
      const shifts = _resvShiftMap[th];
      const shiftLabel = shifts?.length ? shifts.map((s: any) => `${(s.start||'').substring(0,5)}〜${(s.end||'').substring(0,5)}`).join(' / ') : '';

      // 最短案内
      let availHtml = '';
      if (isToday && shifts?.length) {
        const target = shifts.find((s: any) => nowMin < toMin27(s.end));
        if (!target) {
          availHtml = `<div style="margin-top:4px"><span style="font-size:11px;font-weight:700;background:#dc2626;color:#fff;padding:2px 10px;border-radius:10px">🔥 完売</span></div>`;
        } else {
          const candidate = Math.max(nowMin, toMin27(target.start));
          const intv = target.intervalMin || 30;
          const sorted = rows.filter(r => r.status !== 'cancelled').map(r => {
            const dt = new Date(r.rawDate || r.date);
            const h = dt.getHours(), mm = dt.getMinutes();
            const sm = (h < 3 ? h + 24 : h) * 60 + mm;
            return { sm, em: sm + Number(r.course || 60) };
          }).sort((a, b) => a.sm - b.sm);
          let cur = candidate, earliest = -1, remaining = 0;
          for (const rv of sorted) {
            if (cur < rv.sm && rv.sm - cur >= 60 + intv) { earliest = cur; remaining = rv.sm - cur - intv; break; }
            if (cur < rv.em + intv) cur = rv.em + intv;
          }
          if (earliest < 0 && cur < toMin27(target.end)) { earliest = cur; remaining = toMin27(target.end) - cur; }
          if (earliest >= 0 && earliest < toMin27(target.end)) {
            const eH = Math.floor(earliest/60), eM = earliest%60;
            availHtml = `<div style="margin-top:4px"><span style="font-size:11px;font-weight:600;background:#10b981;color:#fff;padding:1px 8px;border-radius:10px">⏱ 最短 ${pad(eH)}:${pad(eM)}〜（残${remaining}分）</span></div>`;
          } else {
            availHtml = `<div style="margin-top:4px"><span style="font-size:11px;font-weight:700;background:#dc2626;color:#fff;padding:2px 10px;border-radius:10px">🔥 完売</span></div>`;
          }
        }
      }

      const atts = shifts?.map((s: any) => s.attendanceType) || [];
      let hBg = 'var(--primary)', attBadge = '';
      if (atts.includes('absent') || atts.includes('noshow')) {
        hBg = '#dc2626';
        attBadge = `<span style="font-size:11px;background:rgba(255,255,255,0.25);padding:1px 8px;border-radius:10px;margin-left:6px">🔴 ${atts.includes('noshow') ? '無断欠勤' : '欠勤'}</span>`;
      } else if (atts.includes('late') || atts.includes('early_leave')) {
        hBg = '#d97706';
        attBadge = `<span style="font-size:11px;background:rgba(255,255,255,0.25);padding:1px 8px;border-radius:10px;margin-left:6px">⚠ ${atts.includes('late') ? '遅刻' : '早退'}</span>`;
      }
      const roomBadge = _resvRoomMap[th] ? ` <span style="font-size:11px;background:rgba(255,255,255,0.25);padding:1px 8px;border-radius:10px;margin-left:4px">🚪 ${_resvRoomMap[th]}</span>` : '';

      return `
        <div style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;padding:8px 10px;background:${hBg};color:#fff;border-radius:8px 8px 0 0;font-size:13px;font-weight:700">
            <span>👤 ${th}${roomBadge}${attBadge}</span>
            <span style="font-size:12px;opacity:.85">${shiftLabel || (`${valid.length}件 ¥${sales.toLocaleString()}`)}</span>
            ${availHtml}
          </div>
          <div style="border-radius:0 0 8px 8px;border:1px solid var(--border);border-top:none;padding:8px">
            ${rows.length
              ? rows.map(r => _resvRow(r)).join('')
              : '<p style="color:var(--muted);font-size:13px;padding:8px 0">予約なし</p>'}
          </div>
        </div>`;
    }).join('')}`;
}

function _renderByTime(data: any[], el: HTMLElement) {
  const total = data.filter(r => r.status !== 'cancelled').length;
  const totalSales = data.filter(r => r.status !== 'cancelled').reduce((s, r) => s + Number(r.price || 0), 0);
  el.innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
      合計 ${total} 件　有効売上 ¥${totalSales.toLocaleString()}
    </div>
    ${data.map(r => _resvRow(r)).join('')}`;
}

function _resvRow(r: any): string {
  const cancelled = r.status === 'cancelled';
  const himePend  = r.isHime && !r.isHimeApproved && !cancelled;
  const rowBg     = cancelled ? 'opacity:0.5;background:#f3f4f6;' : himePend ? 'background:#fef3f9;' : r.isNewCustomer ? 'background:#fdf4ff;' : '';
  const newBadge  = r.isNewCustomer      ? ' <span style="font-size:10px;font-weight:700;color:#7c3aed;background:#ede9fe;padding:1px 6px;border-radius:10px">NEW</span>'     : '';
  const himeBadge = r.isHime             ? ' <span style="font-size:11px;font-weight:700;color:#be185d;background:#fce7f3;padding:1px 6px;border-radius:10px">🌸</span>'     : '';
  const confBadge = r.therapistConfirmed ? ' <span style="font-size:10px;color:#059669;background:#ecfdf5;padding:1px 6px;border-radius:10px">✅ 確認済</span>' : '';
  const nomLabel  = NOMINATION_LABEL[r.nomination] || '';
  const cancelFlag = cancelled ? '<span style="font-size:10px;color:#9ca3af;font-weight:600;margin-left:6px">キャンセル</span>'    : '';
  const pendFlag   = himePend  ? '<span style="font-size:10px;color:#db2777;font-weight:600;margin-left:6px">承認待ち</span>' : '';

  let timeStr = '';
  try {
    const dt = r.rawDate ? new Date(r.rawDate) : null;
    if (dt) { let h = dt.getHours(), m = dt.getMinutes(); if (h < 3) h += 24; timeStr = `${pad(h)}:${pad(m)}`; }
  } catch { timeStr = (r.date || '').split(' ')[1] || ''; }

  const idx = _resvData.indexOf(r);
  return `
  <div style="border-radius:8px;padding:10px 12px;margin-bottom:6px;${rowBg}border:1px solid ${cancelled ? '#e5e7eb' : 'var(--border)'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;flex-wrap:wrap;gap:4px">
      <div style="font-size:14px;font-weight:700">
        ${timeStr}　${r.therapist || '未割り当て'}${cancelFlag}${pendFlag}${confBadge}
      </div>
      <div style="font-size:12px;color:var(--muted)">
        ${r.course}分　¥${Number(r.price||0).toLocaleString()}${Number(r.discount)>0?` <span style="color:#dc2626">割-¥${Number(r.discount).toLocaleString()}</span>`:''}
      </div>
    </div>
    <div style="font-size:13px;margin-bottom:8px">
      ${r.customer || '-'}${newBadge}${himeBadge}
      ${nomLabel ? `<span style="color:var(--muted);font-size:12px;margin-left:4px">${nomLabel}</span>` : ''}
      ${r.visitCount > 0 ? `<span style="font-size:10px;color:#059669;background:#ecfdf5;padding:1px 6px;border-radius:10px;margin-left:4px">全${r.visitCount}回</span>` : ''}
    </div>
    ${r.memo ? `<div style="font-size:12px;color:#1d4ed8;background:#eff6ff;border-radius:6px;padding:4px 8px;margin-bottom:8px">📝 ${r.memo}</div>` : ''}
    ${!cancelled ? `<button class="btn btn-danger btn-sm" onclick="window._resv.cancel(${idx})">キャンセル</button>` : ''}
  </div>`;
}

// ── 予約登録 ──────────────────────────────────────────
async function submit() {
  const mins        = _courseMinutes();
  const coursePrice = _coursePrice();
  const therapist   = (document.getElementById('resv-therapist') as HTMLSelectElement)?.value || '';
  const custName    = ((document.getElementById('resv-customer-name') as HTMLInputElement)?.value || '').trim();
  const dateVal     = (document.getElementById('resv-date') as HTMLInputElement)?.value || '';
  const tel         = (document.getElementById('resv-customer-tel-full') as HTMLInputElement)?.value?.trim()
                   || (document.getElementById('resv-customer-tel') as HTMLInputElement)?.value?.trim() || '';
  const discount    = Number((document.getElementById('resv-discount') as HTMLInputElement)?.value) || 0;
  const nomination  = (document.getElementById('resv-nomination') as HTMLSelectElement)?.value || 'free';
  const memo        = ((document.getElementById('resv-memo') as HTMLTextAreaElement)?.value || '').trim();
  const customerNo  = (document.getElementById('resv-customer-no') as HTMLInputElement)?.value || '';
  const nomFee      = _nomFee(therapist, nomination);

  if (!dateVal)   { alert('日時を入力してください'); return; }
  if (!therapist) { alert('セラピストを選択してください'); return; }
  if (!mins)      { alert('コースを選択してください'); return; }
  if (!custName)  { alert('お客様名を入力してください'); return; }

  _showOverlay();
  try {
    const dt      = new Date(dateVal);
    const dtMs    = dt.getTime();
    const dateStr = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
    let interval  = _therapists.find(t => t.name === therapist)?.interval ?? null;
    if (interval == null) {
      try { interval = await getTherapistInterval(therapist); } catch { interval = 30; }
    }
    interval = interval ?? 30;

    const existResv = await getReservations(dateStr);
    const newEndMs  = dtMs + (mins + interval) * 60000;
    const conflict  = existResv.find((r: any) => {
      if (r.therapist !== therapist || r.status === 'cancelled') return false;
      const rDt    = new Date(r.rawDate || r.date);
      const rEndMs = rDt.getTime() + (Number(r.course) + interval) * 60000;
      return dtMs < rEndMs && newEndMs > rDt.getTime();
    });
    if (conflict) {
      _hideOverlay();
      if (!confirm(`⚠ ${therapist}さんの予約と重複しています。\nこのまま登録しますか？`)) return;
      _showOverlay();
    }

    await addReservation({
      date: dateVal, therapist, course: String(mins),
      customer: custName, customerNo, tel,
      price: coursePrice + nomFee, coursePrice, nominationFee: nomFee,
      discount, nomination, memo,
    });

    _showToast('予約を登録しました');
    reset();
    load();
  } catch (e: any) {
    alert('エラー: ' + e.message);
  } finally {
    _hideOverlay();
  }
}

async function cancel(idx: number) {
  const r = _resvData[idx];
  if (!r) return;
  let timeStr = '';
  try { const dt = new Date(r.rawDate || r.date); let h = dt.getHours(); if (h < 3) h += 24; timeStr = `${pad(h)}:${pad(dt.getMinutes())}`; } catch { /* ignore */ }
  if (!confirm(`キャンセルしますか？\n${timeStr} ${r.therapist} / ${r.customer}`)) return;
  try {
    await cancelReservation({ row: r.id, reason: 'other' });
    _showToast('キャンセルしました');
    load();
  } catch (e: any) { alert('エラー: ' + e.message); }
}

function reset() {
  ['resv-customer-name', 'resv-customer-tel-full', 'resv-memo'].forEach(id => {
    const el = document.getElementById(id) as HTMLInputElement | null; if (el) el.value = '';
  });
  const disc = document.getElementById('resv-discount') as HTMLInputElement | null; if (disc) disc.value = '0';
  (document.getElementById('resv-customer-no') as HTMLInputElement).value  = '';
  (document.getElementById('resv-customer-tel') as HTMLInputElement).value = '';
  const info = document.getElementById('resv-customer-info'); if (info) info.style.display = 'none';
}

// ── Toast / Overlay ───────────────────────────────────
function _showOverlay() { document.getElementById('overlay')?.classList.add('show'); }
function _hideOverlay() { document.getElementById('overlay')?.classList.remove('show'); }
function _showToast(msg: string) {
  document.getElementById('_toast_resv')?.remove();
  const el = document.createElement('div'); el.id = '_toast_resv'; el.textContent = msg;
  Object.assign(el.style, { position:'fixed', bottom:'80px', left:'50%', transform:'translateX(-50%)', background:'#0f172a', color:'#fff', padding:'10px 20px', borderRadius:'8px', fontSize:'14px', zIndex:'99999' });
  document.body.appendChild(el); setTimeout(() => el.remove(), 2500);
}

// ── グローバル公開 ────────────────────────────────────
(window as any)._resv = {
  load,
  changeDate: (d: number) => { currentResvDate.setDate(currentResvDate.getDate() + d); updateDateLabel(); load(); },
  setView: (mode: 'therapist' | 'time') => { _resvViewMode = mode; renderTable(_resvData); },
  syncDatetime,
  calcPrice,
  onTherapistChange,
  lookupByName,
  lookupByTel,
  submit,
  cancel,
  reset,
};
