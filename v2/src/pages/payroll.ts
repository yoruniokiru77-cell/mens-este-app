import { sb, ctx } from '../lib/supabase';
import { getPayrollData } from '../services/salesService';
import { getStoreSettings } from '../services/storeService';
import { LINE_PUSH_URL } from '../lib/supabase';

// ── 状態 ──────────────────────────────────────────────
let currentDate = new Date();
currentDate.setHours(0, 0, 0, 0);

let _payrollData: any[] = [];
let _payrollConfirmations: Record<string, any> = {};
let _storeDropBalances: Record<string, number> = {};
let _payrollExpenses: Record<string, Record<string, number>> = {};

// ── HTML ──────────────────────────────────────────────
export function renderPayrollPage(): string {
  return `
    <!-- サブタブ -->
    <div style="display:flex;gap:0;margin-bottom:12px;border-bottom:2px solid var(--border);align-items:flex-end">
      <button id="ptab-payroll"
        style="padding:8px 18px;font-size:13px;font-weight:500;border:none;background:none;cursor:pointer;color:var(--accent);border-bottom:2px solid var(--accent);margin-bottom:-2px"
        onclick="window._payroll.switchTab('payroll')">💰 給料計算</button>
      <button id="ptab-collection"
        style="padding:8px 18px;font-size:13px;font-weight:500;border:none;background:none;cursor:pointer;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px"
        onclick="window._payroll.switchTab('collection')">💵 回収管理</button>
      <div style="flex:1"></div>
    </div>

    <!-- 給料計算エリア -->
    <div id="payroll-area">
      <div class="date-nav">
        <button onclick="window._payroll.changeDay(-1)">◀</button>
        <span id="payroll-day-label"></span>
        <button onclick="window._payroll.changeDay(1)">▶</button>
        <button class="btn btn-secondary btn-sm" onclick="window._payroll.goToday()">今日</button>
        <button class="btn btn-secondary btn-sm" onclick="window._payroll.load()">更新</button>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px;padding:10px 12px;background:var(--bg);border:1.5px solid var(--border);border-radius:10px">
        <span style="font-size:13px;font-weight:600;color:var(--muted)">LINE送信オプション</span>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
          <span class="toggle-switch" style="width:36px;height:20px">
            <input type="checkbox" id="payroll-detail-toggle">
            <span class="toggle-slider"></span>
          </span>
          明細を含める
        </label>
        <span id="payroll-line-flags" style="font-size:12px;color:var(--muted);margin-left:auto">読み込み中...</span>
      </div>
      <div id="payroll-cards" class="grid2"></div>
      <div id="payroll-details"></div>
    </div>

    <!-- 回収管理エリア -->
    <div id="collection-area" style="display:none">
      <div style="padding:40px;text-align:center;color:var(--muted)">回収管理（実装中）</div>
    </div>

    <!-- 給料明細モーダル -->
    <div id="payroll-preview-modal" class="modal-overlay">
      <div class="modal-inner">
        <div style="background:var(--surface);border-radius:var(--radius-lg);padding:20px;width:100%;max-width:900px;max-height:90vh;overflow-y:auto">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div id="payroll-preview-title" style="font-size:16px;font-weight:700"></div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-line btn-sm" onclick="window._payroll.sendFromPreview()">LINE送信</button>
              <button class="btn btn-secondary btn-sm" onclick="window._payroll.closePreview()">閉じる</button>
            </div>
          </div>
          <div id="payroll-preview-body"></div>
        </div>
      </div>
    </div>
  `;
}

// ── 日付フォーマット ───────────────────────────────────
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function updateDayLabel() {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dow = days[currentDate.getDay()];
  const label = `${currentDate.getFullYear()}/${String(currentDate.getMonth()+1).padStart(2,'0')}/${String(currentDate.getDate()).padStart(2,'0')} (${dow})`;
  const el = document.getElementById('payroll-day-label');
  if (el) el.textContent = label;
}

