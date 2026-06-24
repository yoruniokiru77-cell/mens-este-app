import { describe, it, expect } from 'vitest';
import { calcPayroll } from '../calcPayroll';

// ─── 基本ケース ───────────────────────────────────────────────
describe('コース給料（固定バックなし）', () => {
  it('deduct_then_back: (coursePrice - discount) × courseBack', () => {
    const r = calcPayroll(
      { course_price: 10000, discount: 1000, therapist_course_back: 0.6 },
      { discount_mode: 'deduct_then_back' }
    );
    expect(r.therapistCoursePay).toBe(Math.round((10000 - 1000) * 0.6)); // 5400
    expect(r.storeDrop).toBe(10000 - 0 + 0 - 1000 - r.therapistCoursePay - 0); // 不変条件
  });

  it('store_bears: coursePrice × courseBack（割引は無視）', () => {
    const r = calcPayroll(
      { course_price: 10000, discount: 1000, therapist_course_back: 0.6 },
      { discount_mode: 'store_bears' }
    );
    expect(r.therapistCoursePay).toBe(Math.round(10000 * 0.6)); // 6000
  });

  it('バック率未設定: デフォルト0.5', () => {
    const r = calcPayroll({ course_price: 10000 }, {});
    expect(r.courseBack).toBe(0.5);
    expect(r.therapistCoursePay).toBe(Math.round(10000 * 0.5));
  });
});

// ─── 固定バック ───────────────────────────────────────────────
describe('コース給料（固定バックあり）', () => {
  it('固定バック × store_bears: 割引無視でfixedBackそのまま', () => {
    const r = calcPayroll(
      { course_price: 10000, discount: 1000, fixed_back_amount: 5000 },
      { discount_mode: 'store_bears' }
    );
    expect(r.therapistCoursePay).toBe(5000);
    expect(r.fixedBack).toBe(5000);
  });

  it('固定バック × deduct_then_back: fixedBack - round(discount/2)', () => {
    const r = calcPayroll(
      { course_price: 10000, discount: 1000, fixed_back_amount: 5000 },
      { discount_mode: 'deduct_then_back' }
    );
    expect(r.therapistCoursePay).toBe(5000 - Math.round(1000 / 2)); // 4500
  });

  it('固定バック × 割引0: 影響なし', () => {
    const r = calcPayroll(
      { course_price: 10000, discount: 0, fixed_back_amount: 5000 },
      { discount_mode: 'deduct_then_back' }
    );
    expect(r.therapistCoursePay).toBe(5000);
  });
});

// ─── 不変条件 ──────────────────────────────────────────────────
describe('不変条件', () => {
  it('storeDrop = totalAmount - baseTherapistPay', () => {
    const row = {
      course_price: 8000, option_price: 2000, nomination_fee: 500,
      discount: 500, therapist_course_back: 0.6, therapist_option_back: 1.0,
    };
    const r = calcPayroll(row, {});
    const totalAmount = 8000 + 2000 + 500 - 500;
    const base = r.therapistCoursePay + r.therapistOptPay + 500;
    expect(r.storeDrop).toBe(totalAmount - base);
  });

  it('therapistPay = baseTherapistPay - miscFee - accomFee', () => {
    const r = calcPayroll(
      { course_price: 10000, therapist_course_back: 0.6 },
      {},
      { miscFee: 300, accomFee: 200 }
    );
    const base = r.therapistCoursePay + r.therapistOptPay + 0;
    expect(r.therapistPay).toBe(base - 300 - 200);
  });

  it('miscFee/accomFee はstoreDropに影響しない', () => {
    const r1 = calcPayroll({ course_price: 10000 }, {}, { miscFee: 0 });
    const r2 = calcPayroll({ course_price: 10000 }, {}, { miscFee: 1000 });
    expect(r1.storeDrop).toBe(r2.storeDrop);
  });
});

// ─── オプション給料 ────────────────────────────────────────────
describe('オプション給料', () => {
  it('optItemsなし: optPrice × optionBack', () => {
    const r = calcPayroll(
      { course_price: 8000, option_price: 2000, therapist_option_back: 0.8 },
      {}
    );
    expect(r.therapistOptPay).toBe(Math.round(2000 * 0.8));
  });

  it('optItemsあり・固定バック: 固定額を使用', () => {
    const therapistId = 'th-1';
    const menuId = 'menu-1';
    const r = calcPayroll(
      { course_price: 8000, nomination: 'other' },
      {},
      {
        optItems: [{ menuId, name: 'アロマ', amount: 2000 }],
        menuBackMap: { [`${therapistId}_${menuId}`]: { other: 1500, honshimei: 2000 } },
        therapistId,
      }
    );
    expect(r.therapistOptPay).toBe(1500);
  });

  it('optItemsあり・本指名: honshimeiの固定額を優先', () => {
    const therapistId = 'th-1';
    const menuId = 'menu-1';
    const r = calcPayroll(
      { course_price: 8000, nomination: 'honshimei' },
      {},
      {
        optItems: [{ menuId, name: 'アロマ', amount: 2000 }],
        menuBackMap: { [`${therapistId}_${menuId}`]: { other: 1500, honshimei: 2000 } },
        therapistId,
      }
    );
    expect(r.therapistOptPay).toBe(2000);
  });

  it('延長オプション: therapistExtPayに分離', () => {
    const r = calcPayroll(
      { course_price: 8000, therapist_course_back: 0.6 },
      {},
      {
        optItems: [{ menuId: null, name: '延長30分', amount: 3000 }],
        menuBackMap: {},
        therapistId: 'th-1',
        extensionBack: 1500,
      }
    );
    expect(r.therapistExtPay).toBe(1500);
    expect(r.therapistOptPay).toBe(1500); // extPayはoptPayに含む
  });

  it('延長オプション・固定バックなし: courseBackで計算', () => {
    const r = calcPayroll(
      { course_price: 8000, therapist_course_back: 0.6 },
      {},
      {
        optItems: [{ menuId: null, name: '延長30分', amount: 3000 }],
        menuBackMap: {},
        therapistId: 'th-1',
      }
    );
    expect(r.therapistExtPay).toBe(Math.round(3000 * 0.6));
  });
});

// ─── 割引モード優先順位 ────────────────────────────────────────
describe('割引モード優先順位', () => {
  it('セラピスト個別モードがストア設定より優先', () => {
    const r = calcPayroll(
      { course_price: 10000, discount: 1000, therapist_course_back: 0.6, therapist_discount_mode: 'store_bears' },
      { discount_mode: 'deduct_then_back' }
    );
    // store_bears: coursePrice × courseBack（割引無視）
    expect(r.therapistCoursePay).toBe(Math.round(10000 * 0.6));
  });

  it('ストア設定がグローバルデフォルトより優先', () => {
    const r = calcPayroll(
      { course_price: 10000, discount: 1000, therapist_course_back: 0.6 },
      { discount_mode: 'store_bears' }
    );
    expect(r.therapistCoursePay).toBe(Math.round(10000 * 0.6));
  });
});

// ─── 指名料 ───────────────────────────────────────────────────
describe('指名料', () => {
  it('指名料はbaseTherapistPayに含まれstoreDropに影響する', () => {
    const r = calcPayroll(
      { course_price: 10000, nomination_fee: 1000, therapist_course_back: 0.6 },
      {}
    );
    // baseTherapistPay = coursePay + 0 + 1000
    expect(r.therapistPay).toBe(r.therapistCoursePay + 1000);
    expect(r.storeDrop).toBe(10000 + 1000 - (r.therapistCoursePay + 1000));
  });
});
