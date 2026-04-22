const JST_TIME_ZONE = 'Asia/Tokyo';

const jstDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const jstTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: JST_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
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

export function getJstMinutesOfDay(date: Date): number {
  const parts = jstTimeFormatter.formatToParts(date);
  let hours = 0;
  let minutes = 0;
  for (const part of parts) {
    if (part.type === 'hour') {
      const raw = Number(part.value);
      hours = raw === 24 ? 0 : raw;
    } else if (part.type === 'minute') {
      minutes = Number(part.value);
    }
  }
  return hours * 60 + minutes;
}
