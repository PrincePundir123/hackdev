import { t, systemText, getLanguage } from './i18n';
import LanguagePicker from './LanguagePicker';
import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HeartHandshake,
  ArrowLeft,
  LockKeyhole,
  LoaderCircle,
} from 'lucide-react';
import { api } from './api';
import { Avatar, Brand, GardenIllustration } from './components';
import type { Health, User } from './types';

export default function AuthPage({
  health,
  onLogin,
}: {
  health: Health | null;
  onLogin: (user: User) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState('');
  async function demo(user: string) {
    setBusy(user);
    setError('');
    try {
      await onLogin((await api<{ user: User }>('/auth/demo', { user })).user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy('form');
    setError('');
    const form = new FormData(e.currentTarget);
    const payload = {
      email: form.get('email'),
      password: form.get('password'),
      ...(mode === 'register'
        ? {
            name: form.get('name'),
            language: getLanguage(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ...(invite.trim() ? { inviteCode: invite.trim() } : {}),
          }
        : {}),
    };
    try {
      await onLogin((await api<{ user: User }>('/auth/' + mode, payload)).user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand light />
        <div className="auth-copy">
          <span className="eyebrow light">{t('INDEPENDENCE. WITH A LITTLE TOGETHERNESS.')}</span>
          <h1>
            {t('A little closer.')}
            <br />
            {t('Every single day.')}
          </h1>
          <p>
            {t('Care that respects your space.')}
            <br />
            {t('And keeps your people close.')}
          </p>
          <GardenIllustration />
          <div className="auth-promises">
            <span>
              <CheckCircle2 size={18} />
              {t(' Simple everyday support')}
            </span>
            <span>
              <ShieldCheck size={18} />
              {t(' You decide what to share')}
            </span>
            <span>
              <HeartHandshake size={18} />
              {t(' Someone who follows through')}
            </span>
          </div>
        </div>
        <p className="auth-foot">{t('Thoughtful technology. Human connection.')}</p>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <LanguagePicker />
          {mode === 'welcome' ? (
            <>
              <span className="eyebrow">{t('WELCOME TO YOUR CARE CIRCLE')}</span>
              <h2>
                {t('Good care starts')}
                <br />
                {t('with connection.')}
              </h2>
              <p className="muted auth-description">
                {t(
                  'A calmer way to manage reminders, ask for support, and look out for the people you love.',
                )}
              </p>
              {health?.demo && (
                <>
                  <div className="demo-label">
                    <span />
                    {t(' EXPLORE A FICTIONAL HOUSEHOLD')}
                  </div>
                  <div className="demo-people">
                    {[
                      {
                        id: 'meera',
                        name: t('Meera Sharma'),
                        role: t('Older adult · My day'),
                        variant: 'peach',
                      },
                      {
                        id: 'arjun',
                        name: t('Arjun Sharma'),
                        role: t('Son · Primary caregiver'),
                        variant: 'sage',
                      },
                      {
                        id: 'leela',
                        name: t('Leela Rao'),
                        role: t('Neighbour · Backup caregiver'),
                        variant: 'lavender',
                      },
                    ].map((person) => (
                      <button
                        key={person.id}
                        className="demo-person"
                        disabled={!!busy}
                        onClick={() => demo(person.id)}
                      >
                        <Avatar name={person.name} variant={person.variant} />
                        <span>
                          <strong>
                            {t('Continue as ')}
                            {person.name.split(' ')[0]}
                          </strong>
                          <small>{person.role}</small>
                        </span>
                        {busy === person.id ? (
                          <LoaderCircle size={18} className="spin" />
                        ) : (
                          <ArrowRight size={18} />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="fine-print">
                    {t(
                      'Demo people and events are synthetic. Try different roles to see the care process from both sides.',
                    )}
                  </p>
                  <div className="divider">
                    <span>{t('or make it yours')}</span>
                  </div>
                </>
              )}
              <button className="button primary wide" onClick={() => setMode('register')}>
                {t('Create your care circle ')}
                <ArrowRight size={17} />
              </button>
              <p className="auth-login">
                {t('Already have an account?')}{' '}
                <button className="inline-link" onClick={() => setMode('login')}>
                  {t('Sign in')}
                </button>
              </p>
            </>
          ) : (
            <>
              <button
                className="text-link back"
                onClick={() => {
                  setMode('welcome');
                  setError('');
                }}
              >
                <ArrowLeft size={16} />
                {t(' Back')}
              </button>
              <span className="eyebrow">{t('YOUR SPACE, YOUR PEOPLE')}</span>
              <h2>{mode === 'login' ? t('Welcome back.') : t('Let’s get connected.')}</h2>
              <p className="muted">
                {mode === 'register'
                  ? t('Create a personal care circle, or join with an invitation.')
                  : t('Sign in to your personal care space.')}
              </p>
              <form onSubmit={submit} className="stack-form">
                {mode === 'register' && (
                  <label>
                    {t('Your name')}
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={70}
                      placeholder={t('Your full name')}
                    />
                  </label>
                )}
                <label>
                  {t('Email address')}
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  {t('Password')}
                  <input
                    name="password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={12}
                    maxLength={128}
                    placeholder={t('At least 12 characters')}
                  />
                </label>
                {mode === 'register' && (
                  <label>
                    {t('Invitation code ')}
                    <span className="muted">{t('(optional)')}</span>
                    <input
                      value={invite}
                      onChange={(e) => setInvite(e.target.value)}
                      placeholder={t('Paste a care-circle invitation')}
                    />
                    <small>
                      {invite
                        ? t('Use the email address the invitation was made for.')
                        : t('Leave blank to create your own care circle.')}
                    </small>
                  </label>
                )}
                <button className="button primary wide" disabled={!!busy}>
                  {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}
                  {mode === 'login' ? t('Sign in') : t('Create account')}
                </button>
              </form>
              <p className="auth-login">
                {mode === 'login' ? t('New here?') : t('Already registered?')}{' '}
                <button
                  className="inline-link"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setError('');
                  }}
                >
                  {mode === 'login' ? t('Create an account') : t('Sign in')}
                </button>
              </p>
            </>
          )}
          {error && (
            <div className="error-message" role="alert">
              {systemText(error)}
            </div>
          )}
          <div className="auth-privacy">
            <LockKeyhole size={15} />
            {t(' Personal by default. Shared by your choice.')}
          </div>
          <p className="prototype-note">
            {t('A care-coordination prototype. Not an emergency or medical service.')}
          </p>
        </div>
      </section>
    </div>
  );
}
