export type DiscountMode = 'deduct_then_back' | 'store_bears';

export interface SaleRow {
  price?: number | null;
  course_price?: number | null;
  option_price?: number | null;
  nomination_fee?: number | null;
  discount?: number | null;
  nomination?: string | null;
  therapist_course_back?: number | null;
  therapist_option_back?: number | null;
  therapist_discount_mode?: DiscountMode | null;
  fixed_back_amount?: number | null;
}

export interface StoreSettings {
  discount_mode?: DiscountMode | null;
  default_course_back?: number | null;
  default_option_back?: number | null;
}

export interface OptItem {
  menuId: string | null;
  name: string;
  amount: number;
}

export interface MenuBack {
  other: number | null;
  honshimei: number | null;
}

export interface CalcPayrollOpts {
  miscFee?: number;
  accomFee?: number;
  optItems?: OptItem[] | null;
  menuBackMap?: Record<string, MenuBack> | null;
  therapistId?: string | null;
  extensionBack?: number | null;
  extensionBackHon?: number | null;
}

export interface CalcPayrollResult {
  storeDrop: number;
  therapistPay: number;
  therapistCoursePay: number;
  therapistOptPay: number;
  therapistExtPay: number;
  courseBack: number;
  optionBack: number;
  fixedBack: number | null;
}

const DISCOUNT_MODE_DEFAULT: DiscountMode = 'deduct_then_back';

export function calcPayroll(
  row: SaleRow,
  storeSettings: StoreSettings | null,
  opts: CalcPayrollOpts = {}
): CalcPayrollResult {
  const ss = storeSettings ?? {};

  // 割引モード（優先順: セラピスト個別 → 店舗設定 → グローバルデフォルト）
  const mode: DiscountMode = row.therapist_discount_mode ?? ss.discount_mode ?? DISCOUNT_MODE_DEFAULT;

  // バック率
  const courseBack = (row.therapist_course_back != null)
    ? Number(row.therapist_course_back)
    : Number(ss.default_course_back ?? 0.5);
  const optionBack = (row.therapist_option_back != null)
    ? Number(row.therapist_option_back)
    : Number(ss.default_option_back ?? 1.0);

  // 金額
  const price       = Number(row.price       ?? 0);
  const coursePrice = Number(row.course_price ?? price);
  const optPrice    = Number(row.option_price ?? 0);
  const nomFee      = Number(row.nomination_fee ?? 0);
  const discount    = Number(row.discount    ?? 0);
  const miscFee     = Number(opts.miscFee    ?? 0);
  const accomFee    = Number(opts.accomFee   ?? 0);
  const optItems    = opts.optItems    ?? null;
  const mbMap       = opts.menuBackMap ?? null;
  const therapistId = opts.therapistId ?? null;

  // コース固定バック
  const fixedBack = (row.fixed_back_amount != null)
    ? Number(row.fixed_back_amount)
    : null;

  // ── コース給料（therapistCoursePay）──
  let therapistCoursePay: number;
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
    const isHon = row.nomination === 'honshimei';
    actualOptPrice = 0;
    const extBack    = opts.extensionBack    != null ? Number(opts.extensionBack)    : null;
    const extBackHon = opts.extensionBackHon != null ? Number(opts.extensionBackHon) : null;

    for (const opt of optItems) {
      actualOptPrice += opt.amount;
      const isExt = !opt.menuId && opt.name.includes('延長');

      if (isExt) {
        const extFixed = isHon
          ? (extBackHon != null ? extBackHon : extBack)
          : (extBack    != null ? extBack    : extBackHon);
        const extPay = extFixed != null ? Number(extFixed) : Math.round(opt.amount * courseBack);
        therapistExtPay += extPay;
        therapistOptPay += extPay;
        continue;
      }

      const mb = opt.menuId ? (mbMap[therapistId + '_' + opt.menuId] ?? null) : null;
      if (mb) {
        const prim = isHon ? mb.honshimei : mb.other;
        const fall = isHon ? mb.other     : mb.honshimei;
        const fixedOpt = prim != null ? prim : fall != null ? fall : null;
        if (fixedOpt !== null) {
          therapistOptPay += Number(fixedOpt);
          continue;
        }
      }
      therapistOptPay += Math.round(opt.amount * optionBack);
    }
  } else {
    therapistOptPay = Math.round(optPrice * optionBack);
  }

  // ── 不変条件 ──
  // storeDrop = totalAmount - baseTherapistPay
  // miscFee/accomFee はUI層で storeDrop に加算されるため、ここでは除外
  const baseTherapistPay = therapistCoursePay + therapistOptPay + nomFee;
  const totalAmount      = coursePrice + actualOptPrice + nomFee - discount;
  const storeDrop        = totalAmount - baseTherapistPay;
  const therapistPay     = baseTherapistPay - miscFee - accomFee;

  return { storeDrop, therapistPay, therapistCoursePay, therapistOptPay, therapistExtPay, courseBack, optionBack, fixedBack };
}
