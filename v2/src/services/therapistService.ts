import { sb, ctx, LINE_PUSH_URL } from '../lib/supabase';

function mapTherapist(t: any) {
  return {
    name:             t.name,
    userId:           t.line_user_id || '',
    displayName:      t.line_display_name || '',
    registeredAt:     t.registered_at || '',
    interval:         t.interval_min ?? 30,
    courseBack:       t.course_back != null ? Number(t.course_back) : '',
    optionBack:       t.option_back != null ? Number(t.option_back) : '',
    hasGuarantee:     t.has_guarantee || false,
    email:            t.email || '',
    id:               t.id,
    nominationFee:    t.nomination_fee != null ? Number(t.nomination_fee) : null,
    hourlyRate:       t.hourly_rate    != null ? Number(t.hourly_rate)    : null,
    dailyGuarantee:   t.daily_guarantee != null ? Number(t.daily_guarantee) : null,
    sendPayrollLine:  t.send_payroll_line !== false,
    sendStoreLine:    t.send_store_line   !== false,
    discountMode:     t.discount_mode || null,
    parkingFee:       t.parking_fee   != null ? Number(t.parking_fee)   : null,
    extensionBack:    t.extension_back != null ? Number(t.extension_back) : null,
    extensionBackHon: t.extension_back_honshimei != null ? Number(t.extension_back_honshimei) : null,
  };
}

export async function getTherapists() {
  const { data, error } = await sb.from('therapists')
    .select('*').eq('store_id', ctx.storeId)
    .eq('active', true).eq('is_interview', false).eq('is_admin', false)
    .order('registered_at');
  if (error) throw new Error(error.message);
  return (data || []).map(mapTherapist);
}

