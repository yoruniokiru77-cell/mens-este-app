// @ts-nocheck
// 給料計算ロジック — 唯一の正規実装
// 詳細仕様は CLAUDE.md の「_calcPayroll 関数の完全仕様」参照

const DEFAULT_DISCOUNT_MODE = 'deduct_then_back';

export function _calcPayroll(row, storeSettings, opts = {}) {
  const ss = storeSettings || (typeof window !== 'undefined' && window._cachedStoreSettings) || {};

  // 割引モード（優先順: セラピスト個別 → 店舗設定 → グローバルデフォルト）
  const mode = row.therapist_discount_mode || ss.discount_mode || DEFAULT_DISCOUNT_MODE;

  // バック率
  const courseBack = (row.therapist_course_back !== undefined && row.therapist_course_back !== null)
    ? Number(row.therapist_course_back) : Number(ss.default_course_back || 0.5);
  const optionBack = (row.therapist_option_back !== undefined && row.therapist_option_back !== null)
    ? Number(row.therapist_option_back) : Number(ss.default_option_back ?? 1.0);

  // 金額
  const price       = Number(row.price       || 0);
  const coursePrice = Number(row.course_price || price);
  const optPrice    = Number(row.option_price || 0);
  const nomFee      = Number(row.nomination_fee || 0);
  const discount    = Number(row.discount    || 0);
  const miscFee     = Number(opts.miscFee    || 0);
  const accomFee    = Number(opts.accomFee   || 0);
  const optItems    = opts.optItems    || null;
  const mbMap       = opts.menuBackMap || null;
  const therapistId = opts.therapistId || null;

  // コース固定バック
  const fixedBack = (row.fixed_back_amount !== undefined && row.fixed_back_amount !== null)
    ? Number(row.fixed_back_amount) : null;

  // ── コース給料（therapistCoursePay）──
  let therapistCoursePay;
  if (fixedBack !== null) {
    therapistCoursePay = (mode === 'deduct_then_back')
      ? fixedBack - Math.round(discount / 2)
      : fixedBack;
  } else if (mode === 'store_bears') {
    therapistCoursePay = Math.round(coursePrice * courseBack);
  } else {
    therapistCoursePay = Math.round((coursePrice - discount) * courseBack);
  }

  // ── オプション給料（therapistOptPay）──
  let therapistOptPay = 0;
  let therapistExtPay = 0;
  let actualOptPrice  = optPrice;
  if (optItems && optItems.length > 0 && mbMap && therapistId) {
    const isHon = (row.nomination === 'honshimei');
    actualOptPrice = 0;
    const extBack    = opts.extensionBack    != null ? Number(opts.extensionBack)    : null;
    const extBackHon = opts.extensionBackHon != null ? Number(opts.extensionBackHon) : null;
    optItems.forEach(opt => {
      actualOptPrice += opt.amount;
      const isExt = !opt.menuId && (opt.name || '').includes('延長');
      if (isExt) {
        const extFixed = isHon
          ? (extBackHon != null ? extBackHon : extBack)
          : (extBack    != null ? extBack    : extBackHon);
        const extPay = extFixed != null ? Number(extFixed) : Math.round(opt.amount * courseBack);
        therapistExtPay += extPay;
        therapistOptPay += extPay;
        return;
      }
      const mb = opt.menuId ? (mbMap[therapistId + '_' + opt.menuId] || null) : null;
      if (mb) {
        const prim = isHon ? mb.honshimei : mb.other;
        const fall = isHon ? mb.other     : mb.honshimei;
        const fixedOpt = (prim !== null && prim !== undefined) ? prim
                       : (fall !== null && fall !== undefined) ? fall : null;
        if (fixedOpt !== null) { therapistOptPay += Number(fixedOpt); return; }
      }
      therapistOptPay += Math.round(opt.amount * optionBack);
    });
  } else {
    therapistOptPay = Math.round(optPrice * optionBack);
  }

  // ── 店落ち（不変条件: 会計金額 - セラピスト給料）──
  // miscFee/accomFee は UI 層（recalcPayroll）で storeDrop に加算されるため除外
  const baseTherapistPay = therapistCoursePay + therapistOptPay + nomFee;
  const totalAmount      = coursePrice + actualOptPrice + nomFee - discount;
  const storeDrop        = totalAmount - baseTherapistPay;

  const therapistPay = baseTherapistPay - miscFee - accomFee;

  return { storeDrop, therapistPay, therapistCoursePay, therapistOptPay, therapistExtPay, courseBack, optionBack, fixedBack };
}
