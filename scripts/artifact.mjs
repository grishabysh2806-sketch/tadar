// Готовит страницу для публикации в просмотрщике claude.ai:
// без <!doctype>/<html>/<head>/<body> (их добавляет платформа), с относительными путями.
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head
  .split('\n')
  .filter((l) => !/<meta charset|<meta name="viewport"|rel="manifest"|rel="apple-touch-icon"|apple-mobile-web-app/.test(l))
  .join('\n');
const title = keep.match(/<title>[\s\S]*?<\/title>/)[0];
const rest = keep.replace(title, '');
const out = `${title}\n${rest.trim()}\n${body.trim()}\n`.replace(/(src|href)="\.\//g, '$1="');
writeFileSync('dist/tadar-app.html', out);
console.log(out.slice(0, 1600));
