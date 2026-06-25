import { _sb } from '../config';

async function _getTherapistId(name: string): Promise<string | null> {
  if (!name) return null;
  const { data } = await _sb.from('therapists')
    .select('id').eq('store_id', (window as any).STORE_ID as string).eq('name', name).maybeSingle();
  return data ? data.id : null;
}

export async function saveSalesEntry(params: Record<string, any> = {}): Promise<any> {
  let custTel = params.tel || '';
  if (!custTel && params.reservationId) {
    const { data: resvData } = await _sb.from('reservations')
      .select('customer_tel').eq('id', params.reservationId).maybeSingle();
    if (resvData) custTel = resvData.customer_tel || '';
  }
  const salesData: Record<string, any> = {
    store_id:       (window as any).STORE_ID,
    therapist_name: params.therapist,
    therapist_id:   await _getTherapistId(params.therapist),
    date:           params.date ? new Date(params.date).toISOString() : new Date().toISOString(),
    course_min:     Number(params.course || 0),
    price:          Number(params.price || 0),
    course_price:   Number(params.coursePrice || 0),
    option_price:   Number(params.optionPrice || 0),
    nomination_fee: Number(params.nominationFee || 0),
    discount:       Number(params.discount || 0),
    nomination:     params.nomination || 'free',
    customer_name:  params.customer || '',
    customer_no:    params.customerNo || '',
    customer_tel:   custTel,
    memo:           params.memo || null,
    reservation_id: params.reservationId || null
  };
  if (params.reservationId) {
    const { data: existing } = await _sb.from('sales')
      .select('id').eq('store_id', (window as any).STORE_ID)
      .eq('reservation_id', params.reservationId).maybeSingle();
    if (existing) {
      const { error } = await _sb.from('sales').update(salesData).eq('id', existing.id);
      if (error) throw new Error(error.message);
      await _sb.from('reservations').update({ course_min: salesData.course_min })
        .eq('id', params.reservationId).eq('store_id', (window as any).STORE_ID);
      return { ok: true, updated: true };
    }
  }
  const { error } = await _sb.from('sales').insert(salesData);
  if (error) throw new Error(error.message);
  if (params.reservationId) {
    await _sb.from('reservations').update({ course_min: salesData.course_min })
      .eq('id', params.reservationId).eq('store_id', (window as any).STORE_ID);
  }
  return { ok: true, updated: false };
}

export async function getSalesData(params: Record<string, any> = {}): Promise<any> {
  let q = _sb.from('sales').select('*').eq('store_id', (window as any).STORE_ID).order('date', { ascending: false });
  if (params.startDate) q = q.gte('date', params.startDate + 'T00:00:00+09:00');
  if (params.endDate)   q = q.lte('date', params.endDate   + 'T23:59:59+09:00');
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({ ...r, row: r.id }));
}

export async function updateSalesRow(params: Record<string, any> = {}): Promise<any> {
  const upd: Record<string, any> = {};
  if (params.therapist_name !== undefined) upd.therapist_name = params.therapist_name;
  if (params.date           !== undefined) upd.date           = new Date(params.date).toISOString();
  if (params.price          !== undefined) upd.price          = Number(params.price);
  if (params.discount       !== undefined) upd.discount       = Number(params.discount);
  if (params.nomination     !== undefined) upd.nomination     = params.nomination;
  if (params.course_min     !== undefined) upd.course_min     = Number(params.course_min);
  const { error } = await _sb.from('sales').update(upd).eq('id', params.row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteSalesRow(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('sales').delete().eq('id', params.row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getTherapistsFromSales(_params: Record<string, any> = {}): Promise<any> {
  const { data } = await _sb.from('sales').select('therapist_name').eq('store_id', (window as any).STORE_ID);
  return [...new Set((data||[]).map((r: any) => r.therapist_name).filter(Boolean))];
}

export async function saveSaleOptions(params: Record<string, any> = {}): Promise<any> {
  const { reservationId, options } = params;
  if (!reservationId) return { ok: true };
  await _sb.from('sale_options').delete()
    .eq('store_id', (window as any).STORE_ID).eq('reservation_id', reservationId);
  if (options && options.length > 0) {
    const inserts = options.map((o: any) => ({
      store_id:       (window as any).STORE_ID,
      reservation_id: reservationId,
      menu_id:        o.menuId || null,
      menu_name:      o.name  || '',
      amount:         Number(o.amount) || 0
    }));
    const { error } = await _sb.from('sale_options').insert(inserts);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}
