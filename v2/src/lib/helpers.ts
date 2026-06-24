// @ts-nocheck
// 日時・時刻ユーティリティ — 副作用なし・外部依存なし

export function _normalizeTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  if (h >= 24) return String(h - 24).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  return timeStr.substring(0, 5);
}

export function _timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function _timeLabel(timeStr, dateStr) {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

// ISO文字列を27時ルール対応でフォーマット（Supabaseからのtimestamptz用）
// TZなし文字列はUTC強制（末尾Zを付加）してからパース
export function _fmtDatetimeJp(isoStr) {
  if (!isoStr) return '';
  let normalized = isoStr;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(isoStr)) {
    normalized = isoStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(normalized);
  if (isNaN(d)) return isoStr;
  const pad = n => String(n).padStart(2,'0');
  const h = d.getHours();
  if (h < 3) {
    const dPrev = new Date(d);
    dPrev.setDate(dPrev.getDate() - 1);
    return dPrev.getFullYear() + '/' + pad(dPrev.getMonth()+1) + '/' + pad(dPrev.getDate())
      + ' ' + (24 + h) + ':' + pad(d.getMinutes());
  }
  return d.getFullYear() + '/' + pad(d.getMonth()+1) + '/' + pad(d.getDate())
    + ' ' + pad(h) + ':' + pad(d.getMinutes());
}

// ローカル日時文字列（"YYYY-MM-DDTHH:MM"）を27時ルール対応でフォーマット
// new Date()のTZずれを避けるため手動パース
export function _fmtLocalDatetimeJp(localStr) {
  if (!localStr) return '';
  const [datePart, timePart] = localStr.split('T');
  const [y, mo, dd] = (datePart || '').split('-').map(Number);
  const [h, mi] = (timePart || '').split(':').map(Number);
  if (!y || isNaN(h)) return localStr;
  const pad = n => String(n).padStart(2,'0');
  if (h < 3) {
    const prev = new Date(y, mo - 1, dd - 1);
    return prev.getFullYear() + '/' + pad(prev.getMonth()+1) + '/' + pad(prev.getDate())
      + ' ' + (24 + h) + ':' + pad(mi);
  }
  return y + '/' + pad(mo) + '/' + pad(dd) + ' ' + pad(h) + ':' + pad(mi);
}

export function _fmtDateJp(isoStr) {
  if (!isoStr) return '';
  return isoStr.substring(0, 10).replace(/-/g, '/');
}

export function _fmtTimeJp(timeStr) {
  return (timeStr || '').substring(0, 5);
}

// 時間文字列を分数に変換（27時ルール：00〜02時台は24+hとして扱う）
export function _timeToMin27(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h < 3 ? h + 24 : h) * 60 + (m || 0);
}
