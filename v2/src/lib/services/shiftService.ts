import { _sb } from '../config';
import { _fmtDatetimeJp, _fmtTimeJp, _normalizeTime } from '../helpers';

async function _getTherapistId(name: string): Promise<string | null> {
  if (!name) return null;
  const { data } = await _sb.from('therapists')
    .select('id').eq('store_id', (window as any).STORE_ID as string).eq('name', name).maybeSingle();
  return data ? data.id : null;
}

const LINE_PUSH = 'https://rzfprialypdoyklfwpyg.supabase.co/functions/v1/line-push';

export async function submitShiftBulk(params: Record<string, any> = {}): Promise<any> {
  const items = (params.items || []);
  const therapistId = await _getTherapistId(params.therapist);
  const rows = items.map((item: any) => ({
    store_id:       (window as any).STORE_ID,
    therapist_id:   therapistId,
    therapist_name: params.therapist,
    date:           item.date,
    start_time:     item.startTime,
    end_time:       item.endTime,
    status:         'pending',
    memo:           item.memo || null,
    submitted_at:   new Date().toISOString()
  }));
  const { error } = await _sb.from('shifts').insert(rows);
  if (error) throw new Error(error.message);
  return { ok: true, count: rows.length };
}

export async function getShifts(params: Record<string, any> = {}): Promise<any> {
  let q: any = _sb.from('shifts').select('*').eq('store_id', (window as any).STORE_ID).order('date').order('start_time');
  if (params.therapist)  q = q.eq('therapist_name', params.therapist);
  if (params.status)     q = q.eq('status', params.status);
  if (params.date)       q = q.eq('date', params.date);
  if (params.futureOnly) q = q.gte('date', new Date().toISOString().slice(0,10));
  if (params.month) {
    const [y, m] = params.month.split('-');
    const from = y + '-' + m + '-01';
    const toD  = new Date(Number(y), Number(m), 0);
    const to   = y + '-' + m + '-' + String(toD.getDate()).padStart(2,'0');
    q = q.gte('date', from).lte('date', to);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    row:         r.id,
    submittedAt: _fmtDatetimeJp(r.submitted_at),
    therapist:   r.therapist_name || '',
    date:        r.date ? r.date.replace(/-/g, '/') : '',
    startTime:   _fmtTimeJp(r.start_time),
    endTime:     _fmtTimeJp(r.end_time),
    status:      r.status || 'pending',
    approvedAt:  _fmtDatetimeJp(r.approved_at),
    memo:        r.memo || '',
    roomId:        r.room_id || '',
    roomName:      r.room_name || '',
    attendanceType:     r.attendance_type || 'normal',
    hasChangeRequest:   r.has_change_request || false,
    changeRequestStart: r.change_request_start || '',
    changeRequestEnd:   r.change_request_end   || '',
    changeRequestMemo:  r.change_request_memo  || '',
    isDayoffRequest:    r.is_dayoff_request || false,
    checkinTime:        r.checkin_time  ? _fmtTimeJp(r.checkin_time)  : '',
    checkoutTime:       r.checkout_time ? _fmtTimeJp(r.checkout_time) : '',
    _id:           r.id
  }));
}

export async function approveShift(params: Record<string, any> = {}): Promise<any> {
  const row = params.row;
  if (!row) throw new Error('シフトIDが無効です: ' + params.row);
  const { error } = await _sb.from('shifts').update({
    status: 'approved',
    approved_at: new Date().toISOString()
  }).eq('id', row).eq('store_id', (window as any).STORE_ID);
  if (error) throw new Error('承認エラー: ' + error.message);
  const { data: check } = await _sb.from('shifts').select('status').eq('id', row).single();
  if (!check || check.status !== 'approved') {
    throw new Error('承認の更新に失敗しました（RLS制限の可能性）。Supabaseのポリシーを確認してください。');
  }
  return { ok: true };
}

