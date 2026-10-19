import { useState } from 'react';
import { api } from './api';
import { languages, prepareLanguage, setLanguage, t, useLanguage } from './i18n';
import type { User } from './types';

export default function LanguagePicker({
  user,
  onSaved,
}: {
  user?: User;
  onSaved?: (user: User) => void;
}) {
  const language = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="language-picker">
      <label>
        <span>{t('Language')}</span>
        <select
          aria-label={t('Choose your language')}
          value={language}
          disabled={busy}
          onChange={async (event) => {
            const next = event.target.value;
            setBusy(true);
            setError('');
            try {
              await prepareLanguage(next);
              if (user) {
                const saved = await api<{ user: User }>(
                  '/auth/preferences',
                  { language: next },
                  'PATCH',
                );
                await setLanguage(next);
                onSaved?.(saved.user);
              } else await setLanguage(next);
            } catch {
              setError(t('Could not save your language. Please try again.'));
            } finally {
              setBusy(false);
            }
          }}
        >
          {languages
            .filter((entry) => entry.available)
            .map((entry) => (
              <option key={entry.code} value={entry.code} lang={entry.code}>
                {entry.native}
                {entry.code === 'en' ? '' : ` · ${entry.name}`}
              </option>
            ))}
        </select>
      </label>
      {busy && <span role="status">{t('Saving…')}</span>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
