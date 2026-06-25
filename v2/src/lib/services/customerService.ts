import { _sb } from '../config';
import { _fmtDatetimeJp, _fmtDateJp } from '../helpers';

async function _getTherapistId(name: string): Promise<string | null> {
  if (!name) return null;
  const { data } = await _sb.from('therapists')
    .select('id').eq('store_id', (window as any).STORE_ID as string).eq('name', name).maybeSingle();
  return data ? data.id : null;
}

export async function getCustomer(params: Record<string, any> = {}): Promise<any> {
  const tel  = String(params.tel  || '').replace(/[-\s]/g, '');
  const name = String(params.name || '').trim();
  const internalId = params.internalId || null;
  let q: any = _sb.from('customers').select('*').eq('store_id', (window as any).STORE_ID);
  if (tel && tel.length >= 4)  q = q.ilike('tel', '%' + tel + '%');
  else if (name)               q = q.ilike('name', name);
  else if (internalId)         q = q.eq('id', internalId);
  else return { found: false };
  const { data } = await q.maybeSingle();
  if (!data) return { found: false };
  return {
    found:        true,
    customerNo:   String(data.customer_no || ''),
    name:         data.name || '',
    tel:          data.tel  || '',
    status:       data.status || 'normal',
    ngTherapists: data.ng_therapists || [],
    cancelCount:  Number(data.cancel_count || 0),
    row:          data.id
  };
}

export async function saveCustomer(params: Record<string, any> = {}): Promise<any> {
  const tel  = String(params.tel  || '').replace(/[-\s]/g, '');
  const name = params.name || '';

  if (tel) {
    const { data: dup } = await _sb.from('customers').select('id,customer_no,name')
      .eq('store_id', (window as any).STORE_ID).ilike('tel', '%' + tel + '%').maybeSingle();
    if (dup) {
      return { ok: true, customerNo: String(dup.customer_no || ''), updated: true, existed: true };
    }
  }

  const { error: insErr } = await _sb.from('customers').insert({
    store_id: (window as any).STORE_ID,
    name,
    tel: tel || null
  });
  if (insErr) throw new Error('顧客登録エラー: ' + insErr.message);
  return { ok: true, customerNo: '', updated: false };
}

export async function updateCustomer(params: Record<string, any> = {}): Promise<any> {
  const tel = String(params.tel || '').replace(/[-\s]/g, '');
  let ex: any = null;
  if (tel) {
    const { data } = await _sb.from('customers').select('id').eq('store_id', (window as any).STORE_ID).ilike('tel', '%' + tel + '%').maybeSingle();
    ex = data;
  }
  if (!ex) return { ok: false, error: '顧客が見つかりません' };
  const upd: Record<string, any> = {};
  if (params.name         !== undefined) upd.name          = params.name;
  if (params.status       !== undefined) upd.status        = params.status;
  if (params.ngTherapists !== undefined) {
    upd.ng_therapists = params.ngTherapists
      ? (typeof params.ngTherapists === 'string'
          ? params.ngTherapists.split(',').map((s: string) => s.trim()).filter(Boolean)
          : params.ngTherapists)
      : [];
  }
  await _sb.from('customers').update(upd).eq('id', ex.id);
  return { ok: true };
}

export async function getCustomerMasterList(params: Record<string, any> = {}): Promise<any> {
  const search  = (params.search || '').toLowerCase();
  const page    = Number(params.page || 0);
  const perPage = 500;
  const from    = page * perPage;
  const to      = from + perPage - 1;
  let data: any, error: any, count: any;
  if (search) {
    const { data: d, error: e, count: c } = await _sb.from('customers')
      .select('*', { count: 'exact' })
      .eq('store_id', (window as any).STORE_ID)
      .or(`name.ilike.%${search}%,tel.ilike.%${search}%`)
      .order('name');
    data = d; error = e; count = c;
  } else {
    const { data: d, error: e, count: c } = await _sb.from('customers')
      .select('*', { count: 'exact' })
      .eq('store_id', (window as any).STORE_ID).order('name').range(from, to);
    data = d; error = e; count = c;
  }
  if (error) throw new Error(error.message);
  const list = (data || []).map((r: any) => ({
    customerNo:     String(r.customer_no || ''),
    name:           r.name || '',
    tel:            r.tel  || '',
    registeredAt:   _fmtDateJp(r.registered_at),
    status:         r.status || 'normal',
    ngTherapists:   (r.ng_therapists || []).join(','),
    cancelCount:    Number(r.cancel_count || 0),
    lastCancelDate: r.last_cancel_date || '',
    memo:           r.memo || '',
    row:            r.id
  }));
  return { list, total: count || 0, page, perPage };
}

