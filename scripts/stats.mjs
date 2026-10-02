// Renders assets/stats.svg from the public GitHub API (public repos only).
// Usage: GITHUB_TOKEN=... node scripts/stats.mjs [login]
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const login = process.argv[2] || process.env.GITHUB_ACTOR || 'kcgoofee-jpg'
const token = process.env.GITHUB_TOKEN
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'profile-stats' }
if (token) headers.Authorization = `Bearer ${token}`

async function api(path) {
  const r = await fetch(`https://api.github.com${path}`, { headers })
  if (!r.ok) throw new Error(`${path} -> ${r.status}`)
  return r.json()
}

const user = await api(`/users/${login}`)
const repos = (await api(`/users/${login}/repos?type=owner&per_page=100`)).filter((r) => !r.fork && !r.private)

const stars = repos.reduce((n, r) => n + r.stargazers_count, 0)
const lastPush = repos.map((r) => r.pushed_at).sort().at(-1)
const bytes = {}
for (const r of repos) {
  const langs = await api(`/repos/${login}/${r.name}/languages`)
  for (const [k, v] of Object.entries(langs)) bytes[k] = (bytes[k] || 0) + v
}
const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1
const top = Object.entries(bytes).sort((a, b) => b[1] - a[1]).slice(0, 5)

const palette = ['#00f0ff', '#ff2bd6', '#c08a55', '#7b61ff', '#39ff88']
const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const daysAgo = lastPush ? Math.max(0, Math.round((Date.now() - Date.parse(lastPush)) / 864e5)) : null

const tiles = [
  ['PUBLIC REPOS', repos.length],
  ['STARS', stars],
  ['FOLLOWERS', user.followers],
  ['LAST PUSH', daysAgo === null ? '-' : daysAgo === 0 ? 'today' : `${daysAgo}d ago`],
]

let x = 40
const tileSvg = tiles.map(([label, value], i) => {
  const out = `<g transform="translate(${x},44)">
    <rect width="205" height="84" rx="10" fill="#0b0f24" stroke="${palette[i]}" stroke-opacity="0.55"/>
    <text x="16" y="30" font-family="${mono}" font-size="11" fill="#6f7fb0" letter-spacing="1.5">${label}</text>
    <text x="16" y="66" font-family="${mono}" font-size="30" font-weight="700" fill="${palette[i]}">${esc(value)}</text>
  </g>`
  x += 225
  return out
}).join('\n')

let bx = 40
const barW = 920
const segs = top.map(([name, v], i) => {
  const w = Math.max(4, (v / total) * barW)
  const s = `<rect x="${bx}" y="168" width="${w.toFixed(1)}" height="12" fill="${palette[i]}"/>`
  bx += w
  return s
}).join('')
const legend = top.map(([name, v], i) => {
  const lx = 40 + i * 184
  return `<g transform="translate(${lx},206)"><circle cx="5" cy="-4" r="5" fill="${palette[i]}"/>
    <text x="16" y="0" font-family="${mono}" font-size="13" fill="#d6e4ff">${esc(name)} <tspan fill="#6f7fb0">${((v / total) * 100).toFixed(1)}%</tspan></text></g>`
}).join('\n')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 240" width="1000" height="240" role="img" aria-label="GitHub stats for ${esc(login)}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#05060f"/><stop offset="1" stop-color="#140a26"/></linearGradient>
  <clipPath id="bar"><rect x="40" y="168" width="${barW}" height="12" rx="6"/></clipPath></defs>
  <rect width="1000" height="240" rx="14" fill="url(#bg)" stroke="#1d2a55"/>
  <text x="40" y="30" font-family="${mono}" font-size="13" fill="#00f0ff" letter-spacing="2">// LIVE STATS · @${esc(login)}</text>
  ${tileSvg}
  <text x="40" y="154" font-family="${mono}" font-size="11" fill="#6f7fb0" letter-spacing="1.5">TOP LANGUAGES · PUBLIC REPOS</text>
  <g clip-path="url(#bar)">${segs}</g>
  ${legend}
</svg>
`

const out = fileURLToPath(new URL('../assets/stats.svg', import.meta.url))
mkdirSync(fileURLToPath(new URL('../assets', import.meta.url)), { recursive: true })
writeFileSync(out, svg)
console.log(`wrote ${out}: ${repos.length} repos, ${stars} stars, ${top.map((t) => t[0]).join('/')}`)
