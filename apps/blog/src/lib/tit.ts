export interface TitEntry {
  date: string;
  title: string;
  href: string;
  tags: readonly string[];
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function getTitDateParts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('TIT 날짜가 올바르지 않습니다.');
  const parts = dateFormatter.formatToParts(date);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === name)!.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  return {
    year, month, day,
    monthKey: `${year}-${month}`,
    monthLabel: `${year}년 ${Number(month)}월`,
    dayLabel: `${month}.${day}`,
    dateLabel: `${year}년 ${Number(month)}월 ${Number(day)}일`,
  };
}

export function groupTitEntries<T extends TitEntry>(entries: readonly T[]) {
  const groups = new Map<string, { key: string; label: string; entries: T[] }>();
  const sorted = [...entries].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)
    || a.title.localeCompare(b.title, 'ko') || a.href.localeCompare(b.href));
  for (const entry of sorted) {
    const { monthKey, monthLabel } = getTitDateParts(entry.date);
    let group = groups.get(monthKey);
    if (!group) {
      group = { key: monthKey, label: monthLabel, entries: [] };
      groups.set(monthKey, group);
    }
    group.entries.push(entry);
  }
  return [...groups.values()];
}

export function getTitTags(entries: readonly Pick<TitEntry, 'tags'>[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of new Set(entry.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
}
