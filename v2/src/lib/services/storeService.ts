import { _sb } from '../config';

export async function getStoreSettings(_params: Record<string, any> = {}): Promise<any> {
  const { data } = await _sb.from('store_settings').select('*').eq('store_id', (window as any).STORE_ID).maybeSingle();
  if (!data) return {};
  const cp = data.course_prices || {};
  return {
    ...data,
    course_prices:   cp,
    extension_min:   data.extension_min   || 30,
    extension_price: data.extension_price || 3000
  };
}

export async function saveStoreSettings(params: Record<string, any> = {}): Promise<any> {
  const { data: ex } = await _sb.from('store_settings').select('id').eq('store_id', (window as any).STORE_ID).maybeSingle();
  const upd: Record<string, any> = {};
  if (params.course_prices      !== undefined) upd.course_prices      = params.course_prices;
  if (params.course_step_price  !== undefined) upd.course_step_price  = Number(params.course_step_price);
  if (params.nomination_fee_free       !== undefined) upd.nomination_fee_free       = Number(params.nomination_fee_free);
  if (params.nomination_fee_nomination !== undefined) upd.nomination_fee_nomination = Number(params.nomination_fee_nomination);
  if (params.nomination_fee_honshimei  !== undefined) upd.nomination_fee_honshimei  = Number(params.nomination_fee_honshimei);
  if (params.default_course_back !== undefined) upd.default_course_back = Number(params.default_course_back);
  if (params.default_option_back !== undefined) upd.default_option_back = Number(params.default_option_back);
  if (params.discount_mode      !== undefined) upd.discount_mode      = params.discount_mode;
  if (params.auto_honshimei     !== undefined) upd.auto_honshimei     = params.auto_honshimei;
  if (params.store_line_name    !== undefined) upd.store_line_name    = params.store_line_name;
  if (params.send_payroll_line       !== undefined) upd.send_payroll_line       = params.send_payroll_line;
  if (params.send_store_line         !== undefined) upd.send_store_line         = params.send_store_line;
  if (params.send_expense_line       !== undefined) upd.send_expense_line       = params.send_expense_line;
  if (params.show_room_availability  !== undefined) upd.show_room_availability  = params.show_room_availability;
  if (params.shift_reminder_enabled  !== undefined) upd.shift_reminder_enabled  = params.shift_reminder_enabled;
  if (params.shift_reminder_day      !== undefined) upd.shift_reminder_day      = Number(params.shift_reminder_day);
  if (params.shift_reminder_time     !== undefined) upd.shift_reminder_time     = params.shift_reminder_time;
  if (params.extension_min      !== undefined) upd.extension_min      = Number(params.extension_min);
  if (params.extension_price    !== undefined) upd.extension_price    = Number(params.extension_price);
  if (params.shift_deadline     !== undefined) upd.shift_deadline     = params.shift_deadline || null;
  if (ex) {
    await _sb.from('store_settings').update(upd).eq('store_id', (window as any).STORE_ID);
  } else {
    await _sb.from('store_settings').insert({ store_id: (window as any).STORE_ID, ...upd });
  }
  return { ok: true };
}
