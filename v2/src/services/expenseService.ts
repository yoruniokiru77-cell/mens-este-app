import { sb, ctx } from '../lib/supabase';

export async function getExpenses(params: Record<string, any>) {
  let q = sb.from('expenses').select('*').eq('store_id', ctx.storeId).order('date', { ascending: false });
  if (params.startDate) q = q.gte('date', params.startDate);
  if (params.endDate)   q = q.lte('date', params.endDate);
  if (params.therapist) q = q.eq('therapist_name', params.therapist);
  if (params.date)      q = q.eq('date', params.date);
  if (params.storeOnly) q = q.is('therapist_name', null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({ ...r, row: r.id }));
}

export async function saveStoreExpense(params: { date: string; category: string; amount: number; memo?: string }) {
  const { error } = await sb.from('expenses').insert({
    store_id: ctx.storeId, date: params.date, category: params.category,
    amount: Number(params.amount), memo: params.memo || null, therapist_name: null,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function saveExpense(params: Record<string, any>) {
  const { data: existing } = await sb.from('expenses').select('id')
    .eq('store_id', ctx.storeId).eq('date', params.date).eq('category', params.category)
    .eq('therapist_name', params.therapist || '').maybeSingle();
  if (existing) {
    const { error } = await sb.from('expenses').update({ amount: Number(params.amount), memo: params.memo || null }).eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from('expenses').insert({
      store_id: ctx.storeId, date: params.date, category: params.category,
      amount: Number(params.amount), memo: params.memo || null, therapist_name: params.therapist || null,
    });
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function deleteExpenseByCategory(params: { date: string; category: string; therapist?: string }) {
  await sb.from('expenses').delete()
    .eq('store_id', ctx.storeId).eq('date', params.date)
    .eq('category', params.category).eq('therapist_name', params.therapist || '');
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const { error } = await sb.from('expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getFixedCostMasters() {
  const { data, error } = await sb.from('store_fixed_costs')
    .select('*').eq('store_id', ctx.storeId).eq('active', true).order('category').order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveFixedCostMaster(params: Record<string, any>) {
  const row = {
    store_id:               ctx.storeId,
    name:                   params.name,
    category:               params.category,
    room_id:                params.roomId   || null,
    room_name:              params.roomName || null,
    default_amount:         params.amount != null && params.amount !== '' ? Number(params.amount) : null,
    is_variable:            !params.amount,
    due_day:                params.dueDay ? Number(params.dueDay) : null,
    memo:                   params.memo || null,
    payment_destination_id: params.paymentDestId || null,
    active:                 true,
  };
  if (params.id) {
    const { error } = await sb.from('store_fixed_costs').update(row).eq('id', params.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from('store_fixed_costs').insert(row);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function deleteFixedCostMaster(id: string) {
  const { error } = await sb.from('store_fixed_costs').update({ active: false }).eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getFixedCostPayments(period: string) {
  const { data, error } = await sb.from('fixed_cost_payments').select('*').eq('store_id', ctx.storeId).eq('period', period);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveFixedCostPayment(params: Record<string, any>) {
  const { data: existing } = await sb.from('fixed_cost_payments')
    .select('id').eq('fixed_cost_id', params.fixedCostId).eq('period', params.period).maybeSingle();
  const row = {
    store_id: ctx.storeId, fixed_cost_id: params.fixedCostId, period: params.period,
    amount: Number(params.amount), paid: params.paid === true,
    paid_at: params.paid ? new Date().toISOString() : null, memo: params.memo || null,
  };
  if (existing) {
    const { error } = await sb.from('fixed_cost_payments').update(row).eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from('fixed_cost_payments').insert(row);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function getPaymentDestinations() {
  const { data, error } = await sb.from('payment_destinations').select('*').eq('active', true).order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function savePaymentDestination(params: Record<string, any>) {
  const row = {
    name: params.name, bank_name: params.bankName || null, branch_name: params.branchName || null,
    account_type: params.accountType || null, account_number: params.accountNumber || null,
    account_holder: params.accountHolder || null, memo: params.memo || null, active: true,
  };
  if (params.id) {
    const { error } = await sb.from('payment_destinations').update(row).eq('id', params.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from('payment_destinations').insert(row);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function deletePaymentDestination(id: string) {
  const { error } = await sb.from('payment_destinations').update({ active: false }).eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getExpenseTemplates() {
  const { data, error } = await sb.from('store_expense_templates')
    .select('*').eq('active', true).order('category').order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function saveExpenseTemplate(params: Record<string, any>) {
  const { id, name, category, amount, paymentDestId } = params;
  const row = {
    name, category: category || 'その他',
    amount: amount != null && amount !== '' ? Number(amount) : null,
    payment_destination_id: paymentDestId || null,
  };
  let data: any, error: any;
  if (id) {
    ({ data, error } = await sb.from('store_expense_templates').update(row).eq('id', id).select().single());
  } else {
    ({ data, error } = await sb.from('store_expense_templates').insert(row).select().single());
  }
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteExpenseTemplate(id: string) {
  const { error } = await sb.from('store_expense_templates').update({ active: false }).eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getAllStoreFixedCostSummary(period: string) {
  const [r1, r2, r3] = await Promise.all([
    sb.from('store_fixed_costs').select('*').eq('active', true).order('category').order('name'),
    sb.from('fixed_cost_payments').select('*').eq('period', period),
    sb.from('payment_destinations').select('*').eq('active', true),
  ]);
  if (r1.error) throw new Error(r1.error.message);
  if (r2.error) throw new Error(r2.error.message);
  if (r3.error) throw new Error(r3.error.message);
  return { masters: r1.data || [], payments: r2.data || [], paymentDests: r3.data || [] };
}
