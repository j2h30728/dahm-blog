import test from 'node:test';
import assert from 'node:assert/strict';
import { getTitDateParts, groupTitEntries, getTitTags } from '../src/lib/tit.ts';

test('TIT dates use Korea time at month and year boundaries', () => {
  const december = getTitDateParts('2026-11-30T16:30:00.000Z');
  assert.equal(december.monthKey, '2026-12');
  assert.equal(december.monthLabel, '2026년 12월');
  assert.equal(december.dayLabel, '12.01');
  const newYear = getTitDateParts(new Date('2025-12-31T15:00:00.000Z'));
  assert.equal(newYear.monthKey, '2026-01');
  assert.equal(newYear.dayLabel, '01.01');
  assert.equal(getTitDateParts('2025-12-31T14:59:59.000Z').monthKey, '2025-12');
  assert.equal(getTitDateParts('2026-01-09').dayLabel, '01.09');
  assert.throws(() => getTitDateParts('not a date'));
});

test('month groups include the year and sort records newest first without changing input', () => {
  const entries = [
    { date: '2025-11-29', title: '작년 기록', href: '/notes/old/', tags: [] },
    { date: '2026-11-10', title: '같은 달의 이전 기록', href: '/notes/earlier/', tags: [] },
    { date: '2026-01-01', title: '1월 기록', href: '/notes/january/', tags: [] },
    { date: '2026-11-30T16:30:00Z', title: '한국 시간 12월 기록', href: '/notes/boundary/', tags: [] },
    { date: '2026-11-12', title: '같은 달의 최신 기록', href: '/notes/latest/', tags: [] },
  ];
  const original = structuredClone(entries);
  const groups = groupTitEntries(entries);
  assert.deepEqual(groups.map(group => group.key), ['2026-12', '2026-11', '2026-01', '2025-11']);
  assert.deepEqual(groups[1].entries.map(entry => entry.href), ['/notes/latest/', '/notes/earlier/']);
  assert.equal(groups[3].label, '2025년 11월');
  assert.deepEqual(entries, original);
  assert.deepEqual(groupTitEntries([]), []);
});

test('tag counting preserves comma and space characters and deduplicates within each entry', () => {
  const entries = [
    { tags: ['React, hooks', 'React, hooks', '태그 공백 포함'] },
    { tags: ['React', 'React, hooks'] },
    { tags: ['태그 공백 포함'] },
    { tags: [] },
  ];
  const original = structuredClone(entries);
  const tags = getTitTags(entries);
  assert.equal(tags.find(tag => tag.name === 'React, hooks').count, 2);
  assert.equal(tags.find(tag => tag.name === 'React').count, 1);
  assert.equal(tags.find(tag => tag.name === '태그 공백 포함').count, 2);
  assert.equal(tags.length, 3);
  assert.equal(tags.at(-1).name, 'React');
  assert.deepEqual(entries, original);
  assert.deepEqual(getTitTags([]), []);
});
