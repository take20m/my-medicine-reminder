const JST_TIME_ZONE = 'Asia/Tokyo';

const jstDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function formatJstDate(date: Date): string {
  return jstDateFormatter.format(date);
}

export function getTodayJstString(): string {
  return formatJstDate(new Date());
}

export function parseJstDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+09:00`);
}
