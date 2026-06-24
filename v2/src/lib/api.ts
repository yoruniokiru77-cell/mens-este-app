// @ts-nocheck
// Supabase APIラッパー — 全APIアクション
// STORE_ID等は window 経由で参照（将来的に引数化予定）

import { _sb } from './config';
import { _calcPayroll } from './calc';
import { _fmtDatetimeJp, _fmtDateJp, _fmtTimeJp, _normalizeTime } from './helpers';

export async function apiGet(action, params = {}) {
  switch(action) {

    // ===== セラピスト =====
    case 'getTherapists': {
      const { data, error } = await _sb.from('therapists')
        .select('*').eq('store_id', window.STORE_ID).eq('active', true).eq('is_interview', false).eq('is_admin', false).order('registered_at');
      if (error) throw new Error(error.message);
      return (data || []).map(t => ({
        name:        t.name,
        userId:      t.line_user_id || '',
        displayName: t.line_display_name || '',
        registeredAt:t.registered_at || '',
        interval:    t.interval_min ?? 30,
        courseBack:  t.course_back !== null && t.course_back !== undefined ? Number(t.course_back) : '',
        optionBack:  t.option_back !== null && t.option_back !== undefined ? Number(t.option_back) : '',
        hasGuarantee: t.has_guarantee || false,
        email:       t.email || '',
        id:          t.id,
        nominationFee: t.nomination_fee !== null && t.nomination_fee !== undefined ? Number(t.nomination_fee) : null,
        hourlyRate:    t.hourly_rate !== null && t.hourly_rate !== undefined ? Number(t.hourly_rate) : null,
        dailyGuarantee: t.daily_guarantee !== null && t.daily_guarantee !== undefined ? Number(t.daily_guarantee) : null,
        sendPayrollLine: t.send_payroll_line !== false,
        sendStoreLine:   t.send_store_line   !== false,
        discountMode:       t.discount_mode || null,
        parkingFee:         t.parking_fee !== null && t.parking_fee !== undefined ? Number(t.parking_fee) : null,
        extensionBack:      t.extension_back !== null && t.extension_back !== undefined ? Number(t.extension_back) : null,
        extensionBackHon:   t.extension_back_honshimei !== null && t.extension_back_honshimei !== undefined ? Number(t.extension_back_honshimei) : null,
      }));
    }

    case 'getTherapistProfiles': {
      const { data, error } = await _sb.from('therapists')
        .select('id,name,age,cup,real_name,profile_notes')
        .eq('store_id', window.STORE_ID).eq('active', true).eq('is_interview', false).eq('is_admin', false).order('registered_at');
      if (error) throw new Error(error.message);
      return data || [];
    }

    case 'saveTherapistProfile': {
      const { id, age, cup, real_name, profile_notes } = params;
      const { error } = await _sb.from('therapists').update({ age, cup, real_name, profile_notes }).eq('id', id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'getLineUsers': {
      const { data, error } = await _sb.from('therapists')
        .select('*').eq('store_id', window.STORE_ID).eq('active', true).order('registered_at');
      if (error) throw new Error(error.message);
      return (data || []).map(t => ({
        name:        t.name,
        userId:      t.line_user_id || '',
        displayName: t.line_display_name || '',
        registeredAt:t.registered_at || '',
        interval:    t.interval_min ?? 30,
        courseBack:  t.course_back !== null && t.course_back !== undefined ? Number(t.course_back) : '',
        optionBack:  t.option_back !== null && t.option_back !== undefined ? Number(t.option_back) : '',
        hasGuarantee: t.has_guarantee || false,
        email:       t.email || '',
        id:          t.id,
        nominationFee: t.nomination_fee !== null && t.nomination_fee !== undefined ? Number(t.nomination_fee) : null,
        hourlyRate:    t.hourly_rate !== null && t.hourly_rate !== undefined ? Number(t.hourly_rate) : null,
        dailyGuarantee: t.daily_guarantee !== null && t.daily_guarantee !== undefined ? Number(t.daily_guarantee) : null,
        sendPayrollLine: t.send_payroll_line !== false,
        sendStoreLine:   t.send_store_line   !== false,
        discountMode:       t.discount_mode || null,
        parkingFee:         t.parking_fee !== null && t.parking_fee !== undefined ? Number(t.parking_fee) : null,
        extensionBack:      t.extension_back !== null && t.extension_back !== undefined ? Number(t.extension_back) : null,
        extensionBackHon:   t.extension_back_honshimei !== null && t.extension_back_honshimei !== undefined ? Number(t.extension_back_honshimei) : null,
        isInterview:        t.is_interview === true,
      }));
    }

    case 'getInitialData': {
      const [tRes, rRes, mRes] = await Promise.all([
        _sb.from('therapists').select('*').eq('store_id', window.STORE_ID).eq('active', true).eq('is_admin', false).order('registered_at'),
        _sb.from('rooms').select('*').eq('store_id', window.STORE_ID).eq('active', true).order('display_order'),
        _sb.from('menus').select('*').eq('store_id', window.STORE_ID).eq('active', true).order('display_order')
      ]);
      const therapists = (tRes.data || []).map((t,i) => ({
        name: t.name, userId: t.line_user_id||'', displayName: t.line_display_name||'',
        registeredAt: t.registered_at||'', interval: t.interval_min??30,
        courseBack: t.course_back!==null&&t.course_back!==undefined ? Number(t.course_back) : '',
        email: t.email||'', id: t.id,
        nominationFee: t.nomination_fee !== null && t.nomination_fee !== undefined ? Number(t.nomination_fee) : null,
        hourlyRate: t.hourly_rate !== null && t.hourly_rate !== undefined ? Number(t.hourly_rate) : null,
        dailyGuarantee: t.daily_guarantee !== null && t.daily_guarantee !== undefined ? Number(t.daily_guarantee) : null,
        hasGuarantee: t.has_guarantee || false
      }));
      const rooms = (rRes.data || []).map((r,i) => ({
        row: i+1, id: r.id, name: r.name||'', col3: r.description||'',
        col4: r.guest_guide||'', order: r.display_order||0, active: r.active
      }));
      const menus = (mRes.data || []).map((r,i) => ({
        row: i+1, id: r.id, name: r.name||'', col3: r.duration_min||'',
        col4: r.price||'', order: r.display_order||0, active: r.active
      }));
      return { therapists, rooms, menus };
    }

    case 'getTherapistInterval': {
      const { data } = await _sb.from('therapists')
        .select('interval_min').eq('store_id', window.STORE_ID).eq('name', params.name).single();
      return data ? data.interval_min : 30;
    }

    case 'getTherapistCourseBack': {
      const { data } = await _sb.from('therapists')
        .select('course_back').eq('store_id', window.STORE_ID).eq('name', params.name).single();
      return data && data.course_back !== null ? Number(data.course_back) : 0.5;
    }

    // ===== 予約 =====
    case 'getReservations': {
      const dateStr = params.date; // yyyy-MM-dd
      // 27時ルール: 当日03:00〜翌日02:59を取得（00:00〜02:59は前日扱いのため除外）
      const from = dateStr + 'T03:00:00+09:00';
      const nextDate = new Date(dateStr + 'T00:00:00+09:00');
      nextDate.setDate(nextDate.getDate() + 1);
      const nextPad = n => String(n).padStart(2,'0');
      const nextStr = nextDate.getFullYear() + '-' + nextPad(nextDate.getMonth()+1) + '-' + nextPad(nextDate.getDate());
      const to = nextStr + 'T02:59:59+09:00';
      const { data, error } = await _sb.from('reservations')
        .select('*, therapists!reservations_therapist_id_fkey(interval_min)')
        .eq('store_id', window.STORE_ID)
        .gte('date', from).lte('date', to)
        .order('date');
      if (error) throw new Error(error.message);

      const rows = data || [];

      // 来店回数を取得（reservationsテーブルベース・顧客詳細と同じ基準）
      const allTels = [...new Set(rows.map(r => r.customer_tel).filter(Boolean))];
      const visitByTherapist = {};
      const visitByTherapistMonth = {};
      const visitTotalByTel = {}; // 店舗全体の総来店回数（NEW判定用）
      if (allTels.length) {
        const nowMonth = dateStr.slice(0, 7);
        const countedKeys = new Set();
        const countedDayKeys = new Set(); // 店舗全体の日付重複排除用

        // reservationsから集計（キャンセル除く・日付単位で重複排除）
        const { data: resvHist } = await _sb.from('reservations')
          .select('customer_tel, therapist_name, date')
          .eq('store_id', window.STORE_ID)
          .neq('status', 'cancelled')
          .in('customer_tel', allTels);
        (resvHist || []).forEach(r => {
          const tel = r.customer_tel || '';
          if (!tel || !r.therapist_name) return;
          // 日付単位で重複排除（同日複数予約を1回としてカウント）
          const dayKey = (r.date||'').slice(0, 10) + '_' + r.therapist_name + '_' + tel;
          if (countedKeys.has(dayKey)) return;
          countedKeys.add(dayKey);
          const key = tel + '_' + r.therapist_name;
          visitByTherapist[key] = (visitByTherapist[key] || 0) + 1;
          if (r.date && r.date.slice(0, 7) === nowMonth) {
            visitByTherapistMonth[key] = (visitByTherapistMonth[key] || 0) + 1;
          }
          // 店舗全体の総来店回数（日付×tel 単位で重複排除）
          const totalDayKey = (r.date||'').slice(0, 10) + '_' + tel;
          if (!countedDayKeys.has(totalDayKey)) {
            countedDayKeys.add(totalDayKey);
            visitTotalByTel[tel] = (visitTotalByTel[tel] || 0) + 1;
          }
        });
      }

      return rows.map((r, i) => ({
        row:        r.id,
        date:       _fmtDatetimeJp(r.date),
        rawDate:    r.date,   // 元のISO文字列（27時ルール処理に使用）
        therapist:  r.therapist_name || '',
        course:     r.course_min || 60,
        customer:   r.customer_name || '',
        price:      r.price || 0,
        discount:   r.discount || 0,
        nomination: r.nomination || 'free',
        customerNo: r.customer_no || '',
        tel:        r.customer_tel || '',
        coursePrice:r.course_price || 0,
        optionPrice:r.option_price || 0,
        nominationFee: r.nomination_fee || 0,
        status:        r.status || 'active',
        isNewCustomer: (() => {
          const tel = r.customer_tel || '';
          return r.is_new_customer || (tel ? (visitTotalByTel[tel] || 0) === 1 : false);
        })(),
        isHime:             r.is_hime || false,
        isHimeApproved:     r.is_hime_approved || false,
        therapistConfirmed: r.therapist_confirmed || false,
        visitCount:      (() => { const t = r.customer_tel || ''; return t ? (visitByTherapist[t + '_' + r.therapist_name] || 0) : 0; })(),
        monthlyVisitCount: (() => { const t = r.customer_tel || ''; return t ? (visitByTherapistMonth[t + '_' + r.therapist_name] || 0) : 0; })(),
        memo:          r.memo || '',
        isUnassigned:  r.is_unassigned || false,
        id:            r.id,
        _id:        r.id
      }));
    }

    case 'addReservation': {
      // 新規客判定：電話番号ベースで過去売上を確認
      let isNewCustomer = false;
      const custTel = (params.tel || '').replace(/[-\s]/g, '');
      try {
        if (custTel) {
          const { data: prevSales } = await _sb.from('sales')
            .select('id').eq('store_id', window.STORE_ID)
            .eq('customer_tel', custTel)
            .limit(1);
          isNewCustomer = !prevSales || prevSales.length === 0;
        } else {
          isNewCustomer = true;
        }
      } catch(e) { isNewCustomer = false; }

      const _isUnassigned = params.therapist === '__unassigned__';
      const { error } = await _sb.from('reservations').insert({
        store_id:        window.STORE_ID,
        therapist_name:  _isUnassigned ? null : params.therapist,
        therapist_id:    _isUnassigned ? null : await _getTherapistId(params.therapist),
        customer_name:   params.customer,
        customer_no:     params.customerNo || '',
        customer_tel:    params.tel || '',
        date:            new Date(params.date).toISOString(),
        course_min:      Number(params.course),
        price:           Number(params.price),
        course_price:    Number(params.coursePrice || params.price),
        option_price:    Number(params.optionPrice || 0),
        nomination_fee:  Number(params.nominationFee || 0),
        discount:        Number(params.discount || 0),
        nomination:      params.nomination || 'free',
        is_new_customer: isNewCustomer,
        is_unassigned:   _isUnassigned,
        memo:            params.memo || null
      });
      if (error) throw new Error(error.message);
      return { ok: true, isNewCustomer };
    }

    case 'updateReservation': {
      const { error } = await _sb.from('reservations').update({
        therapist_name: params.therapist,
        therapist_id:   await _getTherapistId(params.therapist),
        customer_name:  params.customer,
        customer_no:    params.customerNo || '',
        date:           new Date(params.date).toISOString(),
        course_min:     Number(params.course),
        price:          Number(params.price),
        course_price:   Number(params.coursePrice || params.price),
        option_price:   Number(params.optionPrice || 0),
        nomination_fee: Number(params.nominationFee || 0),
        discount:       Number(params.discount || 0),
        nomination:     params.nomination || 'free',
        memo:           params.memo || null
      }).eq('id', params.row);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'deleteReservation': {
      const { error } = await _sb.from('reservations').delete().eq('id', params.row);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'cancelReservation': {
      const upd = { status: 'cancelled' };
      if (params.reason) upd.cancel_reason = params.reason;
      const { error } = await _sb.from('reservations').update(upd).eq('id', params.row);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'recordCancellation': {
      const no  = String(params.customerNo || '');
      const tel = String(params.tel || '');
      const today = new Date().toISOString().slice(0, 10);
      // tel優先、なければcustomer_noで顧客特定
      let cust = null;
      if (tel) {
        const { data } = await _sb.from('customers').select('id,cancel_count').eq('store_id', window.STORE_ID).ilike('tel', tel).maybeSingle();
        cust = data;
      }
      if (cust) {
        const newCount = (Number(cust.cancel_count) || 0) + 1;
        await _sb.from('customers').update({ cancel_count: newCount, last_cancel_date: today }).eq('id', cust.id);
      }
      return { ok: true };
    }

    // ===== 売上 =====
    case 'saveSalesEntry': {
      // 電話番号をreservationから取得（なければparams.telを使用）
      let custTel = params.tel || '';
      if (!custTel && params.reservationId) {
        const { data: resvData } = await _sb.from('reservations')
          .select('customer_tel').eq('id', params.reservationId).maybeSingle();
        if (resvData) custTel = resvData.customer_tel || '';
      }
      const salesData = {
        store_id:       window.STORE_ID,
        therapist_name: params.therapist,
        therapist_id:   await _getTherapistId(params.therapist),
        date:           params.date ? new Date(params.date).toISOString() : new Date().toISOString(),
        course_min:     Number(params.course || 0),
        price:          Number(params.price || 0),
        course_price:   Number(params.coursePrice || 0),
        option_price:   Number(params.optionPrice || 0),
        nomination_fee: Number(params.nominationFee || 0),
        discount:       Number(params.discount || 0),
        nomination:     params.nomination || 'free',
        customer_name:  params.customer || '',
        customer_no:    params.customerNo || '',
        customer_tel:   custTel,
        memo:           params.memo || null,
        reservation_id: params.reservationId || null
      };
      // reservation_idがある場合は既存売上を確認してUPDATE/INSERT分岐
      if (params.reservationId) {
        const { data: existing } = await _sb.from('sales')
          .select('id').eq('store_id', window.STORE_ID)
          .eq('reservation_id', params.reservationId).maybeSingle();
        if (existing) {
          // 既存売上を更新
          const { error } = await _sb.from('sales').update(salesData).eq('id', existing.id);
          if (error) throw new Error(error.message);
          // 予約テーブルのcourse_minも同期（セラピストがコース変更した場合に管理者側も反映）
          await _sb.from('reservations').update({ course_min: salesData.course_min })
            .eq('id', params.reservationId).eq('store_id', window.STORE_ID);
          return { ok: true, updated: true };
        }
      }
      // 新規登録
      const { error } = await _sb.from('sales').insert(salesData);
      if (error) throw new Error(error.message);
      // 予約テーブルのcourse_minも同期
      if (params.reservationId) {
        await _sb.from('reservations').update({ course_min: salesData.course_min })
          .eq('id', params.reservationId).eq('store_id', window.STORE_ID);
      }
      return { ok: true, updated: false };
    }

    case 'getSalesData': {
      let q = _sb.from('sales').select('*').eq('store_id', window.STORE_ID).order('date', { ascending: false });
      if (params.startDate) q = q.gte('date', params.startDate + 'T00:00:00+09:00');
      if (params.endDate)   q = q.lte('date', params.endDate   + 'T23:59:59+09:00');
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data || []).map((r, i) => ({ ...r, row: r.id }));
    }

    case 'updateSalesRow': {
      const upd = {};
      if (params.therapist_name !== undefined) upd.therapist_name = params.therapist_name;
      if (params.date           !== undefined) upd.date           = new Date(params.date).toISOString();
      if (params.price          !== undefined) upd.price          = Number(params.price);
      if (params.discount       !== undefined) upd.discount       = Number(params.discount);
      if (params.nomination     !== undefined) upd.nomination     = params.nomination;
      if (params.course_min     !== undefined) upd.course_min     = Number(params.course_min);
      const { error } = await _sb.from('sales').update(upd).eq('id', params.row);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'deleteSalesRow': {
      const { error } = await _sb.from('sales').delete().eq('id', params.row);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'getTherapistsFromSales': {
      const { data } = await _sb.from('sales').select('therapist_name').eq('store_id', window.STORE_ID);
      return [...new Set((data||[]).map(r => r.therapist_name).filter(Boolean))];
    }

    // ===== 給料計算 =====
    case 'getPayrollData': {
      const { startDate, endDate } = params;
      const [salesRes, therapistRes, settingsRes] = await Promise.all([
        (() => {
          // 27時ルール: startDateの03:00〜endDateの翌日02:59まで取得
          // 00:00〜02:59は前日扱いのためT03:00:00から開始
          const endDt = new Date(endDate + 'T00:00:00+09:00');
          endDt.setDate(endDt.getDate() + 1);
          endDt.setHours(2, 59, 59, 0);
          return _sb.from('sales').select('*')
            .eq('store_id', window.STORE_ID)
            .gte('date', startDate + 'T03:00:00+09:00')
            .lte('date', endDt.toISOString())
            .order('date');
        })(),
        _sb.from('therapists').select('id,name,course_back,option_back,has_guarantee,hourly_rate,daily_guarantee,discount_mode,parking_fee,extension_back,extension_back_honshimei').eq('store_id', window.STORE_ID).eq('active', true),
        _sb.from('store_settings').select('*').eq('store_id', window.STORE_ID).single()
      ]);
      const tMap = {};
      (therapistRes.data || []).forEach(t => { tMap[t.name] = t; });
      const ss = settingsRes.data || {};
      window._cachedStoreSettings = ss; // 売上編集モーダルなど他の場所から参照できるようキャッシュ

      // 固定バックマスタを取得（therapist_id → menu_id → back_amount）
      const therapistIds = (therapistRes.data || []).map(t => t.id).filter(Boolean);
      let menuBackMap = {}; // key: therapist_id + '_' + menu_id
      if (therapistIds.length) {
        const { data: menuBacks } = await _sb.from('therapist_menu_backs')
          .select('*').eq('store_id', window.STORE_ID).in('therapist_id', therapistIds);
        (menuBacks || []).forEach(b => {
          menuBackMap[b.therapist_id + '_' + b.menu_id] = {
            other:    b.back_amount,
            honshimei: b.back_amount_honshimei
          };
        });
      }

      // メニューマスタ（コース: course_min → menu_id / オプション: name → menu_id）
      const { data: menuData } = await _sb.from('menus').select('id,name,duration_min,type,extension_price')
        .eq('store_id', window.STORE_ID).eq('active', true);
      const menuByMin  = {}; // course_min → menu_id（コース用）
      const menuByName = {}; // name → menu_id（オプション用）
      (menuData || []).forEach(m => {
        if (m.type === 'course' && m.duration_min) menuByMin[m.duration_min] = m.id;
        if (m.type === 'option') menuByName[m.name] = m.id;
      });
      // 売上編集モーダルのプレビュー計算で参照できるようにグローバルキャッシュへ保存
      window._payrollMenuByMin   = menuByMin;
      window._payrollMenuBackMap = menuBackMap;

      // sale_optionsを取得してオプション固定バック計算に使用
      const salesResvIds = (salesRes.data || []).map(r => r.reservation_id).filter(Boolean);
      let saleOptMap = {}; // reservation_id → [{menuId, amount}]
      if (salesResvIds.length) {
        const { data: saleOpts } = await _sb.from('sale_options')
          .select('reservation_id, menu_name, amount')
          .in('reservation_id', salesResvIds);
        (saleOpts || []).forEach(o => {
          if (!saleOptMap[o.reservation_id]) saleOptMap[o.reservation_id] = [];
          saleOptMap[o.reservation_id].push({
            menuId: menuByName[o.menu_name] || null,
            name:   o.menu_name || '',
            amount: Number(o.amount)
          });
        });
      }

      // 新規客判定：電話番号ベースで期間前の売上を確認
      const custTels = [...new Set((salesRes.data || []).map(r => r.customer_tel).filter(Boolean))];
      let prevSalesTels = new Set();
      if (custTels.length) {
        const { data: prevSales } = await _sb.from('sales')
          .select('customer_tel')
          .eq('store_id', window.STORE_ID)
          .lt('date', startDate + 'T00:00:00+09:00')
          .in('customer_tel', custTels);
        (prevSales || []).forEach(r => { if (r.customer_tel) prevSalesTels.add(r.customer_tel); });
      }

      // 予約件数を取得（27時ルール対応：startDate 03:00〜翌日 02:59）
      const resvEndDt = new Date(endDate + 'T00:00:00+09:00');
      resvEndDt.setDate(resvEndDt.getDate() + 1);
      resvEndDt.setHours(2, 59, 59, 0);
      const resvQuery = await _sb.from('reservations')
        .select('therapist_name, date')
        .eq('store_id', window.STORE_ID)
        .eq('status', 'active')
        .gte('date', startDate + 'T03:00:00+09:00')
        .lte('date', resvEndDt.toISOString());
      const resvCountMap = {};
      (resvQuery.data || []).forEach(r => {
        const d = new Date(r.date);
        // 27時ルール: 3時未満は前日扱い
        const dAdj = new Date(d);
        if (d.getHours() < 3) dAdj.setDate(dAdj.getDate() - 1);
        const dl = dAdj.getFullYear() + '/' +
          String(dAdj.getMonth()+1).padStart(2,'0') + '/' +
          String(dAdj.getDate()).padStart(2,'0');
        const k = dl + '_' + r.therapist_name;
        resvCountMap[k] = (resvCountMap[k] || 0) + 1;
      });

      const result = {};
      (salesRes.data || []).forEach((r, i) => {
        const d = new Date(r.date);
        // 27時ルール: 3時（JST）より前の売上は前日扱い
        const dAdj = new Date(d);
        if (d.getHours() < 3) dAdj.setDate(dAdj.getDate() - 1);
        const dateLabel = dAdj.getFullYear() + '/' +
          String(dAdj.getMonth()+1).padStart(2,'0') + '/' +
          String(dAdj.getDate()).padStart(2,'0');
        const tInfo = tMap[r.therapist_name] || {};
        // 固定バック金額の取得（menu_idをcourse_minで逆引き）
        const menuId = menuByMin[r.course_min];
        const _mb = (tInfo.id && menuId) ? menuBackMap[tInfo.id + '_' + menuId] : undefined;
        // 本指名は honshimei 額、それ以外（フリー・指名）は other 額。
        // 該当区分が未設定(null)なら、もう片方の額にフォールバック。
        let fixedBackAmount = null;
        if (_mb) {
          const isHon = r.nomination === 'honshimei';
          const primary  = isHon ? _mb.honshimei : _mb.other;
          const fallback = isHon ? _mb.other     : _mb.honshimei;
          fixedBackAmount = (primary !== null && primary !== undefined) ? primary
            : ((fallback !== null && fallback !== undefined) ? fallback : null);
        }
        const rowWithBack = {
          ...r,
          therapist_course_back:   tInfo.course_back,
          therapist_option_back:   tInfo.option_back,
          fixed_back_amount:       fixedBackAmount,
          therapist_discount_mode: tInfo.discount_mode || null,
        };
        const { storeDrop, therapistPay, therapistCoursePay, therapistOptPay, therapistExtPay, courseBack, optionBack }
          = _calcPayroll(rowWithBack, ss, {
              optItems:        r.reservation_id ? (saleOptMap[r.reservation_id] || null) : null,
              menuBackMap:     menuBackMap,
              therapistId:     tInfo.id || null,
              extensionBack:    tInfo.extension_back    != null ? Number(tInfo.extension_back)    : null,
              extensionBackHon: tInfo.extension_back_honshimei != null ? Number(tInfo.extension_back_honshimei) : null,
            });
        const key = dateLabel + '_' + r.therapist_name;
        if (!result[key]) {
          const pf = tInfo.parking_fee ? Number(tInfo.parking_fee) : 0;
          result[key] = {
            dateLabel, name: r.therapist_name,
            pay: pf, storeDrop: -pf, count: 0,
            resvCount: resvCountMap[key] || 0,
            hasGuarantee: tInfo.has_guarantee || false,
            hourlyRate: tInfo.hourly_rate || null,
            dailyGuarantee: tInfo.daily_guarantee || null,
            parkingFee: pf,
            details: []
          };
        }
        result[key].pay       += therapistPay;
        result[key].storeDrop += storeDrop;
        result[key].count     += 1;
        const isNewCustomer = r.customer_tel ? !prevSalesTels.has(r.customer_tel) : false;
        result[key].details.push({
          row:             r.id,
          date:            String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'),
          fullDate:        dateLabel,
          course:          r.course_min,
          nomination:      r.nomination,
          price:           Number(r.price || 0),
          coursePrice:     Number(r.course_price || r.price || 0),
          optionPrice:     Number(r.option_price || 0),
          nominationFee:   Number(r.nomination_fee || 0),
          discount:        Number(r.discount || 0),
          therapistPay, storeDrop,
          therapistCoursePay, therapistOptPay, therapistExtPay,
          courseBack, optionBack,
          isGuarantee:     r.is_guarantee || false,
          isNewCustomer:   isNewCustomer || false,
          customer:        r.customer_name || '',
          customerNo:      r.customer_no || '',
          optionPrice:     Number(r.option_price || 0),
          memo:            r.memo || ''
        });
      });

      // 保証対象セラピスト：シフトはあるが売上がない場合も表示
      const guarTherapists = (therapistRes.data || []).filter(t => t.has_guarantee && (t.hourly_rate || t.daily_guarantee));
      if (guarTherapists.length) {
        const shiftsRes = await _sb.from('shifts').select('therapist_name, date, start_time, end_time')
          .eq('store_id', window.STORE_ID).eq('status', 'approved')
          .gte('date', startDate).lte('date', endDate);
        (shiftsRes.data || []).forEach(s => {
          const dateLabel = s.date.replace(/-/g, '/');
          const key = dateLabel + '_' + s.therapist_name;
          if (result[key]) return; // 既に売上がある
          const tInfo = tMap[s.therapist_name];
          if (!tInfo || !tInfo.has_guarantee) return;
          result[key] = {
            dateLabel, name: s.therapist_name,
            pay: 0, storeDrop: 0, count: 0,
            resvCount: 0,
            hasGuarantee: true,
            hourlyRate: tInfo.hourly_rate || null,
            dailyGuarantee: tInfo.daily_guarantee || null,
            shiftStart: s.start_time ? s.start_time.substring(0,5) : '',
            shiftEnd:   s.end_time   ? s.end_time.substring(0,5)   : '',
            details: []
          };
        });
      }

      return Object.values(result).sort((a,b) => {
        if (a.dateLabel !== b.dateLabel) return a.dateLabel.localeCompare(b.dateLabel);
        return a.name.localeCompare(b.name, 'ja');
      });
    }



    // ===== 経費 =====
    case 'getExpenses': {
      let q = _sb.from('expenses').select('*').eq('store_id', window.STORE_ID).order('date', { ascending: false });
      if (params.startDate)  q = q.gte('date', params.startDate);
      if (params.endDate)    q = q.lte('date', params.endDate);
      if (params.therapist)  q = q.eq('therapist_name', params.therapist);
      if (params.date)       q = q.eq('date', params.date);
      if (params.storeOnly)  q = q.is('therapist_name', null);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data || []).map(r => ({ ...r, row: r.id }));
    }

    case 'saveStoreExpense': {
      const { error } = await _sb.from('expenses').insert({
        store_id:       window.STORE_ID,
        date:           params.date,
        category:       params.category,
        amount:         Number(params.amount),
        memo:           params.memo || null,
        therapist_name: null
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'saveExpense': {
      // 同じ日付・カテゴリ・セラピストのレコードがあればUPDATE、なければINSERT
      const { data: existing } = await _sb.from('expenses')
        .select('id').eq('store_id', window.STORE_ID)
        .eq('date', params.date).eq('category', params.category)
        .eq('therapist_name', params.therapist || '').maybeSingle();
      if (existing) {
        const { error } = await _sb.from('expenses').update({
          amount: Number(params.amount), memo: params.memo || null
        }).eq('id', existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await _sb.from('expenses').insert({
          store_id:       window.STORE_ID,
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

    case 'deleteExpenseByCategory': {
      await _sb.from('expenses').delete()
        .eq('store_id', window.STORE_ID)
        .eq('date', params.date)
        .eq('category', params.category)
        .eq('therapist_name', params.therapist || '');
      return { ok: true };
    }

    case 'deleteExpense': {
      const { error } = await _sb.from('expenses').delete().eq('id', params.row);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // ===== 固定費マスタ =====
    case 'getFixedCostMasters': {
      const { data, error } = await _sb.from('store_fixed_costs')
        .select('*').eq('store_id', window.STORE_ID).eq('active', true)
        .order('category').order('name');
      if (error) throw new Error(error.message);
      return data || [];
    }

    case 'saveFixedCostMaster': {
      const row = {
        store_id:               window.STORE_ID,
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

    case 'deleteFixedCostMaster': {
      const { error } = await _sb.from('store_fixed_costs')
        .update({ active: false }).eq('id', params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'getFixedCostPayments': {
      const { data, error } = await _sb.from('fixed_cost_payments')
        .select('*').eq('store_id', window.STORE_ID).eq('period', params.period);
      if (error) throw new Error(error.message);
      return data || [];
    }

    case 'saveFixedCostPayment': {
      const { data: existing } = await _sb.from('fixed_cost_payments')
        .select('id').eq('fixed_cost_id', params.fixedCostId).eq('period', params.period).maybeSingle();
      const row = {
        store_id:      window.STORE_ID,
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

    // ===== 振込先マスタ =====
    case 'getPaymentDestinations': {
      const { data, error } = await _sb.from('payment_destinations')
        .select('*').eq('active', true).order('name');
      if (error) throw new Error(error.message);
      return data || [];
    }

    case 'savePaymentDestination': {
      const row = {
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

    case 'deletePaymentDestination': {
      const { error } = await _sb.from('payment_destinations').update({ active: false }).eq('id', params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'getExpenseTemplates': {
      const { data, error } = await _sb.from('store_expense_templates')
        .select('*').eq('active', true).order('category').order('name');
      if (error) throw new Error(error.message);
      return data;
    }
    case 'saveExpenseTemplate': {
      const { id, name, category, amount, paymentDestId } = params;
      const row = {
        name, category: category || 'その他',
        amount: amount != null && amount !== '' ? Number(amount) : null,
        payment_destination_id: paymentDestId || null
      };
      let data, error;
      if (id) {
        ({ data, error } = await _sb.from('store_expense_templates').update(row).eq('id', id).select().single());
      } else {
        ({ data, error } = await _sb.from('store_expense_templates').insert(row).select().single());
      }
      if (error) throw new Error(error.message);
      return data;
    }
    case 'deleteExpenseTemplate': {
      const { error } = await _sb.from('store_expense_templates').update({ active: false }).eq('id', params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'getAllStoreFixedCostSummary': {
      // 全店舗の固定費マスタ＋支払い記録＋振込先を取得（JOINせず分割クエリ）
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

    // ===== シフト =====
    case 'submitShiftBulk': {
      const items = (params.items || []);
      const therapistId = await _getTherapistId(params.therapist);
      const rows = items.map(item => ({
        store_id:       window.STORE_ID,
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

    case 'getShifts': {
      let q = _sb.from('shifts').select('*').eq('store_id', window.STORE_ID).order('date').order('start_time');
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
      return (data || []).map((r, i) => ({
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

    case 'approveShift': {
      const row = params.row;
      if (!row) throw new Error('シフトIDが無効です: ' + params.row);
      const { error } = await _sb.from('shifts').update({
        status: 'approved',
        approved_at: new Date().toISOString()
      }).eq('id', row).eq('store_id', window.STORE_ID);
      if (error) throw new Error('承認エラー: ' + error.message);
      // 更新確認
      const { data: check } = await _sb.from('shifts').select('status').eq('id', row).single();
      if (!check || check.status !== 'approved') {
        throw new Error('承認の更新に失敗しました（RLS制限の可能性）。Supabaseのポリシーを確認してください。');
      }
      return { ok: true };
    }

    case 'rejectShift': {
      const { error } = await _sb.from('shifts').update({
        status: 'rejected',
        approved_at: new Date().toISOString(),
        memo: params.reason || null
      }).eq('id', params.row).eq('store_id', window.STORE_ID);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'restoreShiftToPending': {
      const { error } = await _sb.from('shifts').update({
        status: 'pending',
        approved_at: null,
        memo: null
      }).eq('id', params.row).eq('store_id', window.STORE_ID);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'deleteShift': {
      const { error } = await _sb.from('shifts').delete().eq('id', params.row).eq('store_id', window.STORE_ID);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'submitDayoffRequest': {
      // セラピストがお休み申請を送信
      const therapistId = await _getTherapistId(params.therapist);
      // 同日にすでに未却下のお休み申請があれば重複防止
      const { data: dupCheck } = await _sb.from('shifts')
        .select('id, status')
        .eq('store_id', window.STORE_ID)
        .eq('therapist_name', params.therapist)
        .eq('date', params.date)
        .eq('is_dayoff_request', true)
        .neq('status', 'rejected')
        .maybeSingle();
      if (dupCheck) return { ok: false, message: 'すでにお休み申請済みです' };
      const { error } = await _sb.from('shifts').insert({
        store_id:          window.STORE_ID,
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

    case 'getDayoffRequests': {
      // 管理者向け: 承認待ちのお休み申請一覧
      const { data, error } = await _sb.from('shifts')
        .select('*')
        .eq('store_id', window.STORE_ID)
        .eq('is_dayoff_request', true)
        .eq('status', 'pending')
        .order('date', { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []).map(r => ({
        row:       r.id,
        therapist: r.therapist_name || '',
        date:      r.date ? r.date.replace(/-/g, '/') : '',
        reason:    r.memo || '',
      }));
    }

    case 'approveDayoffRequest': {
      // 当日 → absent（当日欠勤）、それ以外 → pre_absent（事前欠勤）
      const todayStr = new Date().toISOString().slice(0, 10);
      const shiftDateStr = (params.date || '').replace(/\//g, '-');
      const attType = shiftDateStr === todayStr ? 'absent' : 'pre_absent';
      // このお休み申請を承認
      const { error } = await _sb.from('shifts').update({
        status:          'approved',
        attendance_type: attType,
        approved_at:     new Date().toISOString()
      }).eq('id', params.row).eq('store_id', window.STORE_ID);
      if (error) throw new Error(error.message);
      // 同日・同セラピストの他の承認済みシフトにも attendance_type を反映
      await _sb.from('shifts').update({ attendance_type: attType })
        .eq('store_id', window.STORE_ID)
        .eq('therapist_name', params.therapist)
        .eq('date', shiftDateStr)
        .eq('status', 'approved')
        .eq('is_dayoff_request', false);
      return { ok: true, attendanceType: attType };
    }

    case 'rejectDayoffRequest': {
      const { error } = await _sb.from('shifts').update({
        status: 'rejected',
        memo:   params.reason || null
      }).eq('id', params.row).eq('store_id', window.STORE_ID);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'setAttendance': {
      // 勤怠ステータス設定: attendance_type = normal/absent/noshow/early_leave/late
      const upd = { attendance_type: params.attendanceType || 'normal' };
      const { error } = await _sb.from('shifts').update(upd).eq('id', params.row);
      if (error) throw new Error(error.message);
      // 欠勤・無断欠勤の場合は予約をキャンセル
      if (params.attendanceType === 'absent' || params.attendanceType === 'noshow') {
        // その日のセラピストの予約をキャンセル
        const { data: shiftData } = await _sb.from('shifts').select('therapist_name,date').eq('id', params.row).single();
        if (shiftData) {
          await _sb.from('reservations')
            .update({ status: 'cancelled' })
            .eq('store_id', window.STORE_ID)
            .eq('therapist_name', shiftData.therapist_name)
            .gte('date', shiftData.date + 'T00:00:00+09:00')
            .lte('date', shiftData.date + 'T23:59:59+09:00')
            .neq('status', 'cancelled');
        }
      }
      return { ok: true };
    }

    case 'assignRoomToShift': {
      const { error } = await _sb.from('shifts').update({
        room_id:   params.roomId || null,
        room_name: params.roomName || null
      }).eq('id', params.row);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'updateShift': {
      const upd = {};
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

    case 'addInterviewShift': {
      const { data: shiftData, error } = await _sb.from('shifts').insert({
        store_id:       window.STORE_ID,
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

    case 'getMenuBacks': {
      const { therapistId } = params;
      const { data, error } = await _sb.from('therapist_menu_backs')
        .select('*').eq('store_id', window.STORE_ID).eq('therapist_id', therapistId);
      if (error) throw new Error(error.message);
      return data || [];
    }

    case 'saveMenuBacks': {
      // backs: [{menu_id, back_amount}] の配列
      const { therapistId, backs } = params;
      // 既存を全削除して再INSERT（upsert方式）
      await _sb.from('therapist_menu_backs')
        .delete().eq('store_id', window.STORE_ID).eq('therapist_id', therapistId);
      const inserts = backs
        .filter(b => (b.back_amount !== '' && b.back_amount !== null) ||
                     (b.back_amount_honshimei !== '' && b.back_amount_honshimei !== null && b.back_amount_honshimei !== undefined))
        .map(b => ({
          store_id:     window.STORE_ID,
          therapist_id: therapistId,
          menu_id:      b.menu_id,
          back_amount:  (b.back_amount !== '' && b.back_amount !== null) ? Number(b.back_amount) : null,
          back_amount_honshimei: (b.back_amount_honshimei !== '' && b.back_amount_honshimei !== null && b.back_amount_honshimei !== undefined) ? Number(b.back_amount_honshimei) : null
        }));
      if (inserts.length) {
        const { error } = await _sb.from('therapist_menu_backs').insert(inserts);
        if (error) throw new Error(error.message);
      }
      return { ok: true };
    }

    case 'saveSaleOptions': {
      // reservation_idに紐づくオプションをDELETE→INSERT（options: [{menuId, name, amount}]）
      const { reservationId, options } = params;
      if (!reservationId) return { ok: true };
      await _sb.from('sale_options').delete()
        .eq('store_id', window.STORE_ID).eq('reservation_id', reservationId);
      if (options && options.length > 0) {
        const inserts = options.map(o => ({
          store_id:       window.STORE_ID,
          reservation_id: reservationId,
          menu_id:        o.menuId || null,
          menu_name:      o.name  || '',
          amount:         Number(o.amount) || 0
        }));
        const { error } = await _sb.from('sale_options').insert(inserts);
        if (error) throw new Error(error.message);
      }
      return { ok: true };
    }

    case 'getUnsubmittedTherapists': {
      const now   = new Date();
      const day   = now.getDay();
      const diff  = (8 - day) % 7 || 7;
      const mon   = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
      const sun   = new Date(mon); sun.setDate(mon.getDate() + 6);
      const fmtD  = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const monStr = fmtD(mon), sunStr = fmtD(sun);

      const [tRes, sRes] = await Promise.all([
        _sb.from('therapists').select('name,line_user_id').eq('store_id', window.STORE_ID).eq('active', true),
        _sb.from('shifts').select('therapist_name,status')
          .eq('store_id', window.STORE_ID).gte('date', monStr).lte('date', sunStr)
      ]);
      const all           = (tRes.data || []).filter(t => t.name && t.name !== '管理者');
      const submittedSet  = new Set((sRes.data || []).map(s => s.therapist_name));
      const unsubmitted   = all.filter(t => !submittedSet.has(t.name)).map(t => ({ name: t.name, userId: t.line_user_id||'' }));
      const submitted     = all.filter(t =>  submittedSet.has(t.name)).map(t => t.name);
      return { unsubmitted, submitted, weekLabel: monStr.replace(/-/g,'/') + ' 〜 ' + sunStr.replace(/-/g,'/') };
    }

case 'sendShiftReminder': {
  try {
    const LINE_PUSH = 'https://rzfprialypdoyklfwpyg.supabase.co/functions/v1/line-push';
    // 未提出セラピストを取得して一括送信
    const now = new Date();
    const day = now.getDay();
    const diff = (8 - day) % 7 || 7;
    const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmtD = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const monStr = fmtD(mon), sunStr = fmtD(sun);
    const weekLabel = monStr.replace(/-/g,'/') + '〜' + sunStr.replace(/-/g,'/');
    const [tRes, sRes] = await Promise.all([
      _sb.from('therapists').select('name,line_user_id').eq('store_id', window.STORE_ID).eq('active', true),
      _sb.from('shifts').select('therapist_name,status').eq('store_id', window.STORE_ID).gte('date', monStr).lte('date', sunStr)
    ]);
    const submittedSet = new Set((sRes.data || []).map(s => s.therapist_name));
    const targets = (tRes.data || []).filter(t => t.name && t.name !== '管理者' && !submittedSet.has(t.name) && t.line_user_id);
    let sent = 0;
    for (const t of targets) {
      const msg = `【シフト提出リマインド】\n${weekLabel}のシフトがまだ提出されていません。\nLINEで「ログイン」と送信して提出してください。`;
      await fetch(LINE_PUSH + '?action=sendLineMessage&userId=' + encodeURIComponent(t.line_user_id) + '&message=' + encodeURIComponent(msg));
      sent++;
    }
    return { ok: true, sent };
  } catch(e) { return { ok: false, error: e.message }; }
}

case 'sendReminderToOne': {
  try {
    const LINE_PUSH = 'https://rzfprialypdoyklfwpyg.supabase.co/functions/v1/line-push';
    const now = new Date();
    const day = now.getDay();
    const diff = (8 - day) % 7 || 7;
    const mon = new Date(now); mon.setDate(now.getDate() + diff); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const fmtD = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const weekLabel = fmtD(mon).replace(/-/g,'/') + '〜' + fmtD(sun).replace(/-/g,'/');
    const msg = `【シフト提出リマインド】\n${weekLabel}のシフトがまだ提出されていません。\nLINEで「ログイン」と送信して提出してください。`;
    await fetch(LINE_PUSH + '?action=sendLineMessage&userId=' + encodeURIComponent(params.userId) + '&message=' + encodeURIComponent(msg));
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

    // ===== 顧客マスタ =====
    case 'getCustomer': {
      const tel  = String(params.tel  || '').replace(/[-\s]/g, '');
      const name = String(params.name || '').trim();
      // 内部IDは参照用のみ（検索には使わない）
      const internalId = params.internalId || null;
      let q = _sb.from('customers').select('*').eq('store_id', window.STORE_ID);
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

    case 'saveCustomer': {
      const tel  = String(params.tel  || '').replace(/[-\s]/g, '');
      const name = params.name || '';

      // 電話番号で重複チェック（電話番号がある場合）
      if (tel) {
        const { data: dup } = await _sb.from('customers').select('id,customer_no,name')
          .eq('store_id', window.STORE_ID).ilike('tel', '%' + tel + '%').maybeSingle();
        if (dup) {
          // 既存顧客 → 名前のみ更新して返す（重複登録はしない）
          return { ok: true, customerNo: String(dup.customer_no || ''), updated: true, existed: true };
        }
      }

      // 新規登録（customer_noは採番しない）
      const { error: insErr } = await _sb.from('customers').insert({
        store_id: window.STORE_ID,
        name,
        tel: tel || null
      });
      if (insErr) throw new Error('顧客登録エラー: ' + insErr.message);
      return { ok: true, customerNo: '', updated: false };
    }

    case 'updateCustomer': {
      const tel = String(params.tel || '').replace(/[-\s]/g, '');
      // 電話番号で顧客を特定
      let ex = null;
      if (tel) {
        const { data } = await _sb.from('customers').select('id').eq('store_id', window.STORE_ID).ilike('tel', '%' + tel + '%').maybeSingle();
        ex = data;
      }
      if (!ex) return { ok: false, error: '顧客が見つかりません' };
      const upd = {};
      if (params.name         !== undefined) upd.name          = params.name;
      if (params.status       !== undefined) upd.status        = params.status;
      if (params.ngTherapists !== undefined) {
        upd.ng_therapists = params.ngTherapists
          ? (typeof params.ngTherapists === 'string'
              ? params.ngTherapists.split(',').map(s => s.trim()).filter(Boolean)
              : params.ngTherapists)
          : [];
      }
      await _sb.from('customers').update(upd).eq('id', ex.id);
      return { ok: true };
    }

    case 'getCustomerMasterList': {
      const search  = (params.search || '').toLowerCase();
      const page    = Number(params.page || 0);
      const perPage = 500;
      const from    = page * perPage;
      const to      = from + perPage - 1;
      let data, error, count;
      if (search) {
        // 検索時は全件対象（DB側でフィルタ）
        const { data: d, error: e, count: c } = await _sb.from('customers')
          .select('*', { count: 'exact' })
          .eq('store_id', window.STORE_ID)
          .or(`name.ilike.%${search}%,tel.ilike.%${search}%`)
          .order('name');
        data = d; error = e; count = c;
      } else {
        const { data: d, error: e, count: c } = await _sb.from('customers')
          .select('*', { count: 'exact' })
          .eq('store_id', window.STORE_ID).order('name').range(from, to);
        data = d; error = e; count = c;
      }
      if (error) throw new Error(error.message);
      let list = (data || []).map(r => ({
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
      if (search) {
        // DB側で検索済みのためクライアントフィルタ不要
      }
      return { list, total: count || 0, page, perPage };
    }

    case 'getCustomerHistory': {
      const no = String(params.customerNo || '');
      const tel = String(params.tel || '');
      const therapist = params.therapist || '';

      // 電話番号またはcustomer_noで顧客を特定
      let custData = null;
      if (tel) {
        const { data } = await _sb.from('customers').select('*').eq('store_id', window.STORE_ID).ilike('tel', tel).maybeSingle();
        custData = data;
      }
      // 来店履歴：電話番号ベース
      const lookupTel = custData?.tel || tel;
      const [histRes, memoRes] = await Promise.all([
        (async () => {
          if (lookupTel) {
            let q = _sb.from('reservations').select('*')
              .eq('store_id', window.STORE_ID)
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
          let q = _sb.from('customer_memos').select('*')
            .eq('customer_id', custData.id)
            .order('created_at', { ascending: false });
          if (therapist) {
            // セラピストモード: 自分のメモ かつ 管理者メモは除外
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
      // sale_optionsをreservation_id単位で取得
      const resvIds = (histRes.data || []).map(r => r.id).filter(Boolean);
      let optionsMap = {};
      if (resvIds.length) {
        const { data: saleOpts } = await _sb.from('sale_options')
          .select('reservation_id, menu_name, amount')
          .eq('store_id', window.STORE_ID).in('reservation_id', resvIds);
        (saleOpts || []).forEach(o => {
          if (!optionsMap[o.reservation_id]) optionsMap[o.reservation_id] = [];
          optionsMap[o.reservation_id].push({ name: o.menu_name, amount: Number(o.amount) });
        });
      }

      const history = (histRes.data || []).map(r => ({
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
      // キャンセル履歴（管理者向け・お客様都合含む全件）
      let cancelHistory = [];
      if (params.includeCancel && lookupTel) {
        const cancelQ = _sb.from('reservations').select('date,course_min,therapist_name,cancel_reason,memo')
              .eq('store_id', window.STORE_ID).ilike('customer_tel', lookupTel)
              .eq('status', 'cancelled').order('date', { ascending: false }).limit(20);
        const { data: cancelData } = await cancelQ;
        const CANCEL_REASON_LABEL = { customer: 'お客様都合', therapist: 'セラピスト都合', other: 'その他' };
        cancelHistory = (cancelData || []).map(r => ({
          date:      _fmtDatetimeJp(r.date),
          course:    r.course_min,
          therapist: r.therapist_name || '',
          reason:    CANCEL_REASON_LABEL[r.cancel_reason] || r.cancel_reason || '不明',
          memo:      r.memo || '',
        }));
      }
      const memos = (memoRes.data || []).map(r => ({
        id:        r.id,
        therapist: r.therapist_name||'', memo: r.memo||'',
        date: _fmtDateJp(r.created_at)
      }));
      return { history, memos, customer, cancelHistory };
    }

    case 'saveCustomerMemo': {
      const customerId = params.customerId || '';
      const no  = String(params.customerNo || '');
      const tel = String(params.tel || '');
      const therapistId = await _getTherapistId(params.therapist);
      // customerId(UUID)優先 → tel → customer_noの順で顧客特定
      let custId = customerId || null;
      if (!custId && tel) {
        const { data: c } = await _sb.from('customers').select('id').eq('store_id', window.STORE_ID).ilike('tel', tel).maybeSingle();
        if (c) custId = c.id;
      }
      // 顧客マスタ未登録（tel有り）→ 自動登録してIDを取得
      if (!custId && tel) {
        const { data: newC, error: insErr } = await _sb.from('customers').insert({
          store_id: window.STORE_ID, tel: tel,
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

    case 'updateCustomerMemo': {
      const { memoId, memo } = params;
      if (!memoId) throw new Error('memoId が必要です');
      const { error } = await _sb.from('customer_memos').update({ memo }).eq('id', memoId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'deleteCustomerMemo': {
      const { memoId } = params;
      if (!memoId) throw new Error('memoId が必要です');
      const { error } = await _sb.from('customer_memos').delete().eq('id', memoId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'getMyCustomers': {
      const therapist = params.therapist || '';
      const { data: resvData } = await _sb.from('reservations')
        .select('customer_no, customer_name, customer_tel, date')
        .eq('store_id', window.STORE_ID).eq('therapist_name', therapist)
        .neq('status', 'cancelled');
      const custMap = {};
      (resvData || []).forEach(r => {
        // tel優先、なければcustomer_no、なければ名前をキーに
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
        // telが後から判明した場合は補完
        if (!custMap[key].tel && r.customer_tel) custMap[key].tel = r.customer_tel;
      });
      if (!Object.keys(custMap).length) return [];

      // 顧客マスタから名前補完（tel優先）
      const tels = [...new Set(Object.values(custMap).map(c => c.tel).filter(Boolean))];
      if (tels.length) {
        const { data: custByTel } = await _sb.from('customers')
          .select('tel,name,id').eq('store_id', window.STORE_ID).in('tel', tels);
        (custByTel || []).forEach(c => {
          if (custMap[c.tel]) {
            custMap[c.tel].name       = c.name || custMap[c.tel].name;
            custMap[c.tel].customerId = c.id;
          }
        });
      }

      // 最新メモ（customer_idベース）
      const custIds = [...new Set(Object.values(custMap).map(c => c.customerId).filter(Boolean))];
      if (custIds.length) {
        const { data: memoData } = await _sb.from('customer_memos')
          .select('customer_id, memo')
          .eq('therapist_name', therapist)
          .eq('is_admin', false)
          .in('customer_id', custIds)
          .order('created_at', { ascending: false });
        (memoData || []).forEach(m => {
          const entry = Object.values(custMap).find(c => c.customerId === m.customer_id);
          if (entry && !entry.latestMemo) entry.latestMemo = m.memo || '';
        });
      }

      return Object.values(custMap).sort((a, b) => b.visitCount - a.visitCount);
    }

    case 'checkCustomerStatus': {
      const no  = String(params.customerNo || '');
      const tel = String(params.tel || '');
      // telで検索（telなしの場合は顧客特定不能のため素通り）
      let custData = null;
      if (tel) {
        const { data } = await _sb.from('customers').select('status,ng_therapists').eq('store_id', window.STORE_ID).ilike('tel', tel).maybeSingle();
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

    case 'importCustomers':
      return 'CSVからのインポートはSupabase Dashboardで行ってください';

    // ===== セラピスト更新 =====
    case 'updateLineUser': {
      const upd = {};
      if (params.name      !== undefined) upd.name        = params.name;
      if (params.interval  !== undefined) upd.interval_min= Number(params.interval);
      if (params.courseBack !== undefined && params.courseBack !== '') upd.course_back = Number(params.courseBack);
      if (params.optionBack !== undefined && params.optionBack !== '') upd.option_back = Number(params.optionBack);
      if (params.hasGuarantee !== undefined) upd.has_guarantee = params.hasGuarantee;
      if (params.email     !== undefined) upd.email       = params.email;
      if (params.nominationFee !== undefined) upd.nomination_fee = params.nominationFee === '' || params.nominationFee === null ? null : Number(params.nominationFee);
      if (params.hourlyRate !== undefined) upd.hourly_rate = params.hourlyRate === '' || params.hourlyRate === null ? null : Number(params.hourlyRate);
      if (params.dailyGuarantee !== undefined) upd.daily_guarantee = params.dailyGuarantee === '' || params.dailyGuarantee === null ? null : Number(params.dailyGuarantee);
      if (params.sendPayrollLine !== undefined) upd.send_payroll_line = params.sendPayrollLine;
      if (params.sendStoreLine   !== undefined) upd.send_store_line   = params.sendStoreLine;
      if (params.discountMode    !== undefined) upd.discount_mode     = params.discountMode || null;
      if (params.parkingFee      !== undefined) upd.parking_fee       = params.parkingFee === '' || params.parkingFee === null ? null : Number(params.parkingFee);
      if (params.extensionBack   !== undefined) upd.extension_back             = params.extensionBack   === '' || params.extensionBack   === null ? null : Number(params.extensionBack);
      if (params.extensionBackHon !== undefined) upd.extension_back_honshimei  = params.extensionBackHon === '' || params.extensionBackHon === null ? null : Number(params.extensionBackHon);
      const { error } = await _sb.from('therapists').update(upd).eq('store_id', window.STORE_ID).eq('line_user_id', params.userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'deactivateTherapist': {
      // active=false にして非表示（物理削除はしない）
      const { error } = await _sb.from('therapists').update({ active: false }).eq('store_id', window.STORE_ID).eq('line_user_id', params.userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'saveManualLineEntry': {
      // 同名チェック
      const dupCheck = await _sb.from('therapists').select('id').eq('store_id', window.STORE_ID).eq('name', params.name || '').eq('active', true).maybeSingle();
      if (dupCheck.data) throw new Error('「' + params.name + '」はすでに登録されています。別の源氏名を使用してください。');
      const { error } = await _sb.from('therapists').insert({
        store_id:    window.STORE_ID,
        name:        params.name || '',
        line_user_id:params.userId || null,
        interval_min:Number(params.interval || 30),
        course_back: params.courseBack !== undefined && params.courseBack !== '' ? Number(params.courseBack) : null,
        email:       params.email || null,
        nomination_fee: params.nominationFee !== undefined && params.nominationFee !== '' ? Number(params.nominationFee) : null,
        active:      true,
        is_interview: params.isInterview === true
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'hireTherapist': {
      const { error } = await _sb.from('therapists').update({ is_interview: false }).eq('id', params.id).eq('store_id', window.STORE_ID);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'rejectTherapist': {
      const { error } = await _sb.from('therapists').delete().eq('id', params.id).eq('store_id', window.STORE_ID);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'linkLineUser': {
      const { error } = await _sb.from('therapists').update({ line_user_id: params.userId }).eq('id', params.id).eq('store_id', window.STORE_ID);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'getInterviews': {
      const { data, error } = await _sb.from('interviews')
        .select('*').eq('store_id', window.STORE_ID).order('interview_date', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    }

    case 'saveInterview': {
      const rec = {
        store_id:        window.STORE_ID,
        shift_id:        params.shift_id || null,
        name:            params.name || '',
        interview_date:  params.interview_date || null,
        status:          params.status || 'scheduled',
        age:             params.age || null,
        height:          params.height || null,
        cup:             params.cup || null,
        has_experience:  params.has_experience || false,
        experience_years:params.experience_years || null,
        past_stores:     params.past_stores || null,
        quit_reason:     params.quit_reason || null,
        motivation:      params.motivation || null,
        past_salary:     params.past_salary || null,
        other_interviews:params.other_interviews || false,
        work_days:       params.work_days || null,
        work_hours:      params.work_hours || null,
        preferred_time:  params.preferred_time || null,
        anxiety:         params.anxiety || null,
        qa_memo:         params.qa_memo || null,
        updated_at:      new Date().toISOString()
      };
      let result;
      if (params.id) {
        result = await _sb.from('interviews').update(rec).eq('id', params.id);
      } else {
        result = await _sb.from('interviews').insert(rec).select('id').single();
      }
      if (result.error) throw new Error(result.error.message);
      // 源氏名確定 → therapistsのnameを更新・is_interviewをfalseに
      if (params.status === 'confirmed' && params.therapist_name_original) {
        const { data: th } = await _sb.from('therapists').select('id')
          .eq('store_id', window.STORE_ID).eq('name', params.therapist_name_original).eq('active', true).maybeSingle();
        if (th) {
          await _sb.from('therapists').update({ name: params.name, is_interview: false }).eq('id', th.id);
        } else {
          await _sb.from('therapists').insert({ store_id: window.STORE_ID, name: params.name, interval_min: 30, active: true, is_interview: false });
        }
      }
      // 不採用 → therapists削除・シフト削除
      if (params.status === 'rejected') {
        if (params.therapist_name_original) {
          const { data: th } = await _sb.from('therapists').select('id')
            .eq('store_id', window.STORE_ID).eq('name', params.therapist_name_original).eq('active', true).maybeSingle();
          if (th) await _sb.from('therapists').delete().eq('id', th.id);
        }
        if (params.shift_id) await _sb.from('shifts').delete().eq('id', params.shift_id);
      }
      return { ok: true, id: result.data?.id || params.id };
    }

    case 'deleteInterview': {
      // 紐づくtherapist（is_interview=true）・シフトも削除
      const { data: iv } = await _sb.from('interviews').select('name,shift_id').eq('id', params.id).maybeSingle();
      if (iv) {
        if (iv.shift_id) await _sb.from('shifts').delete().eq('id', iv.shift_id);
        const { data: th } = await _sb.from('therapists').select('id')
          .eq('store_id', window.STORE_ID).eq('name', iv.name).eq('is_interview', true).maybeSingle();
        if (th) await _sb.from('therapists').delete().eq('id', th.id);
      }
      const { error } = await _sb.from('interviews').delete().eq('id', params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // LINEからの源氏名重複チェック（GASから呼び出し用）
    case 'checkTherapistName': {
      const { data } = await _sb.from('therapists').select('id').eq('store_id', window.STORE_ID).eq('name', params.name || '').eq('active', true).maybeSingle();
      return { exists: !!data };
    }

    // LINEからのセラピスト自動登録（GASから呼び出し用・重複チェック付き）
    case 'registerTherapistFromLine': {
      const name   = (params.name || '').trim();
      const userId = params.userId || '';
      if (!name) return { ok: false, reason: 'empty_name' };
      // 同名チェック
      const { data: dup } = await _sb.from('therapists').select('id').eq('store_id', window.STORE_ID).eq('name', name).eq('active', true).maybeSingle();
      if (dup) return { ok: false, reason: 'duplicate', name };
      // LINE userId が既存セラピストに紐付いているか確認
      const { data: existing } = await _sb.from('therapists').select('id,name').eq('store_id', window.STORE_ID).eq('line_user_id', userId).eq('active', true).maybeSingle();
      if (existing) {
        // 既存セラピストの名前を更新
        await _sb.from('therapists').update({ name }).eq('id', existing.id);
        return { ok: true, updated: true, name };
      }
      // 新規登録
      const { error } = await _sb.from('therapists').insert({
        store_id:     window.STORE_ID,
        name,
        line_user_id: userId,
        interval_min: 30,
        active:       true
      });
      if (error) throw new Error(error.message);
      return { ok: true, updated: false, name };
    }

    // ===== マスタ管理 =====
    case 'getMenuMaster': {
      const { data, error } = await _sb.from('menus').select('*').eq('store_id', window.STORE_ID).order('display_order');
      if (error) throw new Error(error.message);
      return (data || []).map((r,i) => ({
        row: r.id, id: r.id, name: r.name||'', col3: r.duration_min||'', col4: r.price||'',
        order: r.display_order||0, active: r.active,
        type:          r.type          || 'course',
        optionType:    r.option_type   || 'fixed',
        optionPrice:   r.price         || 0,
        unitPrice:     r.option_unit_price || 0,
        unitMin:       r.option_unit_min   || 10,
        maxMin:        r.option_max_min    || 100,
        extensionPrice: r.extension_price !== null && r.extension_price !== undefined ? Number(r.extension_price) : null
      }));
    }

    case 'saveMenuMaster': {
      const menuData = {
        name:              params.name||'',
        type:              params.type || 'course',
        duration_min:      params.type === 'course' ? (Number(params.col3)||null) : null,
        price:             Number(params.col4)||0,
        display_order:     Number(params.order)||0,
        option_type:       params.optionType   || 'fixed',
        option_unit_price: Number(params.unitPrice || 0),
        option_unit_min:   Number(params.unitMin   || 10),
        option_max_min:    Number(params.maxMin    || 100),
        extension_price:   params.extensionPrice !== undefined && params.extensionPrice !== '' ? Number(params.extensionPrice) : null,
        active:            params.active !== false
      };
      if (params.row && params.row !== 'null' && params.row !== '') {
        const { error } = await _sb.from('menus').update(menuData).eq('id', params.row);
        if (error) throw new Error(error.message);
        return { ok: true, id: params.row };
      } else {
        const { data, error } = await _sb.from('menus').insert({ store_id: window.STORE_ID, ...menuData }).select().single();
        if (error) throw new Error(error.message);
        return { ok: true, id: data.id };
      }
    }

    case 'deleteMenuMaster': {
      const { error } = await _sb.from('menus').delete().eq('id', params.row);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'getRoomMaster': {
      const { data, error } = await _sb.from('rooms').select('*, interval_min').eq('store_id', window.STORE_ID).order('display_order');
      if (error) throw new Error(error.message);
      return (data || []).map((r,i) => ({
        row: r.id, id: r.id, name: r.name||'', col3: r.description||'', col4: r.guest_guide||'',
        order: r.display_order||0, active: r.active, intervalMin: r.interval_min||0
      }));
    }

    case 'saveRoomMaster': {
      if (params.row && params.row !== 'null' && params.row !== '') {
        const { error } = await _sb.from('rooms').update({
          name: params.name||'', description: params.col3||null,
          guest_guide: params.col4||null, display_order: Number(params.order)||0,
          active: params.active !== false, interval_min: Number(params.intervalMin||0)
        }).eq('id', params.row);
        if (error) throw new Error(error.message);
        return { ok: true, id: params.row };
      } else {
        const { data, error } = await _sb.from('rooms').insert({
          store_id: window.STORE_ID, name: params.name||'',
          description: params.col3||null, guest_guide: params.col4||null,
          display_order: Number(params.order)||0, active: true,
          interval_min: Number(params.intervalMin||0)
        }).select().single();
        if (error) throw new Error(error.message);
        return { ok: true, id: data.id };
      }
    }

    case 'deleteRoomMaster': {
      const { error } = await _sb.from('rooms').delete().eq('id', params.row);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // ===== 退勤チェックリスト =====
    case 'getChecklistByStore': {
      const { data, error } = await _sb.from('room_checklists').select('*')
        .eq('store_id', window.STORE_ID).eq('active', true).order('room_name').order('display_order');
      if (error) throw new Error(error.message);
      return (data || []).map(r => ({
        id: r.id, roomName: r.room_name, itemName: r.item_name, order: r.display_order,
        detail: r.detail || '', imageUrls: r.image_urls || []
      }));
    }

    case 'saveChecklistItem': {
      const itemData = {
        store_id: window.STORE_ID,
        room_name: params.roomName,
        item_name: params.itemName,
        display_order: Number(params.order) || 0,
        detail: params.detail || null,
        image_urls: params.imageUrls || [],
        active: true
      };
      if (params.id) {
        const { error } = await _sb.from('room_checklists').update(itemData).eq('id', params.id);
        if (error) throw new Error(error.message);
        return { ok: true };
      } else {
        const { data, error } = await _sb.from('room_checklists').insert(itemData).select().single();
        if (error) throw new Error(error.message);
        return { ok: true, id: data.id };
      }
    }

    case 'deleteChecklistItem': {
      const { error } = await _sb.from('room_checklists').delete().eq('id', params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'saveCheckoutLog': {
      const { data, error } = await _sb.from('checkout_logs').insert({
        store_id: window.STORE_ID,
        therapist_name: params.therapistName,
        room_name: params.roomName,
        work_date: params.workDate,
        checked_items: params.checkedItems || [],
        unchecked_items: params.uncheckedItems || []
      }).select().single();
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }

    case 'getManuals': {
      const { data, error } = await _sb.from('manuals').select('*')
        .eq('store_id', window.STORE_ID).order('category').order('display_order');
      if (error) throw new Error(error.message);
      return (data || []).map(r => ({
        id: r.id, category: r.category, title: r.title,
        body: r.body || '', imageUrl: r.image_url || '',
        order: r.display_order || 0, active: r.active !== false
      }));
    }
    case 'saveManual': {
      const manualData = {
        store_id:      window.STORE_ID,
        category:      params.category || 'その他',
        title:         params.title || '',
        body:          params.body || null,
        image_url:     params.imageUrl || null,
        display_order: Number(params.order) || 0,
        active:        params.active !== false
      };
      if (params.id) {
        const { error } = await _sb.from('manuals').update(manualData).eq('id', params.id);
        if (error) throw new Error(error.message);
        return { ok: true };
      } else {
        const { error } = await _sb.from('manuals').insert(manualData);
        if (error) throw new Error(error.message);
        return { ok: true };
      }
    }
    case 'deleteManual': {
      const { error } = await _sb.from('manuals').delete().eq('id', params.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case 'getTherapistMaster': {
      const { data } = await _sb.from('therapists').select('*').eq('store_id', window.STORE_ID).eq('active', true).order('registered_at');
      return (data || []).map(t => ({
        id: t.id, name: t.name, userId: t.line_user_id||'',
        interval: t.interval_min??30,
        courseBack: t.course_back!==null ? Number(t.course_back) : '',
        email: t.email||''
      }));
    }

    // ===== スカウト =====
    case 'getScoutCompanies': {
      const { data } = await _sb.from('scout_companies')
        .select('*').eq('store_id', window.STORE_ID).eq('active', true).order('created_at');
      return data || [];
    }
    case 'saveScoutCompany': {
      if (params.id) {
        const { data, error } = await _sb.from('scout_companies')
          .update({ name: params.name, back_rate: params.back_rate, advisory_fee: params.advisory_fee })
          .eq('id', params.id).select().single();
        if (error) throw new Error(error.message);
        return data;
      } else {
        const { data, error } = await _sb.from('scout_companies')
          .insert({ store_id: window.STORE_ID, name: params.name, back_rate: params.back_rate, advisory_fee: params.advisory_fee })
          .select().single();
        if (error) throw new Error(error.message);
        return data;
      }
    }
    case 'getTherapistScout': {
      const { data } = await _sb.from('therapist_scouts')
        .select('*, scout_companies(*)')
        .eq('store_id', window.STORE_ID).eq('therapist_id', params.therapist_id).eq('active', true).maybeSingle();
      return data || null;
    }
    case 'saveTherapistScout': {
      // UPSERT: store_id+therapist_idのユニーク制約を利用
      const { error } = await _sb.from('therapist_scouts')
        .upsert({ store_id: window.STORE_ID, therapist_id: params.therapist_id, company_id: params.company_id, active: true },
          { onConflict: 'store_id,therapist_id' });
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    case 'deleteTherapistScout': {
      const { error } = await _sb.from('therapist_scouts')
        .update({ active: false })
        .eq('store_id', window.STORE_ID).eq('therapist_id', params.therapist_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    case 'getScoutSummary': {
      // 指定月の売上・シフトデータを取得してスカウト集計
      const ym = params.month; // "2026-05"
      const [y, m] = ym.split('-').map(Number);
      const startDt = new Date(y, m-1, 1, 3, 0, 0);
      const endDt   = new Date(y, m,   1, 2, 59, 59);

      // ① therapist_scouts を取得
      const { data: scouts, error: scoutErr } = await _sb.from('therapist_scouts')
        .select('therapist_id, company_id')
        .eq('store_id', window.STORE_ID).eq('active', true);
      if (scoutErr) throw new Error('scouts: ' + scoutErr.message);
      if (!scouts || !scouts.length) return [];

      const therapistIds = scouts.map(s => s.therapist_id);
      const companyIds   = [...new Set(scouts.map(s => s.company_id))];

      // ② セラピスト情報を取得
      const { data: therapistRows, error: tErr } = await _sb.from('therapists')
        .select('id, name, course_back')
        .in('id', therapistIds).eq('active', true);
      if (tErr) throw new Error('therapists: ' + tErr.message);

      // ③ 会社情報を取得
      const { data: companyRows, error: cErr } = await _sb.from('scout_companies')
        .select('id, name, back_rate, advisory_fee')
        .in('id', companyIds).eq('active', true);
      if (cErr) throw new Error('companies: ' + cErr.message);

      // ④ 売上（コースのみ）
      const { data: sales } = await _sb.from('sales')
        .select('therapist_id, date, course_price')
        .eq('store_id', window.STORE_ID)
        .in('therapist_id', therapistIds)
        .gte('date', startDt.toISOString())
        .lte('date', endDt.toISOString());

      // ⑤ 承認済みシフト（欠勤・無断欠勤除く）
      const therapistNames = (therapistRows || []).map(t => t.name);
      const mStr = String(m).padStart(2,'0');
      const { data: shifts } = await _sb.from('shifts')
        .select('therapist_name, date')
        .eq('store_id', window.STORE_ID)
        .in('therapist_name', therapistNames)
        .eq('status', 'approved')
        .neq('attendance_type', 'absent')
        .neq('attendance_type', 'noshow')
        .gte('date', `${y}-${mStr}-01`)
        .lte('date', `${y}-${mStr}-31`);

      // マップ化
      const tMap  = Object.fromEntries((therapistRows || []).map(t => [t.id, t]));
      const coMap = Object.fromEntries((companyRows || []).map(c => [c.id, c]));

      // セラピスト別に集計
      return scouts.map(s => {
        const t  = tMap[s.therapist_id];
        const co = coMap[s.company_id];
        if (!t || !co) return null;
        const courseBack = Number(t.course_back) || 0;
        const backRate   = Number(co.back_rate) || 0;
        const advFee     = Number(co.advisory_fee) || 0;
        // 日別売上グループ化
        const dayMap = {};
        (sales || []).filter(r => r.therapist_id === t.id).forEach(r => {
          const d   = new Date(r.date);
          const key = `${d.getMonth()+1}/${d.getDate()}`;
          if (!dayMap[key]) dayMap[key] = 0;
          dayMap[key] += Number(r.course_price) || 0;
        });
        const days = Object.entries(dayMap).map(([date, courseTotal]) => ({
          date,
          sb: Math.round(courseTotal * courseBack * backRate)
        }));
        const workDays = (shifts || []).filter(r => r.therapist_name === t.name).length;
        const totalSb  = days.reduce((sum, d) => sum + d.sb, 0);
        const advisory = workDays * advFee;
        return {
          therapistId: t.id, therapistName: t.name,
          companyId: co.id, companyName: co.name,
          backRate, advisoryFee: advFee, courseBack,
          workDays, totalSb, advisory, total: totalSb + advisory, days
        };
      }).filter(Boolean);
    }

    // ===== トークン認証 =====
case 'verifyTokenAction': {
  const { data, error } = await _sb.from('tokens').select('*').eq('token', params.token).maybeSingle();
  if (error || !data) return { ok: false, error: 'not found' };
  if (Date.now() > Number(data.expires_at)) return { ok: false, error: 'expired' };
  // 店舗IDをURLに反映
  if (data.store_id) {
    window.STORE_ID = data.store_id;
    clearCache(); // 店舗切り替え時にキャッシュを全クリア
  }
  return { ok: true, name: data.therapist_name };
}

    // ===== セラピスト用予約 =====
    case 'getMyReservations': {
      // 27時ルール：当日03:00〜を取得（00:00〜02:59は前日扱いのため除外）
      const today = new Date();
      if (today.getHours() < 3) today.setDate(today.getDate() - 1);
      today.setHours(3,0,0,0);
      const { data, error } = await _sb.from('reservations').select('*')
        .eq('store_id', window.STORE_ID).eq('therapist_name', params.therapist)
        .gte('date', today.toISOString()).neq('status', 'cancelled').order('date');
      if (error) throw new Error(error.message);

      // 未承認の姫予約は日付に関係なく追加取得（月またぎ対応）
      const { data: pendingHime } = await _sb.from('reservations').select('*')
        .eq('store_id', window.STORE_ID).eq('therapist_name', params.therapist)
        .eq('is_hime', true).eq('is_hime_approved', false)
        .neq('status', 'cancelled').lt('date', today.toISOString());
      // 重複を除いてマージ
      const existingIds = new Set((data || []).map(r => r.id));
      const extraHime = (pendingHime || []).filter(r => !existingIds.has(r.id));
      const rows = [...extraHime, ...(data || [])].sort((a,b) => new Date(a.date) - new Date(b.date));

      // customer_tel を収集（telベースで統一）
      const custTels = [...new Set(rows.map(r => r.customer_tel).filter(Boolean))];

      // 来店回数: reservationsテーブルのキャンセル以外（顧客詳細の来店履歴と同じ基準）
      const visitMap = {}; // customer_tel → 自分への来店回数

      if (custTels.length) {
        const { data: resvHist } = await _sb.from('reservations')
          .select('customer_tel, therapist_name, date')
          .eq('store_id', window.STORE_ID)
          .in('customer_tel', custTels)
          .eq('therapist_name', params.therapist)
          .neq('status', 'cancelled');
        // 日付単位で重複排除（同日同セラピストへの予約を1回としてカウント）
        const countedKeys = new Set();
        (resvHist || []).forEach(r => {
          if (!r.customer_tel) return;
          const dayKey = r.customer_tel + '_' + (r.date || '').slice(0, 10);
          if (countedKeys.has(dayKey)) return;
          countedKeys.add(dayKey);
          visitMap[r.customer_tel] = (visitMap[r.customer_tel] || 0) + 1;
        });
      }

      // 姫予約の正式顧客名をcustomersテーブルから取得
      const custNameMap = {}; // tel → 正式名
      if (custTels.length) {
        const { data: custData } = await _sb.from('customers')
          .select('tel, name').eq('store_id', window.STORE_ID)
          .in('tel', custTels);
        (custData || []).forEach(c => { if (c.tel) custNameMap[c.tel] = c.name; });
      }

      return rows.map(r => {
        // customer_no がなければ tel → customer_no に変換
        const tel = r.customer_tel || '';
        const myVisitCount = tel ? (visitMap[tel] || 0) : 0;
        // 姫予約の場合、顧客マスタの正式名を優先表示
        const resolvedName = (r.is_hime && tel && custNameMap[tel])
          ? custNameMap[tel]
          : r.customer_name || '';
        return {
          row:          r.id,
          date:         _fmtDatetimeJp(r.date),
          therapist:    r.therapist_name || '',
          course:       r.course_min || 60,
          customer:     resolvedName,
          price:        r.price || 0,
          discount:     r.discount || 0,
          nomination:   r.nomination || 'free',
          customerNo:   r.customer_no || '',
          tel:          tel,
          coursePrice:  r.course_price || 0,
          optionPrice:  r.option_price || 0,
          nominationFee:r.nomination_fee || 0,
          isStoreNew:   tel ? !custNameMap[tel] : true,
          myVisitCount,
          isHime:             r.is_hime || false,
          isHimeApproved:     r.is_hime_approved || false,
          therapistConfirmed: r.therapist_confirmed || false,
          _id:                r.id
        };
      });
    }

case 'sendLineMessage': {
  try {
    const LINE_PUSH = 'https://rzfprialypdoyklfwpyg.supabase.co/functions/v1/line-push';
    const res = await fetch(LINE_PUSH + '?action=sendLineMessage&userId=' + encodeURIComponent(params.userId) + '&message=' + encodeURIComponent(params.message || ''));
    const text = await res.text();
    try { return JSON.parse(text); } catch(e) { return { ok: true }; }
  } catch(e) {
    console.warn('LINE送信エラー:', e);
    return { ok: false, error: e.message };
  }
}

    // ===== 店舗設定 =====
    case 'getStoreSettings': {
      const { data } = await _sb.from('store_settings').select('*').eq('store_id', window.STORE_ID).maybeSingle();
      if (!data) return {};
      const cp = data.course_prices || {};
      return {
        ...data,
        course_prices:   cp,
        extension_min:   data.extension_min   || 30,
        extension_price: data.extension_price || 3000
      };
    }

    case 'saveStoreSettings': {
      const { data: ex } = await _sb.from('store_settings').select('id').eq('store_id', window.STORE_ID).maybeSingle();
      const upd = {};
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
        await _sb.from('store_settings').update(upd).eq('store_id', window.STORE_ID);
      } else {
        await _sb.from('store_settings').insert({ store_id: window.STORE_ID, ...upd });
      }
      return { ok: true };
    }

    default:
      console.warn('未実装のaction:', action);
      return null;
  }
}

// ============================================================
// クライアントキャッシュ（速度改善）
// ============================================================
const _cache = {};
const CACHE_TTL = {
  getInitialData:  5 * 60 * 1000,
  getTherapists:   5 * 60 * 1000,
  getRoomMaster:   5 * 60 * 1000,
  getMenuMaster:   5 * 60 * 1000,
  getTherapistMaster: 5 * 60 * 1000,
};

export function apiGetCached(action, params = {}) {
  const ttl = CACHE_TTL[action];
  if (!ttl) return apiGet(action, params);
  const key = action + '_' + window.STORE_ID + JSON.stringify(params);
  const cached = _cache[key];
  if (cached && Date.now() - cached.at < ttl) return Promise.resolve(cached.data);
  return apiGet(action, params).then(data => {
    _cache[key] = { data, at: Date.now() };
    return data;
  });
}

export function clearCache(action) {
  if (action) {
    Object.keys(_cache).filter(k => k.startsWith(action)).forEach(k => delete _cache[k]);
  } else {
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }
}
