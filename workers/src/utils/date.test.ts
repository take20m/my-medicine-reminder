import { describe, expect, it } from 'vitest';
import { addDays, formatJstDate, getJstDateTimeParts } from './date';

describe('formatJstDate', () => {
  it('UTC深夜はJSTの翌日を返す', () => {
    // 2026-04-22T15:30:00Z = JST 2026-04-23 00:30
    expect(formatJstDate(new Date('2026-04-22T15:30:00Z'))).toBe('2026-04-23');
  });

  it('UTC 14:59はまだJST当日', () => {
    // 2026-04-22T14:59:00Z = JST 2026-04-22 23:59
    expect(formatJstDate(new Date('2026-04-22T14:59:00Z'))).toBe('2026-04-22');
  });

  it('UTC 15:00ちょうどでJST翌日に切り替わる', () => {
    // 2026-04-22T15:00:00Z = JST 2026-04-23 00:00
    expect(formatJstDate(new Date('2026-04-22T15:00:00Z'))).toBe('2026-04-23');
  });

  it('月末をまたぐ境界が正しい', () => {
    // 2026-04-30T15:00:00Z = JST 2026-05-01 00:00
    expect(formatJstDate(new Date('2026-04-30T15:00:00Z'))).toBe('2026-05-01');
  });

  it('年末をまたぐ境界が正しい', () => {
    // 2026-12-31T15:00:00Z = JST 2027-01-01 00:00
    expect(formatJstDate(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
  });
});

describe('getJstDateTimeParts', () => {
  it('JST 09:00を正しく分解する', () => {
    // 2026-04-22T00:00:00Z = JST 09:00
    const parts = getJstDateTimeParts(new Date('2026-04-22T00:00:00Z'));
    expect(parts.dateStr).toBe('2026-04-22');
    expect(parts.hours).toBe(9);
    expect(parts.minutes).toBe(0);
    expect(parts.totalMinutes).toBe(540);
  });

  it('JST 23:59を正しく分解する', () => {
    const parts = getJstDateTimeParts(new Date('2026-04-22T14:59:00Z'));
    expect(parts.dateStr).toBe('2026-04-22');
    expect(parts.hours).toBe(23);
    expect(parts.minutes).toBe(59);
    expect(parts.totalMinutes).toBe(23 * 60 + 59);
  });

  it('JST 00:00の day roll over を正しく扱う (hour=24 正規化)', () => {
    const parts = getJstDateTimeParts(new Date('2026-04-22T15:00:00Z'));
    expect(parts.dateStr).toBe('2026-04-23');
    expect(parts.hours).toBe(0);
    expect(parts.minutes).toBe(0);
    expect(parts.totalMinutes).toBe(0);
  });
});

describe('addDays', () => {
  it('翌日を返す', () => {
    expect(addDays('2026-04-22', 1)).toBe('2026-04-23');
  });

  it('前日を返す', () => {
    expect(addDays('2026-04-22', -1)).toBe('2026-04-21');
  });

  it('月境界を越える', () => {
    expect(addDays('2026-04-30', 1)).toBe('2026-05-01');
  });

  it('年境界を越える', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('うるう年の2月末', () => {
    // 2028年はうるう年
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('平年の2月末', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('0日加算は同日', () => {
    expect(addDays('2026-04-22', 0)).toBe('2026-04-22');
  });

  it('16日加算 (backfill想定)', () => {
    expect(addDays('2026-04-07', 15)).toBe('2026-04-22');
  });
});
