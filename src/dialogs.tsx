import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  Clock3,
  HeartHandshake,
  Info,
  LoaderCircle,
  LockKeyhole,
  Mic,
  ShieldCheck,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { api, dateTime, key, stateLabel } from './api';
import { Avatar, Badge, Modal } from './components';
import type { DashboardData, Incident, Interpretation, ReminderProposal } from './types';

type DialogProps = {
  data: DashboardData;
  onClose: () => void;
  refresh: () => void;
  notify: (s: string) => void;
  liveAI?: boolean;
};
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult:
    ((e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function ReminderDialog({ data, onClose, refresh, notify, liveAI }: DialogProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Interpretation | null>(null);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [trigger, setTrigger] = useState<'fixed' | 'check_in'>('check_in');
  const [offset, setOffset] = useState(20);
  const [repeat, setRepeat] = useState<'once' | 'daily'>('once');
  const [at, setAt] = useState('');
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const requestKey = useRef(key());
  useEffect(
    () => () => {
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const Speech =
    (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
  function record() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    if (!Speech) {
      setError('Speech input is not available here. Please type your request.');
      return;
    }
    const instance = new Speech();
    recognition.current = instance;
    instance.lang = 'en-IN';
    instance.interimResults = false;
    instance.onresult = (event) => {
      setText(event.results[0][0].transcript);
      setResult(null);
    };
    instance.onerror = () => {
      setError('Could not hear your request. Check microphone permission or type instead.');
      setListening(false);
    };
    instance.onend = () => setListening(false);
    setError('');
    setListening(true);
    try {
      instance.start();
    } catch {
      setListening(false);
      setError('Microphone unavailable. You can type your request.');
    }
  }
  async function interpret(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(await api<Interpretation>('/interpret', { text }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function reviewManual(e: FormEvent) {
    e.preventDefault();
    const due = trigger === 'fixed' ? new Date(at).getTime() : null;
    if (trigger === 'fixed' && (!due || due <= Date.now())) {
      setError('Choose a future date and time.');
      return;
    }
    const proposal: ReminderProposal = {
      intent: 'reminder',
      title,
      trigger_type: trigger,
      offset_minutes: offset,
      due_at: due,
      repeat: trigger === 'fixed' ? 'once' : repeat,
    };
    setResult({
      proposal,
      mode: 'local',
      notice: 'Manually entered. Please check the details before saving.',
    });
    setError('');
  }
  async function confirm() {
    if (!result || result.proposal.intent === 'clarify') return;
    setBusy(true);
    setError('');
    try {
      const proposal = result.proposal;
      if (proposal.intent === 'reminder')
        await api('/reminders', { ...proposal, client_key: requestKey.current });
      else {
        const contact = data.contacts.find((c) => c.id === proposal.contact_id);
        if (!contact) throw new Error('This contact is no longer in your care circle.');
        await api(
          `/contacts/${contact.id}`,
          {
            allow_requests: !!contact.allow_requests,
            allow_notes: !!contact.allow_notes,
            allow_reminders: !!contact.allow_reminders,
            priority: contact.priority,
            [proposal.field]: proposal.allowed,
          },
          'PATCH',
        );
      }
      refresh();
      notify(
        proposal.intent === 'reminder'
          ? 'Your reminder is saved. One less thing to remember.'
          : 'Your sharing preference is saved.',
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function speak() {
    if (!result || result.proposal.intent === 'clarify') return;
    const p = result.proposal;
    const text =
      p.intent === 'reminder'
        ? `Reminder: ${p.title}. ${p.trigger_type === 'check_in' ? `${p.offset_minutes} minutes after your morning check-in.` : dateTime(p.due_at!, data.user.timezone)}`
        : 'Please review the proposed sharing change on your screen.';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }
  const proposed = result?.proposal;
  return (
    <Modal
      title={
        proposed && proposed.intent !== 'clarify'
          ? 'Does this look right?'
          : 'A little help remembering'
      }
      subtitle="You ask. We help. You always have the final say."
      onClose={onClose}
    >
      <div className="modal-body">
        {proposed && proposed.intent !== 'clarify' ? (
          <>
            <div className="interpretation-note">
              <Sparkles size={16} />
              <span>{result?.notice}</span>
            </div>
            {proposed.intent === 'reminder' ? (
              <div className="proposal-card">
                <span className="eyebrow">YOUR REMINDER</span>
                <h3>{proposed.title}</h3>
                <p>
                  <Clock3 size={17} />
                  {proposed.trigger_type === 'check_in'
                    ? `${proposed.offset_minutes} minutes after your morning check-in`
                    : dateTime(proposed.due_at!, data.user.timezone)}
                </p>
                <Badge tone="green">
                  {proposed.repeat === 'daily' ? 'Every check-in day' : 'One time'}
                </Badge>
                {proposed.trigger_type === 'check_in' && (
                  <small>This waits for you to tap “I am okay.” No wearable is used.</small>
                )}
              </div>
            ) : (
              <div className="proposal-card">
                <ShieldCheck size={25} />
                <h3>
                  {proposed.allowed ? 'Allow sharing' : 'Stop sharing'} with{' '}
                  {data.contacts.find((c) => c.id === proposed.contact_id)?.name}
                </h3>
                <p>
                  {
                    {
                      allow_notes: 'Private notes and request details',
                      allow_reminders: 'Reminder contents',
                      allow_requests: 'Basic help requests and response access',
                    }[proposed.field]
                  }
                </p>
                <small>
                  Applies to future access. Information already seen cannot be recalled.
                </small>
              </div>
            )}
            {'speechSynthesis' in window && (
              <button className="text-link" onClick={speak}>
                <Volume2 size={16} />
                Read this back
              </button>
            )}
          </>
        ) : (
          <>
            <div className="tabs compact">
              <button
                className={!manual ? 'selected' : ''}
                onClick={() => {
                  setManual(false);
                  setResult(null);
                }}
              >
                Ask naturally
              </button>
              <button
                className={manual ? 'selected' : ''}
                onClick={() => {
                  setManual(true);
                  setResult(null);
                }}
              >
                Enter details
              </button>
            </div>
            {manual ? (
              <form id="reminder-manual" onSubmit={reviewManual} className="stack-form">
                <label>
                  What should we remind you about?
                  <input
                    required
                    minLength={2}
                    maxLength={160}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Water the balcony plants"
                  />
                </label>
                <label>
                  When?
                  <select
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value as 'fixed' | 'check_in')}
                  >
                    <option value="check_in">After my morning check-in</option>
                    <option value="fixed">At a specific time</option>
                  </select>
                </label>
                {trigger === 'check_in' ? (
                  <div className="form-pair">
                    <label>
                      Minutes after check-in
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        required
                        value={offset}
                        onChange={(e) => setOffset(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      Repeat
                      <select
                        value={repeat}
                        onChange={(e) => setRepeat(e.target.value as 'once' | 'daily')}
                      >
                        <option value="once">One time</option>
                        <option value="daily">Every check-in day</option>
                      </select>
                    </label>
                  </div>
                ) : (
                  <label>
                    Date and time
                    <input
                      type="datetime-local"
                      required
                      value={at}
                      onChange={(e) => setAt(e.target.value)}
                    />
                    <small>
                      Entered in this device’s timezone:{' '}
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}.
                    </small>
                  </label>
                )}
              </form>
            ) : (
              <form id="reminder-natural" onSubmit={interpret}>
                <label className="field">
                  What’s on your mind?
                  <textarea
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                    minLength={3}
                    maxLength={1000}
                    placeholder="Remind me to water the plants 20 minutes after my morning check-in"
                    rows={4}
                  />
                </label>
                <div className="speech-actions">
                  <button
                    type="button"
                    className={`button secondary ${listening ? 'listening' : ''}`}
                    onClick={record}
                    disabled={!Speech}
                  >
                    <Mic size={17} />
                    {listening ? 'Stop listening' : 'Use my voice'}
                  </button>
                  <span>
                    {Speech ? 'English · Tap to record' : 'Voice unavailable in this browser'}
                  </span>
                </div>
                <p className="fine-print">
                  Optional browser speech may send audio to its provider. Review the transcript
                  before continuing.
                </p>
                <button
                  type="button"
                  className="example-chip"
                  onClick={() =>
                    setText('Remind me to water the plants 20 minutes after my morning check-in')
                  }
                >
                  Try a morning reminder <ArrowRight size={13} />
                </button>
              </form>
            )}
            {proposed?.intent === 'clarify' && (
              <div className="clarification" role="status">
                <Info size={18} />
                <p>{proposed.message}</p>
              </div>
            )}
          </>
        )}
        {liveAI && !manual && (
          <p className="fine-print">
            Your request text and care-circle contact names are processed by the connected AI
            service when you select Review request. Use Enter details to create a reminder without
            AI.
          </p>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-actions">
        {proposed && proposed.intent !== 'clarify' ? (
          <>
            <button className="button secondary" disabled={busy} onClick={() => setResult(null)}>
              Edit request
            </button>
            <button className="button primary" disabled={busy} onClick={confirm}>
              {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}Confirm{' '}
              {proposed.intent === 'reminder' ? 'reminder' : 'change'}
            </button>
          </>
        ) : (
          <>
            <button className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              form={manual ? 'reminder-manual' : 'reminder-natural'}
              className="button primary"
              disabled={busy || listening}
            >
              {busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}Review
              request
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

export function HelpDialog({
  data,
  onClose,
  refresh,
  notify,
  onCreated,
}: DialogProps & { onCreated: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestKey = useRef(key());
  const contacts = data.contacts.filter((c) => c.available && c.accepted && c.allow_requests);
  return (
    <Modal
      title="Reach out to your people"
      subtitle="Let’s make sure the right people hear from you."
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const fields = new FormData(e.currentTarget);
          try {
            const result = await api<Incident>('/incidents', {
              client_key: requestKey.current,
              title: fields.get('title'),
              private_note: fields.get('private_note'),
            });
            refresh();
            notify('Your request is saved. We’re waiting for a caregiver to accept.');
            onClose();
            onCreated(result.id);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-body stack-form">
          <label>
            How can your circle help?
            <input
              name="title"
              required
              minLength={2}
              maxLength={160}
              defaultValue="Please check in with me"
            />
          </label>
          <label>
            Private details <span className="muted">(optional)</span>
            <textarea
              name="private_note"
              maxLength={1000}
              rows={3}
              placeholder="Only contacts allowed to see private notes can read this."
            />
          </label>
          <div className="recipient-preview">
            <span className="eyebrow">YOUR APPROVED RESPONSE ORDER</span>
            {contacts.length ? (
              contacts.map((c, i) => (
                <div className="recipient" key={c.id}>
                  <Avatar name={c.name} variant={i ? 'lavender' : 'sage'} />
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {i === 0 ? 'Contacted first' : 'If the previous contact cannot respond'} ·{' '}
                      {c.allow_notes ? 'Details allowed' : 'Basic request only'}
                    </small>
                  </span>
                </div>
              ))
            ) : (
              <p>
                No contacts are available. The request will be recorded as having no confirmed
                responder.
              </p>
            )}
          </div>
          <p className="fine-print">
            <LockKeyhole size={13} /> Contacts without note permission see a generic check-in
            request. Requests appear in their app inbox; this does not call emergency services.
          </p>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            <HeartHandshake size={17} />
            {busy ? 'Sending…' : 'Confirm help request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function IncidentDialog({
  incident,
  data,
  act,
  busy,
  onClose,
}: {
  incident?: Incident;
  data: DashboardData;
  act: (path: string, body: unknown, method?: string) => Promise<boolean>;
  busy: boolean;
  onClose: () => void;
}) {
  const [outcome, setOutcome] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!incident)
    return (
      <Modal
        title="Loading request"
        subtitle="Checking the latest access and request state."
        onClose={onClose}
      >
        <div className="modal-body">
          <p>
            If the request no longer appears, your sharing permission may have changed. Close this
            dialog and refresh your care requests.
          </p>
        </div>
      </Modal>
    );
  const pending = incident.attempts.find(
    (a) => a.user_id === data.user.id && a.status === 'pending' && a.expires_at > clock,
  );
  const assigned = ['ASSIGNED', 'FOLLOW_UP_OVERDUE'].includes(incident.state);
  const canResolve =
    assigned && (incident.owner_id === data.user.id || data.user.id === incident.elder_id);
  const canCancel =
    data.user.id === incident.elder_id &&
    !['CANCELLED', 'RESOLVED', 'NO_RESPONDER'].includes(incident.state);
  const seconds = Math.max(0, Math.ceil(((incident.next_due_at || clock) - clock) / 1000));
  async function respond(action: string) {
    setLocalError('');
    if (action === 'resolve' && outcome.trim().length < 3) {
      setLocalError('Please enter a short outcome before resolving.');
      return;
    }
    const ok = await act(`/incidents/${incident!.id}/respond`, { action, outcome });
    if (!ok)
      setLocalError(
        'The action could not be completed. The request may have changed; check its latest state and try again.',
      );
  }
  return (
    <Modal
      title={incident.title}
      subtitle={dateTime(incident.created_at, data.elder.timezone)}
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="incident-status">
          <Badge tone={incident.state === 'RESOLVED' ? 'green' : 'amber'}>
            {stateLabel[incident.state] || incident.state}
          </Badge>
          {incident.is_test && <Badge tone="lavender">TEST · ACCELERATED TIMING</Badge>}
        </div>
        {incident.private_note && (
          <div className="private-note">
            <LockKeyhole size={16} />
            <p>{incident.private_note}</p>
          </div>
        )}
        {incident.next_due_at && (
          <div className="deadline">
            <Clock3 size={16} />
            {incident.state === 'AWAITING_RESPONSE' ? 'Response window' : 'Follow-up window'}:{' '}
            {seconds >= 60 ? `${Math.floor(seconds / 60)}m ` : ''}
            {seconds % 60}s
          </div>
        )}
        {incident.owner_name && (
          <div className="owner-banner">
            <Check size={19} />
            {incident.owner_name} accepted responsibility.{' '}
            {incident.state !== 'RESOLVED' && 'An outcome is still needed.'}
          </div>
        )}
        {incident.state === 'NO_RESPONDER' && (
          <div className="error-message">
            No responder confirmed. Use your existing manual contact plan; this prototype does not
            dispatch assistance.
          </div>
        )}
        <h3 className="timeline-title">The care timeline</h3>
        <ol className="timeline">
          {incident.timeline.map((event, i) => (
            <li key={i}>
              <span className={`timeline-dot ${event.kind}`} />
              <div>
                <p>{event.text}</p>
                <small>{dateTime(event.created_at, data.elder.timezone)}</small>
              </div>
            </li>
          ))}
        </ol>
        {incident.outcome && (
          <div className="outcome">
            <strong>Recorded outcome</strong>
            <p>{incident.outcome}</p>
          </div>
        )}
        {incident.deliveries && incident.deliveries.length > 0 && (
          <div className="delivery-status">
            <h3>External delivery attempts</h3>
            {incident.deliveries.map((d, i) => (
              <p key={i}>
                {d.name}: {d.status.replaceAll('_', ' ')}
                {d.last_error ? ` — ${d.last_error}` : ''}
              </p>
            ))}
            <small>Provider acceptance does not establish delivery or human response.</small>
          </div>
        )}
        {canResolve && (
          <label className="field">
            Record the outcome
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="What happened after you accepted?"
              maxLength={500}
              minLength={3}
              rows={3}
            />
          </label>
        )}
        {localError && (
          <p className="error-message" role="alert">
            {localError}
          </p>
        )}
      </div>
      <div className="modal-actions">
        {pending && incident.state === 'AWAITING_RESPONSE' && (
          <>
            <button className="button secondary" disabled={busy} onClick={() => respond('decline')}>
              I cannot respond
            </button>
            <button className="button primary" disabled={busy} onClick={() => respond('accept')}>
              <Check size={17} />I will respond
            </button>
          </>
        )}
        {canResolve && (
          <button className="button primary" disabled={busy} onClick={() => respond('resolve')}>
            Record outcome & resolve
          </button>
        )}
        {canCancel && (
          <button className="button secondary" disabled={busy} onClick={() => respond('cancel')}>
            Cancel request
          </button>
        )}
        {!pending && !canResolve && !canCancel && (
          <button className="button primary" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </Modal>
  );
}
