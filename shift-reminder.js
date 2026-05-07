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

    return res.status(200).json({ ok: true, results, executedAt: currentTime });
  } catch (e) {
    console.error('[shift-reminder] エラー:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
