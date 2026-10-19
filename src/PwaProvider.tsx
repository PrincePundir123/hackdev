import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const Context = createContext({
  available: false,
  installed: false,
  busy: false,
  failed: false,
  install: async () => {},
});

export function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const sync = () =>
      setInstalled(
        display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      );
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setFailed(false);
    };
    const didInstall = () => {
      setInstalled(true);
      setPrompt(null);
      setFailed(false);
    };
    sync();
    display.addEventListener('change', sync);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', didInstall);
    if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .catch((error) => console.warn('Offline page registration failed:', error));
    }
    return () => {
      display.removeEventListener('change', sync);
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', didInstall);
    };
  }, []);
  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setFailed(true);
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }
  return (
    <Context.Provider value={{ available: !!prompt, installed, busy, failed, install }}>
      {children}
    </Context.Provider>
  );
}
export const usePwa = () => useContext(Context);