// ── データ読み込み ─────────────────────────────────────
async function load() {
  updateDayLabel();
  const dateStr = fmtDate(currentDate);
  const cardsEl = document.getElementById('payroll-cards');
  if (!cardsEl) return;
  cardsEl.innerHTML = '<p style="color:var(--muted)">読み込み中...</p>';

  // LINE送信フラグ表示
  try {
    const s = await getStoreSettings();
    const flagEl = document.getElementById('payroll-line-flags');
    if (flagEl) {
      const payFlag   = s.send_payroll_line !== false ? '💰 給料送信ON' : '💰 給料送信OFF';
      const storeFlag = s.send_store_line   !== false ? '🏪 店落ち送信ON' : '🏪 店落ち送信OFF';
      flagEl.innerHTML =
        `<span style="color:${s.send_payroll_line !== false ? 'var(--success)' : 'var(--muted)'}">${payFlag}</span>
         <span style="margin:0 4px">／</span>
         <span style="color:${s.send_store_line !== false ? 'var(--success)' : 'var(--muted)'}">${storeFlag}</span>`;
    }
  } catch { /* ignore */ }

  try {
    const data = await getPayrollData({ startDate: dateStr, endDate: dateStr });

    // 給料確認ステータス
    _payrollConfirmations = {};
    try {
      const { data: confs } = await sb.from('payroll_confirmations')
        .select('therapist_name, sent_at, confirmed_at')
        .eq('store_id', ctx.storeId)
        .eq('period', dateStr.replace(/-/g, '/'));
      (confs || []).forEach((c: any) => { _payrollConfirmations[c.therapist_name] = c; });
    } catch { /* ignore */ }

    // 店落ち繰越残高
    _storeDropBalances = {};
    try {
      const { data: balances } = await sb.from('store_drop_balance')
        .select('therapist_name, balance')
        .eq('store_id', ctx.storeId);
      (balances || []).forEach((b: any) => { _storeDropBalances[b.therapist_name] = b.balance || 0; });
    } catch { /* ignore */ }

    // 雑費
    _payrollExpenses = {};
    try {
      const { data: expData } = await sb.from('expenses')
        .select('therapist_name, category, amount')
        .eq('store_id', ctx.storeId)
        .eq('date', dateStr);
      (expData || []).forEach((e: any) => {
        if (!_payrollExpenses[e.therapist_name]) _payrollExpenses[e.therapist_name] = {};
        _payrollExpenses[e.therapist_name][e.category] = e.amount;
      });
    } catch { /* ignore */ }

    _payrollData = data;
    renderCards(data);
  } catch (e: any) {
    cardsEl.innerHTML = `<p style="color:red">${e.message}</p>`;
  }
}