export async function getCustomerHistory(params: Record<string, any> = {}): Promise<any> {
  const tel = String(params.tel || '');
  const therapist = params.therapist || '';

  let custData: any = null;
  if (tel) {
    const { data } = await _sb.from('customers').select('*').eq('store_id', (window as any).STORE_ID).ilike('tel', tel).maybeSingle();
    custData = data;
  }
  const lookupTel = custData?.tel || tel;
  const [histRes, memoRes] = await Promise.all([
    (async () => {
      if (lookupTel) {
        let q: any = _sb.from('reservations').select('*')
          .eq('store_id', (window as any).STORE_ID)
          .ilike('customer_tel', lookupTel)
          .neq('status', 'cancelled')
          .order('date', { ascending: false }).limit(30);
        if (therapist) q = q.eq('therapist_name', therapist);
        return q;
      }
      return { data: [] };
    })(),
    (async () => {
      if (!custData) return { data: [] };
      let q: any = _sb.from('customer_memos').select('*')
        .eq('customer_id', custData.id)
        .order('created_at', { ascending: false });
      if (therapist) {
        q = q.eq('therapist_name', therapist).eq('is_admin', false);
      }
      return q;
    })()
  ]);

  const customer = custData ? {
    found: true,
    id:           custData.id || '',
    customerNo:   String(custData.customer_no || ''),
    name:         custData.name||'', tel: custData.tel||'',
    status:       custData.status||'normal',
    ngTherapists: custData.ng_therapists||[]
  } : { found: false };
  const resvIds = (histRes.data || []).map((r: any) => r.id).filter(Boolean);
  let optionsMap: Record<string, any[]> = {};
  if (resvIds.length) {
    const { data: saleOpts } = await _sb.from('sale_options')
      .select('reservation_id, menu_name, amount')
      .eq('store_id', (window as any).STORE_ID).in('reservation_id', resvIds);
    (saleOpts || []).forEach((o: any) => {
      if (!optionsMap[o.reservation_id]) optionsMap[o.reservation_id] = [];
      optionsMap[o.reservation_id].push({ name: o.menu_name, amount: Number(o.amount) });
    });
  }

  const history = (histRes.data || []).map((r: any) => ({
    date: _fmtDatetimeJp(r.date), therapist: r.therapist_name||'',
    course: r.course_min, customer: r.customer_name||'',
    price: r.price, discount: r.discount, nomination: r.nomination,
    coursePrice:   r.course_price || 0,
    optionPrice:   r.option_price || 0,
    nominationFee: r.nomination_fee || 0,
    memo:          r.memo || '',
    resvId:        r.id,
    options:       optionsMap[r.id] || null,
  }));
  let cancelHistory: any[] = [];
  if (params.includeCancel && lookupTel) {
    const cancelQ = _sb.from('reservations').select('date,course_min,therapist_name,cancel_reason,memo')
          .eq('store_id', (window as any).STORE_ID).ilike('customer_tel', lookupTel)
          .eq('status', 'cancelled').order('date', { ascending: false }).limit(20);
    const { data: cancelData } = await cancelQ;
    const CANCEL_REASON_LABEL: Record<string, string> = { customer: 'お客様都合', therapist: 'セラピスト都合', other: 'その他' };
    cancelHistory = (cancelData || []).map((r: any) => ({
      date:      _fmtDatetimeJp(r.date),
      course:    r.course_min,
      therapist: r.therapist_name || '',
      reason:    CANCEL_REASON_LABEL[r.cancel_reason] || r.cancel_reason || '不明',
      memo:      r.memo || '',
    }));
  }
  const memos = (memoRes.data || []).map((r: any) => ({
    id:        r.id,
    therapist: r.therapist_name||'', memo: r.memo||'',
    date: _fmtDateJp(r.created_at)
  }));
  return { history, memos, customer, cancelHistory };
}

