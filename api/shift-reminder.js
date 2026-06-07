/**
 * Vercel Cron Job: シフト提出リマインド自動送信
 *
 * 毎時0分(UTC)に実行 → 各店舗の設定を確認 → 曜日・時刻が一致したら未提出セラピストにLINE通知
 *
 * 【Vercel環境変数の設定】(Dashboard > Settings > Environment Variables)
 *   SUPABASE_URL  : https://rzfprialypdoyklfwpyg.supabase.co
 *   SUPABASE_ANON : eyJhbGciOi...（Supabase anon key）
 *   CRON_SECRET   : 任意の文字列（Vercel Cron認証用）
 */

const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://rzfprialypdoyklfwpyg.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON || '';
const LINE_PUSH_URL = `${SUPABASE_URL}/functions/v1/line-push`;

// Supabase REST API ヘルパー
async function sbSelect(table, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    }
  });
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status}`);
  return res.json();
}

// 翌週の月〜日を計算（JST基準）
function getNextWeekRange(nowJST) {
  const day  = nowJST.getDay();
  const diff = (8 - day) % 7 || 7;
  const mon  = new Date(nowJST);
  mon.setDate(nowJST.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = d =>
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  return {
    monStr:    fmt(mon),
    sunStr:    fmt(sun),
    weekLabel: fmt(mon).replace(/-/g, '/') + '〜' + fmt(sun).replace(/-/g, '/')
  };
}

// LINE メッセージ送信
async function sendLine(userId, message) {
  const url = `${LINE_PUSH_URL}?action=sendLineMessage` +
    `&userId=${encodeURIComponent(userId)}` +
    `&message=${encodeURIComponent(message)}`;
  const res = await fetch(url);
  return res.ok;
}

// メインハンドラ
export default async function handler(req, res) {
  // Vercel Cron 認証
  const cronSecret = process.env.CRON_SECRET || '';
  const authHeader = req.headers['authorization'] || '';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 日本時間を算出（JST = UTC+9）
  const nowUTC  = new Date();
  const nowJST  = new Date(nowUTC.getTime() + 9 * 60 * 60 * 1000);
  const currentDay  = nowJST.getDay();
  const currentTime = `${String(nowJST.getHours()).padStart(2, '0')}:${String(nowJST.getMinutes()).padStart(2, '0')}`;

  console.log(`[shift-reminder] JST: 曜日=${currentDay} 時刻=${currentTime}`);

  const results = [];

  try {
    // 自動リマインドが有効な全店舗を取得
    const settings = await sbSelect(
      'store_settings',
      'shift_reminder_enabled=eq.true&select=store_id,shift_reminder_day,shift_reminder_time'
    );

    for (const s of settings) {
      const storeId    = s.store_id;
      const configDay  = Number(s.shift_reminder_day ?? 5);
      const configTime = s.shift_reminder_time || '09:00';

      // 曜日・時刻が一致しない店舗はスキップ
      if (configDay !== currentDay || configTime !== currentTime) {
        console.log(`[shift-reminder] ${storeId}: スキップ（設定=${configDay}曜 ${configTime}）`);
        continue;
      }

      try {
        const { monStr, sunStr, weekLabel } = getNextWeekRange(nowJST);

        // アクティブなセラピスト一覧
        const therapists = await sbSelect(
          'therapists',
          `store_id=eq.${storeId}&active=eq.true&select=name,line_user_id`
        );

        // 翌週のシフト提出済み一覧
        const shifts = await sbSelect(
          'shifts',
          `store_id=eq.${storeId}&date=gte.${monStr}&date=lte.${sunStr}&select=therapist_name`
        );
        const submittedSet = new Set(shifts.map(sh => sh.therapist_name));

        // 未提出・LINE登録済みのセラピストへ送信
        const targets = therapists.filter(
          t => t.name && t.name !== '管理者' && !submittedSet.has(t.name) && t.line_user_id
        );

        let sent = 0;
        for (const t of targets) {
          const msg =
            `【シフト提出リマインド】\n` +
            `${weekLabel}のシフトがまだ提出されていません。\n` +
            `LINEで「ログイン」と送信してシフトを提出してください。`;
          const ok = await sendLine(t.line_user_id, msg);
          if (ok) sent++;
          console.log(`[shift-reminder] ${t.name}: ${ok ? '✅' : '❌'}`);
        }

        results.push({ storeId, weekLabel, sent, total: targets.length });
        console.log(`[shift-reminder] ${storeId}: ${sent}/${targets.length}件送信`);
      } catch (storeErr) {
        console.error(`[shift-reminder] ${storeId} エラー:`, storeErr.message);
        results.push({ storeId, error: storeErr.message });
      }
    }

    // ── 未割り当て予約の30分前通知 ─────────────────────────────
    await checkUnassignedReservations(nowJST, results);

    return res.status(200).json({ ok: true, results, executedAt: currentTime });
  } catch (e) {
    console.error('[shift-reminder] エラー:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

/**
 * 30分後に未割り当て予約がある場合、店舗LINEに通知する
 */
async function checkUnassignedReservations(nowJST, results) {
  try {
    // 30分後の時刻帯（±5分の範囲でチェック）
    const target = new Date(nowJST.getTime() + 30 * 60 * 1000);
    const targetH = target.getHours();
    const targetM = target.getMinutes();

    // 検索範囲: 30分後 ±5分
    const rangeStart = new Date(target.getTime() - 5 * 60 * 1000);
    const rangeEnd   = new Date(target.getTime() + 5 * 60 * 1000);

    // 今日の日付（JST）
    const todayStr =
      nowJST.getFullYear() + '-' +
      String(nowJST.getMonth() + 1).padStart(2, '0') + '-' +
      String(nowJST.getDate()).padStart(2, '0');
    const tomorrowStr = (() => {
      const d = new Date(nowJST);
      d.setDate(d.getDate() + 1);
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    })();

    // 当日〜翌日の未割り当て予約を取得（27時ルール対応）
    const startISO = todayStr + 'T03:00:00+09:00';
    const endISO   = tomorrowStr + 'T02:59:59+09:00';

    const reservations = await sbSelect(
      'reservations',
      `is_unassigned=eq.true&status=eq.active` +
      `&date=gte.${encodeURIComponent(startISO)}` +
      `&date=lte.${encodeURIComponent(endISO)}` +
      `&select=id,store_id,customer_name,course_min,date`
    );

    if (!reservations.length) {
      console.log('[unassigned-check] 未割り当て予約なし');
      return;
    }

    // 30分後±5分の範囲内の予約のみ抽出
    const targets = reservations.filter(r => {
      const d = new Date(r.date);
      return d >= rangeStart && d <= rangeEnd;
    });

    if (!targets.length) {
      console.log('[unassigned-check] 30分前対象なし');
      return;
    }

    // 店舗ごとにグループ化して通知
    const byStore = {};
    targets.forEach(r => {
      if (!byStore[r.store_id]) byStore[r.store_id] = [];
      byStore[r.store_id].push(r);
    });

    for (const [storeId, resvList] of Object.entries(byStore)) {
      try {
        // 店舗設定からstore_line_nameを取得
        const settings = await sbSelect(
          'store_settings',
          `store_id=eq.${storeId}&select=store_line_name`
        );
        const storeLine = settings[0]?.store_line_name;
        if (!storeLine) {
          console.log(`[unassigned-check] ${storeId}: store_line_name未設定`);
          continue;
        }

        // store_line_nameに対応するセラピストのline_user_idを取得
        const therapists = await sbSelect(
          'therapists',
          `store_id=eq.${storeId}&name=eq.${encodeURIComponent(storeLine)}&select=line_user_id`
        );
        const userId = therapists[0]?.line_user_id;
        if (!userId) {
          console.log(`[unassigned-check] ${storeId}: store_line userId未取得`);
          continue;
        }

        // 通知メッセージ生成
        const lines = resvList.map(r => {
          const d = new Date(r.date);
          const h = d.getHours(), m = d.getMinutes();
          const timeStr = String(h < 3 ? h + 24 : h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
          return `・${timeStr}〜 ${r.course_min}分 ${r.customer_name || 'お客様'}`;
        }).join('
');

        const msg =
          `【⚠ 未割り当て予約 30分前】
` +
          `以下の予約がセラピスト未割り当てです。

` +
          `${lines}

` +
          `至急セラピストを割り当ててください。`;

        const ok = await sendLine(userId, msg);
        console.log(`[unassigned-check] ${storeId}: ${ok ? '✅' : '❌'} ${resvList.length}件`);
        results.push({ storeId, type: 'unassigned_alert', count: resvList.length, sent: ok });
      } catch (e) {
        console.error(`[unassigned-check] ${storeId} エラー:`, e.message);
      }
    }
  } catch (e) {
    console.error('[unassigned-check] エラー:', e.message);
  }
}