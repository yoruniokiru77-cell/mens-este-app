import { sb, ctx } from '../lib/supabase';
import { fmtDatetimeJp } from '../lib/helpers';
import { getTherapistId } from '../lib/helpers';

export async function getReservations(date: string) {
  const from = date + 'T03:00:00+09:00';
  const nextDate = new Date(date + 'T00:00:00+09:00');
  nextDate.setDate(nextDate.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const nextStr = nextDate.getFullYear() + '-' + pad(nextDate.getMonth() + 1) + '-' + pad(nextDate.getDate());
  const to = nextStr + 'T02:59:59+09:00';

  const { data, error } = await sb.from('reservations')
    .select('*, therapists!reservations_therapist_id_fkey(interval_min)')
    .eq('store_id', ctx.storeId)
    .gte('date', from).lte('date', to)
    .order('date');
  if (error) throw new Error(error.message);
  const rows = data || [];

  const allTels = [...new Set(rows.map((r: any) => r.customer_tel).filter(Boolean))];
  const visitByTherapist: Record<string, number>      = {};
  const visitByTherapistMonth: Record<string, number> = {};
  const visitTotalByTel: Record<string, number>       = {};

  if (allTels.length) {
    const nowMonth = date.slice(0, 7);
    const countedKeys     = new Set<string>();
    const countedDayKeys  = new Set<string>();
    const { data: resvHist } = await sb.from('reservations')
      .select('customer_tel, therapist_name, date')
      .eq('store_id', ctx.storeId)
      .neq('status', 'cancelled')
      .in('customer_tel', allTels);
    (resvHist || []).forEach((r: any) => {
      const tel = r.customer_tel || '';
      if (!tel || !r.therapist_name) return;
      const dayKey = (r.date || '').slice(0, 10) + '_' + r.therapist_name + '_' + tel;
      if (countedKeys.has(dayKey)) return;
      countedKeys.add(dayKey);
      const key = tel + '_' + r.therapist_name;
      visitByTherapist[key] = (visitByTherapist[key] || 0) + 1;
      if (r.date && r.date.slice(0, 7) === nowMonth) {
        visitByTherapistMonth[key] = (visitByTherapistMonth[key] || 0) + 1;
      }
      const totalDayKey = (r.date || '').slice(0, 10) + '_' + tel;
      if (!countedDayKeys.has(totalDayKey)) {
        countedDayKeys.add(totalDayKey);
        visitTotalByTel[tel] = (visitTotalByTel[tel] || 0) + 1;
      }
    });
  }

  return rows.map((r: any) => ({
    row:        r.id,
    date:       fmtDatetimeJp(r.date),
    rawDate:    r.date,
    therapist:  r.therapist_name || '',
    course:     r.course_min || 60,
    customer:   r.customer_name || '',
    price:      r.price || 0,
    discount:   r.discount || 0,
    nomination: r.nomination || 'free',
    customerNo: r.customer_no || '',
    tel:        r.customer_tel || '',
    coursePrice:     r.course_price || 0,
    optionPrice:     r.option_price || 0,
    nominationFee:   r.nomination_fee || 0,
    status:          r.status || 'active',
    isNewCustomer: (() => {
      const tel = r.customer_tel || '';
      return r.is_new_customer || (tel ? (visitTotalByTel[tel] || 0) === 1 : false);
    })(),
    isHime:             r.is_hime || false,
    isHimeApproved:     r.is_hime_approved || false,
    therapistConfirmed: r.therapist_confirmed || false,
    visitCount:        (() => { const t = r.customer_tel || ''; return t ? (visitByTherapist[t + '_' + r.therapist_name] || 0) : 0; })(),
    monthlyVisitCount: (() => { const t = r.customer_tel || ''; return t ? (visitByTherapistMonth[t + '_' + r.therapist_name] || 0) : 0; })(),
    memo:         r.memo || '',
    isUnassigned: r.is_unassigned || false,
    id:           r.id,
    _id:          r.id,
  }));
}

export async function addReservation(params: Record<string, any>) {
  let isNewCustomer = false;
  const custTel = (params.tel || '').replace(/[-\s]/g, '');
  try {
    if (custTel) {
      const { data: prevSales } = await sb.from('sales')
        .select('id').eq('store_id', ctx.storeId).eq('customer_tel', custTel).limit(1);
      isNewCustomer = !prevSales || prevSales.length === 0;
    } else {
      isNewCustomer = true;
    }
  } catch { isNewCustomer = false; }

  const _isUnassigned = params.therapist === '__unassigned__';
  const { error } = await sb.from('reservations').insert({
    store_id:        ctx.storeId,
    therapist_name:  _isUnassigned ? null : params.therapist,
    therapist_id:    _isUnassigned ? null : await getTherapistId(params.therapist),
    customer_name:   params.customer,
    customer_no:     params.customerNo || '',
    customer_tel:    params.tel || '',
    date:            new Date(params.date).toISOString(),
    course_min:      Number(params.course),
    price:           Number(params.price),
    course_price:    Number(params.coursePrice || params.price),
    option_price:    Number(params.optionPrice || 0),
    nomination_fee:  Number(params.nominationFee || 0),
    discount:        Number(params.discount || 0),
    nomination:      params.nomination || 'free',
    is_new_customer: isNewCustomer,
    is_unassigned:   _isUnassigned,
    memo:            params.memo || null,
  });
  if (error) throw new Error(error.message);
  return { ok: true, isNewCustomer };
}

export async function updateReservation(params: Record<string, any>) {
  const { error } = await sb.from('reservations').update({
    therapist_name: params.therapist,
    therapist_id:   await getTherapistId(params.therapist),
    customer_name:  params.customer,
    customer_no:    params.customerNo || '',
    date:           new Date(params.date).toISOString(),
    course_min:     Number(params.course),
    price:          Number(params.price),
    course_price:   Number(params.coursePrice || params.price),
    option_price:   Number(params.optionPrice || 0),
    nomination_fee: Number(params.nominationFee || 0),
    discount:       Number(params.discount || 0),
    nomination:     params.nomination || 'free',
    memo:           params.memo || null,
  }).eq('id', params.row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteReservation(id: string) {
  const { error } = await sb.from('reservations').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function cancelReservation(params: { row: string; reason?: string }) {
  const upd: Record<string, any> = { status: 'cancelled' };
  if (params.reason) upd.cancel_reason = params.reason;
  const { error } = await sb.from('reservations').update(upd).eq('id', params.row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function recordCancellation(params: { customerNo?: string; tel?: string }) {
  const tel = String(params.tel || '');
  const today = new Date().toISOString().slice(0, 10);
  let cust: any = null;
  if (tel) {
    const { data } = await sb.from('customers').select('id,cancel_count')
      .eq('store_id', ctx.storeId).ilike('tel', tel).maybeSingle();
    cust = data;
  }
  if (cust) {
    const newCount = (Number(cust.cancel_count) || 0) + 1;
    await sb.from('customers').update({ cancel_count: newCount, last_cancel_date: today }).eq('id', cust.id);
  }
  return { ok: true };
}

export async function getMyReservations(therapist: string) {
  const today = new Date();
  if (today.getHours() < 3) today.setDate(today.getDate() - 1);
  today.setHours(3, 0, 0, 0);

  const { data, error } = await sb.from('reservations').select('*')
    .eq('store_id', ctx.storeId).eq('therapist_name', therapist)
    .gte('date', today.toISOString()).neq('status', 'cancelled').order('date');
  if (error) throw new Error(error.message);

  const { data: pendingHime } = await sb.from('reservations').select('*')
    .eq('store_id', ctx.storeId).eq('therapist_name', therapist)
    .eq('is_hime', true).eq('is_hime_approved', false)
    .neq('status', 'cancelled').lt('date', today.toISOString());

  const existingIds = new Set((data || []).map((r: any) => r.id));
  const extraHime = (pendingHime || []).filter((r: any) => !existingIds.has(r.id));
  const rows = [...extraHime, ...(data || [])].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const custTels = [...new Set(rows.map((r: any) => r.customer_tel).filter(Boolean))];
  const visitMap: Record<string, number> = {};

  if (custTels.length) {
    const { data: resvHist } = await sb.from('reservations')
      .select('customer_tel, therapist_name, date')
      .eq('store_id', ctx.storeId)
      .in('customer_tel', custTels)
      .eq('therapist_name', therapist)
      .neq('status', 'cancelled');
    const countedKeys = new Set<string>();
    (resvHist || []).forEach((r: any) => {
      if (!r.customer_tel) return;
      const dayKey = r.customer_tel + '_' + (r.date || '').slice(0, 10);
      if (countedKeys.has(dayKey)) return;
      countedKeys.add(dayKey);
      visitMap[r.customer_tel] = (visitMap[r.customer_tel] || 0) + 1;
    });
  }

  const custNameMap: Record<string, string> = {};
  if (custTels.length) {
    const { data: custData } = await sb.from('customers')
      .select('tel, name').eq('store_id', ctx.storeId).in('tel', custTels);
    (custData || []).forEach((c: any) => { if (c.tel) custNameMap[c.tel] = c.name; });
  }

  return rows.map((r: any) => {
    const tel = r.customer_tel || '';
    const myVisitCount = tel ? (visitMap[tel] || 0) : 0;
    const resolvedName = (r.is_hime && tel && custNameMap[tel]) ? custNameMap[tel] : r.customer_name || '';
    return {
      row:           r.id,
      date:          fmtDatetimeJp(r.date),
      therapist:     r.therapist_name || '',
      course:        r.course_min || 60,
      customer:      resolvedName,
      price:         r.price || 0,
      discount:      r.discount || 0,
      nomination:    r.nomination || 'free',
      customerNo:    r.customer_no || '',
      tel,
      coursePrice:   r.course_price || 0,
      optionPrice:   r.option_price || 0,
      nominationFee: r.nomination_fee || 0,
      isStoreNew:    tel ? !custNameMap[tel] : true,
      myVisitCount,
      isHime:             r.is_hime || false,
      isHimeApproved:     r.is_hime_approved || false,
      therapistConfirmed: r.therapist_confirmed || false,
      _id:                r.id,
    };
  });
}
