const fs = require('fs');

const user = process.env.PROFILE_USER || 'quietdom';
const url = `https://github.com/users/${user}/contributions`;

const shift = (date, delta) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

(async () => {
  let page;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url, { headers: { 'user-agent': 'profile-stats' } });
    if (res.ok) {
      page = await res.text();
      break;
    }
    if (attempt === 2) throw new Error(`GitHub returned ${res.status}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const cells = [...page.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"/g)]
    .map((m) => ({ date: m[1], id: m[2] }));
  const tips = new Map([...page.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]+)<\/tool-tip>/g)]
    .map((m) => [m[1], m[2]]));

  const days = cells
    .map(({ date, id }) => {
      const match = (tips.get(id) || '').match(/([\d,]+)\s+contributions?/);
      return { date, count: match ? Number(match[1].replace(/,/g, '')) : 0 };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!days.length) throw new Error('contribution data not found');

  const counts = new Map(days.map((day) => [day.date, day.count]));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const active = days.filter((day) => day.count > 0).length;
  const best = Math.max(...days.map((day) => day.count));

  const today = new Date().toISOString().slice(0, 10);
  const last = days[days.length - 1].date;
  let cursor = today < last ? today : last;
  if (!counts.get(cursor) && counts.get(shift(cursor, -1)) > 0) cursor = shift(cursor, -1);
  let streak = 0;
  while (counts.get(cursor) > 0) {
    streak += 1;
    cursor = shift(cursor, -1);
  }

  const name = user.replace(/[<>&"]/g, '');
  const font = 'Segoe UI, Ubuntu, Helvetica Neue, sans-serif';
  const dayLabel = (value) => `${value} ${value === 1 ? 'day' : 'days'}`;
  const svg = `<svg width="440" height="140" viewBox="0 0 440 140" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name}: ${total.toLocaleString('en-US')} contributions in the last year">
  <rect x="0.5" y="0.5" width="439" height="139" rx="12" fill="#0D1117" stroke="#21262D"/>
  <text x="24" y="34" fill="#CAD3F5" font-family="${font}" font-size="16" font-weight="600">${name}_</text>
  <text x="416" y="34" text-anchor="end" fill="#8B949E" font-family="${font}" font-size="11">last 12 months · public + private</text>
  <text x="24" y="82" fill="#FFFFFF" font-family="${font}" font-size="34" font-weight="700">${total.toLocaleString('en-US')}</text>
  <text x="24" y="100" fill="#8B949E" font-family="${font}" font-size="11">contributions</text>
  <text x="24" y="124" fill="#8B949E" font-family="${font}" font-size="12">streak <tspan fill="#94C9FF" font-weight="600">${dayLabel(streak)}</tspan>   ·   active <tspan fill="#94C9FF" font-weight="600">${dayLabel(active)}</tspan>   ·   best <tspan fill="#94C9FF" font-weight="600">${best}</tspan></text>
</svg>
`;

  fs.writeFileSync('stats.svg', svg);
})();
