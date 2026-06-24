import { sb } from './supabase';
import { ctx } from './supabase';

export function fmtDatetimeJp(isoStr: string): string {
  if (!isoStr) return '';
  let normalized = isoStr;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(isoStr)) {
    normalized = isoStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return isoStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = d.getHours();
  if (h < 3) {
    const dPrev = new Date(d);
    dPrev.setDate(dPrev.getDate() - 1);
    return dPrev.getFullYear() + '/' + pad(dPrev.getMonth() + 1) + '/' + pad(dPrev.getDate())
      + ' ' + (24 + h) + ':' + pad(d.getMinutes());
  }
  return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate())
    + ' ' + pad(h) + ':' + pad(d.getMinutes());
}

export function fmtDateJp(isoStr: string): string {
  if (!isoStr) return '';
  return isoStr.substring(0, 10).replace(/-/g, '/');
}

export function fmtTimeJp(timeStr: string): string {
  return (timeStr || '').substring(0, 5);
}

export function normalizeTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  if (h >= 24) return String(h - 24).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  return timeStr.substring(0, 5);
}

export async function getTherapistId(name: string): Promise<string | null> {
  if (!name) return null;
  const { data } = await sb.from('therapists')
    .select('id').eq('store_id', ctx.storeId).eq('name', name).eq('active', true).maybeSingle();
  return data ? data.id : null;
}
