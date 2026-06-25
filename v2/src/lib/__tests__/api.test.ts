import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// _sb モック — Supabase クライアントをモックして実DBに接続しない
// ============================================================
const mockQuery = {
  select: vi.fn().mockReturnThis(),
  eq:     vi.fn().mockReturnThis(),
  order:  vi.fn().mockReturnThis(),
  gte:    vi.fn().mockReturnThis(),
  lte:    vi.fn().mockReturnThis(),
  in:     vi.fn().mockReturnThis(),
  not:    vi.fn().mockReturnThis(),
  is:     vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  single:      vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
};

vi.mock('../config', () => ({
  _sb: { from: vi.fn(() => mockQuery) },
}));

// window.STORE_ID をテスト用に設定
(globalThis as any).window = { STORE_ID: '11111111-0000-0000-0000-000000000001' };

import { apiGet, apiGetCached, clearCache } from '../api';

// ============================================================
// テストごとにモックをリセット
// ============================================================
beforeEach(() => {
  vi.clearAllMocks();
  // チェーンメソッドが常に自分自身を返すようリセット
  mockQuery.select.mockReturnThis();
  mockQuery.eq.mockReturnThis();
  mockQuery.order.mockReturnThis();
  mockQuery.gte.mockReturnThis();
  mockQuery.lte.mockReturnThis();
  mockQuery.in.mockReturnThis();
  mockQuery.not.mockReturnThis();
  mockQuery.is.mockReturnThis();
  mockQuery.insert.mockReturnThis();
  mockQuery.update.mockReturnThis();
  mockQuery.delete.mockReturnThis();
  mockQuery.upsert.mockReturnThis();
  mockQuery.single.mockReset();
  mockQuery.maybeSingle.mockReset();
});

// ============================================================
// getTherapists
// ============================================================

describe('getTherapists', () => {
  it('therapistsテーブルから正しい条件でクエリを実行する', async () => {
    mockQuery.order.mockResolvedValueOnce({ data: [], error: null });

    await apiGet('getTherapists');

    const { _sb } = await import('../config');
    expect(_sb.from).toHaveBeenCalledWith('therapists');
    expect(mockQuery.eq).toHaveBeenCalledWith('store_id', window.STORE_ID);
    expect(mockQuery.eq).toHaveBeenCalledWith('active', true);
    expect(mockQuery.eq).toHaveBeenCalledWith('is_admin', false);
  });

  it('DBのカラムを正しいフィールド名にマッピングする', async () => {
    const dbRow = {
      name: 'テスト花子',
      line_user_id: 'U123',
      line_display_name: '花子',
      registered_at: '2026-01-01',
      interval_min: 45,
      course_back: 0.6,
      option_back: 1.0,
      has_guarantee: false,
      email: 'test@example.com',
      id: 'th-001',
      nomination_fee: 500,
      hourly_rate: null,
      daily_guarantee: null,
      send_payroll_line: true,
      send_store_line: false,
      discount_mode: null,
      parking_fee: 300,
      extension_back: 1500,
      extension_back_honshimei: 2000,
    };
    mockQuery.order.mockResolvedValueOnce({ data: [dbRow], error: null });

    const result = await apiGet('getTherapists');

    expect(result[0]).toMatchObject({
      name:          'テスト花子',
      userId:        'U123',
      displayName:   '花子',
      interval:      45,
      courseBack:    0.6,
      optionBack:    1.0,
      id:            'th-001',
      nominationFee: 500,
      parkingFee:    300,
      extensionBack:    1500,
      extensionBackHon: 2000,
      sendStoreLine: false,
    });
  });

  it('DBエラー時は例外をスローする', async () => {
    mockQuery.order.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    await expect(apiGet('getTherapists')).rejects.toThrow('DB error');
  });

  it('データが空のとき空配列を返す', async () => {
    mockQuery.order.mockResolvedValueOnce({ data: null, error: null });

    const result = await apiGet('getTherapists');
    expect(result).toEqual([]);
  });
});

// ============================================================
// getTherapistInterval
// ============================================================

describe('getTherapistInterval', () => {
  it('セラピスト名でinterval_minを取得する', async () => {
    mockQuery.single.mockResolvedValueOnce({ data: { interval_min: 45 }, error: null });

    const result = await apiGet('getTherapistInterval', { name: '花子' });
    expect(result).toBe(45);
  });

  it('データなし（未登録）のときデフォルト30を返す', async () => {
    mockQuery.single.mockResolvedValueOnce({ data: null, error: null });

    const result = await apiGet('getTherapistInterval', { name: '未登録' });
    expect(result).toBe(30);
  });
});

// ============================================================
// saveTherapistProfile
// ============================================================

describe('saveTherapistProfile', () => {
  it('正常保存で { ok: true } を返す', async () => {
    mockQuery.eq.mockResolvedValueOnce({ error: null });

    const result = await apiGet('saveTherapistProfile', {
      id: 'th-001', age: 25, cup: 'D', real_name: '山田花子', profile_notes: 'メモ',
    });
    expect(result).toEqual({ ok: true });
  });

  it('DBエラー時は例外をスローする', async () => {
    mockQuery.eq.mockResolvedValueOnce({ error: { message: 'update failed' } });

    await expect(apiGet('saveTherapistProfile', { id: 'th-001' })).rejects.toThrow('update failed');
  });
});

// ============================================================
// 未実装アクション
// ============================================================

describe('未実装アクション', () => {
  it('存在しないアクション名はnullを返す', async () => {
    const result = await apiGet('nonExistentAction');
    expect(result).toBeNull();
  });
});

// ============================================================
// apiGetCached
// ============================================================

describe('apiGetCached', () => {
  it('キャッシュ対象アクションは2回目の呼び出しでDBを叩かない', async () => {
    mockQuery.order.mockResolvedValue({ data: [{ name: 'キャッシュテスト' }], error: null });

    clearCache('getTherapists');
    await apiGetCached('getTherapists');
    await apiGetCached('getTherapists');

    const { _sb } = await import('../config');
    // DBアクセスは1回だけのはず
    expect(_sb.from).toHaveBeenCalledTimes(1);
  });

  it('clearCache後は再度DBを叩く', async () => {
    mockQuery.order.mockResolvedValue({ data: [], error: null });

    clearCache('getTherapists');
    await apiGetCached('getTherapists');
    clearCache('getTherapists');
    await apiGetCached('getTherapists');

    const { _sb } = await import('../config');
    expect(_sb.from).toHaveBeenCalledTimes(2);
  });

  it('キャッシュ非対象アクションは毎回DBを叩く', async () => {
    mockQuery.single.mockResolvedValue({ data: { interval_min: 30 }, error: null });

    await apiGetCached('getTherapistInterval', { name: '花子' });
    await apiGetCached('getTherapistInterval', { name: '花子' });

    const { _sb } = await import('../config');
    expect(_sb.from).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// clearCache
// ============================================================

describe('clearCache', () => {
  it('引数なしで全キャッシュをクリアする', () => {
    // エラーなく実行できることを確認
    expect(() => clearCache(undefined)).not.toThrow();
  });

  it('アクション名指定で該当キャッシュのみクリアする', () => {
    expect(() => clearCache('getTherapists')).not.toThrow();
  });
});
