import { sb, ctx } from '../lib/supabase';

export async function getScoutCompanies() {
  const { data } = await sb.from('scout_companies')
    .select('*').eq('store_id', ctx.storeId).eq('active', true).order('created_at');
  return data || [];
}

export async function saveScoutCompany(params: { id?: string; name: string; back_rate: number; advisory_fee: number }) {
  if (params.id) {
    const { data, error } = await sb.from('scout_companies')
      .update({ name: params.name, back_rate: params.back_rate, advisory_fee: params.advisory_fee })
      .eq('id', params.id).select().single();
    if (error) throw new Error(error.message);
    return data;
  } else {
    const { data, error } = await sb.from('scout_companies')
      .insert({ store_id: ctx.storeId, name: params.name, back_rate: params.back_rate, advisory_fee: params.advisory_fee })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  }
}

export async function getTherapistScout(therapistId: string) {
  const { data } = await sb.from('therapist_scouts')
    .select('*, scout_companies(*)')
    .eq('store_id', ctx.storeId).eq('therapist_id', therapistId).eq('active', true).maybeSingle();
  return data || null;
}

export async function saveTherapistScout(params: { therapistId: string; companyId: string }) {
  const { error } = await sb.from('therapist_scouts')
    .upsert({ store_id: ctx.storeId, therapist_id: params.therapistId, company_id: params.companyId, active: true },
      { onConflict: 'store_id,therapist_id' });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteTherapistScout(therapistId: string) {
  const { error } = await sb.from('therapist_scouts')
    .update({ active: false }).eq('store_id', ctx.storeId).eq('therapist_id', therapistId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getScoutSummary(month: string) {
  const [y, m] = month.split('-').map(Number);
  const startDt = new Date(y, m - 1, 1, 3, 0, 0);
  const endDt   = new Date(y, m,     1, 2, 59, 59);

  const { data: scouts, error: scoutErr } = await sb.from('therapist_scouts')
    .select('therapist_id, company_id').eq('store_id', ctx.storeId).eq('active', true);
  if (scoutErr) throw new Error('scouts: ' + scoutErr.message);
  if (!scouts || !scouts.length) return [];

  const therapistIds = scouts.map((s: any) => s.therapist_id);
  const companyIds   = [...new Set(scouts.map((s: any) => s.company_id))];

  const { data: therapistRows, error: tErr } = await sb.from('therapists')
    .select('id, name, course_back').in('id', therapistIds).eq('active', true);
  if (tErr) throw new Error('therapists: ' + tErr.message);

  const { data: companyRows, error: cErr } = await sb.from('scout_companies')
    .select('id, name, back_rate, advisory_fee').in('id', companyIds).eq('active', true);
  if (cErr) throw new Error('companies: ' + cErr.message);

  const { data: sales } = await sb.from('sales')
    .select('therapist_id, date, course_price').eq('store_id', ctx.storeId)
    .in('therapist_id', therapistIds)
    .gte('date', startDt.toISOString()).lte('date', endDt.toISOString());

  const therapistNames = (therapistRows || []).map((t: any) => t.name);
  const mStr = String(m).padStart(2, '0');
  const { data: shifts } = await sb.from('shifts')
    .select('therapist_name, date').eq('store_id', ctx.storeId)
    .in('therapist_name', therapistNames).eq('status', 'approved')
    .neq('attendance_type', 'absent').neq('attendance_type', 'noshow')
    .gte('date', `${y}-${mStr}-01`).lte('date', `${y}-${mStr}-31`);

  const tMap  = Object.fromEntries((therapistRows || []).map((t: any) => [t.id, t]));
  const coMap = Object.fromEntries((companyRows  || []).map((c: any) => [c.id, c]));

  return scouts.map((s: any) => {
    const t  = tMap[s.therapist_id];
    const co = coMap[s.company_id];
    if (!t || !co) return null;
    const courseBack = Number(t.course_back) || 0;
    const backRate   = Number(co.back_rate) || 0;
    const advFee     = Number(co.advisory_fee) || 0;
    const dayMap: Record<string, number> = {};
    (sales || []).filter((r: any) => r.therapist_id === t.id).forEach((r: any) => {
      const d = new Date(r.date);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (!dayMap[key]) dayMap[key] = 0;
      dayMap[key] += Number(r.course_price) || 0;
    });
    const days = Object.entries(dayMap).map(([date, courseTotal]) => ({
      date, sb: Math.round(courseTotal * courseBack * backRate),
    }));
    const workDays = (shifts || []).filter((r: any) => r.therapist_name === t.name).length;
    const totalSb  = days.reduce((sum, d) => sum + d.sb, 0);
    const advisory = workDays * advFee;
    return {
      therapistId: t.id, therapistName: t.name,
      companyId: co.id, companyName: co.name,
      backRate, advisoryFee: advFee, courseBack,
      workDays, totalSb, advisory, total: totalSb + advisory, days,
    };
  }).filter(Boolean);
}
