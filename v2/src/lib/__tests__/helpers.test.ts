import { describe, it, expect } from 'vitest';
import {
  _normalizeTime,
  _timeToMinutes,
  _fmtDatetimeJp,
  _fmtLocalDatetimeJp,
  _fmtDateJp,
  _fmtTimeJp,
  _timeToMin27,
} from '../helpers';

// ============================================================
// _normalizeTime
// ============================================================

describe('_normalizeTime', () => {
  it('通常の時刻はそのまま返す', () => {
    expect(_normalizeTime('09:30')).toBe('09:30');
  });

  it('24時以上は -24 して返す', () => {
    expect(_normalizeTime('25:00')).toBe('01:00');
    expect(_normalizeTime('24:30')).toBe('00:30');
  });

  it('空文字は空文字を返す', () => {
    expect(_normalizeTime('')).toBe('');
  });

  it('秒以下を切り捨てる（5文字に切り詰め）', () => {
    expect(_normalizeTime('09:30:00')).toBe('09:30');
  });
});

// ============================================================
// _timeToMinutes
// ============================================================

describe('_timeToMinutes', () => {
  it('09:30 → 570', () => {
    expect(_timeToMinutes('09:30')).toBe(570);
  });

  it('00:00 → 0', () => {
    expect(_timeToMinutes('00:00')).toBe(0);
  });

  it('空文字 → 0', () => {
    expect(_timeToMinutes('')).toBe(0);
  });
});

// ============================================================
// _timeToMin27（27時ルール）
// ============================================================

describe('_timeToMin27', () => {
  it('03:00以降は通常通り', () => {
    expect(_timeToMin27('09:00')).toBe(9 * 60);
    expect(_timeToMin27('23:59')).toBe(23 * 60 + 59);
  });

  it('00:00〜02:59は +24時間 として扱う', () => {
    expect(_timeToMin27('00:00')).toBe(24 * 60);
    expect(_timeToMin27('01:30')).toBe(25 * 60 + 30);
    expect(_timeToMin27('02:59')).toBe(26 * 60 + 59);
  });

  it('空文字 → 0', () => {
    expect(_timeToMin27('')).toBe(0);
  });
});

// ============================================================
// _fmtDateJp
// ============================================================

describe('_fmtDateJp', () => {
  it('ISO日付をスラッシュ区切りに変換', () => {
    expect(_fmtDateJp('2026-06-25')).toBe('2026/06/25');
  });

  it('空文字は空文字を返す', () => {
    expect(_fmtDateJp('')).toBe('');
  });
});

// ============================================================
// _fmtTimeJp
// ============================================================

describe('_fmtTimeJp', () => {
  it('HH:MM を返す', () => {
    expect(_fmtTimeJp('09:30:00')).toBe('09:30');
    expect(_fmtTimeJp('21:00')).toBe('21:00');
  });

  it('空文字は空文字を返す', () => {
    expect(_fmtTimeJp('')).toBe('');
  });
});

// ============================================================
// _fmtLocalDatetimeJp（27時ルール・手動パース）
// ============================================================

describe('_fmtLocalDatetimeJp', () => {
  it('通常時刻（03:00以降）はそのままフォーマット', () => {
    expect(_fmtLocalDatetimeJp('2026-06-25T09:30')).toBe('2026/06/25 09:30');
    expect(_fmtLocalDatetimeJp('2026-06-25T23:00')).toBe('2026/06/25 23:00');
  });

  it('00:00〜02:59は前日扱いで24時以降表示', () => {
    expect(_fmtLocalDatetimeJp('2026-06-25T01:00')).toBe('2026/06/24 25:00');
    expect(_fmtLocalDatetimeJp('2026-06-25T00:15')).toBe('2026/06/24 24:15');
    expect(_fmtLocalDatetimeJp('2026-06-25T02:59')).toBe('2026/06/24 26:59');
  });

  it('月またぎの前日計算が正しい', () => {
    expect(_fmtLocalDatetimeJp('2026-07-01T01:00')).toBe('2026/06/30 25:00');
  });

  it('空文字は空文字を返す', () => {
    expect(_fmtLocalDatetimeJp('')).toBe('');
  });
});

// ============================================================
// _fmtDatetimeJp（Supabaseからのtimestamptz用・27時ルール）
// ============================================================

describe('_fmtDatetimeJp', () => {
  it('TZ付きISO文字列（UTC）を日本時間でフォーマット', () => {
    // 2026-06-25T00:30:00Z = JST 09:30
    const result = _fmtDatetimeJp('2026-06-25T00:30:00Z');
    expect(result).toBe('2026/06/25 09:30');
  });

  it('TZなし文字列はUTC強制（末尾Z付加）してパース', () => {
    // TZなし "2026-06-25T00:30:00" → UTC扱い → JST 09:30
    const result = _fmtDatetimeJp('2026-06-25T00:30:00');
    expect(result).toBe('2026/06/25 09:30');
  });

  it('JST深夜0〜2時台（UTC前日15〜17時）は前日扱い', () => {
    // 2026-06-24T15:00:00Z = JST 2026-06-25 00:00 → 前日扱い → 2026/06/24 24:00
    const result = _fmtDatetimeJp('2026-06-24T15:00:00Z');
    expect(result).toBe('2026/06/24 24:00');
  });

  it('空文字は空文字を返す', () => {
    expect(_fmtDatetimeJp('')).toBe('');
  });

  it('不正な文字列はそのまま返す', () => {
    expect(_fmtDatetimeJp('not-a-date')).toBe('not-a-date');
  });
});
