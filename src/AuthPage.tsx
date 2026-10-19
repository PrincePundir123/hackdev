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
  onLogin: (user: User) => void;
}) {
  const [mode, setMode] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState('');
  async function demo(user: string) {
    setBusy(user);
    setError('');
    try {
      onLogin((await api<{ user: User }>('/auth/demo', { user })).user);
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
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ...(invite.trim() ? { inviteCode: invite.trim() } : {}),
          }
        : {}),
    };
    try {
      onLogin((await api<{ user: User }>('/auth/' + mode, payload)).user);
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
          <span className="eyebrow light">INDEPENDENCE. WITH A LITTLE TOGETHERNESS.</span>
          <h1>
            A little closer.
            <br />
            Every single day.
          </h1>
          <p>
            Care that respects your space.
            <br />
            And keeps your people close.
          </p>
          <GardenIllustration />
          <div className="auth-promises">
            <span>
              <CheckCircle2 size={18} /> Simple everyday support
            </span>
            <span>
              <ShieldCheck size={18} /> You decide what to share
            </span>
            <span>
              <HeartHandshake size={18} /> Someone who follows through
            </span>
          </div>
        </div>
        <p className="auth-foot">Thoughtful technology. Human connection.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          {mode === 'welcome' ? (
            <>
              <span className="eyebrow">WELCOME TO YOUR CARE CIRCLE</span>
              <h2>
                Good care starts
                <br />
                with connection.
              </h2>
              <p className="muted auth-description">
                A calmer way to manage reminders, ask for support, and look out for the people you
                love.
              </p>
              {health?.demo && (
                <>
                  <div className="demo-label">
                    <span /> EXPLORE A FICTIONAL HOUSEHOLD
                  </div>
                  <div className="demo-people">
                    {[
                      {
                        id: 'meera',
                        name: 'Meera Sharma',
                        role: 'Older adult · My day',
                        variant: 'peach',
                      },
                      {
                        id: 'arjun',
                        name: 'Arjun Sharma',
                        role: 'Son · Primary caregiver',
                        variant: 'sage',
                      },
                      {
                        id: 'leela',
                        name: 'Leela Rao',
                        role: 'Neighbour · Backup caregiver',
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
                          <strong>Continue as {person.name.split(' ')[0]}</strong>
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
                    Demo people and events are synthetic. Try different roles to see the care
                    process from both sides.
                  </p>
                  <div className="divider">
                    <span>or make it yours</span>
                  </div>
                </>
              )}
              <button className="button primary wide" onClick={() => setMode('register')}>
                Create your care circle <ArrowRight size={17} />
              </button>
              <p className="auth-login">
                Already have an account?{' '}
                <button className="inline-link" onClick={() => setMode('login')}>
                  Sign in
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
                <ArrowLeft size={16} /> Back
              </button>
              <span className="eyebrow">YOUR SPACE, YOUR PEOPLE</span>
              <h2>{mode === 'login' ? 'Welcome back.' : 'Let’s get connected.'}</h2>
              <p className="muted">
                {mode === 'register'
                  ? 'Create a personal care circle, or join with an invitation.'
                  : 'Sign in to your personal care space.'}
              </p>
              <form onSubmit={submit} className="stack-form">
                {mode === 'register' && (
                  <label>
                    Your name
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={70}
                      placeholder="Your full name"
                    />
                  </label>
                )}
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={12}
                    maxLength={128}
                    placeholder="At least 12 characters"
                  />
                </label>
                {mode === 'register' && (
                  <label>
                    Invitation code <span className="muted">(optional)</span>
                    <input
                      value={invite}
                      onChange={(e) => setInvite(e.target.value)}
                      placeholder="Paste a care-circle invitation"
                    />
                    <small>
                      {invite
                        ? 'Use the email address the invitation was made for.'
                        : 'Leave blank to create your own care circle.'}
                    </small>
                  </label>
                )}
                <button className="button primary wide" disabled={!!busy}>
                  {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}
                  {mode === 'login' ? 'Sign in' : 'Create account'}
                </button>
              </form>
              <p className="auth-login">
                {mode === 'login' ? 'New here?' : 'Already registered?'}{' '}
                <button
                  className="inline-link"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setError('');
                  }}
                >
                  {mode === 'login' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            </>
          )}
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          <div className="auth-privacy">
            <LockKeyhole size={15} /> Personal by default. Shared by your choice.
          </div>
          <p className="prototype-note">
            A care-coordination prototype. Not an emergency or medical service.
          </p>
        </div>
      </section>
    </div>
  );
}
