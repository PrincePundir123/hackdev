import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  Clock3,
  Info,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { api, time } from './api';
import { Avatar, Badge, Loading, Modal, SectionTitle } from './components';
import type { CoverageContact, CoverageReport, CoverageWindow } from './types';
import type { PageProps } from './pages';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function clock(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours ? `${hours}h` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest}m` : ''}` || '0h';
}
function editableTime(minutes: number) {
  return clock(minutes === 1440 ? 0 : minutes);
}
function parseTime(value: string, end = false) {
  const [hour, minute] = value.split(':').map(Number);
  const result = (hour || 0) * 60 + (minute || 0);
  return end && result === 0 ? 1440 : result;
}

function ScheduleEditor({
  contact,
  timezone,
  onClose,
  onSaved,
  onReload,
}: {
  contact: CoverageContact;
  timezone: string;
  onClose: () => void;
  onSaved: (report: CoverageReport) => void;
  onReload: () => void;
}) {
  const [mode, setMode] = useState(contact.mode);
  const [baseVersion] = useState(contact.version);
  const [windows, setWindows] = useState<CoverageWindow[]>(() =>
    contact.windows.map((w) => ({ ...w })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function add(day: number, allDay = false) {
    setWindows((previous) => [
      ...previous,
      { day, start: allDay ? 0 : 540, end: allDay ? 1440 : 1020 },
    ]);
  }
  function change(index: number, field: 'start' | 'end', value: string) {
    setWindows((previous) =>
      previous.map((w, i) =>
        i === index ? { ...w, [field]: parseTime(value, field === 'end') } : w,
      ),
    );
  }
  return (
    <Modal
      title="My weekly response hours"
      subtitle={`All hours use ${timezone}, the household’s timezone.`}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          if (mode === 'weekly' && windows.some((w) => w.end <= w.start)) {
            setError('End time must follow start time. Split overnight hours across two days.');
            return;
          }
          setBusy(true);
          try {
            onSaved(
              await api<CoverageReport>(
                '/coverage/me',
                { mode, windows: mode === 'weekly' ? windows : [], version: baseVersion },
                'PUT',
              ),
            );
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-body coverage-editor">
          <fieldset className="schedule-mode">
            <legend>When can you receive new requests?</legend>
            <label>
              <input
                type="radio"
                name="schedule-mode"
                value="anytime"
                checked={mode === 'anytime'}
                onChange={() => setMode('anytime')}
              />
              <span>
                <strong>Any time I am marked available</strong>
                <small>Use my availability switch without limiting days or hours.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="schedule-mode"
                value="weekly"
                checked={mode === 'weekly'}
                onChange={() => setMode('weekly')}
              />
              <span>
                <strong>Only during my weekly hours</strong>
                <small>New invitations follow the hours I set below.</small>
              </span>
            </label>
          </fieldset>
          {mode === 'weekly' && (
            <>
              <p className="fine-print">
                Leave a day empty when you are not scheduled. An end time of 00:00 means midnight at
                the end of that day. For overnight hours, add a second window on the next day.
                Overlapping hours are merged when saved.
              </p>
              <div className="schedule-days">
                {weekdays.map((day, dayIndex) => (
                  <section className="schedule-day" key={day}>
                    <div className="schedule-day-heading">
                      <h3>{day}</h3>
                      <div>
                        <button
                          type="button"
                          className="text-link"
                          aria-label={`Add ${day} hours`}
                          disabled={windows.length >= 56}
                          onClick={() => add(dayIndex)}
                        >
                          <Plus size={14} />
                          Add hours
                        </button>
                        <button
                          type="button"
                          className="text-link"
                          aria-label={`Add all day ${day}`}
                          disabled={windows.length >= 56}
                          onClick={() => add(dayIndex, true)}
                        >
                          All day
                        </button>
                      </div>
                    </div>
                    {!windows.some((w) => w.day === dayIndex) && (
                      <p className="schedule-off">Not scheduled</p>
                    )}
                    {windows.map(
                      (window, index) =>
                        window.day === dayIndex && (
                          <div className="schedule-window" key={index}>
                            <label>
                              From
                              <input
                                aria-label={`${day} start ${index + 1}`}
                                type="time"
                                required
                                value={editableTime(window.start)}
                                onChange={(e) => change(index, 'start', e.target.value)}
                              />
                            </label>
                            <label>
                              Until
                              <input
                                aria-label={`${day} end ${index + 1}`}
                                type="time"
                                required
                                value={editableTime(window.end)}
                                onChange={(e) => change(index, 'end', e.target.value)}
                              />
                            </label>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Remove ${day} window ${index + 1}`}
                              onClick={() =>
                                setWindows((previous) => previous.filter((_, i) => i !== index))
                              }
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ),
                    )}
                  </section>
                ))}
              </div>
              {!windows.length && (
                <p className="coverage-empty-warning">
                  No hours selected. Saving this plan means you will not receive new requests until
                  you add hours or switch to any-time availability.
                </p>
              )}
            </>
          )}
          <div className="info-strip">
            <Info size={18} />
            <p>
              Your availability switch, participation, and sharing permissions still apply. An
              accepted request stays yours when your scheduled hours end.
            </p>
          </div>
          {error && (
            <div className="error-message" role="alert">
              <p>{error}</p>
              <button type="button" className="text-link" onClick={onReload}>
                Reload latest schedule
              </button>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}Save weekly
            hours
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function CoveragePage(props: PageProps) {
  const [report, setReport] = useState<CoverageReport | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await api<CoverageReport>('/coverage');
        if (active) {
          setReport(next);
          setError('');
        }
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) timer = setTimeout(poll, 5000);
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [props.data.user.id, revision]);
  const personal = props.data.user.role === 'caregiver';
  const own = report?.contacts.find((c) => c.user_id === props.data.user.id);
  const day = report?.days[selectedDay ?? report.position.day];
  const nextGap = report?.next_gap;
  const personalStatus =
    own && !own.accepted
      ? 'Participation paused'
      : own && !own.allow_requests
        ? 'Requests not shared'
        : own && !own.available
          ? 'Marked away'
          : report?.now.length
            ? 'Within my hours'
            : 'Outside my hours';
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR EACH OTHER</span>
          <h1>
            {personal ? 'Your hours. A clearer care plan.' : 'Know when your circle is covered.'}
          </h1>
          <p>
            {personal
              ? 'Choose when you can receive new requests. Your circle can plan around your hours.'
              : 'See scheduled responders, backup periods, and gaps before someone needs support.'}
          </p>
        </div>
        <div className="coverage-heading-actions">
          <button
            className="icon-button"
            aria-label="Refresh coverage"
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={19} />
          </button>
          {personal && own && (
            <button className="button primary" onClick={() => setEditing(true)}>
              <CalendarDays size={17} />
              Edit my weekly hours
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="error-message" role="alert">
          {error} {report && 'Showing the last loaded plan; it may be out of date.'}
        </div>
      )}
      {!report ? (
        error ? (
          <button className="button secondary" onClick={() => setRevision((n) => n + 1)}>
            Try again
          </button>
        ) : (
          <Loading />
        )
      ) : (
        <>
          <div className="coverage-timezone">
            <Clock3 size={16} />
            <span>
              Weekly plan in <strong>{report.timezone}</strong>
            </span>
            <small>Updated {time(report.generated_at, report.timezone)}</small>
          </div>
          <div className="coverage-stats">
            <section
              className={`card coverage-stat ${report.now.length ? '' : 'coverage-gap-stat'}`}
            >
              <span className="eyebrow">{personal ? 'MY STATUS NOW' : 'SCHEDULED NOW'}</span>
              <h2>
                {personal
                  ? personalStatus
                  : report.now.length
                    ? `${report.now.length} responder${report.now.length === 1 ? '' : 's'}`
                    : 'No responder scheduled'}
              </h2>
              <p>
                {report.now.length
                  ? personal
                    ? 'New requests can be routed to you while you remain available.'
                    : report.now.map((c) => c.name).join(', ')
                  : personal
                    ? 'New requests will skip you until you are scheduled and available.'
                    : 'Review your contacts and arrange a willing backup.'}
              </p>
            </section>
            <section className="card coverage-stat">
              <span className="eyebrow">
                {personal ? 'TIME NOT SCHEDULED / WEEK' : 'UNCOVERED TIME / WEEK'}
              </span>
              <h2>{duration(report.gap_minutes)}</h2>
              <p>
                {personal
                  ? 'Time outside your hours, including periods when participation is paused.'
                  : 'Periods with no available, participating contact permitted to receive help requests.'}
              </p>
            </section>
            <section className="card coverage-stat">
              <span className="eyebrow">{personal ? 'NEXT TIME OFF' : 'NEXT COVERAGE GAP'}</span>
              <h2>
                {nextGap
                  ? `${weekdays[nextGap.day].slice(0, 3)} ${clock(nextGap.start)}`
                  : 'No gap in this plan'}
              </h2>
              <p>
                {nextGap
                  ? `${clock(nextGap.start)}–${clock(nextGap.end)}${nextGap.day === report.position.day && nextGap.start <= report.position.minute && report.position.minute < nextGap.end ? ' · Includes now' : ' · Repeating weekly plan'}`
                  : 'Availability switches and permissions can change this view.'}
              </p>
            </section>
          </div>
          <section className="card coverage-calendar">
            <SectionTitle
              title={personal ? 'My typical week' : 'Your circle’s typical week'}
              subtitle="Choose a day for exact hours. Colours are explained by labels."
            />
            <div className="coverage-legend">
              <span>
                <i className="coverage-gap" />
                {personal ? 'Not scheduled' : 'No responder'}
              </span>
              <span>
                <i className="coverage-single" />
                {personal ? 'Scheduled' : 'One responder'}
              </span>
              {!personal && (
                <span>
                  <i className="coverage-backup" />
                  Two or more
                </span>
              )}
            </div>
            <div className="coverage-week">
              {report.days.map((d) => (
                <button
                  key={d.day}
                  className={`coverage-week-day ${day?.day === d.day ? 'selected' : ''}`}
                  aria-pressed={day?.day === d.day}
                  aria-label={`${d.name}, ${duration(d.gap_minutes)} ${personal ? 'not scheduled' : 'uncovered'}`}
                  onClick={() => setSelectedDay(d.day)}
                >
                  <strong>{d.name.slice(0, 3)}</strong>
                  <span className="coverage-track" aria-hidden="true">
                    {d.segments.map((s) => (
                      <span
                        key={s.start}
                        className={
                          !s.responders.length
                            ? 'coverage-gap'
                            : s.responders.length === 1
                              ? 'coverage-single'
                              : 'coverage-backup'
                        }
                        style={{ flex: s.end - s.start }}
                      />
                    ))}
                  </span>
                  <small>
                    {d.gap_minutes
                      ? `${duration(d.gap_minutes)} ${personal ? 'off' : 'gap'}`
                      : personal
                        ? 'All day'
                        : 'Covered'}
                  </small>
                </button>
              ))}
            </div>
            {day && (
              <div className="coverage-day-detail">
                <div className="coverage-detail-heading">
                  <h3>{day.name}</h3>
                  <span>
                    {personal
                      ? `${duration(1440 - day.gap_minutes)} scheduled`
                      : `${duration(day.gap_minutes)} uncovered · ${duration(day.backup_minutes)} with backup`}
                  </span>
                </div>
                {day.segments.map((segment) => (
                  <div className="coverage-interval" key={segment.start}>
                    <span className="coverage-interval-time">
                      {clock(segment.start)}–{clock(segment.end)}
                    </span>
                    <div>
                      <strong>
                        {segment.responders.length
                          ? segment.responders.map((c) => c.name).join(', ')
                          : personal
                            ? 'Not scheduled'
                            : 'No responder scheduled'}
                      </strong>
                      <small>
                        {segment.responders.length
                          ? personal
                            ? 'Within your planned hours'
                            : segment.responders.length === 1
                              ? 'One responder; no scheduled backup'
                              : 'Multiple responders, routed in your contact order'
                          : personal
                            ? 'You will not receive new invitations during this time.'
                            : 'Ask a trusted contact whether they can cover this period.'}
                      </small>
                    </div>
                    <Badge
                      tone={
                        !segment.responders.length
                          ? 'rose'
                          : segment.responders.length === 1
                            ? 'amber'
                            : 'green'
                      }
                    >
                      {!segment.responders.length
                        ? personal
                          ? 'Off'
                          : 'Gap'
                        : personal
                          ? 'Scheduled'
                          : segment.responders.length === 1
                            ? 'Single'
                            : 'Backup'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="card coverage-people">
            <SectionTitle
              title={personal ? 'My participation' : 'The people behind the plan'}
              subtitle={
                personal
                  ? 'Only your own schedule is visible in your caregiver account.'
                  : 'Each caregiver sets their own hours. Sharing and availability still decide eligibility.'
              }
              action={
                <button className="text-link" onClick={() => props.go('circle')}>
                  <Users size={15} />
                  {personal ? 'My availability' : 'Manage care circle'}
                </button>
              }
            />
            {report.contacts.length ? (
              report.contacts.map((contact, i) => (
                <div className="coverage-person" key={contact.id}>
                  <Avatar name={contact.name} variant={i ? 'lavender' : 'sage'} />
                  <div>
                    <strong>{contact.name}</strong>
                    <small>
                      {contact.relationship} ·{' '}
                      {contact.mode === 'anytime'
                        ? 'Any time while marked available'
                        : `${contact.windows.length} weekly window${contact.windows.length === 1 ? '' : 's'}`}
                    </small>
                  </div>
                  <Badge tone={report.now.some((c) => c.id === contact.id) ? 'green' : 'neutral'}>
                    {!contact.accepted
                      ? 'Participation paused'
                      : !contact.allow_requests
                        ? 'Requests not shared'
                        : !contact.available
                          ? 'Marked away'
                          : report.now.some((c) => c.id === contact.id)
                            ? 'Scheduled now'
                            : 'Outside hours'}
                  </Badge>
                </div>
              ))
            ) : (
              <p>
                No contacts have joined your care circle yet. Invite someone you trust to start
                planning.
              </p>
            )}
          </section>
          <div className="info-strip">
            <ShieldCheck size={20} />
            <p>
              This is a repeating weekly plan based on current availability and permissions, not a
              guarantee of response. All hours use {report.timezone}, including clock changes there.
              Requests skip off-schedule contacts; accepted responsibilities continue until
              follow-up or handoff. A request already marked “No responder confirmed” is not
              automatically reopened.
            </p>
          </div>
        </>
      )}
      {editing && own && report && (
        <ScheduleEditor
          contact={own}
          timezone={report.timezone}
          onClose={() => setEditing(false)}
          onReload={() => {
            setEditing(false);
            setRevision((n) => n + 1);
          }}
          onSaved={(next) => {
            setReport(next);
            setEditing(false);
            props.refresh();
            props.notify('Your weekly hours are saved. New requests follow your schedule.');
          }}
        />
      )}
    </>
  );
}
