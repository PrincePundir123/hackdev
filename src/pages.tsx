import { t, systemText, errorText, formatDate, languages, pluralSuffix } from './i18n';
import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FlaskConical,
  Flower2,
  Heart,
  HeartHandshake,
  Info,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import { api, dateTime, key, stateLabel } from './api';
import {
  Avatar,
  Badge,
  Empty,
  GardenIllustration,
  Modal,
  SectionTitle,
  TextLink,
  Toggle,
} from './components';
import type { Contact, DashboardData, Health, Incident, Page, Preview, Reminder } from './types';

export type PageProps = {
  data: DashboardData;
  busy: boolean;
  act: (path: string, body: unknown, method?: string) => Promise<boolean>;
  notify: (s: string) => void;
  refresh: () => void;
  go: (page: Page) => void;
  openReminder: () => void;
  openHelp: () => void;
  openIncident: (id: string) => void;
};
const openStates = [
  'CREATED',
  'AWAITING_RESPONSE',
  'ASSIGNED',
  'FOLLOW_UP_OVERDUE',
  'NO_RESPONDER',
];
function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function RequestCard({
  incident,
  onClick,
  timezone,
}: {
  incident: Incident;
  onClick: () => void;
  timezone: string;
}) {
  const tone =
    incident.state === 'RESOLVED'
      ? 'green'
      : incident.state === 'NO_RESPONDER' || incident.state === 'FOLLOW_UP_OVERDUE'
        ? 'rose'
        : 'amber';
  return (
    <button className="request-card" onClick={onClick}>
      <span className={`request-icon ${tone}`}>
        <HeartHandshake size={23} />
      </span>
      <span className="request-copy">
        <span className="request-title">
          {incident.title_is_system ? t(incident.title) : incident.title}
          {incident.is_test && <Badge tone="lavender">{t('TEST')}</Badge>}
        </span>
        <small>
          {dateTime(incident.created_at, timezone)} ·{' '}
          {incident.owner_name
            ? t('Accepted by {{p0}}', { p0: incident.owner_name.split(' ')[0] })
            : t('No caregiver assigned yet')}
        </small>
      </span>
      <Badge tone={tone}>{t(stateLabel[incident.state] || incident.state)}</Badge>
      <ChevronRight size={18} />
    </button>
  );
}
function ReminderRow({ reminder, props }: { reminder: Reminder; props: PageProps }) {
  const closed = ['completed', 'cancelled'].includes(reminder.status);
  const elder = props.data.user.role === 'elder';
  const timing =
    reminder.status === 'waiting'
      ? t('{{p0}} min after morning check-in', { p0: reminder.offset_minutes })
      : reminder.due_at
        ? dateTime(reminder.due_at, props.data.elder.timezone)
        : t('Waiting for check-in');
  return (
    <div className={`reminder-row ${closed ? 'closed' : ''}`}>
      <span
        className={`reminder-symbol ${reminder.trigger_type === 'check_in' ? 'mint' : 'peach'}`}
      >
        {reminder.trigger_type === 'check_in' ? <Flower2 size={23} /> : <Bell size={22} />}
      </span>
      <div className="reminder-copy">
        <strong>{reminder.title}</strong>
        <small>
          <Clock3 size={12} />
          {timing}
          {reminder.repeat === 'daily' && t(' · Daily')}
        </small>
      </div>
      <Badge tone={reminder.status === 'due' ? 'amber' : closed ? 'neutral' : 'green'}>
        {reminder.status === 'waiting'
          ? t('After check-in')
          : reminder.status === 'scheduled'
            ? t('Upcoming')
            : reminder.status === 'completed'
              ? t('Done')
              : t(reminder.status)}
      </Badge>
      {elder && !closed && (
        <div className="reminder-actions">
          <button
            aria-label={t('Mark {{p0}} done', { p0: reminder.title })}
            className="icon-button done-button"
            disabled={props.busy}
            onClick={async () => {
              if (await props.act(`/reminders/${reminder.id}`, { action: 'complete' }, 'PATCH'))
                props.notify('Reminder marked done. Thank you for the update.');
            }}
          >
            <Check size={19} />
          </button>
          {reminder.status === 'due' && (
            <button
              className="small-button"
              disabled={props.busy}
              onClick={() => props.act(`/reminders/${reminder.id}`, { action: 'snooze' }, 'PATCH')}
            >
              {t('10 min later')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Overview(props: PageProps) {
  const { data, busy, act, notify, go, openReminder, openHelp, openIncident } = props;
  const elder = data.user.role === 'elder';
  const first = data.user.name.split(' ')[0];
  const reminders = data.reminders.filter((r) => !['completed', 'cancelled'].includes(r.status));
  const pending = data.incidents.filter((i) => openStates.includes(i.state));
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: data.user.timezone,
    }).format(new Date()),
  );
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <>
      <PageHeading
        eyebrow={formatDate(Date.now(), {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: data.user.timezone,
        }).toUpperCase()}
        title={t('{{p0}}, {{p1}}.', { p0: t(greeting), p1: first })}
        subtitle={
          elder
            ? t('A new day, a little support, and your people by your side.')
            : t('A thoughtful space to support {{p0}}, together.', {
                p0: data.elder.name.split(' ')[0],
              })
        }
        action={
          <span className="soft-label">
            <Sun size={17} />
            {t(' A little closer, every day')}
          </span>
        }
      />
      <div className="overview-grid">
        <div className="overview-main">
          <section className="welcome-card">
            <div className="welcome-copy">
              <Badge tone="white">
                <Heart size={12} />
                {t(' YOUR EVERYDAY COMPANION')}
              </Badge>
              <h2>
                {elder ? (
                  <>
                    {t('Your day.')}
                    <br />
                    {t('At your own pace.')}
                  </>
                ) : (
                  <>
                    {t('A caring connection.')}
                    <br />
                    {t('A clear next step.')}
                  </>
                )}
              </h2>
              <p>
                {elder
                  ? t(
                      'A gentle reminder, a friendly check-in, or a helping hand. We’re right here.',
                    )
                  : t(
                      'See the requests you are allowed to receive, and let your circle know when you can help.',
                    )}
              </p>
              <button
                className="button primary"
                onClick={elder ? openReminder : () => go('requests')}
              >
                {elder ? <Sparkles size={17} /> : <HeartHandshake size={17} />}
                {elder ? t('Ask your companion') : t('View care requests')}
                <ArrowRight size={17} />
              </button>
            </div>
            <GardenIllustration />
          </section>
          <div className="quick-actions">
            {elder ? (
              <>
                <button onClick={openReminder}>
                  <span className="quick-icon peach">
                    <Plus size={22} />
                  </span>
                  <span>
                    <strong>{t('Add a reminder')}</strong>
                    <small>{t('A little nudge, right on time')}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
                <button onClick={openHelp}>
                  <span className="quick-icon rose">
                    <HeartHandshake size={22} />
                  </span>
                  <span>
                    <strong>{t('Request help')}</strong>
                    <small>{t('Reach your trusted people')}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => go('circle')}>
                  <span className="quick-icon mint">
                    <Users size={22} />
                  </span>
                  <span>
                    <strong>{t('My availability')}</strong>
                    <small>{t('Let your circle know')}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
                <button onClick={() => go('reminders')}>
                  <span className="quick-icon peach">
                    <Bell size={22} />
                  </span>
                  <span>
                    <strong>{t('Shared reminders')}</strong>
                    <small>{t('Only what’s shared with you')}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              </>
            )}
          </div>
          <section className="card">
            <SectionTitle
              title={elder ? t('Your little reminders') : t('Shared reminders')}
              subtitle={t('Small things that make the day feel easier.')}
              action={<TextLink onClick={() => go('reminders')}>{t('View all')}</TextLink>}
            />
            {reminders.length ? (
              reminders
                .slice(0, 3)
                .map((r) => <ReminderRow key={r.id} reminder={r} props={props} />)
            ) : (
              <Empty
                title={
                  data.reminders_allowed ? t('A little breathing room') : t('Reminders are private')
                }
              >
                {data.reminders_allowed
                  ? t('No reminders waiting. Add something you would like a gentle nudge for.')
                  : t('The older adult decides whether to share reminders with you.')}
              </Empty>
            )}
          </section>
          <section className="card">
            <SectionTitle
              title={t('Care, in motion')}
              subtitle={t('Know who is responding and what happens next.')}
              action={<TextLink onClick={() => go('requests')}>{t('All requests')}</TextLink>}
            />
            {pending.length ? (
              pending
                .slice(0, 3)
                .map((i) => (
                  <RequestCard
                    key={i.id}
                    incident={i}
                    timezone={data.elder.timezone}
                    onClick={() => openIncident(i.id)}
                  />
                ))
            ) : (
              <div className="quiet-state">
                <span>
                  <CheckCircle2 size={22} />
                </span>
                <div>
                  <strong>{t('No requests waiting for a response')}</strong>
                  <p>{t('When support is requested, you’ll see its progress here.')}</p>
                </div>
              </div>
            )}
          </section>
        </div>
        <aside className="overview-aside">
          {elder ? (
            <section className="checkin-card">
              <span className="sun-icon">
                <Sun size={27} />
              </span>
              <h2>{t('A moment for you.')}</h2>
              <p>
                {t('Let your care space know')}
                <br />
                {t('you’ve checked in today.')}
              </p>
              <button
                className="button primary wide"
                disabled={busy}
                onClick={async () => {
                  if (await act('/check-ins', { client_key: key() }))
                    notify('Your check-in is saved. Event-linked reminders are ready.');
                }}
              >
                <Check size={18} />
                {t(' I am okay')}
              </button>
              <span className="checkin-time">
                {data.last_check_in
                  ? t('Last check-in: {{p0}}', {
                      p0: dateTime(data.last_check_in, data.elder.timezone),
                    })
                  : t('Your first check-in is a tap away')}
              </span>
              <small>{t('A self-reported update, at your own pace.')}</small>
            </section>
          ) : (
            <section className="checkin-card">
              <span className="sun-icon">
                <HeartHandshake size={27} />
              </span>
              <h2>{t('Your presence matters.')}</h2>
              <p>
                {pending.length
                  ? t('{{p0}} open request{{p1}} in your care space.', {
                      p0: pending.length,
                      p1: pluralSuffix(pending.length),
                    })
                  : t('There are no open requests right now.')}
              </p>
              <button className="button primary wide" onClick={() => go('requests')}>
                {t('Open caregiver inbox ')}
                <ArrowRight size={17} />
              </button>
            </section>
          )}
          <section className="card coverage-summary">
            <SectionTitle title={elder ? t('Coverage now') : t('My scheduled availability')} />
            <div className="coverage-summary-status">
              <Clock3 size={20} />
              <strong>
                {data.coverage_now.length
                  ? elder
                    ? t('{{p0}} scheduled responder{{p1}}', {
                        p0: data.coverage_now.length,
                        p1: pluralSuffix(data.coverage_now.length),
                      })
                    : t('Within my response hours')
                  : elder
                    ? t('No responder scheduled')
                    : t('Outside my response hours')}
              </strong>
            </div>
            <p>
              {data.coverage_now.length
                ? data.coverage_now.map((c) => c.name).join(', ')
                : elder
                  ? t('Review the weekly plan and arrange a willing backup.')
                  : t('Review your weekly hours or update your availability.')}
            </p>
            <TextLink onClick={() => go('coverage')}>
              {elder ? t('View weekly coverage') : t('Set my weekly hours')}
            </TextLink>
          </section>
          <section className="card circle-summary">
            <SectionTitle
              title={t('Your people')}
              action={<TextLink onClick={() => go('circle')}>{t('Manage')}</TextLink>}
            />
            {data.contacts.length ? (
              data.contacts.map((c, i) => (
                <div className="person-row" key={c.id}>
                  <Avatar name={c.name} variant={i === 0 ? 'sage' : 'lavender'} />
                  <div>
                    <strong>{c.name}</strong>
                    <small>
                      {c.relationship} · {c.priority === 1 ? t('Primary') : t('Backup')}
                    </small>
                  </div>
                  <span
                    className={`availability-dot ${c.available && c.accepted && c.allow_requests && c.scheduled_now ? '' : 'away'}`}
                    title={
                      c.available && c.accepted && c.allow_requests && c.scheduled_now
                        ? t('Scheduled and available for requests')
                        : t('Not currently available')
                    }
                  />
                </div>
              ))
            ) : (
              <p className="muted">{t('Invite someone you trust to start your circle.')}</p>
            )}
            <div className="circle-note">
              <LockKeyhole size={14} />
              {t(' Sharing is always your choice.')}
            </div>
          </section>
          <section className="small-promise">
            <ShieldCheck size={27} />
            <div>
              <h3>{t('A little privacy. A lot of dignity.')}</h3>
              <p>{t('See exactly what each person can see. Change your mind any time.')}</p>
              <button className="text-link" onClick={() => go('circle')}>
                {t('Explore sharing ')}
                <ArrowRight size={14} />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export function Reminders(props: PageProps) {
  const [filter, setFilter] = useState('active');
  const elder = props.data.user.role === 'elder';
  const reminders = props.data.reminders.filter(
    (r) =>
      filter === 'all' ||
      (filter === 'active'
        ? !['completed', 'cancelled'].includes(r.status)
        : r.status === 'completed' || !!r.completed_at),
  );
  return (
    <>
      <PageHeading
        eyebrow={t('THE SMALL THINGS MATTER')}
        title={elder ? t('A gentle nudge.') : t('Shared reminders.')}
        subtitle={
          elder
            ? t('Make space for your day. Let us remember the little things.')
            : t('An invitation into someone’s day, shared on their terms.')
        }
        action={
          elder && (
            <button className="button primary" onClick={props.openReminder}>
              <Plus size={17} />
              {t('Add reminder')}
            </button>
          )
        }
      />
      <div className="tabs" aria-label={t('Reminder filters')}>
        {['active', 'done', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'selected' : ''}>
            {f === 'active'
              ? t('Upcoming & waiting')
              : f === 'done'
                ? t('Marked done')
                : t('All reminders')}
          </button>
        ))}
      </div>
      <section className="card reminder-list">
        {reminders.length ? (
          reminders.map((r) => (
            <div key={r.id}>
              <ReminderRow reminder={r} props={props} />
              {elder && !['completed', 'cancelled'].includes(r.status) && (
                <button
                  className="cancel-reminder"
                  disabled={props.busy}
                  onClick={() => props.act(`/reminders/${r.id}`, { action: 'cancel' }, 'PATCH')}
                >
                  {t('Cancel reminder')}
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty
            title={
              props.data.reminders_allowed
                ? t('Nothing on this list yet')
                : t('This part of the day is private')
            }
          >
            {props.data.reminders_allowed
              ? t('Add a reminder or try a different filter.')
              : t('You can see reminders only when sharing is enabled by the older adult.')}
          </Empty>
        )}
      </section>
      <div className="info-strip">
        <Info size={19} />
        <p>
          {t(
            'Morning reminders wait for a manual check-in. “Done” is a personal update, not proof that a task or medication was completed.',
          )}
        </p>
      </div>
    </>
  );
}

export function Circle(props: PageProps) {
  const elder = props.data.user.role === 'elder';
  const [editing, setEditing] = useState<Contact | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [invite, setInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  async function showPreview(id: string) {
    setLoading(true);
    setLocalError('');
    try {
      setPreview(await api<Preview>(`/contacts/${id}/preview`));
      props.refresh();
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow={t('THE PEOPLE WHO SHOW UP')}
        title={elder ? t('Your circle, your choice.') : t('Your place in the circle.')}
        subtitle={
          elder
            ? t('Keep your people close, and your personal details in your hands.')
            : t('Choose your availability and the ways you want to participate.')
        }
        action={
          elder && (
            <button
              className="button primary"
              onClick={() => {
                setInvite(true);
                setInviteCode('');
                setLocalError('');
              }}
            >
              <Plus size={17} />
              {t(' Invite a contact')}
            </button>
          )
        }
      />
      <div className="coverage-circle-link">
        <button className="button secondary" onClick={() => props.go('coverage')}>
          <Clock3 size={17} />
          {elder ? t('View weekly care coverage') : t('Set my weekly hours')}
        </button>
      </div>
      {localError && (
        <p className="error-message" role="alert">
          {errorText(localError)}
        </p>
      )}
      <div className="contact-grid">
        {props.data.contacts.map((c, i) => (
          <article className="card contact-card" key={c.id}>
            <div className="contact-head">
              <Avatar name={c.name} variant={i ? 'lavender' : 'sage'} size="large" />
              <Badge
                tone={
                  c.available && c.accepted && c.allow_requests && c.scheduled_now
                    ? 'green'
                    : 'neutral'
                }
              >
                {!c.available || !c.accepted
                  ? t('Away')
                  : !c.allow_requests
                    ? t('Requests not shared')
                    : c.scheduled_now
                      ? t('Scheduled now')
                      : t('Outside hours')}
              </Badge>
            </div>
            <h2>{c.name}</h2>
            <p className="muted">
              {c.relationship} ·{' '}
              {c.priority === 1
                ? t('Primary responder')
                : t('Backup responder {{p0}}', { p0: c.priority - 1 })}
            </p>
            <div className="permission-list">
              {[
                [t('Help requests'), c.allow_requests],
                [t('Private notes & details'), c.allow_notes],
                [t('Reminder text'), c.allow_reminders],
              ].map(([label, allowed]) => (
                <div key={String(label)}>
                  <span>{label}</span>
                  {allowed ? (
                    <span className="allowed">
                      <Check size={14} />
                      {t(' Shared')}
                    </span>
                  ) : (
                    <span className="private">
                      <LockKeyhole size={13} />
                      {t(' Private')}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="contact-actions">
              <button className="button secondary" onClick={() => setEditing(c)}>
                {elder ? t('Edit permissions') : t('My availability')}
              </button>
              {elder && (
                <button
                  className="icon-button"
                  aria-label={t('Preview sharing with {{p0}}', { p0: c.name })}
                  disabled={loading}
                  onClick={() => showPreview(c.id)}
                >
                  <Eye size={20} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!props.data.contacts.length && (
        <Empty title={t('A care circle starts with one person')}>
          {t('Invite someone you trust. They choose whether to join using the invitation code.')}
        </Empty>
      )}
      <div className="info-strip">
        <ShieldCheck size={21} />
        <p>
          {t(
            'Changes apply to future access and messages. Information a contact has already seen cannot be recalled. Permission checks happen on the server, for every request.',
          )}
        </p>
      </div>
      {editing && (
        <Modal
          title={
            elder
              ? t('Sharing with {{p0}}', { p0: editing.name.split(' ')[0] })
              : t('My availability')
          }
          subtitle={elder ? t('Small choices. Meaningful control.') : t('Your time matters, too.')}
          onClose={() => setEditing(null)}
        >
          <div className="modal-body">
            {elder ? (
              <>
                {(['allow_requests', 'allow_notes', 'allow_reminders'] as const).map((field) => (
                  <Toggle
                    key={field}
                    checked={!!editing[field]}
                    onChange={(value) => setEditing({ ...editing, [field]: Number(value) })}
                    label={
                      {
                        allow_requests: t('Basic help requests'),
                        allow_notes: t('Private notes and request details'),
                        allow_reminders: t('Reminder text'),
                      }[field]
                    }
                    description={
                      field === 'allow_requests'
                        ? t('Allow this person to view and respond to support requests.')
                        : field === 'allow_notes'
                          ? t('May include personal information you write in a request or outcome.')
                          : t('Allow this person to read the contents of your reminders.')
                    }
                  />
                ))}
                <label className="field">
                  {t('Contact order')}
                  <select
                    value={editing.priority}
                    onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })}
                  >
                    {Array.from({ length: 8 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {i === 0
                          ? t('1 — Primary contact')
                          : t('{{p0}} — Backup contact', { p0: i + 1 })}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                {(['available', 'accepted', 'drill_opt_in', 'external_opt_in'] as const).map(
                  (field) => (
                    <Toggle
                      key={field}
                      checked={!!editing[field]}
                      onChange={(value) => setEditing({ ...editing, [field]: Number(value) })}
                      label={
                        {
                          available: t('Available to respond'),
                          accepted: t('Participate in this care circle'),
                          drill_opt_in: t('Receive test drills'),
                          external_opt_in: t('Allow configured external notifications'),
                        }[field]
                      }
                      description={
                        field === 'external_opt_in'
                          ? t(
                              'Optional. A configured provider receives only a generic request and identifiers; delivery is not guaranteed.',
                            )
                          : field === 'drill_opt_in'
                            ? t(
                                'Clearly labelled rehearsals with accelerated response timers. No external messages are sent for drills.',
                              )
                            : undefined
                      }
                    />
                  ),
                )}
              </>
            )}
          </div>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setEditing(null)}>
              {t('Cancel')}
            </button>
            <button
              className="button primary"
              disabled={props.busy}
              onClick={async () => {
                const body = elder
                  ? {
                      allow_requests: !!editing.allow_requests,
                      allow_notes: !!editing.allow_notes,
                      allow_reminders: !!editing.allow_reminders,
                      priority: editing.priority,
                    }
                  : {
                      available: !!editing.available,
                      accepted: !!editing.accepted,
                      drill_opt_in: !!editing.drill_opt_in,
                      external_opt_in: !!editing.external_opt_in,
                    };
                if (await props.act(`/contacts/${editing.id}`, body, 'PATCH')) {
                  setEditing(null);
                  props.notify('Your preferences are saved. Future access uses the new settings.');
                }
              }}
            >
              {t('Save changes')}
            </button>
          </div>
        </Modal>
      )}
      {preview && (
        <Modal
          title={t('{{p0}}’s view', { p0: preview.name.split(' ')[0] })}
          subtitle={t('A preview from the same server-side sharing rules.')}
          onClose={() => setPreview(null)}
        >
          <div className="modal-body">
            <div className="sharing-preview">
              <span className="eyebrow">{t('WHAT THIS PERSON CAN RECEIVE')}</span>
              <h3>
                {preview.can_receive
                  ? preview.sample
                    ? preview.sample.title_is_system
                      ? t(preview.sample.title)
                      : preview.sample.title
                    : t(preview.example?.title || '')
                  : t('Help requests are not shared')}
              </h3>
              {preview.can_receive && (
                <p>
                  {preview.sample?.private_note ||
                    t(preview.example?.private_note || '') ||
                    t('Private notes are hidden from this contact.')}
                </p>
              )}
              <div className="preview-permissions">
                <Badge tone={preview.notes ? 'green' : 'neutral'}>
                  {preview.notes ? t('Private notes allowed') : t('Private notes hidden')}
                </Badge>
                <Badge tone={preview.reminders ? 'green' : 'neutral'}>
                  {preview.reminders ? t('Reminders allowed') : t('Reminders hidden')}
                </Badge>
              </div>
            </div>
            <p className="fine-print">
              {t('Test requests additionally require the contact to opt in to drills.')}
            </p>
          </div>
          <div className="modal-actions">
            <button className="button primary" onClick={() => setPreview(null)}>
              {t('Got it')}
            </button>
          </div>
        </Modal>
      )}
      {invite && (
        <Modal
          title={t('Invite someone you trust')}
          subtitle={t('They decide whether to join your care circle.')}
          onClose={() => setInvite(false)}
        >
          {inviteCode ? (
            <div className="modal-body">
              <p>
                {t(
                  'Share this one-time code privately with the invited person. It expires in three days. They should choose “Create account” and use the invited email address.',
                )}
              </p>
              <textarea
                className="invite-code"
                aria-label={t('Invitation code')}
                readOnly
                value={inviteCode}
              />
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteCode);
                    props.notify('Invitation code copied.');
                  } catch {
                    setLocalError('Please select and copy the code manually.');
                  }
                }}
              >
                {t('Copy invitation code')}
              </button>
              <p className="fine-print">
                {t(
                  'No email has been sent. The person joins only when they accept with this code.',
                )}
              </p>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const values = new FormData(e.currentTarget);
                setLoading(true);
                setLocalError('');
                try {
                  const result = await api<{ code: string }>('/contacts/invite', {
                    email: values.get('email'),
                    relationship: values.get('relationship'),
                  });
                  setInviteCode(result.code);
                  props.refresh();
                } catch (err) {
                  setLocalError((err as Error).message);
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="modal-body stack-form">
                <label>
                  {t('Email address')}
                  <input name="email" type="email" required placeholder="person@example.com" />
                </label>
                <label>
                  {t('Relationship')}
                  <input
                    name="relationship"
                    required
                    minLength={2}
                    maxLength={50}
                    placeholder={t('Daughter, friend, neighbour…')}
                  />
                </label>
                {localError && (
                  <p className="error-message" role="alert">
                    {errorText(localError)}
                  </p>
                )}
                <p className="fine-print">
                  {t(
                    'New contacts can receive basic requests. Private notes and reminders stay private until you choose otherwise.',
                  )}
                </p>
              </div>
              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setInvite(false)}>
                  {t('Cancel')}
                </button>
                <button className="button primary" disabled={loading}>
                  {t('Create invitation')}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

export function Requests(props: PageProps) {
  const [filter, setFilter] = useState('all');
  const incidents = props.data.incidents.filter(
    (i) =>
      filter === 'all' ||
      (filter === 'open'
        ? openStates.includes(i.state) || i.state === 'NO_RESPONDER'
        : i.state === 'RESOLVED'),
  );
  return (
    <>
      <PageHeading
        eyebrow={t('CARE THAT FOLLOWS THROUGH')}
        title={t('Every request, a clear next step.')}
        subtitle={t(
          'An invitation is the beginning. A named responder and a recorded outcome complete the picture.',
        )}
        action={
          props.data.user.role === 'elder' && (
            <button className="button primary" onClick={props.openHelp}>
              <HeartHandshake size={17} />
              {t('Request help')}
            </button>
          )
        }
      />
      <div className="tabs">
        {['all', 'open', 'resolved'].map((f) => (
          <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? t('All requests') : f === 'open' ? t('Needs attention') : t('Resolved')}
          </button>
        ))}
      </div>
      <section className="card">
        {incidents.length ? (
          incidents.map((i) => (
            <RequestCard
              key={i.id}
              incident={i}
              timezone={props.data.elder.timezone}
              onClick={() => props.openIncident(i.id)}
            />
          ))
        ) : (
          <Empty title={t('A quiet moment')}>
            {t('Requests that you are allowed to see will appear here, with a clear timeline.')}
          </Empty>
        )}
      </section>
      <div className="info-strip">
        <Info size={20} />
        <p>
          {t(
            'Notifications are available in the caregiver inbox while connected. “Accepted” means someone agreed to respond; it does not establish that help arrived.',
          )}
        </p>
      </div>
    </>
  );
}

export function Drills(props: PageProps) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const drills = props.data.incidents.filter((i) => i.is_test);
  async function start() {
    setStarting(true);
    setError('');
    try {
      const incident = await api<Incident>('/drills', { client_key: key() });
      props.refresh();
      props.notify('Test drill started. Switch to a caregiver account to respond.');
      props.openIncident(incident.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }
  function download() {
    const blob = new Blob(
      [JSON.stringify({ exported_at: new Date().toISOString(), synthetic: true, drills }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saathi-drill-report.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <PageHeading
        eyebrow={t('PRACTICE BUILDS CONFIDENCE')}
        title={t('A small rehearsal. A clearer plan.')}
        subtitle={t(
          'Test how your circle responds, using fictional events and accelerated timers.',
        )}
      />
      <section className="drill-hero">
        <span className="drill-symbol">
          <FlaskConical size={34} />
        </span>
        <div>
          <Badge tone="lavender">{t('TEST MODE · NO REAL SENSOR EVENT')}</Badge>
          <h2>{t('Let’s walk through it, together.')}</h2>
          <p>
            {t(
              'Invite the primary contact. Wait 10 seconds. Hand off to an opted-in backup if nobody accepts. Then record a follow-up.',
            )}
          </p>
          <button className="button primary" disabled={starting} onClick={start}>
            <FlaskConical size={17} />
            {starting ? t('Starting…') : t('Start a practice drill')}
          </button>
        </div>
      </section>
      <div className="drill-steps">
        {[
          [
            '01',
            t('A gentle request'),
            t('A synthetic event starts the same persistent workflow.'),
          ],
          [
            '02',
            t('A clear handoff'),
            t('Only approved contacts who opted into drills are invited.'),
          ],
          ['03', t('A visible outcome'), t('Acceptance and resolution are recorded separately.')],
        ].map(([number, title, text]) => (
          <div key={number}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
      {error && (
        <p className="error-message" role="alert">
          {errorText(error)}
        </p>
      )}
      <section className="card">
        <SectionTitle
          title={t('Your practice log')}
          subtitle={t('A record of what happened, including unanswered requests.')}
          action={
            drills.length > 0 && (
              <button className="text-link" onClick={download}>
                <Download size={16} />
                {t('Export report')}
              </button>
            )
          }
        />
        {drills.length ? (
          drills.map((i) => (
            <RequestCard
              key={i.id}
              incident={i}
              timezone={props.data.elder.timezone}
              onClick={() => props.openIncident(i.id)}
            />
          ))
        ) : (
          <Empty title={t('Ready when your circle is')}>
            {t(
              'Start your first drill. Use separate browser profiles for the older adult and caregiver, or sign out and switch demo roles.',
            )}
          </Empty>
        )}
      </section>
      <div className="info-strip">
        <Info size={20} />
        <p>
          {t(
            'Drills send no external notifications. Test timing: 10 seconds to accept, 60 seconds to record an outcome, then a 15-second follow-up grace period. These are demonstration values, not emergency-response recommendations.',
          )}
        </p>
      </div>
    </>
  );
}

export function History(props: PageProps) {
  return (
    <>
      <PageHeading
        eyebrow={t('TRUST, MADE VISIBLE')}
        title={t('Nothing shared in the dark.')}
        subtitle={t(
          'See which actions were taken, what was shared, and which permissions were checked.',
        )}
      />
      <section className="card history-card">
        {props.data.audit.length ? (
          props.data.audit.map((a) => (
            <div className="audit-row" key={a.id}>
              <span className={`audit-icon ${a.decision === 'deny' ? 'rose' : 'mint'}`}>
                {a.decision === 'deny' ? <LockKeyhole size={19} /> : <ShieldCheck size={19} />}
              </span>
              <div>
                <strong>
                  {t(
                    a.action.startsWith('reminder_')
                      ? 'My reminders'
                      : a.action.startsWith('request_') || a.action === 'help_requested'
                        ? 'Care requests'
                        : a.action === 'coverage_updated'
                          ? 'Care coverage'
                          : a.action === 'check_in'
                            ? 'Check-in'
                            : 'Sharing history',
                  )}
                </strong>
                <p>{systemText(a.detail)}</p>
                <small>
                  {dateTime(a.created_at, props.data.elder.timezone)}
                  {a.policy_version ? t(' · Policy version {{p0}}', { p0: a.policy_version }) : ''}
                </small>
              </div>
              <Badge tone={a.decision === 'deny' ? 'rose' : 'green'}>
                {a.decision === 'deny' ? t('Blocked') : t('Recorded')}
              </Badge>
            </div>
          ))
        ) : (
          <Empty title={t('Your story starts here')}>
            {t('Confirmed actions and sharing decisions appear in this history.')}
          </Empty>
        )}
      </section>
    </>
  );
}

export function SettingsPage(props: PageProps & { health: Health | null }) {
  const [large, setLarge] = useState(() => localStorage.getItem('saathi:large-text') === 'true');
  return (
    <>
      <PageHeading
        eyebrow={t('MAKE YOURSELF COMFORTABLE')}
        title={t('A space that works for you.')}
        subtitle={t('A few simple preferences, and a clear picture of how this prototype works.')}
      />
      <div className="settings-grid">
        <section className="card">
          <SectionTitle title={t('Language settings')} />
          <p>{t('Personal notes stay in the language they were written in.')}</p>
          <p>{t('No translation service is called when you change the language.')}</p>
          <p className="fine-print">
            {t('Regional translations are drafts and need fluent-speaker review.')}
          </p>
          <p>
            {languages
              .filter((entry) => entry.available)
              .map((entry) => entry.native)
              .join(' · ')}
          </p>
        </section>
        <section className="card">
          <SectionTitle title={t('Your account')} />
          <div className="account-summary">
            <Avatar name={props.data.user.name} variant="peach" size="large" />
            <div>
              <h3>{props.data.user.name}</h3>
              <p>{props.data.user.email}</p>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>{t('Role')}</dt>
              <dd>{props.data.user.role === 'elder' ? t('Older adult') : t('Caregiver')}</dd>
            </div>
            <div>
              <dt>{t('Household timezone')}</dt>
              <dd>{props.data.elder.timezone}</dd>
            </div>
            <div>
              <dt>{t('Data')}</dt>
              <dd>
                {props.data.user.is_demo ? t('Fictional demo household') : t('Your household')}
              </dd>
            </div>
          </dl>
          <Toggle
            checked={large}
            onChange={(value) => {
              setLarge(value);
              localStorage.setItem('saathi:large-text', String(value));
              document.documentElement.classList.toggle('large-text', value);
            }}
            label={t('Larger text')}
            description={t('A little more room for comfortable reading.')}
          />
        </section>
        <section className="card">
          <SectionTitle title={t('What is connected')} />
          <dl className="detail-list">
            <div>
              <dt>{t('Language interpretation')}</dt>
              <dd>
                {props.health?.ai === 'live' ? t('Live provider configured') : t('Local helper')}
              </dd>
            </div>
            <div>
              <dt>{t('Notifications')}</dt>
              <dd>
                {props.health?.notifications === 'webhook'
                  ? t('Inbox + optional webhook')
                  : t('In-app inbox')}
              </dd>
            </div>
            <div>
              <dt>{t('Wearable signals')}</dt>
              <dd>{t('Not connected')}</dd>
            </div>
            <div>
              <dt>{t('Storage')}</dt>
              <dd>{t('Persistent SQLite database')}</dd>
            </div>
          </dl>
          <p className="fine-print">
            {t(
              'Voice input uses your browser’s speech service when available and may send audio to its provider. Recording starts only when you press the microphone. Always review the transcript.',
            )}
          </p>
        </section>
        <section className="card settings-about">
          <SectionTitle title={t('Built around dignity')} />
          <p>
            {t(
              'Saathi Care AI is inspired by the published Suraksha case study by Team StarBugs, with a separate implementation focused on sharing previews, care-circle drills, and accountable handoffs.',
            )}
          </p>
          <p>
            {t(
              'It coordinates support; it does not diagnose, detect falls, or guarantee emergency assistance. There is no automatic emergency-service dispatch. Keep your existing care and emergency arrangements in place.',
            )}
          </p>
          <p className="fine-print">
            {t(
              'The app works while its server is running. When disconnected, new actions are not sent or queued. A saved check-in or an accepted request does not prove someone is safe.',
            )}
          </p>
        </section>
      </div>
    </>
  );
}
