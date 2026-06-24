import './style.css';
import { ctx, sb } from './lib/supabase';
import { renderPayrollPage, initPayroll } from './pages/payroll';
import { renderReservationPage, initReservation } from './pages/reservation';

// ── 認証状態 ──────────────────────────────────────────
let storeName = '';

export function showPage(name: string) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');

  document.querySelectorAll('#nav button').forEach(el => el.classList.remove('active'));
  const tab = document.getElementById('tab-' + name);
  if (tab) tab.classList.add('active');

  document.querySelectorAll('#bottom-nav button').forEach(el => el.classList.remove('active'));
  const bnav = document.getElementById('bnav-' + name);
  if (bnav) bnav.classList.add('active');

  // ページ初期化
  if (name === 'payroll')      initPayroll();
  if (name === 'reservation')  initReservation();
}

// ── シェルHTML ──────────────────────────────────────
function renderShell() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div id="overlay"><div class="spinner"></div><span>送信中...</span></div>

    <div id="login-page" style="display:none">
      <div style="max-width:360px;margin:60px auto;padding:16px">
        <div class="card" style="padding:32px;text-align:center">
          <div style="width:64px;height:64px;background:#06c755;border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M30 15.5C30 10.2 24.6 6 18 6S6 10.2 6 15.5c0 4.7 4.2 8.7 9.8 9.4.4.1.9.3 1 .6.1.3.1.7 0 1l-.2 1c0 .3-.2 1.2 1.1.7C19.1 27.6 27 22.5 27 15.5H30z" fill="white"/>
            </svg>
          </div>
          <div style="font-size:18px;font-weight:700;margin-bottom:12px">セラピスト用ログイン</div>
          <div style="color:var(--muted);font-size:13px;line-height:1.8;margin-bottom:24px">
            LINEで <strong style="color:var(--text)">「ログイン」</strong> と送信すると<br>ログイン用URLが届きます
          </div>
          <div id="login-status" style="font-size:13px;color:var(--accent);min-height:20px;white-space:pre-wrap;line-height:1.6"></div>
        </div>
      </div>
    </div>

    <div id="main-app" style="display:none">
      <div id="bottom-nav">
        <button id="bnav-my-reservations" onclick="window._app.showPage('my-reservations')">
          <span class="icon">📋</span>予約確認
        </button>
        <button id="bnav-shift-submit" onclick="window._app.showPage('shift-submit')">
          <span class="icon">📆</span>シフト
        </button>
        <button id="bnav-customer-list" onclick="window._app.showPage('customer-list')">
          <span class="icon">👥</span>顧客リスト
        </button>
        <button id="bnav-sales-input" onclick="window._app.showPage('sales-input')" style="display:none">
          <span class="icon">📝</span>売上入力
        </button>
        <button id="bnav-manual-view" onclick="window._app.showPage('manual-view')">
          <span class="icon">📖</span>マニュアル
        </button>
        <button id="bnav-checkout" onclick="window._app.showPage('checkout')">
          <span class="icon">🏁</span>退勤
        </button>
      </div>

      <div id="nav">
        <div id="store-name-badge" style="display:flex;align-items:center;padding:0 12px;font-size:11px;font-weight:700;color:#fff;background:var(--accent);white-space:nowrap;flex-shrink:0;height:var(--nav-h);border-right:1px solid rgba(255,255,255,0.15)">読込中...</div>
        <div id="line-usage-badge" style="display:none;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;margin:auto 4px;flex-shrink:0"></div>
        <button id="tab-payroll" onclick="window._app.showPage('payroll')">💰 給料</button>
        <button id="tab-sales-report" onclick="window._app.showPage('sales-report')">📊 売上確認</button>
        <button id="tab-reservation" onclick="window._app.showPage('reservation')">📅 予約</button>
        <button id="tab-shift-calendar" onclick="window._app.showPage('shift-calendar')">📅 シフト表</button>
        <button id="tab-therapist-profile" onclick="window._app.showPage('therapist-profile')" style="display:none">👩 セラピスト情報</button>
        <button id="tab-customer-master" onclick="window._app.showPage('customer-master')">👥 顧客マスタ</button>
        <button id="tab-master-mgmt" onclick="window._app.showPage('master-mgmt')">⚙ マスタ管理</button>
        <button id="tab-interview-mgmt" onclick="window._app.showPage('interview-mgmt')" style="display:none">🤝 面接管理</button>
        <button id="tab-line-mgmt" onclick="window._app.showPage('line-mgmt')" style="display:none">💬 LINE管理</button>
        <button id="tab-broadcast" onclick="window._app.showPage('broadcast')" style="display:none">📢 アナウンス</button>
        <button id="tab-scout" onclick="window._app.showPage('scout')" style="display:none">🔍 スカウト</button>
        <button onclick="location.href='supply.html'">📦 備品</button>
        <button id="tab-shift-submit" style="display:none">📆 シフト提出</button>
        <button id="tab-my-reservations" style="display:none">📋 予約確認</button>
        <button id="tab-sales-input" style="display:none">📝 売上入力</button>
      </div>

      <!-- ページコンテナ -->
      <div id="page-payroll" class="page">${renderPayrollPage()}</div>
      <div id="page-reservation" class="page">${renderReservationPage()}</div>
      <div id="page-sales-report" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">売上確認（実装中）</div></div>
      <div id="page-shift-calendar" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">シフト表（実装中）</div></div>
      <div id="page-customer-master" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">顧客マスタ（実装中）</div></div>
      <div id="page-master-mgmt" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">マスタ管理（実装中）</div></div>
      <div id="page-line-mgmt" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">LINE管理（実装中）</div></div>
      <div id="page-scout" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">スカウト（実装中）</div></div>
      <div id="page-my-reservations" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">予約確認（実装中）</div></div>
      <div id="page-shift-submit" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">シフト提出（実装中）</div></div>
      <div id="page-customer-list" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">顧客リスト（実装中）</div></div>
      <div id="page-sales-input" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">売上入力（実装中）</div></div>
      <div id="page-manual-view" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">マニュアル（実装中）</div></div>
      <div id="page-checkout" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">退勤（実装中）</div></div>
      <div id="page-therapist-profile" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">セラピスト情報（実装中）</div></div>
      <div id="page-interview-mgmt" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">面接管理（実装中）</div></div>
      <div id="page-broadcast" class="page"><div style="padding:40px;text-align:center;color:var(--muted)">アナウンス（実装中）</div></div>
    </div>
  `;
}

// ── 管理者モード起動 ──────────────────────────────────
async function startAdminMode(storeId: string) {
  ctx.storeId = storeId;
  document.getElementById('main-app')!.style.display = 'block';
  document.getElementById('login-page')!.style.display = 'none';

  // 店舗名取得
  try {
    const { data: store } = await sb.from('stores').select('name').eq('id', storeId).maybeSingle();
    storeName = store?.name || '店舗';
    const badge = document.getElementById('store-name-badge');
    if (badge) badge.textContent = storeName;
  } catch { /* ignore */ }

  // 管理者ナビ表示
  document.getElementById('nav')!.style.display = 'flex';
  const bNav = document.getElementById('bottom-nav')!;
  bNav.classList.remove('show');

  // 管理者タブ表示制御（現行と同じロジック）
  const show = (id: string) => { const el = document.getElementById(id); if (el) el.style.display = ''; };
  const KAMISU    = '33333333-0000-0000-0000-000000000003';

  show('tab-line-mgmt');
  show('tab-therapist-profile');
  show('tab-interview-mgmt');
  show('tab-broadcast');
  if (storeId === KAMISU) show('tab-scout');

  // LINE使用量バッジ
  try {
    const { data: tokenRow } = await sb.from('tokens')
      .select('line_message_count, line_message_limit')
      .eq('store_id', storeId).maybeSingle();
    if (tokenRow?.line_message_limit) {
      const badge = document.getElementById('line-usage-badge')!;
      const count = tokenRow.line_message_count || 0;
      const limit = tokenRow.line_message_limit;
      const pct   = count / limit;
      badge.textContent = `${count.toLocaleString()}/${limit.toLocaleString()}通`;
      badge.style.display = '';
      badge.style.background = pct >= 0.9 ? '#fef2f2' : pct >= 0.7 ? '#fef3c7' : '#f0fdf4';
      badge.style.color      = pct >= 0.9 ? '#dc2626' : pct >= 0.7 ? '#d97706' : '#16a34a';
    }
  } catch { /* ignore */ }

  showPage('payroll');
}

// ── セラピストモード起動 ──────────────────────────────
async function startTherapistMode(storeId: string, _name: string) {
  ctx.storeId = storeId;
  document.body.classList.add('therapist-mode');
  document.getElementById('main-app')!.style.display = 'block';
  document.getElementById('login-page')!.style.display = 'none';
  document.getElementById('nav')!.style.display = 'none';
  document.getElementById('bottom-nav')!.classList.add('show');

  // 店舗名取得
  try {
    const { data: store } = await sb.from('stores').select('name').eq('id', storeId).maybeSingle();
    storeName = store?.name || '店舗';
  } catch { /* ignore */ }

  showPage('my-reservations');
}

// ── 初期化 ──────────────────────────────────────────
async function init() {
  renderShell();

  const params = new URLSearchParams(location.search);
  const token   = params.get('token');
  const storeParam = params.get('store');
  const adminParam = params.get('admin');

  // 管理者: ?admin=1&store=xxx
  if (adminParam) {
    const storeId = storeParam || '11111111-0000-0000-0000-000000000001';
    await startAdminMode(storeId);
    return;
  }

  // セラピスト: ?token=xxx
  if (token) {
    document.getElementById('login-page')!.style.display = 'block';
    const statusEl = document.getElementById('login-status')!;
    statusEl.textContent = '確認中...';
    try {
      const { data: row } = await sb.from('tokens')
        .select('store_id, therapist_name, expires_at')
        .eq('token', token)
        .maybeSingle();
      if (!row) { statusEl.textContent = 'URLが無効または期限切れです'; return; }
      if (new Date(row.expires_at) < new Date()) { statusEl.textContent = 'URLの有効期限が切れています\nもう一度LINEで「ログイン」と送信してください'; return; }
      await startTherapistMode(row.store_id, row.therapist_name);
    } catch (e: any) {
      document.getElementById('login-status')!.textContent = 'エラー: ' + e.message;
    }
    return;
  }

  // デフォルト: 管理者（いわき店）
  const storeId = storeParam || '11111111-0000-0000-0000-000000000001';
  await startAdminMode(storeId);
}

// グローバル公開（onclick用）
(window as any)._app = { showPage };

init();
