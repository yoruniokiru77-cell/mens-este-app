import { _sb } from '../config';
import { _calcPayroll } from '../calc';

export async function getPayrollData(params: Record<string, any> = {}): Promise<any> {
  const { startDate, endDate } = params;
  const [salesRes, therapistRes, settingsRes] = await Promise.all([
    (() => {
      const endDt = new Date(endDate + 'T00:00:00+09:00');
      endDt.setDate(endDt.getDate() + 1);
      endDt.setHours(2, 59, 59, 0);
      return _sb.from('sales').select('*')
        .eq('store_id', (window as any).STORE_ID)
        .gte('date', startDate + 'T03:00:00+09:00')
        .lte('date', endDt.toISOString())
        .order('date');
    })(),
    _sb.from('therapists').select('id,name,course_back,option_back,has_guarantee,hourly_rate,daily_guarantee,discount_mode,parking_fee,extension_back,extension_back_honshimei').eq('store_id', (window as any).STORE_ID).eq('active', true),
    _sb.from('store_settings').select('*').eq('store_id', (window as any).STORE_ID).single()
  ]);
  const tMap: Record<string, any> = {};
  (therapistRes.data || []).forEach((t: any) => { tMap[t.name] = t; });
  const ss = settingsRes.data || {};
  (window as any)._cachedStoreSettings = ss;

  const therapistIds = (therapistRes.data || []).map((t: any) => t.id).filter(Boolean);
  let menuBackMap: Record<string, any> = {};
  if (therapistIds.length) {
    const { data: menuBacks } = await _sb.from('therapist_menu_backs')
      .select('*').eq('store_id', (window as any).STORE_ID).in('therapist_id', therapistIds);
    (menuBacks || []).forEach((b: any) => {
      menuBackMap[b.therapist_id + '_' + b.menu_id] = {
        other:    b.back_amount,
        honshimei: b.back_amount_honshimei
      };
    });
  }

  const { data: menuData } = await _sb.from('menus').select('id,name,duration_min,type,extension_price')
    .eq('store_id', (window as any).STORE_ID).eq('active', true);
  const menuByMin: Record<string, any> = {};
  const menuByName: Record<string, any> = {};
  (menuData || []).forEach((m: any) => {
    if (m.type === 'course' && m.duration_min) menuByMin[m.duration_min] = m.id;
    if (m.type === 'option') menuByName[m.name] = m.id;
  });
  (window as any)._payrollMenuByMin   = menuByMin;
  (window as any)._payrollMenuBackMap = menuBackMap;

  const salesResvIds = (salesRes.data || []).map((r: any) => r.reservation_id).filter(Boolean);
  let saleOptMap: Record<string, any[]> = {};
  if (salesResvIds.length) {
    const { data: saleOpts } = await _sb.from('sale_options')
      .select('reservation_id, menu_name, amount')
      .in('reservation_id', salesResvIds);
    (saleOpts || []).forEach((o: any) => {
      if (!saleOptMap[o.reservation_id]) saleOptMap[o.reservation_id] = [];
      saleOptMap[o.reservation_id].push({
        menuId: menuByName[o.menu_name] || null,
        name:   o.menu_name || '',
        amount: Number(o.amount)
      });
    });
  }

  const custTels = [...new Set((salesRes.data || []).map((r: any) => r.customer_tel).filter(Boolean))];
  let prevSalesTels = new Set<string>();
  if (custTels.length) {
    const { data: prevSales } = await _sb.from('sales')
      .select('customer_tel')
      .eq('store_id', (window as any).STORE_ID)
      .lt('date', startDate + 'T00:00:00+09:00')
      .in('customer_tel', custTels);
    (prevSales || []).forEach((r: any) => { if (r.customer_tel) prevSalesTels.add(r.customer_tel); });
  }

  const resvEndDt = new Date(endDate + 'T00:00:00+09:00');
  resvEndDt.setDate(resvEndDt.getDate() + 1);
  resvEndDt.setHours(2, 59, 59, 0);
  const resvQuery = await _sb.from('reservations')
    .select('therapist_name, date')
    .eq('store_id', (window as any).STORE_ID)
    .eq('status', 'active')
    .gte('date', startDate + 'T03:00:00+09:00')
    .lte('date', resvEndDt.toISOString());
  const resvCountMap: Record<string, number> = {};
  (resvQuery.data || []).forEach((r: any) => {
    const d = new Date(r.date);
    const dAdj = new Date(d);
    if (d.getHours() < 3) dAdj.setDate(dAdj.getDate() - 1);
    const dl = dAdj.getFullYear() + '/' +
      String(dAdj.getMonth()+1).padStart(2,'0') + '/' +
      String(dAdj.getDate()).padStart(2,'0');
    const k = dl + '_' + r.therapist_name;
    resvCountMap[k] = (resvCountMap[k] || 0) + 1;
  });

  const result: Record<string, any> = {};
  (salesRes.data || []).forEach((r: any) => {
    const d = new Date(r.date);
    const dAdj = new Date(d);
    if (d.getHours() < 3) dAdj.setDate(dAdj.getDate() - 1);
    const dateLabel = dAdj.getFullYear() + '/' +
      String(dAdj.getMonth()+1).padStart(2,'0') + '/' +
      String(dAdj.getDate()).padStart(2,'0');
    const tInfo = tMap[r.therapist_name] || {};
    const menuId = menuByMin[r.course_min];
    const _mb = (tInfo.id && menuId) ? menuBackMap[tInfo.id + '_' + menuId] : undefined;
    let fixedBackAmount = null;
    if (_mb) {
      const isHon = r.nomination === 'honshimei';
      const primary  = isHon ? _mb.honshimei : _mb.other;
      const fallback = isHon ? _mb.other     : _mb.honshimei;
      fixedBackAmount = (primary !== null && primary !== undefined) ? primary
        : ((fallback !== null && fallback !== undefined) ? fallback : null);
    }
    const rowWithBack = {
      ...r,
      therapist_course_back:   tInfo.course_back,
      therapist_option_back:   tInfo.option_back,
      fixed_back_amount:       fixedBackAmount,
      therapist_discount_mode: tInfo.discount_mode || null,
    };
    const { storeDrop, therapistPay, therapistCoursePay, therapistOptPay, therapistExtPay, courseBack, optionBack }
      = _calcPayroll(rowWithBack, ss, {
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
        details: []
      };
    }
    result[key].pay       += therapistPay;
    result[key].storeDrop += storeDrop;
    result[key].count     += 1;
    const isNewCustomer = r.customer_tel ? !prevSalesTels.has(r.customer_tel) : false;
    result[key].details.push({
      row:             r.id,
      date:            String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'),
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
      isGuarantee:     r.is_guarantee || false,
      isNewCustomer:   isNewCustomer || false,
      customer:        r.customer_name || '',
      customerNo:      r.customer_no || '',
      memo:            r.memo || ''
    });
  });

  const guarTherapists = (therapistRes.data || []).filter((t: any) => t.has_guarantee && (t.hourly_rate || t.daily_guarantee));
  if (guarTherapists.length) {
    const shiftsRes = await _sb.from('shifts').select('therapist_name, date, start_time, end_time')
      .eq('store_id', (window as any).STORE_ID).eq('status', 'approved')
      .gte('date', startDate).lte('date', endDate);
    (shiftsRes.data || []).forEach((s: any) => {
      const dateLabel = s.date.replace(/-/g, '/');
      const key = dateLabel + '_' + s.therapist_name;
      if (result[key]) return;
      const tInfo = tMap[s.therapist_name];
      if (!tInfo || !tInfo.has_guarantee) return;
      result[key] = {
        dateLabel, name: s.therapist_name,
        pay: 0, storeDrop: 0, count: 0,
        resvCount: 0,
        hasGuarantee: true,
        hourlyRate: tInfo.hourly_rate || null,
        dailyGuarantee: tInfo.daily_guarantee || null,
        shiftStart: s.start_time ? s.start_time.substring(0,5) : '',
        shiftEnd:   s.end_time   ? s.end_time.substring(0,5)   : '',
        details: []
      };
    });
  }

  return Object.values(result).sort((a: any, b: any) => {
    if (a.dateLabel !== b.dateLabel) return a.dateLabel.localeCompare(b.dateLabel);
    return a.name.localeCompare(b.name, 'ja');
  });
}

