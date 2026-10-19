import { z } from 'zod';

export const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const weekdayIndex = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export const coverageSchema = z.object({
  version: z.number().int().min(0),
  mode: z.enum(['anytime', 'weekly']),
  windows: z
    .array(
      z
        .object({
          day: z.number().int().min(0).max(6),
          start: z.number().int().min(0).max(1439),
          end: z.number().int().min(1).max(1440),
        })
        .refine((w) => w.end > w.start, {
          message: 'End time must be later than start time. Split overnight hours across two days.',
        }),
    )
    .max(56),
});

export function normalizeWindows(windows) {
  const result = [];
  for (const window of [...windows].sort((a, b) => a.day - b.day || a.start - b.start)) {
    const previous = result.at(-1);
    if (previous && previous.day === window.day && window.start <= previous.end) {
      previous.end = Math.max(previous.end, window.end);
    } else result.push({ ...window });
  }
  return result;
}

export function localPosition(timestamp, timezone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(timestamp)
      .map((p) => [p.type, p.value]),
  );
  return {
    day: weekdayIndex[parts.weekday],
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function scheduledAt(plan, position) {
  return (
    plan.mode === 'anytime' ||
    plan.windows.some(
      (w) => w.day === position.day && w.start <= position.minute && position.minute < w.end,
    )
  );
}

export function participates(contact) {
  return !!(contact.accepted && contact.available && contact.allow_requests);
}

// Partition exact interval boundaries, rather than approximating coverage with hourly buckets.
export function coverageReport(contacts, position) {
  const eligible = contacts.filter(participates);
  const days = weekdays.map((name, day) => {
    const active = eligible.map((c) => ({
      ...c,
      windows:
        c.mode === 'anytime'
          ? [{ day, start: 0, end: 1440 }]
          : c.windows.filter((w) => w.day === day),
    }));
    const edges = [
      ...new Set([0, 1440, ...active.flatMap((c) => c.windows.flatMap((w) => [w.start, w.end]))]),
    ].sort((a, b) => a - b);
    const segments = [];
    for (let i = 0; i < edges.length - 1; i++) {
      const start = edges[i];
      const end = edges[i + 1];
      const responders = active
        .filter((c) => c.windows.some((w) => w.start <= start && start < w.end))
        .map((c) => ({ id: c.id, name: c.name, priority: c.priority }));
      const previous = segments.at(-1);
      if (
        previous &&
        previous.responders.map((c) => c.id).join(',') === responders.map((c) => c.id).join(',')
      )
        previous.end = end;
      else segments.push({ start, end, responders });
    }
    const gap_minutes = segments
      .filter((s) => !s.responders.length)
      .reduce((n, s) => n + s.end - s.start, 0);
    const backup_minutes = segments
      .filter((s) => s.responders.length >= 2)
      .reduce((n, s) => n + s.end - s.start, 0);
    return { day, name, segments, gap_minutes, backup_minutes };
  });
  const now = eligible
    .filter((c) => scheduledAt(c, position))
    .map((c) => ({ id: c.id, name: c.name, priority: c.priority }));
  const gaps = days.flatMap((d) =>
    d.segments
      .filter((s) => !s.responders.length)
      .map((s) => ({ day: d.day, start: s.start, end: s.end })),
  );
  const minuteOfWeek = position.day * 1440 + position.minute;
  const next_gap = gaps.find((g) => g.day * 1440 + g.end > minuteOfWeek) || gaps[0] || null;
  return {
    days,
    now,
    next_gap,
    gap_minutes: days.reduce((n, d) => n + d.gap_minutes, 0),
    backup_minutes: days.reduce((n, d) => n + d.backup_minutes, 0),
  };
}
