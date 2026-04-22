const JST_TIME_ZONE = 'Asia/Tokyo';

const jstDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const jstPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

export function formatJstDate(date: Date): string {
  return jstDateFormatter.format(date);
}

export interface JstDateTimeParts {
  dateStr: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
}

export function getJstDateTimeParts(date: Date): JstDateTimeParts {
  const parts = jstPartsFormatter.formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const { type, value } of parts) {
    if (type !== 'literal') lookup[type] = value;
  }

  // en-CA は 24 時間表記で "24" を使う場合があるため 0 に正規化
  const hourRaw = Number(lookup.hour ?? '0');
  const hours = hourRaw === 24 ? 0 : hourRaw;
  const minutes = Number(lookup.minute ?? '0');

  return {
    dateStr: `${lookup.year}-${lookup.month}-${lookup.day}`,
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes
  };
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const shifted = new Date(ms);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
