// A current-day, permission-filtered view. No AI, stored digest or outbound notification.
export function localDate(timestamp, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(timestamp);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function dailySummary(service, user) {
  const now = service.now();
  const elder = service.elder(user);
  const own = elder.id === user.id;
  const contact = own
    ? null
    : service.get('SELECT * FROM contacts WHERE user_id=? AND elder_id=?', user.id, elder.id);
  const participating = !!contact?.accepted;
  const date = localDate(now, elder.timezone);
  const today = (timestamp) => timestamp != null && localDate(timestamp, elder.timezone) === date;
  const checkinsAllowed = own || (participating && !!contact.allow_checkins);
  const remindersAllowed = own || (participating && !!contact.allow_reminders);
  const requestsAllowed = own || (participating && !!contact.allow_requests);
  const checkin = checkinsAllowed
    ? service.get(
        "SELECT received_at FROM events WHERE elder_id=? AND type='check_in' AND is_test=0 ORDER BY received_at DESC LIMIT 1",
        elder.id,
      )
    : null;
  // Completion timestamps are mutable; this deliberately reports today, not historical digests.
  const reminders = remindersAllowed
    ? service.all(
        "SELECT id,title,status,due_at,completed_at FROM reminders WHERE elder_id=? AND (status IN ('due','scheduled','waiting') OR completed_at>=?)",
        elder.id,
        now - 48 * 3600000,
      )
    : [];
  const due = reminders.filter(
    (r) => r.status === 'due' || (r.status === 'scheduled' && r.due_at != null && r.due_at <= now),
  );
  const upcoming = reminders.filter(
    (r) => r.status === 'scheduled' && r.due_at > now && today(r.due_at),
  );
  const waiting = reminders.filter((r) => r.status === 'waiting');
  const incidents = requestsAllowed
    ? service
        .all(
          "SELECT * FROM incidents WHERE elder_id=? AND is_test=0 AND (state NOT IN ('RESOLVED','CANCELLED') OR updated_at>=?)",
          elder.id,
          now - 48 * 3600000,
        )
        .filter((incident) => service.canRead(user, incident))
    : [];
  const open = incidents.filter((incident) => !['RESOLVED', 'CANCELLED'].includes(incident.state));
  const coverage = service.coverage(user);
  const gaps = coverage.days[coverage.position.day].segments
    .filter((segment) => !segment.responders.length && segment.end > coverage.position.minute)
    .map((segment) => ({
      start: Math.max(segment.start, coverage.position.minute),
      end: segment.end,
    }));
  return {
    date,
    generated_at: now,
    timezone: elder.timezone,
    elder: { id: elder.id, name: elder.name },
    check_in: {
      allowed: !!checkinsAllowed,
      received_at: checkinsAllowed && today(checkin?.received_at) ? checkin.received_at : null,
    },
    reminders: {
      allowed: !!remindersAllowed,
      completed_today: reminders.filter((r) => today(r.completed_at)).length,
      due: due.length,
      upcoming: upcoming.length,
      waiting: waiting.length,
      due_items: due.slice(0, 5).map(({ id, title }) => ({ id, title })),
    },
    requests: {
      allowed: !!requestsAllowed,
      open: open.length,
      assigned_to_you: open.filter((incident) => incident.owner_id === user.id).length,
      resolved_today: incidents.filter(
        (incident) => incident.state === 'RESOLVED' && today(incident.updated_at),
      ).length,
      items: open
        .sort((a, b) => b.updated_at - a.updated_at)
        .slice(0, 5)
        .map((incident) => {
          const view = service.view(user, incident);
          return {
            id: view.id,
            title: view.title,
            title_is_system: view.title_is_system,
            state: view.state,
          };
        }),
    },
    coverage: {
      scope: coverage.scope,
      gaps,
      remaining_gap_minutes: gaps.reduce((sum, gap) => sum + gap.end - gap.start, 0),
    },
  };
}