export async function getTherapistProfiles() {
  const { data, error } = await sb.from('therapists')
    .select('id,name,age,cup,real_name,profile_notes')
    .eq('store_id', ctx.storeId).eq('active', true)
    .eq('is_interview', false).eq('is_admin', false).order('registered_at');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveTherapistProfile(params: { id: string; age?: number; cup?: string; real_name?: string; profile_notes?: string }) {
  const { id, age, cup, real_name, profile_notes } = params;
  const { error } = await sb.from('therapists').update({ age, cup, real_name, profile_notes }).eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getLineUsers() {
  const { data, error } = await sb.from('therapists')
    .select('*').eq('store_id', ctx.storeId).eq('active', true).order('registered_at');
  if (error) throw new Error(error.message);
  return (data || []).map(t => ({ ...mapTherapist(t), isInterview: t.is_interview === true }));
}

export async function getInitialData() {
  const [tRes, rRes, mRes] = await Promise.all([
    sb.from('therapists').select('*').eq('store_id', ctx.storeId).eq('active', true).eq('is_admin', false).order('registered_at'),
    sb.from('rooms').select('*').eq('store_id', ctx.storeId).eq('active', true).order('display_order'),
    sb.from('menus').select('*').eq('store_id', ctx.storeId).eq('active', true).order('display_order'),
  ]);
  const therapists = (tRes.data || []).map((t: any) => ({
    name: t.name, userId: t.line_user_id || '', displayName: t.line_display_name || '',
    registeredAt: t.registered_at || '', interval: t.interval_min ?? 30,
    courseBack: t.course_back != null ? Number(t.course_back) : '',
    email: t.email || '', id: t.id,
    nominationFee: t.nomination_fee != null ? Number(t.nomination_fee) : null,
    hourlyRate: t.hourly_rate != null ? Number(t.hourly_rate) : null,
    dailyGuarantee: t.daily_guarantee != null ? Number(t.daily_guarantee) : null,
    hasGuarantee: t.has_guarantee || false,
  }));
  const rooms = (rRes.data || []).map((r: any, i: number) => ({
    row: i + 1, id: r.id, name: r.name || '', col3: r.description || '',
    col4: r.guest_guide || '', order: r.display_order || 0, active: r.active,
  }));
  const menus = (mRes.data || []).map((r: any, i: number) => ({
    row: i + 1, id: r.id, name: r.name || '', col3: r.duration_min || '',
    col4: r.price || '', order: r.display_order || 0, active: r.active,
  }));
  return { therapists, rooms, menus };
}

export async function getTherapistInterval(name: string): Promise<number> {
  const { data } = await sb.from('therapists')
    .select('interval_min').eq('store_id', ctx.storeId).eq('name', name).single();
  return data ? data.interval_min : 30;
}

export async function getTherapistCourseBack(name: string): Promise<number> {
  const { data } = await sb.from('therapists')
    .select('course_back').eq('store_id', ctx.storeId).eq('name', name).single();
  return data && data.course_back != null ? Number(data.course_back) : 0.5;
}

export async function updateLineUser(params: Record<string, any>) {
  const upd: Record<string, any> = {};
  if (params.name      !== undefined) upd.name         = params.name;
  if (params.interval  !== undefined) upd.interval_min = Number(params.interval);
  if (params.courseBack !== undefined && params.courseBack !== '') upd.course_back = Number(params.courseBack);
  if (params.optionBack !== undefined && params.optionBack !== '') upd.option_back = Number(params.optionBack);
  if (params.hasGuarantee !== undefined) upd.has_guarantee = params.hasGuarantee;
  if (params.email     !== undefined) upd.email        = params.email;
  if (params.nominationFee !== undefined) upd.nomination_fee = params.nominationFee === '' || params.nominationFee === null ? null : Number(params.nominationFee);
  if (params.hourlyRate !== undefined) upd.hourly_rate = params.hourlyRate === '' || params.hourlyRate === null ? null : Number(params.hourlyRate);
  if (params.dailyGuarantee !== undefined) upd.daily_guarantee = params.dailyGuarantee === '' || params.dailyGuarantee === null ? null : Number(params.dailyGuarantee);
  if (params.sendPayrollLine !== undefined) upd.send_payroll_line = params.sendPayrollLine;
  if (params.sendStoreLine   !== undefined) upd.send_store_line   = params.sendStoreLine;
  if (params.discountMode    !== undefined) upd.discount_mode     = params.discountMode || null;
  if (params.parkingFee      !== undefined) upd.parking_fee       = params.parkingFee === '' || params.parkingFee === null ? null : Number(params.parkingFee);
  if (params.extensionBack   !== undefined) upd.extension_back             = params.extensionBack   === '' || params.extensionBack   === null ? null : Number(params.extensionBack);
  if (params.extensionBackHon !== undefined) upd.extension_back_honshimei  = params.extensionBackHon === '' || params.extensionBackHon === null ? null : Number(params.extensionBackHon);
  const { error } = await sb.from('therapists').update(upd).eq('store_id', ctx.storeId).eq('line_user_id', params.userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deactivateTherapist(userId: string) {
  const { error } = await sb.from('therapists').update({ active: false }).eq('store_id', ctx.storeId).eq('line_user_id', userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function saveManualLineEntry(params: Record<string, any>) {
  const dupCheck = await sb.from('therapists').select('id').eq('store_id', ctx.storeId).eq('name', params.name || '').eq('active', true).maybeSingle();
  if (dupCheck.data) throw new Error('「' + params.name + '」はすでに登録されています。別の源氏名を使用してください。');
  const { error } = await sb.from('therapists').insert({
    store_id:     ctx.storeId,
    name:         params.name || '',
    line_user_id: params.userId || null,
    interval_min: Number(params.interval || 30),
    course_back:  params.courseBack !== undefined && params.courseBack !== '' ? Number(params.courseBack) : null,
    email:        params.email || null,
    nomination_fee: params.nominationFee !== undefined && params.nominationFee !== '' ? Number(params.nominationFee) : null,
    active:       true,
    is_interview: params.isInterview === true,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function hireTherapist(id: string) {
  const { error } = await sb.from('therapists').update({ is_interview: false }).eq('id', id).eq('store_id', ctx.storeId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function rejectTherapist(id: string) {
  const { error } = await sb.from('therapists').delete().eq('id', id).eq('store_id', ctx.storeId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function linkLineUser(id: string, userId: string) {
  const { error } = await sb.from('therapists').update({ line_user_id: userId }).eq('id', id).eq('store_id', ctx.storeId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getInterviews() {
  const { data, error } = await sb.from('interviews')
    .select('*').eq('store_id', ctx.storeId).order('interview_date', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveInterview(params: Record<string, any>) {
  const rec = {
    store_id:         ctx.storeId,
    shift_id:         params.shift_id || null,
    name:             params.name || '',
    interview_date:   params.interview_date || null,
    status:           params.status || 'scheduled',
    age:              params.age || null,
    height:           params.height || null,
    cup:              params.cup || null,
    has_experience:   params.has_experience || false,
    experience_years: params.experience_years || null,
    past_stores:      params.past_stores || null,
    quit_reason:      params.quit_reason || null,
    motivation:       params.motivation || null,
    past_salary:      params.past_salary || null,
    other_interviews: params.other_interviews || false,
    work_days:        params.work_days || null,
    work_hours:       params.work_hours || null,
    preferred_time:   params.preferred_time || null,
    anxiety:          params.anxiety || null,
    qa_memo:          params.qa_memo || null,
    updated_at:       new Date().toISOString(),
  };
  let result: any;
  if (params.id) {
    result = await sb.from('interviews').update(rec).eq('id', params.id);
  } else {
    result = await sb.from('interviews').insert(rec).select('id').single();
  }
  if (result.error) throw new Error(result.error.message);
  if (params.status === 'confirmed' && params.therapist_name_original) {
    const { data: th } = await sb.from('therapists').select('id')
      .eq('store_id', ctx.storeId).eq('name', params.therapist_name_original).eq('active', true).maybeSingle();
    if (th) {
      await sb.from('therapists').update({ name: params.name, is_interview: false }).eq('id', th.id);
    } else {
      await sb.from('therapists').insert({ store_id: ctx.storeId, name: params.name, interval_min: 30, active: true, is_interview: false });
    }
  }
  if (params.status === 'rejected') {
    if (params.therapist_name_original) {
      const { data: th } = await sb.from('therapists').select('id')
        .eq('store_id', ctx.storeId).eq('name', params.therapist_name_original).eq('active', true).maybeSingle();
      if (th) await sb.from('therapists').delete().eq('id', th.id);
    }
    if (params.shift_id) await sb.from('shifts').delete().eq('id', params.shift_id);
  }
  return { ok: true, id: result.data?.id || params.id };
}

export async function deleteInterview(id: string) {
  const { data: iv } = await sb.from('interviews').select('name,shift_id').eq('id', id).maybeSingle();
  if (iv) {
    if (iv.shift_id) await sb.from('shifts').delete().eq('id', iv.shift_id);
    const { data: th } = await sb.from('therapists').select('id')
      .eq('store_id', ctx.storeId).eq('name', iv.name).eq('is_interview', true).maybeSingle();
    if (th) await sb.from('therapists').delete().eq('id', th.id);
  }
  const { error } = await sb.from('interviews').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function checkTherapistName(name: string) {
  const { data } = await sb.from('therapists').select('id')
    .eq('store_id', ctx.storeId).eq('name', name || '').eq('active', true).maybeSingle();
  return { exists: !!data };
}

export async function registerTherapistFromLine(params: { name: string; userId: string }) {
  const name   = (params.name || '').trim();
  const userId = params.userId || '';
  if (!name) return { ok: false, reason: 'empty_name' };
  const { data: dup } = await sb.from('therapists').select('id')
    .eq('store_id', ctx.storeId).eq('name', name).eq('active', true).maybeSingle();
  if (dup) return { ok: false, reason: 'duplicate', name };
  const { data: existing } = await sb.from('therapists').select('id,name')
    .eq('store_id', ctx.storeId).eq('line_user_id', userId).eq('active', true).maybeSingle();
  if (existing) {
    await sb.from('therapists').update({ name }).eq('id', existing.id);
    return { ok: true, updated: true, name };
  }
  const { error } = await sb.from('therapists').insert({
    store_id: ctx.storeId, name, line_user_id: userId, interval_min: 30, active: true,
  });
  if (error) throw new Error(error.message);
  return { ok: true, updated: false, name };
}

export async function getTherapistMaster() {
  const { data } = await sb.from('therapists').select('*')
    .eq('store_id', ctx.storeId).eq('active', true).order('registered_at');
  return (data || []).map((t: any) => ({
    id: t.id, name: t.name, userId: t.line_user_id || '',
    interval: t.interval_min ?? 30,
    courseBack: t.course_back != null ? Number(t.course_back) : '',
    email: t.email || '',
  }));
}

export async function getMenuBacks(therapistId: string) {
  const { data, error } = await sb.from('therapist_menu_backs')
    .select('*').eq('store_id', ctx.storeId).eq('therapist_id', therapistId);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function saveMenuBacks(params: { therapistId: string; backs: Array<{ menu_id: string; back_amount: any; back_amount_honshimei?: any }> }) {
  const { therapistId, backs } = params;
  await sb.from('therapist_menu_backs').delete().eq('store_id', ctx.storeId).eq('therapist_id', therapistId);
  const inserts = backs
    .filter(b => (b.back_amount !== '' && b.back_amount !== null) ||
                 (b.back_amount_honshimei !== '' && b.back_amount_honshimei !== null && b.back_amount_honshimei !== undefined))
    .map(b => ({
      store_id:              ctx.storeId,
      therapist_id:          therapistId,
      menu_id:               b.menu_id,
      back_amount:           (b.back_amount !== '' && b.back_amount !== null) ? Number(b.back_amount) : null,
      back_amount_honshimei: (b.back_amount_honshimei !== '' && b.back_amount_honshimei !== null && b.back_amount_honshimei !== undefined) ? Number(b.back_amount_honshimei) : null,
    }));
  if (inserts.length) {
    const { error } = await sb.from('therapist_menu_backs').insert(inserts);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function getUnsubmittedTherapists() {
  const now  = new Date();
  const day  = now.getDay();
  const diff = (8 - day) % 7 || 7;
  const mon  = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0, 0, 0, 0);
  const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmtD = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const monStr = fmtD(mon), sunStr = fmtD(sun);
  const [tRes, sRes] = await Promise.all([
    sb.from('therapists').select('name,line_user_id').eq('store_id', ctx.storeId).eq('active', true),
    sb.from('shifts').select('therapist_name,status').eq('store_id', ctx.storeId).gte('date', monStr).lte('date', sunStr),
  ]);
  const all          = (tRes.data || []).filter((t: any) => t.name && t.name !== '管理者');
  const submittedSet = new Set((sRes.data || []).map((s: any) => s.therapist_name));
  const unsubmitted  = all.filter((t: any) => !submittedSet.has(t.name)).map((t: any) => ({ name: t.name, userId: t.line_user_id || '' }));
  const submitted    = all.filter((t: any) =>  submittedSet.has(t.name)).map((t: any) => t.name);
  return { unsubmitted, submitted, weekLabel: monStr.replace(/-/g, '/') + ' 〜 ' + sunStr.replace(/-/g, '/') };
}

export async function sendShiftReminder() {
  try {
    const now  = new Date();
    const day  = now.getDay();
    const diff = (8 - day) % 7 || 7;
    const mon  = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0, 0, 0, 0);
    const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmtD = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const monStr = fmtD(mon), sunStr = fmtD(sun);
    const weekLabel = monStr.replace(/-/g, '/') + '〜' + sunStr.replace(/-/g, '/');
    const [tRes, sRes] = await Promise.all([
      sb.from('therapists').select('name,line_user_id').eq('store_id', ctx.storeId).eq('active', true),
      sb.from('shifts').select('therapist_name,status').eq('store_id', ctx.storeId).gte('date', monStr).lte('date', sunStr),
    ]);
    const submittedSet = new Set((sRes.data || []).map((s: any) => s.therapist_name));
    const targets = (tRes.data || []).filter((t: any) => t.name && t.name !== '管理者' && !submittedSet.has(t.name) && t.line_user_id);
    let sent = 0;
    for (const t of targets) {
      const msg = `【シフト提出リマインド】\n${weekLabel}のシフトがまだ提出されていません。\nLINEで「ログイン」と送信して提出してください。`;
      await fetch(LINE_PUSH_URL + '?action=sendLineMessage&userId=' + encodeURIComponent(t.line_user_id) + '&message=' + encodeURIComponent(msg));
      sent++;
    }
    return { ok: true, sent };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function sendReminderToOne(userId: string) {
  try {
    const now  = new Date();
    const day  = now.getDay();
    const diff = (8 - day) % 7 || 7;
    const mon  = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0, 0, 0, 0);
    const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmtD = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const weekLabel = fmtD(mon).replace(/-/g, '/') + '〜' + fmtD(sun).replace(/-/g, '/');
    const msg = `【シフト提出リマインド】\n${weekLabel}のシフトがまだ提出されていません。\nLINEで「ログイン」と送信して提出してください。`;
    await fetch(LINE_PUSH_URL + '?action=sendLineMessage&userId=' + encodeURIComponent(userId) + '&message=' + encodeURIComponent(msg));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