// ── カードレンダリング ─────────────────────────────────
function renderCards(data: any[]) {
  const cardsEl   = document.getElementById('payroll-cards')!;
  const detailsEl = document.getElementById('payroll-details')!;

  if (!data || !data.length) {
    cardsEl.innerHTML = '<p style="color:var(--muted)">この日の予約データはありません</p>';
    detailsEl.innerHTML = '';
    return;
  }

  const byDate: Record<string, any[]> = {};
  data.forEach(t => {
    if (!byDate[t.dateLabel]) byDate[t.dateLabel] = [];
    byDate[t.dateLabel].push(t);
  });

  const days = ['日', '月', '火', '水', '木', '金', '土'];

  cardsEl.className = '';
  cardsEl.innerHTML = Object.keys(byDate).sort().map(dateLabel => {
    const list = byDate[dateLabel];
    const [y, mo, d] = dateLabel.split('-').map(Number);
    const dt   = new Date(y, mo - 1, d);
    const dow  = days[dt.getDay()];
    const dateDisp = dateLabel.replace(/-/g, '/') + '(' + dow + ')';
    const dayPay   = list.reduce((s: number, t: any) => s + t.pay, 0);
    const dayStore = list.reduce((s: number, t: any) => s + t.storeDrop, 0);

    return `
    <div style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:0 2px">
        <span style="font-size:15px;font-weight:700;color:var(--text)">${dateDisp}</span>
        <span style="font-size:12px;color:var(--muted)">日計 給料 ¥${dayPay.toLocaleString()} / 店落ち ¥${dayStore.toLocaleString()}</span>
      </div>
      <div class="grid2">
        ${list.map((t: any, idx: number) => {
          const uid = dateLabel.replace(/-/g, '') + '_t' + idx;
          const bal = _storeDropBalances[t.name] || 0;
          const balLabel = bal < 0
            ? `<span style="color:#dc2626;font-weight:700">前回${Math.abs(bal).toLocaleString()}円不足</span>`
            : bal > 0
            ? `<span style="color:#059669;font-weight:700">前回${bal.toLocaleString()}円過払い</span>`
            : '<span style="color:var(--muted)">繰越なし</span>';
          const conf = _payrollConfirmations[t.name];
          const confBadge = !conf ? '' : conf.confirmed_at
            ? (() => { const d = new Date(conf.confirmed_at); return `<span style="font-size:11px;color:var(--success);font-weight:600">✅ ${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}</span>`; })()
            : '<span style="font-size:11px;color:var(--warning);font-weight:600">⏳ 未確認</span>';

          return `
          <div class="card therapist-card">
            <div style="font-weight:700;font-size:15px;margin-bottom:10px">${t.name}</div>
            <div class="grid3" style="margin-bottom:10px">
              <div>
                <div class="card-title">給料</div>
                <div class="card-value pay" id="pay-${uid}">¥${t.pay.toLocaleString()}</div>
                ${t.parkingFee > 0 ? '<div style="font-size:10px;color:#0369a1;font-weight:600;margin-top:2px">🚗 パーキング代含む</div>' : ''}
              </div>
              <div>
                <div class="card-title">店落ち</div>
                <div class="card-value store" id="store-${uid}">¥${t.storeDrop.toLocaleString()}</div>
                ${t.parkingFee > 0 ? '<div style="font-size:10px;color:#0369a1;font-weight:600;margin-top:2px">🚗 パーキング代含む</div>' : ''}
              </div>
              <div>
                <div class="card-title">件数</div>
                <div class="card-value">${t.count}件</div>
              </div>
            </div>

            <!-- 雑費 -->
            <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
              ${feeRow(uid, 'misc', '雑費', dateLabel)}
              ${feeRow(uid, 'accom', '宿泊費', dateLabel)}
              <label id="other-label-${uid}" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px">
                <span class="toggle-switch" style="width:36px;height:20px;flex-shrink:0">
                  <input type="checkbox" id="other-${uid}"
                    onchange="window._payroll.recalc('${uid}','${t.name}','${dateLabel}')">
                  <span class="toggle-slider"></span>
                </span>
                <span style="font-size:13px;flex-shrink:0">その他</span>
                <div style="display:flex;align-items:center;gap:4px;margin-left:auto">
                  <button type="button" id="other-sign-${uid}"
                    onclick="window._payroll.toggleSign('${uid}')"
                    style="width:32px;height:32px;border:1.5px solid var(--border);border-radius:6px;font-size:16px;font-weight:700;background:var(--surface);cursor:pointer;flex-shrink:0">+</button>
                  <input type="number" id="other-amt-${uid}" value="0" step="100" min="0"
                    style="width:80px;padding:4px 6px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;text-align:right"
                    oninput="window._payroll.recalc('${uid}','${t.name}','${dateLabel}')">
                  <span style="font-size:12px;color:var(--muted);flex-shrink:0">円</span>
                </div>
              </label>
            </div>

            <!-- 店落ち繰越 -->
            <div style="margin-bottom:10px;padding:10px;background:#fafafa;border:1.5px solid var(--border);border-radius:8px">
              <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px">🔄 店落ち繰越</div>
              <div style="font-size:13px;margin-bottom:8px">現在: ${balLabel}</div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <div style="font-size:12px;color:var(--muted)">次回繰越入力</div>
                <input type="number" id="sdb-${uid}" value="${bal}" step="100"
                  style="width:90px;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:14px;text-align:right;font-weight:700">
                <span style="font-size:12px;color:var(--muted)">円</span>
                <button class="btn btn-secondary btn-sm" onclick="window._payroll.saveBalance('${t.name}','${uid}')">保存</button>
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:6px">-は不足（次回上乗せ）、+は過払い（次回差引）</div>
            </div>

            <!-- ボタン -->
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              <button class="btn btn-secondary btn-sm" onclick="window._payroll.copy('${uid}','${t.name}','${dateLabel}','pay')">💴 給料</button>
              <button class="btn btn-secondary btn-sm" onclick="window._payroll.copy('${uid}','${t.name}','${dateLabel}','store')">🏪 店落ち</button>
              <button class="btn btn-secondary btn-sm" onclick="window._payroll.openPreview('${uid}','${t.name}','${dateLabel}')">📊 明細</button>
              <button class="btn btn-line btn-sm" onclick="window._payroll.sendLine('${uid}','${t.name}','${dateLabel}')">LINE送信</button>
              <span id="payconf-${uid}">${confBadge}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  detailsEl.innerHTML = '';
  restoreExpenses(data);
}

function feeRow(uid: string, key: string, label: string, dateLabel: string): string {
  const name = uid.split('_t')[0]; // unused but kept for signature consistency
  return `
  <label id="${key}-label-${uid}" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px">
    <span class="toggle-switch" style="width:36px;height:20px;flex-shrink:0">
      <input type="checkbox" id="${key}-${uid}"
        onchange="window._payroll.recalc('${uid}','${name}','${dateLabel}');this.closest('label').style.background=this.checked?'#fef3c7':'';this.closest('label').style.borderColor=this.checked?'#f59e0b':'var(--border)'">
      <span class="toggle-slider"></span>
    </span>
    <span style="font-size:13px;flex-shrink:0">${label}</span>
    <div style="display:flex;align-items:center;gap:4px;margin-left:auto">
      <input type="number" id="${key}-amt-${uid}" value="0" min="0" step="100"
        style="width:80px;padding:4px 6px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;text-align:right"
        oninput="window._payroll.recalc('${uid}','${name}','${dateLabel}')">
      <span style="font-size:12px;color:var(--muted);flex-shrink:0">円</span>
    </div>
  </label>`;
}

function restoreExpenses(data: any[]) {
  data.forEach((t: any, idx: number) => {
    const uid = t.dateLabel.replace(/-/g, '') + '_t' + idx;
    const exps = _payrollExpenses[t.name] || {};

    const restore = (key: string, cat: string) => {
      const amt = exps[cat];
      if (!amt) return;
      const chk = document.getElementById(key + '-' + uid) as HTMLInputElement | null;
      const amtEl = document.getElementById(key + '-amt-' + uid) as HTMLInputElement | null;
      if (chk) { chk.checked = true; chk.dispatchEvent(new Event('change')); }
      if (amtEl) { amtEl.value = String(amt); amtEl.dispatchEvent(new Event('input')); }
    };
    restore('misc', 'misc');
    restore('accom', 'accommodation');

    const otherAmt = exps['other'];
    if (otherAmt) {
      const otherAmtEl = document.getElementById('other-amt-' + uid) as HTMLInputElement | null;
      const otherSignEl = document.getElementById('other-sign-' + uid) as HTMLButtonElement | null;
      if (otherAmtEl) {
        otherAmtEl.value = String(Math.abs(otherAmt));
        if (otherAmt < 0 && otherSignEl && otherSignEl.textContent === '+') otherSignEl.click();
        otherAmtEl.dispatchEvent(new Event('input'));
      }
    }
  });
}

// ── 再計算 ────────────────────────────────────────────
function recalc(uid: string, name: string, dateLabel: string) {
  const get = (id: string) => document.getElementById(id);
  const miscFee  = (get('misc-' + uid) as HTMLInputElement)?.checked  ? Number((get('misc-amt-' + uid) as HTMLInputElement)?.value  || 0) : 0;
  const accomFee = (get('accom-' + uid) as HTMLInputElement)?.checked ? Number((get('accom-amt-' + uid) as HTMLInputElement)?.value || 0) : 0;
  const otherChk = (get('other-' + uid) as HTMLInputElement)?.checked;
  const otherAmt = Number((get('other-amt-' + uid) as HTMLInputElement)?.value || 0);
  const sign     = (get('other-sign-' + uid) as HTMLButtonElement)?.textContent === '+' ? 1 : -1;
  const otherFee = otherChk ? sign * otherAmt : 0;

  const t = _payrollData.find(d => d.name === name && d.dateLabel === dateLabel);
  if (!t) return;

  const newPay   = t.pay   - miscFee - accomFee - otherFee;
  const newStore = t.storeDrop + miscFee + accomFee + otherFee;

  const payEl   = get('pay-'   + uid);
  const storeEl = get('store-' + uid);
  if (payEl)   payEl.textContent   = '¥' + newPay.toLocaleString();
  if (storeEl) storeEl.textContent = '¥' + newStore.toLocaleString();
}

function toggleSign(uid: string) {
  const btn = document.getElementById('other-sign-' + uid) as HTMLButtonElement | null;
  if (!btn) return;
  btn.textContent = btn.textContent === '+' ? '-' : '+';
  btn.style.color = btn.textContent === '-' ? '#dc2626' : '';
}

// ── コピー ────────────────────────────────────────────
async function copy(uid: string, name: string, dateLabel: string, type: 'pay' | 'store') {
  const payEl   = document.getElementById('pay-'   + uid);
  const storeEl = document.getElementById('store-' + uid);
  const pay   = payEl?.textContent?.trim()   || '¥0';
  const store = storeEl?.textContent?.trim() || '¥0';
  const text  = type === 'pay'
    ? `${dateLabel} ${name}\n給料：${pay}`
    : `${dateLabel} ${name}\n店落ち：${store}`;
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 コピーしました');
  } catch {
    showToast('コピーに失敗しました');
  }
}

// ── 明細モーダル ──────────────────────────────────────
let _previewUid = '', _previewName = '', _previewDate = '';

function openPreview(uid: string, name: string, dateLabel: string) {
  _previewUid = uid; _previewName = name; _previewDate = dateLabel;

  const tData = _payrollData.find(d => d.name === name && d.dateLabel === dateLabel);
  const details = (tData?.details || []).filter((d: any) => !d.isGuarantee);

  const totCBack   = details.reduce((s: number, d: any) => s + (d.therapistCoursePay || 0), 0);
  const totExt     = details.reduce((s: number, d: any) => s + (d.therapistExtPay || 0), 0);
  const totOptOnly = details.reduce((s: number, d: any) => s + ((d.therapistOptPay || 0) - (d.therapistExtPay || 0)), 0);
  const totNom     = details.reduce((s: number, d: any) => s + (d.nominationFee || 0), 0);
  const totStore   = details.reduce((s: number, d: any) => s + d.storeDrop, 0);
  const totPrice   = details.reduce((s: number, d: any) => s + d.price, 0);

  const payEl      = document.getElementById('pay-'   + uid);
  const storeEl    = document.getElementById('store-' + uid);
  const finalPay   = payEl?.textContent?.trim()   || '¥0';
  const finalStore = storeEl?.textContent?.trim() || '¥0';

  const rows = details.map((d: any) => {
    const nomLabel  = d.nomination === 'honshimei' ? '本指名' : d.nomination === 'nomination' ? '指名' : 'フリー';
    const discStr   = d.discount > 0 ? `<span style="color:#dc2626;font-size:10px"> -¥${d.discount.toLocaleString()}</span>` : '';
    const optOnly   = (d.therapistOptPay || 0) - (d.therapistExtPay || 0);
    return `
      <tr style="border-top:1px solid var(--border)">
        <td style="padding:7px 6px;font-size:13px;white-space:nowrap">${d.date}</td>
        <td style="padding:7px 6px;font-size:13px">${d.course}分<br><span style="font-size:10px;color:var(--muted)">${nomLabel}</span></td>
        <td style="padding:7px 6px;font-size:13px">${d.customer || '-'}</td>
        <td style="padding:7px 6px;font-size:13px;text-align:right">¥${d.price.toLocaleString()}${discStr}</td>
        <td style="padding:7px 6px;font-size:13px;text-align:right;color:var(--muted)">¥${(d.therapistCoursePay || 0).toLocaleString()}</td>
        <td style="padding:7px 6px;font-size:13px;text-align:right;color:var(--success)">${optOnly > 0 ? '¥' + optOnly.toLocaleString() : '-'}</td>
        <td style="padding:7px 6px;font-size:13px;text-align:right;color:var(--muted)">${d.nominationFee > 0 ? '¥' + d.nominationFee.toLocaleString() : '-'}</td>
        <td style="padding:7px 6px;font-size:13px;text-align:right;color:var(--success)">${d.therapistExtPay ? '¥' + d.therapistExtPay.toLocaleString() : '-'}</td>
        <td style="padding:7px 6px;font-size:13px;text-align:right;font-weight:600">¥${d.storeDrop.toLocaleString()}</td>
      </tr>`;
  }).join('');

  const titleEl = document.getElementById('payroll-preview-title');
  const bodyEl  = document.getElementById('payroll-preview-body');
  if (titleEl) titleEl.textContent = `${name} / ${dateLabel}`;
  if (bodyEl) bodyEl.innerHTML = `
    <div style="margin-bottom:14px;padding:10px 12px;background:#f0f9ff;border-radius:8px;font-size:13px;display:flex;gap:16px;flex-wrap:wrap">
      <span>給料（確定）: <strong style="font-size:15px">${finalPay}</strong></span>
      <span>店落ち（確定）: <strong style="font-size:15px">${finalStore}</strong></span>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--bg)">
            <th style="padding:7px 6px;text-align:left;font-size:11px;color:var(--muted)">時刻</th>
            <th style="padding:7px 6px;text-align:left;font-size:11px;color:var(--muted)">コース</th>
            <th style="padding:7px 6px;text-align:left;font-size:11px;color:var(--muted)">お客様</th>
            <th style="padding:7px 6px;text-align:right;font-size:11px;color:var(--muted)">合計金額</th>
            <th style="padding:7px 6px;text-align:right;font-size:11px;color:var(--muted)">コースバック</th>
            <th style="padding:7px 6px;text-align:right;font-size:11px;color:var(--muted)">OPT給料</th>
            <th style="padding:7px 6px;text-align:right;font-size:11px;color:var(--muted)">指名料</th>
            <th style="padding:7px 6px;text-align:right;font-size:11px;color:var(--muted)">延長給料</th>
            <th style="padding:7px 6px;text-align:right;font-size:11px;color:var(--muted)">店落ち</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="9" style="padding:16px;text-align:center;color:var(--muted)">明細なし</td></tr>'}</tbody>
        <tfoot>
          <tr style="border-top:2px solid var(--border);background:var(--bg)">
            <td colspan="3" style="padding:8px 6px;font-size:12px;font-weight:700;color:var(--muted)">${details.length}件合計</td>
            <td style="padding:8px 6px;text-align:right;font-weight:700">¥${totPrice.toLocaleString()}</td>
            <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--muted)">¥${totCBack.toLocaleString()}</td>
            <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--success)">${totOptOnly > 0 ? '¥' + totOptOnly.toLocaleString() : '-'}</td>
            <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--muted)">${totNom > 0 ? '¥' + totNom.toLocaleString() : '-'}</td>
            <td style="padding:8px 6px;text-align:right;font-weight:700;color:var(--success)">${totExt > 0 ? '¥' + totExt.toLocaleString() : '-'}</td>
            <td style="padding:8px 6px;text-align:right;font-weight:700">¥${totStore.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;

  const modal = document.getElementById('payroll-preview-modal');
  if (modal) modal.classList.add('show');
}

function closePreview() {
  const modal = document.getElementById('payroll-preview-modal');
  if (modal) modal.classList.remove('show');
}

// ── LINE送信 ──────────────────────────────────────────
async function sendLine(uid: string, name: string, dateLabel: string) {
  const payEl   = document.getElementById('pay-'   + uid);
  const storeEl = document.getElementById('store-' + uid);
  const payText   = payEl?.textContent?.trim()   || '¥0';
  const storeText = storeEl?.textContent?.trim() || '¥0';

  const showDetail = (document.getElementById('payroll-detail-toggle') as HTMLInputElement)?.checked;

  const t = _payrollData.find(d => d.name === name && d.dateLabel === dateLabel);
  if (!t?.lineId) { showToast('LINEが登録されていません'); return; }

  const bal = _storeDropBalances[name] || 0;
  const balLine = bal < 0
    ? `前回${Math.abs(bal).toLocaleString()}円不足\n`
    : bal > 0
    ? `前回${bal.toLocaleString()}円過払い\n`
    : '';

  let msg = `【給与明細】${t.storeName || ''}\n${dateLabel}\n\n給料：${payText}\n店落ち：${storeText}\n`;
  if (balLine) msg += balLine;

  if (showDetail && t.details?.length) {
    msg += '\n--- 明細 ---\n';
    t.details.filter((d: any) => !d.isGuarantee).forEach((d: any) => {
      msg += `${d.date} ${d.course}分 給料¥${(d.therapistCoursePay || 0).toLocaleString()} 店落¥${d.storeDrop.toLocaleString()}\n`;
    });
  }

  msg += '\n確認したらLINEで「確認」と返信してください。';

  try {
    await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: t.lineId, messages: [{ type: 'text', text: msg }] }),
    });

    // 送信記録
    await sb.from('payroll_confirmations').upsert({
      store_id:       ctx.storeId,
      therapist_name: name,
      period:         dateLabel.replace(/-/g, '/'),
      sent_at:        new Date().toISOString(),
      store_drop:     Number(storeText.replace(/[¥,]/g, '')) || 0,
    }, { onConflict: 'store_id,therapist_name,period' });

    showToast('LINE送信しました');
  } catch (e: any) {
    showToast('送信エラー: ' + e.message);
  }
}

async function sendFromPreview() {
  closePreview();
  await sendLine(_previewUid, _previewName, _previewDate);
}

// ── 繰越保存 ──────────────────────────────────────────
async function saveBalance(therapistName: string, uid: string) {
  const el = document.getElementById('sdb-' + uid) as HTMLInputElement | null;
  const bal = parseInt(el?.value || '0') || 0;
  try {
    await sb.from('store_drop_balance').upsert({
      store_id:       ctx.storeId,
      therapist_name: therapistName,
      balance:        bal,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'store_id,therapist_name' });
    _storeDropBalances[therapistName] = bal;
    showToast('繰越残高を保存しました');
  } catch (e: any) {
    showToast('保存エラー: ' + e.message);
  }
}

// ── タブ切替 ──────────────────────────────────────────
function switchTab(tab: 'payroll' | 'collection') {
  const payrollArea    = document.getElementById('payroll-area')!;
  const collectionArea = document.getElementById('collection-area')!;
  const ptabPayroll    = document.getElementById('ptab-payroll')!;
  const ptabCollection = document.getElementById('ptab-collection')!;

  if (tab === 'payroll') {
    payrollArea.style.display    = '';
    collectionArea.style.display = 'none';
    ptabPayroll.style.color        = 'var(--accent)';
    ptabPayroll.style.borderBottom = '2px solid var(--accent)';
    ptabCollection.style.color        = 'var(--muted)';
    ptabCollection.style.borderBottom = '2px solid transparent';
  } else {
    payrollArea.style.display    = 'none';
    collectionArea.style.display = '';
    ptabPayroll.style.color        = 'var(--muted)';
    ptabPayroll.style.borderBottom = '2px solid transparent';
    ptabCollection.style.color        = 'var(--accent)';
    ptabCollection.style.borderBottom = '2px solid var(--accent)';
  }
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg: string) {
  const existing = document.getElementById('_toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = '_toast';
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
    background: '#0f172a', color: '#fff', padding: '10px 20px',
    borderRadius: '8px', fontSize: '14px', zIndex: '99999',
    animation: 'slideUp .3s ease',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ── 公開API ───────────────────────────────────────────
export function initPayroll() {
  updateDayLabel();
  load();
}

// グローバル公開（onclick用）
(window as any)._payroll = {
  load,
  changeDay: (delta: number) => { currentDate.setDate(currentDate.getDate() + delta); updateDayLabel(); load(); },
  goToday:   () => { currentDate = new Date(); currentDate.setHours(0,0,0,0); updateDayLabel(); load(); },
  recalc,
  toggleSign,
  copy,
  openPreview,
  closePreview,
  sendLine,
  sendFromPreview,
  saveBalance,
  switchTab,
};
