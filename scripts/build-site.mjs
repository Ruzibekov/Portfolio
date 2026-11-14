import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as shared from './site/shared.mjs'
import { renderService, serviceFaq } from './site/service.mjs'
import { renderWork, validateCaseCopy } from './site/work.mjs'
import { renderCase } from './site/case.mjs'
import { validateProjectMedia } from './site/project.mjs'
import {
  bundledSources,
  fontLicenses,
  imageSrc,
  script,
  stylesheet,
  versioned,
} from './site/assets.mjs'

const legacyImageWidth = 700
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
const portfolio = readJson('content/portfolio-b.json')
const cases = readJson('content/cases.json').cases
if (
  !Array.isArray(cases) ||
  cases.length !== 30 ||
  new Set(cases.map((item) => item.key)).size !== 30
)
  throw new Error('Expected all 30 unique portfolio cases')
validateProjectMedia(cases)
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
    const bento = ui.services.bento
    if (
      !bento?.proof ||
      !bento.chat?.start ||
      !bento.chat.ask ||
      !bento.chat.cap ||
      bento.chat.opts?.length !== 3
    )
      throw new Error(`Incomplete services bento copy for ${locale}`)
    for (const slug of shared.serviceSlugs) {
      const service = copy.services[slug]
      if (
        !service.name ||
        !service.short ||
        !service.pitch ||
        service.tags?.length !== 3 ||
        !service.description ||
        service.useCases?.length !== 3 ||
        !service.seo?.title ||
        !service.seo?.description
      )
        throw new Error(`Incomplete service content for ${locale}/${slug}`)
      serviceFaq(copy, slug)
    }
    return [locale, { copy, ui }]
  }),
)

const sourceAssets = [
  ...bundledSources,
  'assets/og-products.png',
  'assets/og-products-square.png',
  'assets/avatar.jpg',
  ...fontLicenses.map((path) => path.slice(1)),
  'favicon.svg',
  'og-image.png',
]
for (const path of sourceAssets)
  if (!existsSync(join(root, path)))
    throw new Error(`Required public asset is missing: ${path}`)
if (!existsSync(join(root, 'content/legacy-portfolio.html')))
  throw new Error(
    'The original portfolio archive is missing: content/legacy-portfolio.html',
  )

rmSync(destination, { recursive: true, force: true })
mkdirSync(destination, { recursive: true })
for (const file of readdirSync(root).filter(
  (name) =>
    name === 'favicon.svg' ||
    /^og-image\.(?:png|jpg|jpeg|webp|avif)$/.test(name),
))
  cpSync(join(root, file), join(destination, file))
const writeAsset = (publicPath, content) => {
  const target = join(destination, publicPath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}
writeAsset(stylesheet.path, stylesheet.content)
writeAsset(script.path, script.content)

const pages = []
const writePage = (path, html) => {
  if (typeof html !== 'string' || !html.includes('<!doctype html>'))
    throw new Error(`Renderer returned invalid HTML for ${path}`)
  const target = join(destination, path, 'index.html')
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, html)
  pages.push(html)
}
const canonicalPaths = []
for (const locale of shared.locales) {
  const { copy, ui } = content[locale]
  const html = await renderHome({
    locale,
    copy,
    ui,
    words: portfolio[locale],
    cases,
    caseCopy: caseCopies[locale],
    shared,
  })
  writePage(locale, html)
  if (locale === 'uz') writePage('', html)
  canonicalPaths.push(shared.pagePath(locale))
  writePage(
    `${locale}/work`,
    renderWork({
      locale,
      copy,
      ui,
      words: portfolio[locale],
      cases,
      caseCopy: caseCopies[locale],
    }),
  )
  canonicalPaths.push(shared.pagePath(locale, 'work'))
  for (const key of shared.caseKeys) {
    const path = shared.casePath(locale, key)
    writePage(
      path.slice(1),
      renderCase({
        locale,
        copy,
        ui,
        words: portfolio[locale],
        cases,
        caseCopy: caseCopies[locale],
        key,
      }),
    )
    canonicalPaths.push(path)
  }
  for (const slug of shared.serviceSlugs) {
    writePage(
      `${locale}/services/${slug}`,
      renderService({
        locale,
        copy,
        ui,
        words: portfolio[locale],
        slug,
        cases,
        caseCopy: caseCopies[locale],
      }),
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
  .replace(
    /(["'])(\/assets\/[^"'?#\s]+)(?:\?v=[^"'#\s]*)?\1/g,
    (_, quote, path) => `${quote}${versioned(path)}${quote}`,
  )
  .replace(
    /(["'])\/screenshots\/([a-z0-9-]+)\.webp\1/g,
    (_, quote, key) => `${quote}${imageSrc(key, legacyImageWidth)}${quote}`,
  )
  .replace('</head>', '<meta name="robots" content="noindex, follow">\n</head>')
writePage('portfolio', archive)
const referenced = new Set(
  [stylesheet.content, ...pages].flatMap((text) =>
    [
      ...text.matchAll(
        /\/(?:assets|screenshots|projects\/screenshots)\/[^"'()\s?#,]+/g,
      ),
    ].map((match) => match[0]),
  ),
)
for (const license of fontLicenses) referenced.add(license)
for (const publicPath of referenced) {
  if (existsSync(join(destination, publicPath))) continue
  const source = join(root, publicPath)
  if (!existsSync(source))
    throw new Error(`Referenced public file is missing: ${publicPath}`)
  writeAsset(publicPath, readFileSync(source))
}
writeFileSync(
  join(destination, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${canonicalPaths.map((path) => `  <url><loc>${shared.absoluteUrl(path)}</loc></url>`).join('\n')}\n</urlset>\n`,
)
writeFileSync(
  join(destination, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${shared.origin}/sitemap.xml\n`,
)
writeFileSync(
  join(destination, `${shared.indexNowKey}.txt`),
  shared.indexNowKey,
)
console.log(
  `Built ${canonicalPaths.length} canonical pages, Uzbek root fallback and preserved portfolio archive in dist/.`,
)
