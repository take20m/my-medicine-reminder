import type { Medication, TimingType } from '../types';
import { TIMING_ORDER } from '../types';

// 時刻文字列 (HH:mm) を分に変換
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 薬が1つ以上登録されているタイミングを TIMING_ORDER の順で返す。
 * 服用済みかどうかは見ない。
 */
export function timingsWithMedications(medications: Medication[]): TimingType[] {
  return TIMING_ORDER.filter(timing =>
    medications.some(med => med.timings.includes(timing))
  );
}

/**
 * 初期表示するタイミングを決める。
 *
 * 薬が登録されているタイミングだけを候補にし、その中から現在時刻に最も近い過去のものを選ぶ。
 * 候補がすべて未来なら最も早い候補。薬が1件も無ければ全タイミングを候補にする
 * （＝従来どおり現在時刻基準）。
 *
 * 例）朝しか薬を登録していなければ、昼に開いても「朝」を返す。
 */
export function selectInitialTiming(
  timings: Record<TimingType, string>,
  currentMinutes: number,
  medications: Medication[]
): TimingType {
  const withMeds = timingsWithMedications(medications);
  const candidates = withMeds.length > 0 ? withMeds : TIMING_ORDER;

  const sorted = candidates
    .map(timing => ({ timing, minutes: timeToMinutes(timings[timing]) }))
    .sort((a, b) => a.minutes - b.minutes);

  for (let i = sorted.length - 1; i >= 0; i--) {
    if (currentMinutes >= sorted[i].minutes) {
      return sorted[i].timing;
    }
  }

  return sorted[0].timing;
}
