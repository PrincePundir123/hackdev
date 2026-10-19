// Migration from ordered draft values to editable source-keyed dictionaries.
import { readFileSync, writeFileSync } from 'node:fs';
const keys = Object.keys(JSON.parse(readFileSync('src/locales/en.json', 'utf8')));
for (const code of process.argv.slice(2)) {
  const path = `src/locales/${code}.json`;
  const draft = JSON.parse(readFileSync(path, 'utf8'));
  if (Array.isArray(draft) && draft.length !== keys.length)
    throw new Error(`Incomplete draft: ${code}`);
  const dictionary = Object.fromEntries(
    keys.map((key, i) => {
      const value = Array.isArray(draft) ? draft[i] : draft[key];
      if (typeof value !== 'string') throw new Error(`Missing translation: ${code}: ${key}`);
      return [key, (key.match(/^\s*/)?.[0] || '') + value.trim() + (key.match(/\s*$/)?.[0] || '')];
    }),
  );
  writeFileSync(path, JSON.stringify(dictionary, null, 2) + '\n');
}
