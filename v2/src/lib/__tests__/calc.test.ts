import { describe, it, expect } from 'vitest';
import { _calcPayroll } from '../calc';

// ============================================================
// テスト用ヘルパー
// ============================================================

/** 最小限の row オブジェクト */
function row(overrides = {}) {
  return {
    price: 12000,
    course_price: 12000,
    option_price: 0,
    nomination_fee: 0,
    discount: 0,
    nomination: 'free',
    therapist_course_back: null,
    therapist_option_back: null,
    therapist_discount_mode: null,
    fixed_back_amount: null,
    ...overrides,
  };
}

/** 最小限の storeSettings */
function ss(overrides = {}) {
  return {
    discount_mode: 'deduct_then_back',
    default_course_back: 0.5,
    default_option_back: 1.0,
    ...overrides,
  };
}

// ============================================================
// 1. コース給料 — バック率ベース
// ============================================================

describe('コース給料（バック率）', () => {
  it('割引なし: coursePrice × courseBack', () => {
    const r = _calcPayroll(row(), ss());
    expect(r.therapistCoursePay).toBe(6000); // 12000 × 0.5
  });

  it('deduct_then_back: (coursePrice - discount) × courseBack', () => {
    const r = _calcPayroll(row({ discount: 2000 }), ss({ discount_mode: 'deduct_then_back' }));
    expect(r.therapistCoursePay).toBe(5000); // (12000-2000) × 0.5
  });

  it('store_bears: coursePrice × courseBack（割引無視）', () => {
    const r = _calcPayroll(row({ discount: 2000 }), ss({ discount_mode: 'store_bears' }));
    expect(r.therapistCoursePay).toBe(6000); // 12000 × 0.5
  });

  it('セラピスト個別バック率が優先される', () => {
    const r = _calcPayroll(row({ therapist_course_back: 0.6 }), ss());
    expect(r.therapistCoursePay).toBe(7200); // 12000 × 0.6
  });

  it('storeSettings未設定時はデフォルト0.5', () => {
    const r = _calcPayroll(row(), null);
    expect(r.courseBack).toBe(0.5);
  });
});

// ============================================================
// 2. コース給料 — 固定バック
// ============================================================

describe('コース給料（固定バック）', () => {
  it('固定バック × store_bears: fixedBack がそのままセラピスト給料', () => {
    const r = _calcPayroll(
      row({ fixed_back_amount: 7000, discount: 2000 }),
      ss({ discount_mode: 'store_bears' })
    );
    expect(r.therapistCoursePay).toBe(7000);
  });

  it('固定バック × deduct_then_back: fixedBack - round(discount/2)', () => {
    const r = _calcPayroll(
      row({ fixed_back_amount: 7000, discount: 2000 }),
      ss({ discount_mode: 'deduct_then_back' })
    );
    expect(r.therapistCoursePay).toBe(6000); // 7000 - 1000
  });

  it('固定バック × deduct_then_back: 奇数割引は round', () => {
    const r = _calcPayroll(
      row({ fixed_back_amount: 7000, discount: 1001 }),
      ss({ discount_mode: 'deduct_then_back' })
    );
    expect(r.therapistCoursePay).toBe(7000 - Math.round(1001 / 2));
  });

  it('固定バック × デフォルトモード(deduct_then_back扱い): fixedBack - discount/2', () => {
    const r = _calcPayroll(
      row({ fixed_back_amount: 7000, discount: 2000 }),
      ss()
    );
    expect(r.therapistCoursePay).toBe(6000);
  });
});

// ============================================================
// 3. 不変条件（invariant）
// ============================================================

describe('不変条件', () => {
  it('storeDrop = totalAmount - baseTherapistPay', () => {
    const r = _calcPayroll(
      row({ option_price: 3000, nomination_fee: 1000, discount: 2000 }),
      ss()
    );
    const total = 12000 + 3000 + 1000 - 2000; // 14000
    const base  = r.therapistCoursePay + r.therapistOptPay + 1000;
    expect(r.storeDrop).toBe(total - base);
  });

  it('therapistPay = baseTherapistPay - miscFee - accomFee', () => {
    const r = _calcPayroll(row(), ss(), { miscFee: 500, accomFee: 300 });
    const base = r.therapistCoursePay + r.therapistOptPay + 0;
    expect(r.therapistPay).toBe(base - 500 - 300);
  });

  it('miscFee は storeDrop に影響しない（二重計上なし）', () => {
    const r1 = _calcPayroll(row(), ss(), { miscFee: 0 });
    const r2 = _calcPayroll(row(), ss(), { miscFee: 1000 });
    expect(r1.storeDrop).toBe(r2.storeDrop);
  });
});