export async function saveCustomerMemo(params: Record<string, any> = {}): Promise<any> {
  const customerId = params.customerId || '';
  const tel = String(params.tel || '');
  const therapistId = await _getTherapistId(params.therapist);
  let custId = customerId || null;
  if (!custId && tel) {
    const { data: c } = await _sb.from('customers').select('id').eq('store_id', (window as any).STORE_ID).ilike('tel', tel).maybeSingle();
    if (c) custId = c.id;
  }
  if (!custId && tel) {
    const { data: newC, error: insErr } = await _sb.from('customers').insert({
      store_id: (window as any).STORE_ID, tel: tel,
      name: params.customerName || tel, status: 'normal'
    }).select('id').single();
    if (!insErr && newC) custId = newC.id;
  }
  if (!custId) throw new Error('顧客情報が特定できません（電話番号を登録してください）');
  const { error } = await _sb.from('customer_memos').insert({
    customer_id:    custId,
    therapist_id:   therapistId,
    therapist_name: params.therapist,
    memo:           params.memo,
    is_admin:       params.isAdmin === true
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function updateCustomerMemo(params: Record<string, any> = {}): Promise<any> {
  const { memoId, memo } = params;
  if (!memoId) throw new Error('memoId が必要です');
  const { error } = await _sb.from('customer_memos').update({ memo }).eq('id', memoId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteCustomerMemo(params: Record<string, any> = {}): Promise<any> {
  const { memoId } = params;
  if (!memoId) throw new Error('memoId が必要です');
  const { error } = await _sb.from('customer_memos').delete().eq('id', memoId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getMyCustomers(params: Record<string, any> = {}): Promise<any> {
  const therapist = params.therapist || '';
  const { data: resvData } = await _sb.from('reservations')
    .select('customer_no, customer_name, customer_tel, date')
    .eq('store_id', (window as any).STORE_ID).eq('therapist_name', therapist)
    .neq('status', 'cancelled');
  const custMap: Record<string, any> = {};
  (resvData || []).forEach((r: any) => {
    const key = r.customer_tel || r.customer_no || r.customer_name || '';
    if (!key) return;
    const dateStr = _fmtDateJp(r.date);
    if (!custMap[key]) custMap[key] = {
      customerNo: r.customer_no || '',
      tel:        r.customer_tel || '',
      visitCount: 0, lastVisit: '',
      name:       r.customer_name || ''
    };
    custMap[key].visitCount++;
    if (dateStr > custMap[key].lastVisit) custMap[key].lastVisit = dateStr;
    if (!custMap[key].tel && r.customer_tel) custMap[key].tel = r.customer_tel;
  });
  if (!Object.keys(custMap).length) return [];

  const tels = [...new Set(Object.values(custMap).map((c: any) => c.tel).filter(Boolean))];
  if (tels.length) {
    const { data: custByTel } = await _sb.from('customers')
      .select('tel,name,id').eq('store_id', (window as any).STORE_ID).in('tel', tels);
    (custByTel || []).forEach((c: any) => {
      if (custMap[c.tel]) {
        custMap[c.tel].name       = c.name || custMap[c.tel].name;
        custMap[c.tel].customerId = c.id;
      }
    });
  }

  const custIds = [...new Set(Object.values(custMap).map((c: any) => c.customerId).filter(Boolean))];
  if (custIds.length) {
    const { data: memoData } = await _sb.from('customer_memos')
      .select('customer_id, memo')
      .eq('therapist_name', therapist)
      .eq('is_admin', false)
      .in('customer_id', custIds)
      .order('created_at', { ascending: false });
    (memoData || []).forEach((m: any) => {
      const entry = Object.values(custMap).find((c: any) => c.customerId === m.customer_id);
      if (entry && !entry.latestMemo) entry.latestMemo = m.memo || '';
    });
  }

  return Object.values(custMap).sort((a: any, b: any) => b.visitCount - a.visitCount);
}

export async function checkCustomerStatus(params: Record<string, any> = {}): Promise<any> {
  const tel = String(params.tel || '');
  let custData: any = null;
  if (tel) {
    const { data } = await _sb.from('customers').select('status,ng_therapists').eq('store_id', (window as any).STORE_ID).ilike('tel', tel).maybeSingle();
    custData = data;
  }
  if (!custData) return { allowed: true, reason: '' };
  const { status, ng_therapists } = custData;
  if (status === '出禁') return { allowed: false, reason: '出禁のお客様です' };
  if (ng_therapists && ng_therapists.includes(params.therapist)) return { allowed: false, reason: params.therapist + ' さんへのNG客です' };
  if (status === 'NG')   return { allowed: false, reason: 'NGのお客様です' };
  if (status === '注意') return { allowed: true, reason: '⚠ 注意客です', warning: true };
  return { allowed: true, reason: '' };
}

export async function importCustomers(_params: Record<string, any> = {}): Promise<any> {
  return 'CSVからのインポートはSupabase Dashboardで行ってください';
}
