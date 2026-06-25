import { _sb } from '../config';

export async function getScoutCompanies(_params: Record<string, any> = {}): Promise<any> {
  const { data } = await _sb.from('scout_companies')
    .select('*').eq('store_id', (window as any).STORE_ID).eq('active', true).order('created_at');
  return data || [];
}

export async function saveScoutCompany(params: Record<string, any> = {}): Promise<any> {
  if (params.id) {
    const { data, error } = await _sb.from('scout_companies')
      .update({ name: params.name, back_rate: params.back_rate, advisory_fee: params.advisory_fee })
      .eq('id', params.id).select().single();
    if (error) throw new Error(error.message);
    return data;
  } else {
    const { data, error } = await _sb.from('scout_companies')
      .insert({ store_id: (window as any).STORE_ID, name: params.name, back_rate: params.back_rate, advisory_fee: params.advisory_fee })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  }
}

export async function getTherapistScout(params: Record<string, any> = {}): Promise<any> {
  const { data } = await _sb.from('therapist_scouts')
    .select('*, scout_companies(*)')
    .eq('store_id', (window as any).STORE_ID).eq('therapist_id', params.therapist_id).eq('active', true).maybeSingle();
  return data || null;
}

export async function saveTherapistScout(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('therapist_scouts')
    .upsert({ store_id: (window as any).STORE_ID, therapist_id: params.therapist_id, company_id: params.company_id, active: true },
      { onConflict: 'store_id,therapist_id' });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteTherapistScout(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('therapist_scouts')
    .update({ active: false })
    .eq('store_id', (window as any).STORE_ID).eq('therapist_id', params.therapist_id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getScoutSummary(params: Record<string, any> = {}): Promise<any> {
  const ym = params.month; // "2026-05"
  const [y, m] = ym.split('-').map(Number);
  const startDt = new Date(y, m-1, 1, 3, 0, 0);
  const endDt   = new Date(y, m,   1, 2, 59, 59);

  const { data: scouts, error: scoutErr } = await _sb.from('therapist_scouts')
    .select('therapist_id, company_id')
    .eq('store_id', (window as any).STORE_ID).eq('active', true);
  if (scoutErr) throw new Error('scouts: ' + scoutErr.message);
  if (!scouts || !scouts.length) return [];

  const therapistIds = scouts.map((s: any) => s.therapist_id);
  const companyIds   = [...new Set(scouts.map((s: any) => s.company_id))];

  const { data: therapistRows, error: tErr } = await _sb.from('therapists')
    .select('id, name, course_back')
    .in('id', therapistIds).eq('active', true);
  if (tErr) throw new Error('therapists: ' + tErr.message);

  const { data: companyRows, error: cErr } = await _sb.from('scout_companies')
    .select('id, name, back_rate, advisory_fee')
    .in('id', companyIds).eq('active', true);
  if (cErr) throw new Error('companies: ' + cErr.message);

  const { data: sales } = await _sb.from('sales')
    .select('therapist_id, date, course_price')
    .eq('store_id', (window as any).STORE_ID)
    .in('therapist_id', therapistIds)
    .gte('date', startDt.toISOString())
    .lte('date', endDt.toISOString());

  const therapistNames = (therapistRows || []).map((t: any) => t.name);
  const mStr = String(m).padStart(2,'0');
  const { data: shifts } = await _sb.from('shifts')
    .select('therapist_name, date')
    .eq('store_id', (window as any).STORE_ID)
    .in('therapist_name', therapistNames)
    .eq('status', 'approved')
    .neq('attendance_type', 'absent')
    .neq('attendance_type', 'noshow')
    .gte('date', `${y}-${mStr}-01`)
    .lte('date', `${y}-${mStr}-31`);

  const tMap  = Object.fromEntries((therapistRows || []).map((t: any) => [t.id, t]));
  const coMap = Object.fromEntries((companyRows || []).map((c: any) => [c.id, c]));

  return scouts.map((s: any) => {
    const t  = tMap[s.therapist_id];
    const co = coMap[s.company_id];
    if (!t || !co) return null;
    const courseBack = Number(t.course_back) || 0;
    const backRate   = Number(co.back_rate) || 0;
    const advFee     = Number(co.advisory_fee) || 0;
    const dayMap: Record<string, number> = {};
    (sales || []).filter((r: any) => r.therapist_id === t.id).forEach((r: any) => {
      const d   = new Date(r.date);
      const key = `${d.getMonth()+1}/${d.getDate()}`;
      if (!dayMap[key]) dayMap[key] = 0;
      dayMap[key] += Number(r.course_price) || 0;
    });
    const days = Object.entries(dayMap).map(([date, courseTotal]) => ({
      date,
      sb: Math.round(courseTotal * courseBack * backRate)
    }));
    const workDays = (shifts || []).filter((r: any) => r.therapist_name === t.name).length;
    const totalSb  = days.reduce((sum: number, d: any) => sum + d.sb, 0);
    const advisory = workDays * advFee;
    return {
      therapistId: t.id, therapistName: t.name,
      companyId: co.id, companyName: co.name,
      backRate, advisoryFee: advFee, courseBack,
      workDays, totalSb, advisory, total: totalSb + advisory, days
    };
  }).filter(Boolean);
}
