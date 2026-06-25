import { _sb } from '../config';

export async function getExpenses(params: Record<string, any> = {}): Promise<any> {
  let q: any = _sb.from('expenses').select('*').eq('store_id', (window as any).STORE_ID).order('date', { ascending: false });
  if (params.startDate)  q = q.gte('date', params.startDate);
  if (params.endDate)    q = q.lte('date', params.endDate);
  if (params.therapist)  q = q.eq('therapist_name', params.therapist);
  if (params.date)       q = q.eq('date', params.date);
  if (params.storeOnly)  q = q.is('therapist_name', null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({ ...r, row: r.id }));
}

export async function saveStoreExpense(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('expenses').insert({
    store_id:       (window as any).STORE_ID,
    date:           params.date,
    category:       params.category,
    amount:         Number(params.amount),
    memo:           params.memo || null,
    therapist_name: null
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function saveExpense(params: Record<string, any> = {}): Promise<any> {
  const { data: existing } = await _sb.from('expenses')
    .select('id').eq('store_id', (window as any).STORE_ID)
    .eq('date', params.date).eq('category', params.category)
    .eq('therapist_name', params.therapist || '').maybeSingle();
  if (existing) {
    const { error } = await _sb.from('expenses').update({
      amount: Number(params.amount), memo: params.memo || null
    }).eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await _sb.from('expenses').insert({
      store_id:       (window as any).STORE_ID,
      date:           params.date,
      category:       params.category,
      amount:         Number(params.amount),
      memo:           params.memo || null,
      therapist_name: params.therapist || null
    });
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function deleteExpenseByCategory(params: Record<string, any> = {}): Promise<any> {
  await _sb.from('expenses').delete()
    .eq('store_id', (window as any).STORE_ID)
    .eq('date', params.date)
    .eq('category', params.category)
    .eq('therapist_name', params.therapist || '');
  return { ok: true };
}

export async function deleteExpense(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('expenses').delete().eq('id', params.row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getFixedCostMasters(_params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await _sb.from('store_fixed_costs')
    .select('*').eq('store_id', (window as any).STORE_ID).eq('active', true)
    .order('category').order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveFixedCostMaster(params: Record<string, any> = {}): Promise<any> {
  const row: Record<string, any> = {
    store_id:               (window as any).STORE_ID,
    name:                   params.name,
    category:               params.category,
    room_id:                params.roomId   || null,
    room_name:              params.roomName || null,
    default_amount:         params.amount != null && params.amount !== '' ? Number(params.amount) : null,
    is_variable:            !params.amount,
    due_day:                params.dueDay ? Number(params.dueDay) : null,
    memo:                   params.memo || null,
    payment_destination_id: params.paymentDestId || null,
    active:                 true
  };
  if (params.id) {
    const { error } = await _sb.from('store_fixed_costs').update(row).eq('id', params.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await _sb.from('store_fixed_costs').insert(row);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function deleteFixedCostMaster(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('store_fixed_costs')
    .update({ active: false }).eq('id', params.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getFixedCostPayments(params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await _sb.from('fixed_cost_payments')
    .select('*').eq('store_id', (window as any).STORE_ID).eq('period', params.period);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveFixedCostPayment(params: Record<string, any> = {}): Promise<any> {
  const { data: existing } = await _sb.from('fixed_cost_payments')
    .select('id').eq('fixed_cost_id', params.fixedCostId).eq('period', params.period).maybeSingle();
  const row: Record<string, any> = {
    store_id:      (window as any).STORE_ID,
    fixed_cost_id: params.fixedCostId,
    period:        params.period,
    amount:        Number(params.amount),
    paid:          params.paid === true,
    paid_at:       params.paid ? new Date().toISOString() : null,
    memo:          params.memo || null
  };
  if (existing) {
    const { error } = await _sb.from('fixed_cost_payments').update(row).eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await _sb.from('fixed_cost_payments').insert(row);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function getPaymentDestinations(_params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await _sb.from('payment_destinations')
    .select('*').eq('active', true).order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function savePaymentDestination(params: Record<string, any> = {}): Promise<any> {
  const row: Record<string, any> = {
    name:           params.name,
    bank_name:      params.bankName      || null,
    branch_name:    params.branchName    || null,
    account_type:   params.accountType   || null,
    account_number: params.accountNumber || null,
    account_holder: params.accountHolder || null,
    memo:           params.memo          || null,
    active:         true
  };
  if (params.id) {
    const { error } = await _sb.from('payment_destinations').update(row).eq('id', params.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await _sb.from('payment_destinations').insert(row);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function deletePaymentDestination(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('payment_destinations').update({ active: false }).eq('id', params.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getExpenseTemplates(_params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await _sb.from('store_expense_templates')
    .select('*').eq('active', true).order('category').order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function saveExpenseTemplate(params: Record<string, any> = {}): Promise<any> {
  const { id, name, category, amount, paymentDestId } = params;
  const row: Record<string, any> = {
    name, category: category || 'その他',
    amount: amount != null && amount !== '' ? Number(amount) : null,
    payment_destination_id: paymentDestId || null
  };
  let data: any, error: any;
  if (id) {
    ({ data, error } = await _sb.from('store_expense_templates').update(row).eq('id', id).select().single());
  } else {
    ({ data, error } = await _sb.from('store_expense_templates').insert(row).select().single());
  }
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteExpenseTemplate(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('store_expense_templates').update({ active: false }).eq('id', params.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getAllStoreFixedCostSummary(params: Record<string, any> = {}): Promise<any> {
  const [r1, r2, r3] = await Promise.all([
    _sb.from('store_fixed_costs').select('*').eq('active', true).order('category').order('name'),
    _sb.from('fixed_cost_payments').select('*').eq('period', params.period),
    _sb.from('payment_destinations').select('*').eq('active', true)
  ]);
  if (r1.error) throw new Error(r1.error.message);
  if (r2.error) throw new Error(r2.error.message);
  if (r3.error) throw new Error(r3.error.message);
  return { masters: r1.data || [], payments: r2.data || [], paymentDests: r3.data || [] };
}