export async function rejectShift(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('shifts').update({
    status: 'rejected',
    approved_at: new Date().toISOString(),
    memo: params.reason || null
  }).eq('id', params.row).eq('store_id', (window as any).STORE_ID);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function restoreShiftToPending(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('shifts').update({
    status: 'pending',
    approved_at: null,
    memo: null
  }).eq('id', params.row).eq('store_id', (window as any).STORE_ID);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteShift(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('shifts').delete().eq('id', params.row).eq('store_id', (window as any).STORE_ID);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function submitDayoffRequest(params: Record<string, any> = {}): Promise<any> {
  const therapistId = await _getTherapistId(params.therapist);
  const { data: dupCheck } = await _sb.from('shifts')
    .select('id, status')
    .eq('store_id', (window as any).STORE_ID)
    .eq('therapist_name', params.therapist)
    .eq('date', params.date)
    .eq('is_dayoff_request', true)
    .neq('status', 'rejected')
    .maybeSingle();
  if (dupCheck) return { ok: false, message: 'すでにお休み申請済みです' };
  const { error } = await _sb.from('shifts').insert({
    store_id:          (window as any).STORE_ID,
    therapist_id:      therapistId,
    therapist_name:    params.therapist,
    date:              params.date,
    start_time:        '00:00',
    end_time:          '00:00',
    status:            'pending',
    is_dayoff_request: true,
    memo:              params.reason || null,
    submitted_at:      new Date().toISOString()
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getDayoffRequests(_params: Record<string, any> = {}): Promise<any> {
  const { data, error } = await _sb.from('shifts')
    .select('*')
    .eq('store_id', (window as any).STORE_ID)
    .eq('is_dayoff_request', true)
    .eq('status', 'pending')
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    row:       r.id,
    therapist: r.therapist_name || '',
    date:      r.date ? r.date.replace(/-/g, '/') : '',
    reason:    r.memo || '',
  }));
}

export async function approveDayoffRequest(params: Record<string, any> = {}): Promise<any> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const shiftDateStr = (params.date || '').replace(/\//g, '-');
  const attType = shiftDateStr === todayStr ? 'absent' : 'pre_absent';
  const { error } = await _sb.from('shifts').update({
    status:          'approved',
    attendance_type: attType,
    approved_at:     new Date().toISOString()
  }).eq('id', params.row).eq('store_id', (window as any).STORE_ID);
  if (error) throw new Error(error.message);
  await _sb.from('shifts').update({ attendance_type: attType })
    .eq('store_id', (window as any).STORE_ID)
    .eq('therapist_name', params.therapist)
    .eq('date', shiftDateStr)
    .eq('status', 'approved')
    .eq('is_dayoff_request', false);
  return { ok: true, attendanceType: attType };
}

export async function rejectDayoffRequest(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('shifts').update({
    status: 'rejected',
    memo:   params.reason || null
  }).eq('id', params.row).eq('store_id', (window as any).STORE_ID);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setAttendance(params: Record<string, any> = {}): Promise<any> {
  const upd = { attendance_type: params.attendanceType || 'normal' };
  const { error } = await _sb.from('shifts').update(upd).eq('id', params.row);
  if (error) throw new Error(error.message);
  if (params.attendanceType === 'absent' || params.attendanceType === 'noshow') {
    const { data: shiftData } = await _sb.from('shifts').select('therapist_name,date').eq('id', params.row).single();
    if (shiftData) {
      await _sb.from('reservations')
        .update({ status: 'cancelled' })
        .eq('store_id', (window as any).STORE_ID)
        .eq('therapist_name', shiftData.therapist_name)
        .gte('date', shiftData.date + 'T00:00:00+09:00')
        .lte('date', shiftData.date + 'T23:59:59+09:00')
        .neq('status', 'cancelled');
    }
  }
  return { ok: true };
}

export async function assignRoomToShift(params: Record<string, any> = {}): Promise<any> {
  const { error } = await _sb.from('shifts').update({
    room_id:   params.roomId || null,
    room_name: params.roomName || null
  }).eq('id', params.row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function updateShift(params: Record<string, any> = {}): Promise<any> {
  const upd: Record<string, any> = {};
  if (params.date)      upd.date       = params.date.replace(/\//g, '-');
  if (params.startTime) upd.start_time = params.startTime;
  if (params.endTime)   upd.end_time   = params.endTime;
  if (params.memo !== undefined) upd.memo = params.memo || null;
  if (params.roomId !== undefined)       upd.room_id       = params.roomId       || null;
  if (params.roomName !== undefined)     upd.room_name     = params.roomName     || null;
  if (params.checkinTime  !== undefined) upd.checkin_time  = params.checkinTime  || null;
  if (params.checkoutTime !== undefined) upd.checkout_time = params.checkoutTime || null;
  const { error } = await _sb.from('shifts').update(upd).eq('id', params.row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function addInterviewShift(params: Record<string, any> = {}): Promise<any> {
  const { data: shiftData, error } = await _sb.from('shifts').insert({
    store_id:       (window as any).STORE_ID,
    therapist_name: params.therapist,
    date:           params.date.replace(/\//g, '-'),
    start_time:     _normalizeTime(params.startTime),
    end_time:       _normalizeTime(params.endTime),
    status:         'approved',
    room_id:        params.roomId   || null,
    room_name:      params.roomName || null,
    memo:           params.memo || null,
    submitted_at:   new Date().toISOString(),
    approved_at:    new Date().toISOString()
  }).select('id').single();
  if (error) throw new Error(error.message);
  return { ok: true, shiftId: shiftData?.id || null };
}

export async function sendShiftReminder(_params: Record<string, any> = {}): Promise<any> {
  try {
    const now = new Date();
    const day = now.getDay();
    const diff = (8 - day) % 7 || 7;
    const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmtD = (d: Date) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const monStr = fmtD(mon), sunStr = fmtD(sun);
    const weekLabel = monStr.replace(/-/g,'/') + '〜' + sunStr.replace(/-/g,'/');
    const [tRes, sRes] = await Promise.all([
      _sb.from('therapists').select('name,line_user_id').eq('store_id', (window as any).STORE_ID).eq('active', true),
      _sb.from('shifts').select('therapist_name,status').eq('store_id', (window as any).STORE_ID).gte('date', monStr).lte('date', sunStr)
    ]);
    const submittedSet = new Set((sRes.data || []).map((s: any) => s.therapist_name));
    const targets = (tRes.data || []).filter((t: any) => t.name && t.name !== '管理者' && !submittedSet.has(t.name) && t.line_user_id);
    let sent = 0;
    for (const t of targets) {
      const msg = `【シフト提出リマインド】\n${weekLabel}のシフトがまだ提出されていません。\nLINEで「ログイン」と送信して提出してください。`;
      await fetch(LINE_PUSH + '?action=sendLineMessage&userId=' + encodeURIComponent(t.line_user_id) + '&message=' + encodeURIComponent(msg));
      sent++;
    }
    return { ok: true, sent };
  } catch(e: any) { return { ok: false, error: e.message }; }
}

export async function sendReminderToOne(params: Record<string, any> = {}): Promise<any> {
  try {
    const now = new Date();
    const day = now.getDay();
    const diff = (8 - day) % 7 || 7;
    const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmtD = (d: Date) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const weekLabel = fmtD(mon).replace(/-/g,'/') + '〜' + fmtD(sun).replace(/-/g,'/');
    const msg = `【シフト提出リマインド】\n${weekLabel}のシフトがまだ提出されていません。\nLINEで「ログイン」と送信して提出してください。`;
    await fetch(LINE_PUSH + '?action=sendLineMessage&userId=' + encodeURIComponent(params.userId) + '&message=' + encodeURIComponent(msg));
    return { ok: true };
  } catch(e: any) { return { ok: false, error: e.message }; }
}
