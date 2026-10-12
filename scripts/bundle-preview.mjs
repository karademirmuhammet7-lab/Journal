// Construit dist/preview.html : l'application en un seul fichier autonome
// (styles, scripts et édition intégrés), pratique pour un aperçu rapide.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

let html = await read('index.html');
const css = await read('assets/css/app.css');
const news = await read('data/news.json');
const icon = Buffer.from(await read('assets/icons/icon.svg')).toString('base64');

html = html
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="data:image/svg+xml;base64,${icon}">`)
  .replace(/<link rel="stylesheet" href="assets\/css\/app.css">/, () => `<style>\n${css}\n</style>`);

for (const js of ['i18n', 'icons', 'app']) {
  const code = await read(`assets/js/${js}.js`);
  html = html.replace(`<script src="assets/js/${js}.js"></script>`, () =>
    (js === 'i18n' ? `<script>window.__NEWS__ = ${news.replace(/</g, '\\u003c')};</script>\n  ` : '') + `<script>\n${code}\n</script>`);
}

// Aperçu hébergé (Artifact) : la page est insérée dans un document existant
// et les services externes (météo, position) n'y sont pas joignables.
const sample = `<script>
window.__SAMPLE_WEATHER__ = () => {
  const iso = (d) => d.toISOString().slice(0, 16);
  const h0 = new Date(); h0.setUTCMinutes(0, 0, 0); h0.setUTCHours(0);
  const time = [], temperature_2m = [], weather_code = [], precipitation_probability = [], is_day = [];
  const codes = [3, 2, 2, 61, 80, 3, 1];
  for (let i = 0; i < 24 * 7; i++) {
    const d = new Date(h0.getTime() + i * 3600e3), h = (d.getUTCHours() + 2) % 24, day = Math.floor(i / 24);
    time.push(iso(d));
    temperature_2m.push(9 + 5.5 * Math.max(0, Math.sin(((h - 7) / 14) * Math.PI)) - day * 0.3);
    weather_code.push(codes[day]);
    precipitation_probability.push([15, 10, 20, 75, 55, 30, 5][day]);
    is_day.push(h >= 8 && h < 19 ? 1 : 0);
  }
  const days = [...Array(7)].map((_, i) => new Date(h0.getTime() + i * 864e5).toISOString().slice(0, 10));
  const hNow = (new Date().getUTCHours() + 2) % 24;
  return {
    sample: true, fetchedAt: Date.now(), utc_offset_seconds: 0,
    current: { temperature_2m: 9 + 5.5 * Math.max(0, Math.sin(((hNow - 7) / 14) * Math.PI)), apparent_temperature: 11.2, relative_humidity_2m: 78, weather_code: 2, wind_speed_10m: 14, is_day: hNow >= 8 && hNow < 19 ? 1 : 0 },
    hourly: { time, temperature_2m, weather_code, precipitation_probability, is_day },
    daily: { time: days, weather_code: codes, temperature_2m_max: [15, 16, 15, 13, 12, 13, 15], temperature_2m_min: [9, 8, 9, 10, 8, 7, 6],
      sunrise: days.map((d) => d + 'T06:05'), sunset: days.map((d) => d + 'T16:52'), precipitation_probability_max: [15, 10, 20, 75, 55, 30, 5] },
  };
};
</script>
<style>html, body { height: 100%; } body { height: 100%; }</style>`;

const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/, '')
  .replace(/<\/html>\s*/, '')
  .replace(/<head>\s*/, '')
  .replace(/<\/head>\s*/, '')
  .replace(/<body[^>]*>/, '')
  .replace(/<\/body>/, '')
  .replace(/\s*<meta[^>]*>/g, '')
  .replace(title, '');
html = `${title}\n${html.replace('<script>window.__NEWS__', sample + '\n<script>window.__NEWS__')}`;

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/preview.html', root), html);
console.log(`dist/preview.html (${(html.length / 1024).toFixed(0)} Ko)`);