// ============================================================
// 4. オプション給料 — バック率
// ============================================================

describe('オプション給料（バック率）', () => {
  it('optItems なし: optPrice × optionBack', () => {
    const r = _calcPayroll(row({ option_price: 3000 }), ss({ default_option_back: 1.0 }));
    expect(r.therapistOptPay).toBe(3000);
  });

  it('optionBack 0.5 の場合', () => {
    const r = _calcPayroll(
      row({ option_price: 3000, therapist_option_back: 0.5 }),
      ss()
    );
    expect(r.therapistOptPay).toBe(1500);
  });
});

// ============================================================
// 5. オプション給料 — optItems（固定バック）
// ============================================================

describe('オプション給料（optItems + menuBackMap）', () => {
  const therapistId = 'th-001';
  const menuId = 'menu-abc';

  it('optItems × 固定バック(other)', () => {
    const optItems = [{ menuId, name: 'オプション', amount: 3000 }];
    const menuBackMap = { [`${therapistId}_${menuId}`]: { other: 2000, honshimei: 2500 } };
    const r = _calcPayroll(row({ nomination: 'free' }), ss(), { optItems, menuBackMap, therapistId });
    expect(r.therapistOptPay).toBe(2000);
  });

  it('optItems × 固定バック(honshimei)', () => {
    const optItems = [{ menuId, name: 'オプション', amount: 3000 }];
    const menuBackMap = { [`${therapistId}_${menuId}`]: { other: 2000, honshimei: 2500 } };
    const r = _calcPayroll(row({ nomination: 'honshimei' }), ss(), { optItems, menuBackMap, therapistId });
    expect(r.therapistOptPay).toBe(2500);
  });

  it('optItems × 固定バックなし → amount × optionBack にフォールバック', () => {
    const optItems = [{ menuId, name: 'オプション', amount: 3000 }];
    const menuBackMap = {};
    const r = _calcPayroll(row({ therapist_option_back: 1.0 }), ss(), { optItems, menuBackMap, therapistId });
    expect(r.therapistOptPay).toBe(3000);
  });
});

// ============================================================
// 6. 延長バック（therapistExtPay）
// ============================================================

describe('延長バック（therapistExtPay）', () => {
  const therapistId = 'th-001';

  it('延長アイテム × 固定延長バック(other)', () => {
    const optItems = [{ menuId: null, name: '延長30分', amount: 3000 }];
    const r = _calcPayroll(row({ nomination: 'free' }), ss(), {
      optItems, menuBackMap: {}, therapistId,
      extensionBack: 1500, extensionBackHon: 2000,
    });
    expect(r.therapistExtPay).toBe(1500);
    expect(r.therapistOptPay).toBe(1500); // optPay に含まれる
  });

  it('延長アイテム × 固定延長バック(honshimei)', () => {
    const optItems = [{ menuId: null, name: '延長30分', amount: 3000 }];
    const r = _calcPayroll(row({ nomination: 'honshimei' }), ss(), {
      optItems, menuBackMap: {}, therapistId,
      extensionBack: 1500, extensionBackHon: 2000,
    });
    expect(r.therapistExtPay).toBe(2000);
  });

  it('延長アイテム × 固定バックなし → amount × courseBack にフォールバック', () => {
    const optItems = [{ menuId: null, name: '延長30分', amount: 3000 }];
    const r = _calcPayroll(
      row({ therapist_course_back: 0.6 }), ss(),
      { optItems, menuBackMap: {}, therapistId }
    );
    expect(r.therapistExtPay).toBe(Math.round(3000 * 0.6));
  });
});

// ============================================================
// 7. 割引モード優先順位
// ============================================================

describe('割引モード優先順位', () => {
  it('セラピスト個別設定 > 店舗設定', () => {
    const r = _calcPayroll(
      row({ discount: 2000, therapist_discount_mode: 'store_bears' }),
      ss({ discount_mode: 'deduct_then_back' })
    );
    // store_bears なので割引を無視
    expect(r.therapistCoursePay).toBe(6000); // 12000 × 0.5
  });

  it('店舗設定 > グローバルデフォルト', () => {
    const r = _calcPayroll(
      row({ discount: 2000 }),
      ss({ discount_mode: 'store_bears' })
    );
    expect(r.therapistCoursePay).toBe(6000);
  });
});

// ============================================================
// 8. 指名料
// ============================================================

describe('指名料', () => {
  it('nomFee は storeDrop に含まれない（セラピスト全額受取）', () => {
    const r = _calcPayroll(row({ nomination_fee: 1000 }), ss());
    const total = 12000 + 1000; // 13000
    expect(r.storeDrop).toBe(total - (r.therapistCoursePay + r.therapistOptPay + 1000));
  });
});
