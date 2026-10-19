import { t, systemText, pluralSuffix } from './i18n';
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
  return (
    [hours ? t('{{p0}}h', { p0: hours }) : '', rest ? t('{{p0}}m', { p0: rest }) : '']
      .filter(Boolean)
      .join(' ') || t('{{p0}}h', { p0: 0 })
  );
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
      title={t('My weekly response hours')}
      subtitle={t('All hours use {{p0}}, the household’s timezone.', { p0: timezone })}
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
            <legend>{t('When can you receive new requests?')}</legend>
            <label>
              <input
                type="radio"
                name="schedule-mode"
                value="anytime"
                checked={mode === 'anytime'}
                onChange={() => setMode('anytime')}
              />
              <span>
                <strong>{t('Any time I am marked available')}</strong>
                <small>{t('Use my availability switch without limiting days or hours.')}</small>
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
                <strong>{t('Only during my weekly hours')}</strong>
                <small>{t('New invitations follow the hours I set below.')}</small>
              </span>
            </label>
          </fieldset>
          {mode === 'weekly' && (
            <>
              <p className="fine-print">
                {t(
                  'Leave a day empty when you are not scheduled. An end time of 00:00 means midnight at the end of that day. For overnight hours, add a second window on the next day. Overlapping hours are merged when saved.',
                )}
              </p>
              <div className="schedule-days">
                {weekdays.map((sourceDay, dayIndex) => {
                  const day = t(sourceDay);
                  return (
                    <section className="schedule-day" key={day}>
                      <div className="schedule-day-heading">
                        <h3>{day}</h3>
                        <div>
                          <button
                            type="button"
                            className="text-link"
                            aria-label={t('Add {{p0}} hours', { p0: day })}
                            disabled={windows.length >= 56}
                            onClick={() => add(dayIndex)}
                          >
                            <Plus size={14} />
                            {t('Add hours')}
                          </button>
                          <button
                            type="button"
                            className="text-link"
                            aria-label={t('Add all day {{p0}}', { p0: day })}
                            disabled={windows.length >= 56}
                            onClick={() => add(dayIndex, true)}
                          >
                            {t('All day')}
                          </button>
                        </div>
                      </div>
                      {!windows.some((w) => w.day === dayIndex) && (
                        <p className="schedule-off">{t('Not scheduled')}</p>
                      )}
                      {windows.map(
                        (window, index) =>
                          window.day === dayIndex && (
                            <div className="schedule-window" key={index}>
                              <label>
                                {t('From')}
                                <input
                                  aria-label={t('{{p0}} start {{p1}}', { p0: day, p1: index + 1 })}
                                  type="time"
                                  required
                                  value={editableTime(window.start)}
                                  onChange={(e) => change(index, 'start', e.target.value)}
                                />
                              </label>
                              <label>
                                {t('Until')}
                                <input
                                  aria-label={t('{{p0}} end {{p1}}', { p0: day, p1: index + 1 })}
                                  type="time"
                                  required
                                  value={editableTime(window.end)}
                                  onChange={(e) => change(index, 'end', e.target.value)}
                                />
                              </label>
                              <button
                                type="button"
                                className="icon-button"
                                aria-label={t('Remove {{p0}} window {{p1}}', {
                                  p0: day,
                                  p1: index + 1,
                                })}
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
                  );
                })}
              </div>
              {!windows.length && (
                <p className="coverage-empty-warning">
                  {t(
                    'No hours selected. Saving this plan means you will not receive new requests until you add hours or switch to any-time availability.',
                  )}
                </p>
              )}
            </>
          )}
          <div className="info-strip">
            <Info size={18} />
            <p>
              {t(
                'Your availability switch, participation, and sharing permissions still apply. An accepted request stays yours when your scheduled hours end.',
              )}
            </p>
          </div>
          {error && (
            <div className="error-message" role="alert">
              <p>{systemText(error)}</p>
              <button type="button" className="text-link" onClick={onReload}>
                {t('Reload latest schedule')}
              </button>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}
            {t('Save weekly hours')}
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
          <span className="eyebrow">{t('MAKE ROOM FOR EACH OTHER')}</span>
          <h1>
            {personal
              ? t('Your hours. A clearer care plan.')
              : t('Know when your circle is covered.')}
          </h1>
          <p>
            {personal
              ? t(
                  'Choose when you can receive new requests. Your circle can plan around your hours.',
                )
              : t(
                  'See scheduled responders, backup periods, and gaps before someone needs support.',
                )}
          </p>
        </div>
        <div className="coverage-heading-actions">
          <button
            className="icon-button"
            aria-label={t('Refresh coverage')}
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={19} />
          </button>
          {personal && own && (
            <button className="button primary" onClick={() => setEditing(true)}>
              <CalendarDays size={17} />
              {t('Edit my weekly hours')}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="error-message" role="alert">
          {systemText(error)} {report && t('Showing the last loaded plan; it may be out of date.')}
        </div>
      )}
      {!report ? (
        error ? (
          <button className="button secondary" onClick={() => setRevision((n) => n + 1)}>
            {t('Try again')}
          </button>
        ) : (
          <Loading />
        )
      ) : (
        <>
          <div className="coverage-timezone">
            <Clock3 size={16} />
            <span>
              {t('Weekly plan in ')}
              <strong>{report.timezone}</strong>
            </span>
            <small>
              {t('Updated ')}
              {time(report.generated_at, report.timezone)}
            </small>
          </div>
          <div className="coverage-stats">
            <section
              className={`card coverage-stat ${report.now.length ? '' : 'coverage-gap-stat'}`}
            >
              <span className="eyebrow">{personal ? t('MY STATUS NOW') : t('SCHEDULED NOW')}</span>
              <h2>
                {personal
                  ? t(personalStatus)
                  : report.now.length
                    ? t('{{p0}} responder{{p1}}', {
                        p0: report.now.length,
                        p1: pluralSuffix(report.now.length),
                      })
                    : t('No responder scheduled')}
              </h2>
              <p>
                {report.now.length
                  ? personal
                    ? t('New requests can be routed to you while you remain available.')
                    : report.now.map((c) => c.name).join(', ')
                  : personal
                    ? t('New requests will skip you until you are scheduled and available.')
                    : t('Review your contacts and arrange a willing backup.')}
              </p>
            </section>
            <section className="card coverage-stat">
              <span className="eyebrow">
                {personal ? t('TIME NOT SCHEDULED / WEEK') : t('UNCOVERED TIME / WEEK')}
              </span>
              <h2>{duration(report.gap_minutes)}</h2>
              <p>
                {personal
                  ? t('Time outside your hours, including periods when participation is paused.')
                  : t(
                      'Periods with no available, participating contact permitted to receive help requests.',
                    )}
              </p>
            </section>
            <section className="card coverage-stat">
              <span className="eyebrow">
                {personal ? t('NEXT TIME OFF') : t('NEXT COVERAGE GAP')}
              </span>
              <h2>
                {nextGap
                  ? t('{{p0}} {{p1}}', { p0: t(weekdays[nextGap.day]), p1: clock(nextGap.start) })
                  : t('No gap in this plan')}
              </h2>
              <p>
                {nextGap
                  ? `${clock(nextGap.start)}–${clock(nextGap.end)}${nextGap.day === report.position.day && nextGap.start <= report.position.minute && report.position.minute < nextGap.end ? t(' · Includes now') : t(' · Repeating weekly plan')}`
                  : t('Availability switches and permissions can change this view.')}
              </p>
            </section>
          </div>
          <section className="card coverage-calendar">
            <SectionTitle
              title={personal ? t('My typical week') : t('Your circle’s typical week')}
              subtitle={t('Choose a day for exact hours. Colours are explained by labels.')}
            />
            <div className="coverage-legend">
              <span>
                <i className="coverage-gap" />
                {personal ? t('Not scheduled') : t('No responder')}
              </span>
              <span>
                <i className="coverage-single" />
                {personal ? t('Scheduled') : t('One responder')}
              </span>
              {!personal && (
                <span>
                  <i className="coverage-backup" />
                  {t('Two or more')}
                </span>
              )}
            </div>
            <div className="coverage-week">
              {report.days.map((d) => (
                <button
                  key={d.day}
                  className={`coverage-week-day ${day?.day === d.day ? 'selected' : ''}`}
                  aria-pressed={day?.day === d.day}
                  aria-label={t('{{p0}}, {{p1}} {{p2}}', {
                    p0: t(d.name),
                    p1: duration(d.gap_minutes),
                    p2: personal ? t('Not scheduled') : t('Gap'),
                  })}
                  onClick={() => setSelectedDay(d.day)}
                >
                  <strong>{t(d.name)}</strong>
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
                      ? t('{{p0}} {{p1}}', {
                          p0: duration(d.gap_minutes),
                          p1: personal ? t('Off') : t('Gap'),
                        })
                      : personal
                        ? t('All day')
                        : t('Covered')}
                  </small>
                </button>
              ))}
            </div>
            {day && (
              <div className="coverage-day-detail">
                <div className="coverage-detail-heading">
                  <h3>{t(day.name)}</h3>
                  <span>
                    {personal
                      ? t('{{p0}} scheduled', { p0: duration(1440 - day.gap_minutes) })
                      : t('{{p0}} uncovered · {{p1}} with backup', {
                          p0: duration(day.gap_minutes),
                          p1: duration(day.backup_minutes),
                        })}
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
                            ? t('Not scheduled')
                            : t('No responder scheduled')}
                      </strong>
                      <small>
                        {segment.responders.length
                          ? personal
                            ? t('Within your planned hours')
                            : segment.responders.length === 1
                              ? t('One responder; no scheduled backup')
                              : t('Multiple responders, routed in your contact order')
                          : personal
                            ? t('You will not receive new invitations during this time.')
                            : t('Ask a trusted contact whether they can cover this period.')}
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
                          ? t('Off')
                          : t('Gap')
                        : personal
                          ? t('Scheduled')
                          : segment.responders.length === 1
                            ? t('Single')
                            : t('Backup')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="card coverage-people">
            <SectionTitle
              title={personal ? t('My participation') : t('The people behind the plan')}
              subtitle={
                personal
                  ? t('Only your own schedule is visible in your caregiver account.')
                  : t(
                      'Each caregiver sets their own hours. Sharing and availability still decide eligibility.',
                    )
              }
              action={
                <button className="text-link" onClick={() => props.go('circle')}>
                  <Users size={15} />
                  {personal ? t('My availability') : t('Manage care circle')}
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
                        ? t('Any time while marked available')
                        : t('{{p0}} weekly window{{p1}}', {
                            p0: contact.windows.length,
                            p1: pluralSuffix(contact.windows.length),
                          })}
                    </small>
                  </div>
                  <Badge tone={report.now.some((c) => c.id === contact.id) ? 'green' : 'neutral'}>
                    {!contact.accepted
                      ? t('Participation paused')
                      : !contact.allow_requests
                        ? t('Requests not shared')
                        : !contact.available
                          ? t('Marked away')
                          : report.now.some((c) => c.id === contact.id)
                            ? t('Scheduled now')
                            : t('Outside hours')}
                  </Badge>
                </div>
              ))
            ) : (
              <p>
                {t(
                  'No contacts have joined your care circle yet. Invite someone you trust to start planning.',
                )}
              </p>
            )}
          </section>
          <div className="info-strip">
            <ShieldCheck size={20} />
            <p>
              {t(
                'This is a repeating weekly plan based on current availability and permissions, not a guarantee of response. All hours use ',
              )}
              {report.timezone}
              {t(
                ', including clock changes there. Requests skip off-schedule contacts; accepted responsibilities continue until follow-up or handoff. A request already marked “No responder confirmed” is not automatically reopened.',
              )}
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
