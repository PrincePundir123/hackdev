import { t, systemText, setLanguage, useLanguage } from './i18n';
import LanguagePicker from './LanguagePicker';
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
import CoveragePage from './CoveragePage';
import type { DashboardData, Health, Page, User } from './types';

const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'reminders', label: 'My reminders', icon: CalendarDays },
  { id: 'circle', label: 'My care circle', icon: Users },
  { id: 'coverage', label: 'Care coverage', icon: CalendarDays },
  { id: 'requests', label: 'Care requests', icon: Heart },
  { id: 'drills', label: 'Practice a drill', icon: FlaskConical },
  { id: 'history', label: 'Sharing history', icon: ShieldCheck },
] as const;

export default function App() {
  useLanguage();
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
      async (results) => {
        if (!active) return;
        if (results[0].status === 'fulfilled') setHealth(results[0].value);
        const saved = results[1].status === 'fulfilled' ? results[1].value.user : null;
        try {
          await setLanguage(saved?.language || localStorage.getItem('saathi:language') || 'en');
        } catch {
          await setLanguage('en');
        }
        if (!active) return;
        if (saved) setUser(saved);
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
  async function login(next: User) {
    await setLanguage(next.language);
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
    page === 'settings'
      ? 'Settings'
      : page === 'coverage' && !isElder
        ? 'My weekly hours'
        : navigation.find((n) => n.id === page)?.label;
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
        {t('Skip to content')}
      </a>
      {menu && (
        <button
          className="nav-scrim"
          onClick={() => setMenu(false)}
          aria-label={t('Close navigation')}
        />
      )}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Brand />
        <div className="sidebar-home">
          <span className="home-icon">
            <Home size={18} />
          </span>
          <div>
            <strong>{isElder ? t('My personal space') : t('My caregiver space')}</strong>
            <small>{isElder ? t('Care on your terms') : t('Connection with intention')}</small>
          </div>
        </div>
        <span className="nav-label">{t('YOUR EVERYDAY')}</span>
        <nav aria-label={t('Main navigation')}>
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
                <span>
                  {!isElder && n.id === 'reminders'
                    ? t('Shared reminders')
                    : !isElder && n.id === 'coverage'
                      ? t('My weekly hours')
                      : t(n.label)}
                </span>
                {n.id === 'requests' && data && data.stats.open > 0 && (
                  <span className="nav-count">{data.stats.open}</span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={22} />
            <strong>{t('Your circle. Your choice.')}</strong>
            <p>
              {t('Only the people you choose.')}
              <br />
              {t('Only what you choose to share.')}
            </p>
          </div>
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => go('settings')}
          >
            <Settings size={18} />
            {t('Settings & accessibility')}
          </button>
          <button
            className="profile-button"
            onClick={logout}
            disabled={busy}
            aria-label={t('Sign out {{p0}}', { p0: user.name })}
          >
            <Avatar name={user.name} variant={isElder ? 'peach' : 'sage'} />
            <span>
              <strong>{user.name}</strong>
              <small>{isElder ? t('Personal account') : t('Caregiver account')}</small>
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
              aria-label={t('Open navigation')}
            >
              <Menu size={22} />
            </button>
            <span>{t('My care space')}</span>
            <ChevronRight size={14} />
            <strong>{t(currentTitle || '')}</strong>
          </div>
          <div className="topbar-right">
            <LanguagePicker
              user={user}
              onSaved={(next) => {
                setUser(next);
                refresh();
              }}
            />
            {user.is_demo && (
              <span className="test-pill">
                <span />
                {t(' DEMO HOUSEHOLD')}
              </span>
            )}
            <button
              className="icon-button notification-button"
              aria-label={t('View care requests')}
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
              {t(
                'Connection unavailable. Updates may be stale. New actions are not queued offline.',
              )}
            </span>
            <button onClick={refresh}>{t('Retry')}</button>
          </div>
        )}
        <main id="main-content" className="workspace">
          {!props ? (
            offline ? (
              <div className="empty">
                <WifiOff />
                <h2>{t('We couldn’t reach your care space.')}</h2>
                <button className="button secondary" onClick={refresh}>
                  {t('Try again')}
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
              {page === 'coverage' && <CoveragePage {...props} />}
              {page === 'requests' && <Requests {...props} />}
              {page === 'drills' && <Drills {...props} />}
              {page === 'history' && <History {...props} />}
              {page === 'settings' && <SettingsPage {...props} health={health} />}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <Heart size={13} />
            {t(' A little care goes a long way.')}
          </span>
          <span>{t('Care coordination prototype · Not an emergency service')}</span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          <ShieldCheck size={20} />
          {systemText(notice)}
          <button onClick={() => setNotice('')} aria-label={t('Dismiss message')}>
            <X size={16} />
          </button>
        </div>
      )}
      {error && (
        <div className="toast error" role="alert">
          <CircleHelp size={20} />
          {systemText(error)}
          <button onClick={() => setError('')} aria-label={t('Dismiss error')}>
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
