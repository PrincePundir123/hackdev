import parser from 'prettier/plugins/typescript';
import { readFileSync } from 'node:fs';
let violations = 0;
for (const name of ['App', 'AuthPage', 'pages', 'dialogs', 'components', 'CoveragePage']) {
  const ast = await parser.parsers.typescript.parse(readFileSync(`src/${name}.tsx`, 'utf8'));
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXText' && /[A-Za-z]/.test(node.value) && node.value.trim() !== 'saathi') {
      console.error(name, JSON.stringify(node.value.trim()));
      violations++;
    }
    for (const [key, value] of Object.entries(node))
      if (!['tokens', 'comments', 'loc'].includes(key)) {
        if (Array.isArray(value)) value.forEach(walk);
        else walk(value);
      }
  }
  walk(ast);
}
if (violations) process.exitCode = 1;
else console.log('No unlocalized literal UI text found (brand name excluded).');
