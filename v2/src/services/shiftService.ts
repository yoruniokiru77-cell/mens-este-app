import { sb, ctx } from '../lib/supabase';
import { fmtDatetimeJp, fmtTimeJp, normalizeTime, getTherapistId } from '../lib/helpers';

export async function submitShiftBulk(params: { therapist: string; items: Array<{ date: string; startTime: string; endTime: string; memo?: string }> }) {
  const therapistId = await getTherapistId(params.therapist);
  const rows = params.items.map(item => ({
    store_id:       ctx.storeId,
    therapist_id:   therapistId,
    therapist_name: params.therapist,
    date:           item.date,
    start_time:     item.startTime,
    end_time:       item.endTime,
    status:         'pending',
    memo:           item.memo || null,
    submitted_at:   new Date().toISOString(),
  }));
  const { error } = await sb.from('shifts').insert(rows);
  if (error) throw new Error(error.message);
  return { ok: true, count: rows.length };
}

export async function getShifts(params: Record<string, any>) {
  let q = sb.from('shifts').select('*').eq('store_id', ctx.storeId).order('date').order('start_time');
  if (params.therapist)  q = q.eq('therapist_name', params.therapist);
  if (params.status)     q = q.eq('status', params.status);
  if (params.date)       q = q.eq('date', params.date);
  if (params.futureOnly) q = q.gte('date', new Date().toISOString().slice(0, 10));
  if (params.month) {
    const [y, m] = params.month.split('-');
    const from = y + '-' + m + '-01';
    const toD  = new Date(Number(y), Number(m), 0);
    const to   = y + '-' + m + '-' + String(toD.getDate()).padStart(2, '0');
    q = q.gte('date', from).lte('date', to);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    row:         r.id,
    submittedAt: fmtDatetimeJp(r.submitted_at),
    therapist:   r.therapist_name || '',
    date:        r.date ? r.date.replace(/-/g, '/') : '',
    startTime:   fmtTimeJp(r.start_time),
    endTime:     fmtTimeJp(r.end_time),
    status:      r.status || 'pending',
    approvedAt:  fmtDatetimeJp(r.approved_at),
    memo:        r.memo || '',
    roomId:               r.room_id || '',
    roomName:             r.room_name || '',
    attendanceType:       r.attendance_type || 'normal',
    hasChangeRequest:     r.has_change_request || false,
    changeRequestStart:   r.change_request_start || '',
    changeRequestEnd:     r.change_request_end   || '',
    changeRequestMemo:    r.change_request_memo  || '',
    isDayoffRequest:      r.is_dayoff_request || false,
    checkinTime:          r.checkin_time  ? fmtTimeJp(r.checkin_time)  : '',
    checkoutTime:         r.checkout_time ? fmtTimeJp(r.checkout_time) : '',
    _id: r.id,
  }));
}

export async function approveShift(row: string) {
  if (!row) throw new Error('シフトIDが無効です');
  const { error } = await sb.from('shifts').update({
    status: 'approved', approved_at: new Date().toISOString(),
  }).eq('id', row).eq('store_id', ctx.storeId);
  if (error) throw new Error('承認エラー: ' + error.message);
  const { data: check } = await sb.from('shifts').select('status').eq('id', row).single();
  if (!check || check.status !== 'approved') throw new Error('承認の更新に失敗しました（RLS制限の可能性）');
  return { ok: true };
}

