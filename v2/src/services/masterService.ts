import { sb, ctx } from '../lib/supabase';

export async function getMenuMaster() {
  const { data, error } = await sb.from('menus').select('*').eq('store_id', ctx.storeId).order('display_order');
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    row: r.id, id: r.id, name: r.name || '', col3: r.duration_min || '', col4: r.price || '',
    order: r.display_order || 0, active: r.active,
    type:          r.type          || 'course',
    optionType:    r.option_type   || 'fixed',
    optionPrice:   r.price         || 0,
    unitPrice:     r.option_unit_price || 0,
    unitMin:       r.option_unit_min   || 10,
    maxMin:        r.option_max_min    || 100,
    extensionPrice: r.extension_price != null ? Number(r.extension_price) : null,
  }));
}

export async function saveMenuMaster(params: Record<string, any>) {
  const menuData = {
    name:              params.name || '',
    type:              params.type || 'course',
    duration_min:      params.type === 'course' ? (Number(params.col3) || null) : null,
    price:             Number(params.col4) || 0,
    display_order:     Number(params.order) || 0,
    option_type:       params.optionType   || 'fixed',
    option_unit_price: Number(params.unitPrice || 0),
    option_unit_min:   Number(params.unitMin   || 10),
    option_max_min:    Number(params.maxMin    || 100),
    extension_price:   params.extensionPrice !== undefined && params.extensionPrice !== '' ? Number(params.extensionPrice) : null,
    active:            params.active !== false,
  };
  if (params.row && params.row !== 'null' && params.row !== '') {
    const { error } = await sb.from('menus').update(menuData).eq('id', params.row);
    if (error) throw new Error(error.message);
    return { ok: true, id: params.row };
  } else {
    const { data, error } = await sb.from('menus').insert({ store_id: ctx.storeId, ...menuData }).select().single();
    if (error) throw new Error(error.message);
    return { ok: true, id: data.id };
  }
}

export async function deleteMenuMaster(id: string) {
  const { error } = await sb.from('menus').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getRoomMaster() {
  const { data, error } = await sb.from('rooms').select('*, interval_min').eq('store_id', ctx.storeId).order('display_order');
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    row: r.id, id: r.id, name: r.name || '', col3: r.description || '', col4: r.guest_guide || '',
    order: r.display_order || 0, active: r.active, intervalMin: r.interval_min || 0,
  }));
}

export async function saveRoomMaster(params: Record<string, any>) {
  if (params.row && params.row !== 'null' && params.row !== '') {
    const { error } = await sb.from('rooms').update({
      name: params.name || '', description: params.col3 || null,
      guest_guide: params.col4 || null, display_order: Number(params.order) || 0,
      active: params.active !== false, interval_min: Number(params.intervalMin || 0),
    }).eq('id', params.row);
    if (error) throw new Error(error.message);
    return { ok: true, id: params.row };
  } else {
    const { data, error } = await sb.from('rooms').insert({
      store_id: ctx.storeId, name: params.name || '',
      description: params.col3 || null, guest_guide: params.col4 || null,
      display_order: Number(params.order) || 0, active: true,
      interval_min: Number(params.intervalMin || 0),
    }).select().single();
    if (error) throw new Error(error.message);
    return { ok: true, id: data.id };
  }
}

export async function deleteRoomMaster(id: string) {
  const { error } = await sb.from('rooms').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getChecklistByStore() {
  const { data, error } = await sb.from('room_checklists').select('*')
    .eq('store_id', ctx.storeId).eq('active', true).order('room_name').order('display_order');
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    id: r.id, roomName: r.room_name, itemName: r.item_name, order: r.display_order,
    detail: r.detail || '', imageUrls: r.image_urls || [],
  }));
}

export async function saveChecklistItem(params: Record<string, any>) {
  const itemData = {
    store_id: ctx.storeId, room_name: params.roomName, item_name: params.itemName,
    display_order: Number(params.order) || 0, detail: params.detail || null,
    image_urls: params.imageUrls || [], active: true,
  };
  if (params.id) {
    const { error } = await sb.from('room_checklists').update(itemData).eq('id', params.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } else {
    const { data, error } = await sb.from('room_checklists').insert(itemData).select().single();
    if (error) throw new Error(error.message);
    return { ok: true, id: data.id };
  }
}

export async function deleteChecklistItem(id: string) {
  const { error } = await sb.from('room_checklists').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function saveCheckoutLog(params: Record<string, any>) {
  const { data, error } = await sb.from('checkout_logs').insert({
    store_id: ctx.storeId, therapist_name: params.therapistName,
    room_name: params.roomName, work_date: params.workDate,
    checked_items: params.checkedItems || [], unchecked_items: params.uncheckedItems || [],
  }).select().single();
  if (error) throw new Error(error.message);
  return { ok: true, id: data.id };
}

export async function getManuals() {
  const { data, error } = await sb.from('manuals').select('*')
    .eq('store_id', ctx.storeId).order('category').order('display_order');
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    id: r.id, category: r.category, title: r.title,
    body: r.body || '', imageUrl: r.image_url || '',
    order: r.display_order || 0, active: r.active !== false,
  }));
}

export async function saveManual(params: Record<string, any>) {
  const manualData = {
    store_id: ctx.storeId, category: params.category || 'その他',
    title: params.title || '', body: params.body || null,
    image_url: params.imageUrl || null, display_order: Number(params.order) || 0,
    active: params.active !== false,
  };
  if (params.id) {
    const { error } = await sb.from('manuals').update(manualData).eq('id', params.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from('manuals').insert(manualData);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function deleteManual(id: string) {
  const { error } = await sb.from('manuals').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
