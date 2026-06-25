import { _sb } from '../config';

function _clearCacheIfNeeded(): void {
  if (typeof (window as any)._clearCache === 'function') {
    (window as any)._clearCache();
  }
}

export async function verifyTokenAction(params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await _sb.from('tokens').select('*').eq('token', params.token).maybeSingle();
  if (error || !data) return { ok: false, error: 'not found' };
  if (Date.now() > Number(data.expires_at)) return { ok: false, error: 'expired' };
  if (data.store_id) {
    (window as any).STORE_ID = data.store_id;
    _clearCacheIfNeeded();
  }
  return { ok: true, name: data.therapist_name };
}

export async function sendLineMessage(params: Record<string, any> = {}): Promise<any> {
  try {
    const LINE_PUSH = 'https://rzfprialypdoyklfwpyg.supabase.co/functions/v1/line-push';
    const res = await fetch(LINE_PUSH + '?action=sendLineMessage&userId=' + encodeURIComponent(params.userId) + '&message=' + encodeURIComponent(params.message || ''));
    const text = await res.text();
    try { return JSON.parse(text); } catch(e) { return { ok: true }; }
  } catch(e: any) {
    console.warn('LINE送信エラー:', e);
    return { ok: false, error: e.message };
  }
}
