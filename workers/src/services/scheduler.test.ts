import { describe, expect, it } from 'vitest';
import {
  CRON_INTERVAL,
  isReminderWindow,
  maxElapsedMinutes,
  relevantTimesForWindow,
  shouldSendNotification
} from './scheduler';

// 朝 07:30 を基準にしたヘルパー。cron は5分毎なので、実際に評価される時刻だけを渡す。
const TARGET = 7 * 60 + 30; // 07:30 = 450分

function send(
  currentMinutes: number,
  reminderInterval: number,
  maxReminderCount: number
): boolean {
  return shouldSendNotification({
    currentMinutes,
    targetMinutes: TARGET,
    reminderInterval,
    maxReminderCount
  });
}

describe('shouldSendNotification 初回通知', () => {
  it('設定時刻ちょうどの cron ウィンドウで送る', () => {
    expect(send(TARGET, 15, 4)).toBe(true);
  });

  it('設定時刻が cron ウィンドウ内にずれていても送る (07:32 実行で 07:30 設定)', () => {
    expect(send(TARGET + 2, 15, 4)).toBe(true);
  });

  it('cron ウィンドウを外れた分では初回通知を送らない', () => {
    expect(send(TARGET + CRON_INTERVAL, 15, 4)).toBe(false);
  });

  it('設定時刻より前には送らない', () => {
    expect(send(TARGET - 1, 15, 4)).toBe(false);
  });

  it('最大回数 0 でも初回通知は送る', () => {
    expect(send(TARGET, 15, 0)).toBe(true);
  });
});

describe('shouldSendNotification 再通知', () => {
  it('間隔15分・最大3回なら +15/+30/+45 で送る', () => {
    expect(send(TARGET + 15, 15, 3)).toBe(true);
    expect(send(TARGET + 30, 15, 3)).toBe(true);
    expect(send(TARGET + 45, 15, 3)).toBe(true);
  });

  it('間隔15分・最大3回なら +60 以降は送らない', () => {
    expect(send(TARGET + 60, 15, 3)).toBe(false);
    expect(send(TARGET + 75, 15, 3)).toBe(false);
  });

  it('最大回数ちょうどは送り、+1回目は送らない', () => {
    expect(send(TARGET + 15 * 4, 15, 4)).toBe(true);
    expect(send(TARGET + 15 * 5, 15, 4)).toBe(false);
  });

  it('最大回数 0 なら再通知を送らない', () => {
    expect(send(TARGET + 15, 15, 0)).toBe(false);
    expect(send(TARGET + 30, 15, 0)).toBe(false);
  });

  it('間隔の倍数でない分では送らない', () => {
    expect(send(TARGET + 20, 15, 4)).toBe(false);
  });

  it('旧実装の60分上限を超えても最大回数までは送る (間隔30分・最大4回)', () => {
    expect(send(TARGET + 90, 30, 4)).toBe(true);
    expect(send(TARGET + 120, 30, 4)).toBe(true);
    expect(send(TARGET + 150, 30, 4)).toBe(false);
  });

  it('間隔60分・最大3回なら3時間後まで送る', () => {
    expect(send(TARGET + 60, 60, 3)).toBe(true);
    expect(send(TARGET + 180, 60, 3)).toBe(true);
    expect(send(TARGET + 240, 60, 3)).toBe(false);
  });
});

describe('shouldSendNotification 日またぎ', () => {
  // 就寝前 22:00 = 1320分。翌日 00:00 以降は currentMinutes が小さくなる。
  const BEDTIME = 22 * 60;

  function sendBedtime(currentMinutes: number, interval: number, maxCount: number): boolean {
    return shouldSendNotification({
      currentMinutes,
      targetMinutes: BEDTIME,
      reminderInterval: interval,
      maxReminderCount: maxCount
    });
  }

  it('当日 23:00 の再通知は送る', () => {
    expect(sendBedtime(23 * 60, 60, 10)).toBe(true);
  });

  it('日付が変わったら回数が残っていても送らない', () => {
    expect(sendBedtime(0, 60, 10)).toBe(false); // 翌日 00:00
    expect(sendBedtime(60, 60, 10)).toBe(false); // 翌日 01:00
    expect(sendBedtime(8 * 60, 60, 10)).toBe(false); // 翌日 08:00
  });
});

describe('isReminderWindow', () => {
  it('cron ウィンドウ内に間隔の倍数があれば取りこぼさない', () => {
    // 実行が 1 分ずれて diff=16 になっても、ウィンドウ内の 15 を拾う
    expect(isReminderWindow(16, 15, 4)).toBe(true);
  });

  it('ウィンドウ内に倍数がなければ false', () => {
    expect(isReminderWindow(20, 15, 4)).toBe(false);
  });

  it('最大回数を超える倍数は拾わない', () => {
    expect(isReminderWindow(60, 15, 3)).toBe(false);
  });

  it('経過 0 以下は再通知ではない', () => {
    expect(isReminderWindow(0, 15, 4)).toBe(false);
    expect(isReminderWindow(-10, 15, 4)).toBe(false);
  });
});

describe('maxElapsedMinutes', () => {
  it('間隔 × 最大回数を返す', () => {
    expect(maxElapsedMinutes(15, 4)).toBe(60);
    expect(maxElapsedMinutes(60, 10)).toBe(600);
  });

  it('最大回数 0 でも初回通知ぶんの cron ウィンドウは確保する', () => {
    expect(maxElapsedMinutes(15, 0)).toBe(CRON_INTERVAL);
  });
});

describe('relevantTimesForWindow', () => {
  it('設定しうる最大 (60分 × 10回) + cron ウィンドウぶんを展開する', () => {
    const times = relevantTimesForWindow(12 * 60); // 12:00
    expect(times).toHaveLength(600 + CRON_INTERVAL);
    expect(times[0]).toBe('12:00');
    expect(times[times.length - 1]).toBe('01:56'); // 604分前 (720 - 604 = 116分)
  });

  it('日をまたいで前日ぶんは展開しない', () => {
    const times = relevantTimesForWindow(5); // 00:05
    expect(times).toEqual(['00:05', '00:04', '00:03', '00:02', '00:01', '00:00']);
  });

  it('00:00 ちょうどは当日ぶんの1件のみ', () => {
    expect(relevantTimesForWindow(0)).toEqual(['00:00']);
  });
});
