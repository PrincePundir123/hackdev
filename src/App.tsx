import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  Heart,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import AuthPage from './AuthPage';
import { api, ApiError } from './api';
import { Avatar, Brand, Loading } from './components';
import { Overview, Reminders, Circle, Requests, Drills, History, SettingsPage } from './pages';
import { HelpDialog, ReminderDialog, IncidentDialog } from './dialogs';
import type { DashboardData, Health, Page, User } from './types';

const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'reminders', label: 'My reminders', icon: CalendarDays },
  { id: 'circle', label: 'My care circle', icon: Users },
  { id: 'requests', label: 'Care requests', icon: Heart },
  { id: 'drills', label: 'Practice a drill', icon: FlaskConical },
  { id: 'history', label: 'Sharing history', icon: ShieldCheck },
] as const;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [initial, setInitial] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [page, setPage] = useState<Page>('overview');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<'reminder' | 'help' | null>(null);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  useEffect(() => {
    document.documentElement.classList.toggle(
      'large-text',
      localStorage.getItem('saathi:large-text') === 'true',
    );
    let active = true;
    Promise.allSettled([api<Health>('/health'), api<{ user: User }>('/auth/me')]).then(
      (results) => {
        if (!active) return;
        if (results[0].status === 'fulfilled') setHealth(results[0].value);
        if (results[1].status === 'fulfilled') setUser(results[1].value.user);
        setInitial(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await api<DashboardData>('/dashboard');
        if (active) {
          setData(result);
          setOffline(false);
        }
      } catch (err) {
        if (active) {
          if (err instanceof ApiError && err.status === 401) {
            setUser(null);
            setData(null);
          } else setOffline(true);
        }
      } finally {
        if (active) timer = setTimeout(poll, 2500);
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [user?.id, revision]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const refresh = useCallback(() => setRevision((x) => x + 1), []);
  const notify = useCallback((message: string) => setNotice(message), []);
  async function act(path: string, body: unknown, method = 'POST') {
    setBusy(true);
    setError('');
    try {
      await api(path, body, method);
      refresh();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function login(next: User) {
    setData(null);
    setUser(next);
    setPage('overview');
    setModal(null);
    setIncidentId(null);
    setError('');
  }
  async function logout() {
    if (await act('/auth/logout', {})) {
      setUser(null);
      setData(null);
    }
  }
  function go(next: Page) {
    setPage(next);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (initial) return <Loading />;
  if (!user) return <AuthPage health={health} onLogin={login} />;
  const isElder = user.role === 'elder';
  const currentTitle =
    page === 'settings' ? 'Settings' : navigation.find((n) => n.id === page)?.label;
  const props = data
    ? {
        data,
        act,
        busy,
        notify,
        refresh,
        go,
        openReminder: () => setModal('reminder'),
        openHelp: () => setModal('help'),
        openIncident: setIncidentId,
      }
    : null;
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {menu && (
        <button
          className="nav-scrim"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Brand />
        <div className="sidebar-home">
          <span className="home-icon">
            <Home size={18} />
          </span>
          <div>
            <strong>{isElder ? 'My personal space' : 'My caregiver space'}</strong>
            <small>{isElder ? 'Care on your terms' : 'Connection with intention'}</small>
          </div>
        </div>
        <span className="nav-label">YOUR EVERYDAY</span>
        <nav aria-label="Main navigation">
          {navigation
            .filter((n) => isElder || !['drills', 'history'].includes(n.id))
            .map((n) => (
              <button
                key={n.id}
                className={`nav-item ${page === n.id ? 'active' : ''}`}
                onClick={() => go(n.id)}
                aria-current={page === n.id ? 'page' : undefined}
              >
                <n.icon size={19} />
                <span>{!isElder && n.id === 'reminders' ? 'Shared reminders' : n.label}</span>
                {n.id === 'requests' && data && data.stats.open > 0 && (
                  <span className="nav-count">{data.stats.open}</span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={22} />
            <strong>Your circle. Your choice.</strong>
            <p>
              Only the people you choose.
              <br />
              Only what you choose to share.
            </p>
          </div>
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => go('settings')}
          >
            <Settings size={18} />
            Settings & accessibility
          </button>
          <button
            className="profile-button"
            onClick={logout}
            disabled={busy}
            aria-label={`Sign out ${user.name}`}
          >
            <Avatar name={user.name} variant={isElder ? 'peach' : 'sage'} />
            <span>
              <strong>{user.name}</strong>
              <small>{isElder ? 'Personal account' : 'Caregiver account'}</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <span>My care space</span>
            <ChevronRight size={14} />
            <strong>{currentTitle}</strong>
          </div>
          <div className="topbar-right">
            {user.is_demo && (
              <span className="test-pill">
                <span /> DEMO HOUSEHOLD
              </span>
            )}
            <button
              className="icon-button notification-button"
              aria-label="View care requests"
              onClick={() => go('requests')}
            >
              <Bell size={20} />
              {!!data?.stats.open && <i />}
            </button>
            <Avatar name={user.name} variant="peach" size="small" />
          </div>
        </header>
        {offline && (
          <div className="connection-banner" role="alert">
            <WifiOff size={17} />
            <span>
              Connection unavailable. Updates may be stale. New actions are not queued offline.
            </span>
            <button onClick={refresh}>Retry</button>
          </div>
        )}
        <main id="main-content" className="workspace">
          {!props ? (
            offline ? (
              <div className="empty">
                <WifiOff />
                <h2>We couldn’t reach your care space.</h2>
                <button className="button secondary" onClick={refresh}>
                  Try again
                </button>
              </div>
            ) : (
              <Loading />
            )
          ) : (
            <>
              {page === 'overview' && <Overview {...props} />}
              {page === 'reminders' && <Reminders {...props} />}
              {page === 'circle' && <Circle {...props} />}
              {page === 'requests' && <Requests {...props} />}
              {page === 'drills' && <Drills {...props} />}
              {page === 'history' && <History {...props} />}
              {page === 'settings' && <SettingsPage {...props} health={health} />}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <Heart size={13} /> A little care goes a long way.
          </span>
          <span>Care coordination prototype · Not an emergency service</span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <ShieldCheck size={20} />
          {notice}
          <button onClick={() => setNotice('')} aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      )}
      {error && (
        <div className="toast error" role="alert">
          <CircleHelp size={20} />
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {modal === 'reminder' && props && (
        <ReminderDialog
          data={props.data}
          onClose={() => setModal(null)}
          refresh={refresh}
          notify={notify}
          liveAI={health?.ai === 'live'}
        />
      )}
      {modal === 'help' && props && (
        <HelpDialog
          data={props.data}
          onClose={() => setModal(null)}
          refresh={refresh}
          notify={notify}
          onCreated={setIncidentId}
        />
      )}
      {incidentId && props && (
        <IncidentDialog
          incident={props.data.incidents.find((i) => i.id === incidentId)}
          data={props.data}
          act={act}
          busy={busy}
          onClose={() => setIncidentId(null)}
        />
      )}
    </div>
  );
}