export async function getMenuBacks(params: Record<string, any> = {}): Promise<any> {
  const { therapistId } = params;
  const { data, error } = await _sb.from('therapist_menu_backs')
    .select('*').eq('store_id', (window as any).STORE_ID).eq('therapist_id', therapistId);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveMenuBacks(params: Record<string, any> = {}): Promise<any> {
  const { therapistId, backs } = params;
  await _sb.from('therapist_menu_backs')
    .delete().eq('store_id', (window as any).STORE_ID).eq('therapist_id', therapistId);
  const inserts = backs
    .filter((b: any) => (b.back_amount !== '' && b.back_amount !== null) ||
                   (b.back_amount_honshimei !== '' && b.back_amount_honshimei !== null && b.back_amount_honshimei !== undefined))
    .map((b: any) => ({
      store_id:     (window as any).STORE_ID,
      therapist_id: therapistId,
      menu_id:      b.menu_id,
      back_amount:  (b.back_amount !== '' && b.back_amount !== null) ? Number(b.back_amount) : null,
      back_amount_honshimei: (b.back_amount_honshimei !== '' && b.back_amount_honshimei !== null && b.back_amount_honshimei !== undefined) ? Number(b.back_amount_honshimei) : null
    }));
  if (inserts.length) {
    const { error } = await _sb.from('therapist_menu_backs').insert(inserts);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function getUnsubmittedTherapists(_params: Record<string, any> = {}): Promise<any> {
  const now   = new Date();
  const day   = now.getDay();
  const diff  = (8 - day) % 7 || 7;
  const mon   = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
  const sun   = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmtD  = (d: Date) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  const monStr = fmtD(mon), sunStr = fmtD(sun);

  const [tRes, sRes] = await Promise.all([
    _sb.from('therapists').select('name,line_user_id').eq('store_id', (window as any).STORE_ID).eq('active', true),
    _sb.from('shifts').select('therapist_name,status')
      .eq('store_id', (window as any).STORE_ID).gte('date', monStr).lte('date', sunStr)
  ]);
  const all           = (tRes.data || []).filter((t: any) => t.name && t.name !== '管理者');
  const submittedSet  = new Set((sRes.data || []).map((s: any) => s.therapist_name));
  const unsubmitted   = all.filter((t: any) => !submittedSet.has(t.name)).map((t: any) => ({ name: t.name, userId: t.line_user_id||'' }));
  const submitted     = all.filter((t: any) =>  submittedSet.has(t.name)).map((t: any) => t.name);
  return { unsubmitted, submitted, weekLabel: monStr.replace(/-/g,'/') + ' 〜 ' + sunStr.replace(/-/g,'/') };
}