export async function rejectShift(params: { row: string; reason?: string }) {
  const { error } = await sb.from('shifts').update({
    status: 'rejected', approved_at: new Date().toISOString(), memo: params.reason || null,
  }).eq('id', params.row).eq('store_id', ctx.storeId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function restoreShiftToPending(row: string) {
  const { error } = await sb.from('shifts').update({ status: 'pending', approved_at: null, memo: null })
    .eq('id', row).eq('store_id', ctx.storeId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteShift(row: string) {
  const { error } = await sb.from('shifts').delete().eq('id', row).eq('store_id', ctx.storeId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function submitDayoffRequest(params: { therapist: string; date: string; reason?: string }) {
  const therapistId = await getTherapistId(params.therapist);
  const { data: dupCheck } = await sb.from('shifts')
    .select('id, status').eq('store_id', ctx.storeId)
    .eq('therapist_name', params.therapist).eq('date', params.date)
    .eq('is_dayoff_request', true).neq('status', 'rejected').maybeSingle();
  if (dupCheck) return { ok: false, message: 'すでにお休み申請済みです' };
  const { error } = await sb.from('shifts').insert({
    store_id:          ctx.storeId,
    therapist_id:      therapistId,
    therapist_name:    params.therapist,
    date:              params.date,
    start_time:        '00:00',
    end_time:          '00:00',
    status:            'pending',
    is_dayoff_request: true,
    memo:              params.reason || null,
    submitted_at:      new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getDayoffRequests() {
  const { data, error } = await sb.from('shifts')
    .select('*').eq('store_id', ctx.storeId)
    .eq('is_dayoff_request', true).eq('status', 'pending')
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    row:       r.id,
    therapist: r.therapist_name || '',
    date:      r.date ? r.date.replace(/-/g, '/') : '',
    reason:    r.memo || '',
  }));
}

export async function approveDayoffRequest(params: { row: string; therapist: string; date: string }) {
  const todayStr    = new Date().toISOString().slice(0, 10);
  const shiftDateStr = (params.date || '').replace(/\//g, '-');
  const attType = shiftDateStr === todayStr ? 'absent' : 'pre_absent';
  const { error } = await sb.from('shifts').update({
    status: 'approved', attendance_type: attType, approved_at: new Date().toISOString(),
  }).eq('id', params.row).eq('store_id', ctx.storeId);
  if (error) throw new Error(error.message);
  await sb.from('shifts').update({ attendance_type: attType })
    .eq('store_id', ctx.storeId).eq('therapist_name', params.therapist)
    .eq('date', shiftDateStr).eq('status', 'approved').eq('is_dayoff_request', false);
  return { ok: true, attendanceType: attType };
}

export async function rejectDayoffRequest(params: { row: string; reason?: string }) {
  const { error } = await sb.from('shifts').update({ status: 'rejected', memo: params.reason || null })
    .eq('id', params.row).eq('store_id', ctx.storeId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setAttendance(params: { row: string; attendanceType: string }) {
  const upd = { attendance_type: params.attendanceType || 'normal' };
  const { error } = await sb.from('shifts').update(upd).eq('id', params.row);
  if (error) throw new Error(error.message);
  if (params.attendanceType === 'absent' || params.attendanceType === 'noshow') {
    const { data: shiftData } = await sb.from('shifts').select('therapist_name,date').eq('id', params.row).single();
    if (shiftData) {
      await sb.from('reservations').update({ status: 'cancelled' })
        .eq('store_id', ctx.storeId)
        .eq('therapist_name', shiftData.therapist_name)
        .gte('date', shiftData.date + 'T00:00:00+09:00')
        .lte('date', shiftData.date + 'T23:59:59+09:00')
        .neq('status', 'cancelled');
    }
  }
  return { ok: true };
}

export async function assignRoomToShift(params: { row: string; roomId?: string; roomName?: string }) {
  const { error } = await sb.from('shifts').update({ room_id: params.roomId || null, room_name: params.roomName || null }).eq('id', params.row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function updateShift(params: Record<string, any>) {
  const upd: Record<string, any> = {};
  if (params.date)       upd.date       = params.date.replace(/\//g, '-');
  if (params.startTime)  upd.start_time = params.startTime;
  if (params.endTime)    upd.end_time   = params.endTime;
  if (params.memo !== undefined)         upd.memo          = params.memo || null;
  if (params.roomId !== undefined)       upd.room_id       = params.roomId       || null;
  if (params.roomName !== undefined)     upd.room_name     = params.roomName     || null;
  if (params.checkinTime  !== undefined) upd.checkin_time  = params.checkinTime  || null;
  if (params.checkoutTime !== undefined) upd.checkout_time = params.checkoutTime || null;
  const { error } = await sb.from('shifts').update(upd).eq('id', params.row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function addInterviewShift(params: Record<string, any>) {
  const { data: shiftData, error } = await sb.from('shifts').insert({
    store_id:       ctx.storeId,
    therapist_name: params.therapist,
    date:           params.date.replace(/\//g, '-'),
    start_time:     normalizeTime(params.startTime),
    end_time:       normalizeTime(params.endTime),
    status:         'approved',
    room_id:        params.roomId   || null,
    room_name:      params.roomName || null,
    memo:           params.memo || null,
    submitted_at:   new Date().toISOString(),
    approved_at:    new Date().toISOString(),
  }).select('id').single();
  if (error) throw new Error(error.message);
  return { ok: true, shiftId: shiftData?.id || null };
}
