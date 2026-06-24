import { sb, ctx } from '../lib/supabase';
import { getTherapistId } from '../lib/helpers';
import { calcPayroll } from '../lib/calcPayroll';

export async function saveSalesEntry(params: Record<string, any>) {
  let custTel = params.tel || '';
  if (!custTel && params.reservationId) {
    const { data: resvData } = await sb.from('reservations')
      .select('customer_tel').eq('id', params.reservationId).maybeSingle();
    if (resvData) custTel = resvData.customer_tel || '';
  }
  const salesData = {
    store_id:       ctx.storeId,
    therapist_name: params.therapist,
    therapist_id:   await getTherapistId(params.therapist),
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
    reservation_id: params.reservationId || null,
  };
  if (params.reservationId) {
    const { data: existing } = await sb.from('sales')
      .select('id').eq('store_id', ctx.storeId)
      .eq('reservation_id', params.reservationId).maybeSingle();
    if (existing) {
      const { error } = await sb.from('sales').update(salesData).eq('id', existing.id);
      if (error) throw new Error(error.message);
      await sb.from('reservations').update({ course_min: salesData.course_min })
        .eq('id', params.reservationId).eq('store_id', ctx.storeId);
      return { ok: true, updated: true };
    }
  }
  const { error } = await sb.from('sales').insert(salesData);
  if (error) throw new Error(error.message);
  if (params.reservationId) {
    await sb.from('reservations').update({ course_min: salesData.course_min })
      .eq('id', params.reservationId).eq('store_id', ctx.storeId);
  }
  return { ok: true, updated: false };
}

export async function getSalesData(params: { startDate?: string; endDate?: string }) {
  let q = sb.from('sales').select('*').eq('store_id', ctx.storeId).order('date', { ascending: false });
  if (params.startDate) q = q.gte('date', params.startDate + 'T00:00:00+09:00');
  if (params.endDate)   q = q.lte('date', params.endDate   + 'T23:59:59+09:00');
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({ ...r, row: r.id }));
}

