import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Heart, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, dateTime, stateLabel, time } from './api';
import { Badge, Loading, SectionTitle } from './components';
import { errorText, formatDate, t } from './i18n';
import type { DailySummary } from './types';
import type { PageProps } from './pages';

const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export default function DailySummaryPage(props: PageProps) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const permissions = props.data.contacts.map((contact) => contact.version).join(':');
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setSummary(null);
    async function load() {
      try {
        const result = await api<DailySummary>('/summary/daily');
        if (active) {
          setSummary(result);
          setError('');
        }
      } catch (err) {
        if (active) {
          setSummary(null);
          setError((err as Error).message);
        }
      } finally {
        if (active) timer = setTimeout(load, 5000);
      }
    }
    load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [props.data.user.id, permissions, revision]);
  const reminderStats = summary
    ? ([
        ['Completed today', summary.reminders.completed_today],
        ['Due now', summary.reminders.due],
        ['Upcoming today', summary.reminders.upcoming],
        ['Waiting for check-in', summary.reminders.waiting],
      ] as const)
    : [];
  const requestStats = summary
    ? ([
        ['Open requests', summary.requests.open],
        ['Assigned to you', summary.requests.assigned_to_you],
        ['Resolved today', summary.requests.resolved_today],
      ] as const)
    : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('Daily summary')}</span>
          <h1>{t('Today in one place.')}</h1>
          <p>{t('Today’s shared activity, with current permissions.')}</p>
        </div>
        <button className="button secondary" onClick={() => setRevision((value) => value + 1)}>
          <RefreshCw size={17} />
          {t('Refresh summary')}
        </button>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {errorText(error)}
        </p>
      )}
      {!summary && !error && <Loading />}
      {summary && (
        <>
          <p className="coverage-timezone">
            <CalendarDays size={16} />
            {summary.elder.name} ·{' '}
            {formatDate(summary.generated_at, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: summary.timezone,
            })}{' '}
            · {summary.timezone}
            <small>
              {t('Updated ')}
              {time(summary.generated_at, summary.timezone)}
            </small>
          </p>
          <div className="summary-grid">
            <section className="card summary-card" data-testid="summary-checkin">
              <SectionTitle title={t('Check-in')} action={<Heart size={20} />} />
              {!summary.check_in.allowed ? (
                <Badge tone="neutral">{t('Not shared')}</Badge>
              ) : (
                <>
                  <h3>
                    {t(
                      summary.check_in.received_at
                        ? 'Check-in recorded today.'
                        : 'No check-in recorded today.',
                    )}
                  </h3>
                  {summary.check_in.received_at && (
                    <p>{dateTime(summary.check_in.received_at, summary.timezone)}</p>
                  )}
                  {summary.check_in.received_at && (
                    <p className="fine-print">
                      {t('Morning check-in received. This is a self-reported update.')}
                    </p>
                  )}
                </>
              )}
            </section>
            <section className="card summary-card" data-testid="summary-reminders">
              <SectionTitle title={t('Shared reminders')} action={<CheckCircle2 size={20} />} />
              {!summary.reminders.allowed ? (
                <Badge tone="neutral">{t('Not shared')}</Badge>
              ) : (
                <>
                  <dl className="summary-metrics">
                    {reminderStats.map(([label, count]) => (
                      <div key={label}>
                        <dt>{t(label)}</dt>
                        <dd>{count}</dd>
                      </div>
                    ))}
                  </dl>
                  {!!summary.reminders.due_items.length && (
                    <>
                      <h3>{t('Due now')}</h3>
                      <ul className="summary-items">
                        {summary.reminders.due_items.map((reminder) => (
                          <li key={reminder.id}>{reminder.title}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <button className="text-link" onClick={() => props.go('reminders')}>
                    {t(props.data.user.role === 'elder' ? 'My reminders' : 'Shared reminders')}
                  </button>
                </>
              )}
            </section>
            <section className="card summary-card" data-testid="summary-requests">
              <SectionTitle title={t('Care requests')} action={<ShieldCheck size={20} />} />
              {!summary.requests.allowed ? (
                <Badge tone="neutral">{t('Not shared')}</Badge>
              ) : (
                <>
                  <dl className="summary-metrics">
                    {requestStats.map(([label, count]) => (
                      <div key={label}>
                        <dt>{t(label)}</dt>
                        <dd>{count}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="summary-requests">
                    {summary.requests.items.map((incident) => (
                      <button
                        key={incident.id}
                        onClick={() => props.openIncident(incident.id)}
                        className="summary-request"
                      >
                        <span>{incident.title_is_system ? t(incident.title) : incident.title}</span>
                        <Badge tone="amber">
                          {t(stateLabel[incident.state] || incident.state)}
                        </Badge>
                      </button>
                    ))}
                  </div>
                  <button className="text-link" onClick={() => props.go('requests')}>
                    {t('Care requests')}
                  </button>
                </>
              )}
            </section>
            <section className="card summary-card" data-testid="summary-coverage">
              <SectionTitle
                title={t(
                  summary.coverage.scope === 'personal'
                    ? 'Your remaining time off today'
                    : 'Remaining coverage gaps today',
                )}
                action={<Clock3 size={20} />}
              />
              <p>{t('{{p0}}m', { p0: summary.coverage.remaining_gap_minutes })}</p>
              {summary.coverage.gaps.length ? (
                <ul className="summary-items">
                  {summary.coverage.gaps.map((gap) => (
                    <li key={gap.start}>
                      <bdi dir="ltr">
                        {clock(gap.start)}–{clock(gap.end)}
                      </bdi>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t('No gaps for the rest of today.')}</p>
              )}
              <button className="text-link" onClick={() => props.go('coverage')}>
                {t(summary.coverage.scope === 'personal' ? 'My weekly hours' : 'Care coverage')}
              </button>
            </section>
          </div>
          <p className="fine-print summary-footnote">
            {t('Live view of today; personal writing stays unchanged.')}{' '}
            {t('Practice drills are excluded.')}
          </p>
        </>
      )}
    </>
  );
}
