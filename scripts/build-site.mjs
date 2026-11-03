import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as shared from './site/shared.mjs'
import { renderService } from './site/service.mjs'
import { renderWork, validateCaseCopy } from './site/work.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destination = join(root, 'dist')
const homeModule = join(root, 'scripts/site/home.mjs')
if (!existsSync(homeModule))
  throw new Error(
    'Home renderer is missing: implement scripts/site/home.mjs with export renderHome({ locale, copy, ui, shared }) before building.',
  )
const { renderHome } = await import('./site/home.mjs')
if (typeof renderHome !== 'function')
  throw new Error(
    'scripts/site/home.mjs must export renderHome({ locale, copy, ui, shared }).',
  )

const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'))
const presentation = readJson('content/locales/presentation.json')
const cases = readJson('content/cases.json').cases
if (
  !Array.isArray(cases) ||
  cases.length !== 29 ||
  new Set(cases.map((item) => item.key)).size !== 29
)
  throw new Error('Expected all 29 unique source portfolio cases')
const caseCopies = Object.fromEntries(
  shared.locales.map((locale) => {
    const translations = ['ru', 'en', 'uz'].includes(locale)
      ? Object.fromEntries(
          cases.map((item) => [item.key, item.translations[locale]]),
        )
      : readJson(`content/case-copy/${locale}.json`)
    validateCaseCopy(cases, translations, locale)
    return [locale, translations]
  }),
)
const content = Object.fromEntries(
  shared.locales.map((locale) => {
    const copy = readJson(`content/locales/${locale}.json`)
    const ui = presentation.locales[locale]
    if (
      copy.locale !== locale ||
      !ui ||
      !copy.seo?.title ||
      !copy.seo?.description
    )
      throw new Error(`Invalid homepage content for ${locale}`)
    if (
      Object.keys(copy.services).sort().join(',') !==
      [...shared.serviceSlugs].sort().join(',')
    )
      throw new Error(`Unexpected service families for ${locale}`)
    for (const slug of shared.serviceSlugs) {
      const service = copy.services[slug]
      if (
        !service.name ||
        !service.description ||
        service.useCases?.length !== 3 ||
        !service.seo?.title ||
        !service.seo?.description
      )
        throw new Error(`Incomplete service content for ${locale}/${slug}`)
    }
    return [locale, { copy, ui }]
  }),
)

const publicAssets = [
  'assets/fonts.css',
  'assets/og-products.png',
  'assets/site.css',
  'assets/site.js',
  'assets/theme-init.js',
  'assets/bento.css',
  'assets/services.css',
  'assets/work-gallery.css',
  'favicon.svg',
  'og-image.png',
]
for (const path of publicAssets)
  if (!existsSync(join(root, path)))
    throw new Error(`Required public asset is missing: ${path}`)
if (!existsSync(join(root, 'content/legacy-portfolio.html')))
  throw new Error(
    'The original portfolio archive is missing: content/legacy-portfolio.html',
  )
const allowedExtensions = new Set([
  '.css',
  '.js',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.mp4',
  '.webm',
])
const isPublicAsset = (path) => {
  const entry = path.split('/').at(-1)
  if (entry.startsWith('.')) return false
  return (
    existsSync(path) &&
    (!extname(path) || allowedExtensions.has(extname(path).toLowerCase()))
  )
}

rmSync(destination, { recursive: true, force: true })
mkdirSync(destination, { recursive: true })
for (const directory of ['assets', 'screenshots', 'projects/screenshots']) {
  const source = join(root, directory)
  if (existsSync(source))
    cpSync(source, join(destination, directory), {
      recursive: true,
      dereference: false,
      filter: isPublicAsset,
    })
}
for (const file of readdirSync(root).filter(
  (name) =>
    name === 'favicon.svg' ||
    /^og-image\.(?:png|jpg|jpeg|webp|avif)$/.test(name),
))
  cpSync(join(root, file), join(destination, file))

const writePage = (path, html) => {
  if (typeof html !== 'string' || !html.includes('<!doctype html>'))
    throw new Error(`Renderer returned invalid HTML for ${path}`)
  const target = join(destination, path, 'index.html')
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, html)
}
const canonicalPaths = []
for (const locale of shared.locales) {
  const { copy, ui } = content[locale]
  const html = await renderHome({ locale, copy, ui, shared })
  writePage(locale, html)
  if (locale === 'uz') writePage('', html)
  canonicalPaths.push(shared.pagePath(locale))
  writePage(
    `${locale}/work`,
    renderWork({ locale, copy, ui, cases, caseCopy: caseCopies[locale] }),
  )
  canonicalPaths.push(shared.pagePath(locale, 'work'))
  for (const slug of shared.serviceSlugs) {
    writePage(
      `${locale}/services/${slug}`,
      renderService({ locale, copy, ui, slug }),
    )
    canonicalPaths.push(shared.pagePath(locale, slug))
  }
}
const legacy = readFileSync(join(root, 'content/legacy-portfolio.html'), 'utf8')
const archive = legacy
  .replace(
    /\b(href|src|poster)=(['"])(?:\.\/)?((?:assets\/|screenshots\/|projects\/screenshots\/|favicon\.svg|og-image\.)[^'"\s]*)\2/g,
    '$1=$2/$3$2',
  )
  .replace(
    /<link\b(?=[^>]*rel=["']canonical["'])[^>]*>/gi,
    `<link rel="canonical" href="${shared.origin}/portfolio">`,
  )
  .replace('</head>', '<meta name="robots" content="noindex, follow">\n</head>')
writePage('portfolio', archive)
writeFileSync(
  join(destination, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${canonicalPaths.map((path) => `  <url><loc>${shared.absoluteUrl(path)}</loc></url>`).join('\n')}\n</urlset>\n`,
)
writeFileSync(
  join(destination, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${shared.origin}/sitemap.xml\n`,
)
console.log(
  `Built ${canonicalPaths.length} canonical pages, Uzbek root fallback and preserved portfolio archive in dist/.`,
)