export async function updateSalesRow(params: Record<string, any>) {
  const upd: Record<string, any> = {};
  if (params.therapist_name !== undefined) upd.therapist_name = params.therapist_name;
  if (params.date           !== undefined) upd.date           = new Date(params.date).toISOString();
  if (params.price          !== undefined) upd.price          = Number(params.price);
  if (params.discount       !== undefined) upd.discount       = Number(params.discount);
  if (params.nomination     !== undefined) upd.nomination     = params.nomination;
  if (params.course_min     !== undefined) upd.course_min     = Number(params.course_min);
  const { error } = await sb.from('sales').update(upd).eq('id', params.row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteSalesRow(id: string) {
  const { error } = await sb.from('sales').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getTherapistsFromSales() {
  const { data } = await sb.from('sales').select('therapist_name').eq('store_id', ctx.storeId);
  return [...new Set((data || []).map((r: any) => r.therapist_name).filter(Boolean))];
}

export async function saveSaleOptions(params: { reservationId: string; options: Array<{ menuId: string | null; name: string; amount: number }> }) {
  const { reservationId, options } = params;
  if (!reservationId) return { ok: true };
  await sb.from('sale_options').delete().eq('store_id', ctx.storeId).eq('reservation_id', reservationId);
  if (options && options.length > 0) {
    const inserts = options.map(o => ({
      store_id:       ctx.storeId,
      reservation_id: reservationId,
      menu_id:        o.menuId || null,
      menu_name:      o.name  || '',
      amount:         Number(o.amount) || 0,
    }));
    const { error } = await sb.from('sale_options').insert(inserts);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export interface PayrollEntry {
  dateLabel: string;
  name: string;
  pay: number;
  storeDrop: number;
  count: number;
  resvCount: number;
  hasGuarantee: boolean;
  hourlyRate: number | null;
  dailyGuarantee: number | null;
  parkingFee: number;
  details: any[];
}

export async function getPayrollData(params: { startDate: string; endDate: string }): Promise<PayrollEntry[]> {
  const { startDate, endDate } = params;

  const endDt = new Date(endDate + 'T00:00:00+09:00');
  endDt.setDate(endDt.getDate() + 1);
  endDt.setHours(2, 59, 59, 0);

  const [salesRes, therapistRes, settingsRes] = await Promise.all([
    sb.from('sales').select('*')
      .eq('store_id', ctx.storeId)
      .gte('date', startDate + 'T03:00:00+09:00')
      .lte('date', endDt.toISOString())
      .order('date'),
    sb.from('therapists')
      .select('id,name,course_back,option_back,has_guarantee,hourly_rate,daily_guarantee,discount_mode,parking_fee,extension_back,extension_back_honshimei')
      .eq('store_id', ctx.storeId).eq('active', true),
    sb.from('store_settings').select('*').eq('store_id', ctx.storeId).single(),
  ]);

  const tMap: Record<string, any> = {};
  (therapistRes.data || []).forEach((t: any) => { tMap[t.name] = t; });
  const ss = settingsRes.data || {};

  const therapistIds = (therapistRes.data || []).map((t: any) => t.id).filter(Boolean);
  const menuBackMap: Record<string, { other: number | null; honshimei: number | null }> = {};
  if (therapistIds.length) {
    const { data: menuBacks } = await sb.from('therapist_menu_backs')
      .select('*').eq('store_id', ctx.storeId).in('therapist_id', therapistIds);
    (menuBacks || []).forEach((b: any) => {
      menuBackMap[b.therapist_id + '_' + b.menu_id] = { other: b.back_amount, honshimei: b.back_amount_honshimei };
    });
  }

  const { data: menuData } = await sb.from('menus').select('id,name,duration_min,type')
    .eq('store_id', ctx.storeId).eq('active', true);
  const menuByMin:  Record<number, string> = {};
  const menuByName: Record<string, string> = {};
  (menuData || []).forEach((m: any) => {
    if (m.type === 'course' && m.duration_min) menuByMin[m.duration_min] = m.id;
    if (m.type === 'option') menuByName[m.name] = m.id;
  });

  const salesResvIds = (salesRes.data || []).map((r: any) => r.reservation_id).filter(Boolean);
  const saleOptMap: Record<string, Array<{ menuId: string | null; name: string; amount: number }>> = {};
  if (salesResvIds.length) {
    const { data: saleOpts } = await sb.from('sale_options')
      .select('reservation_id, menu_name, amount').in('reservation_id', salesResvIds);
    (saleOpts || []).forEach((o: any) => {
      if (!saleOptMap[o.reservation_id]) saleOptMap[o.reservation_id] = [];
      saleOptMap[o.reservation_id].push({ menuId: menuByName[o.menu_name] || null, name: o.menu_name || '', amount: Number(o.amount) });
    });
  }

  const custTels = [...new Set((salesRes.data || []).map((r: any) => r.customer_tel).filter(Boolean))];
  const prevSalesTels = new Set<string>();
  if (custTels.length) {
    const { data: prevSales } = await sb.from('sales')
      .select('customer_tel').eq('store_id', ctx.storeId)
      .lt('date', startDate + 'T00:00:00+09:00').in('customer_tel', custTels);
    (prevSales || []).forEach((r: any) => { if (r.customer_tel) prevSalesTels.add(r.customer_tel); });
  }

  const resvEndDt = new Date(endDate + 'T00:00:00+09:00');
  resvEndDt.setDate(resvEndDt.getDate() + 1);
  resvEndDt.setHours(2, 59, 59, 0);
  const resvQuery = await sb.from('reservations')
    .select('therapist_name, date').eq('store_id', ctx.storeId).eq('status', 'active')
    .gte('date', startDate + 'T03:00:00+09:00').lte('date', resvEndDt.toISOString());
  const resvCountMap: Record<string, number> = {};
  const pad = (n: number) => String(n).padStart(2, '0');
  (resvQuery.data || []).forEach((r: any) => {
    const d = new Date(r.date);
    const dAdj = new Date(d);
    if (d.getHours() < 3) dAdj.setDate(dAdj.getDate() - 1);
    const dl = dAdj.getFullYear() + '/' + pad(dAdj.getMonth() + 1) + '/' + pad(dAdj.getDate());
    const k = dl + '_' + r.therapist_name;
    resvCountMap[k] = (resvCountMap[k] || 0) + 1;
  });

  const result: Record<string, any> = {};
  (salesRes.data || []).forEach((r: any) => {
    const d = new Date(r.date);
    const dAdj = new Date(d);
    if (d.getHours() < 3) dAdj.setDate(dAdj.getDate() - 1);
    const dateLabel = dAdj.getFullYear() + '/' + pad(dAdj.getMonth() + 1) + '/' + pad(dAdj.getDate());
    const tInfo = tMap[r.therapist_name] || {};
    const menuId = menuByMin[r.course_min];
    const _mb = (tInfo.id && menuId) ? menuBackMap[tInfo.id + '_' + menuId] : undefined;
    let fixedBackAmount: number | null = null;
    if (_mb) {
      const isHon = r.nomination === 'honshimei';
      const primary  = isHon ? _mb.honshimei : _mb.other;
      const fallback = isHon ? _mb.other     : _mb.honshimei;
      fixedBackAmount = primary != null ? primary : fallback != null ? fallback : null;
    }
    const rowWithBack = {
      ...r,
      therapist_course_back:   tInfo.course_back,
      therapist_option_back:   tInfo.option_back,
      fixed_back_amount:       fixedBackAmount,
      therapist_discount_mode: tInfo.discount_mode || null,
    };
    const { storeDrop, therapistPay, therapistCoursePay, therapistOptPay, therapistExtPay, courseBack, optionBack }
      = calcPayroll(rowWithBack, ss, {
          optItems:        r.reservation_id ? (saleOptMap[r.reservation_id] || null) : null,
          menuBackMap:     menuBackMap,
          therapistId:     tInfo.id || null,
          extensionBack:    tInfo.extension_back    != null ? Number(tInfo.extension_back)    : null,
          extensionBackHon: tInfo.extension_back_honshimei != null ? Number(tInfo.extension_back_honshimei) : null,
        });
    const key = dateLabel + '_' + r.therapist_name;
    if (!result[key]) {
      const pf = tInfo.parking_fee ? Number(tInfo.parking_fee) : 0;
      result[key] = {
        dateLabel, name: r.therapist_name,
        pay: pf, storeDrop: -pf, count: 0,
        resvCount: resvCountMap[key] || 0,
        hasGuarantee: tInfo.has_guarantee || false,
        hourlyRate: tInfo.hourly_rate || null,
        dailyGuarantee: tInfo.daily_guarantee || null,
        parkingFee: pf,
        details: [],
      };
    }
    result[key].pay       += therapistPay;
    result[key].storeDrop += storeDrop;
    result[key].count     += 1;
    const isNewCustomer = r.customer_tel ? !prevSalesTels.has(r.customer_tel) : false;
    result[key].details.push({
      row:             r.id,
      date:            String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
      fullDate:        dateLabel,
      course:          r.course_min,
      nomination:      r.nomination,
      price:           Number(r.price || 0),
      coursePrice:     Number(r.course_price || r.price || 0),
      optionPrice:     Number(r.option_price || 0),
      nominationFee:   Number(r.nomination_fee || 0),
      discount:        Number(r.discount || 0),
      therapistPay, storeDrop,
      therapistCoursePay, therapistOptPay, therapistExtPay,
      courseBack, optionBack,
      isGuarantee:   r.is_guarantee || false,
      isNewCustomer: isNewCustomer || false,
      customer:      r.customer_name || '',
      customerNo:    r.customer_no || '',
      memo:          r.memo || '',
    });
  });

  // 保証対象セラピスト: シフトあり・売上なしでも表示
  const guarTherapists = (therapistRes.data || []).filter((t: any) => t.has_guarantee && (t.hourly_rate || t.daily_guarantee));
  if (guarTherapists.length) {
    const shiftsRes = await sb.from('shifts').select('therapist_name, date, start_time, end_time')
      .eq('store_id', ctx.storeId).eq('status', 'approved')
      .gte('date', startDate).lte('date', endDate);
    (shiftsRes.data || []).forEach((s: any) => {
      const dateLabel = s.date.replace(/-/g, '/');
      const key = dateLabel + '_' + s.therapist_name;
      if (result[key]) return;
      const tInfo = tMap[s.therapist_name];
      if (!tInfo || !tInfo.has_guarantee) return;
      result[key] = {
        dateLabel, name: s.therapist_name,
        pay: 0, storeDrop: 0, count: 0, resvCount: 0,
        hasGuarantee: true,
        hourlyRate: tInfo.hourly_rate || null,
        dailyGuarantee: tInfo.daily_guarantee || null,
        shiftStart: s.start_time ? s.start_time.substring(0, 5) : '',
        shiftEnd:   s.end_time   ? s.end_time.substring(0, 5)   : '',
        details: [],
      };
    });
  }

  return Object.values(result).sort((a: any, b: any) => {
    if (a.dateLabel !== b.dateLabel) return a.dateLabel.localeCompare(b.dateLabel);
    return a.name.localeCompare(b.name, 'ja');
  });
}
