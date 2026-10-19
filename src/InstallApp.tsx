import { Download, CheckCircle2, Smartphone } from 'lucide-react';
import { t } from './i18n';
import { usePwa } from './PwaProvider';
import { SectionTitle } from './components';

export default function InstallApp() {
  const { available, installed, busy, failed, install } = usePwa();
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return (
    <section className="card install-card" data-testid="install-app">
      <SectionTitle title={t('Install Saathi')} action={<Smartphone size={22} />} />
      <p>{t('Keep Saathi on your home screen.')}</p>
      {installed ? (
        <p className="install-status" role="status">
          <CheckCircle2 size={20} />
          {t('App installed')}
        </p>
      ) : available ? (
        <button className="button primary" disabled={busy} onClick={install}>
          <Download size={18} />
          {t('Install app')}
        </button>
      ) : (
        <p className="install-instructions">
          {ios
            ? t('On iPhone or iPad, open Share and choose Add to Home Screen.')
            : t(
                'In your browser, open the menu and look for Install app or Add to Home Screen. Availability depends on your browser.',
              )}
        </p>
      )}
      {failed && (
        <p className="error-message" role="alert">
          {t('Installation could not start. Try your browser menu.')}
        </p>
      )}
      <p className="fine-print">
        {t(
          'Care updates need an internet connection. Private care records are not saved for offline use.',
        )}
      </p>
    </section>
  );
}
