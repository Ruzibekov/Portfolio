import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCaseCopy } from './site/work.mjs'
import {
  escapeHtml,
  lineBreaks,
  locales,
  origin,
  pagePath,
  serviceSlugs,
} from './site/shared.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destination = join(root, 'dist')
assert.ok(
  existsSync(join(destination, 'sitemap.xml')),
  'Run npm run build before static tests',
)
const attribute = (tag, name) =>
  tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1]
const links = (html) => html.match(/<link\b[^>]*>/gi) ?? []
const read = (path) => readFileSync(join(destination, path), 'utf8')
const expectedPaths = locales.flatMap((locale) => [
  pagePath(locale),
  pagePath(locale, 'work'),
  ...serviceSlugs.map((slug) => pagePath(locale, slug)),
])
const titles = new Set()
const cases = JSON.parse(
  readFileSync(join(root, 'content/cases.json'), 'utf8'),
).cases
assert.equal(cases.length, 29)
assert.equal(cases.filter((item) => item.categories.includes('web')).length, 17)
assert.equal(
  cases.filter((item) => item.categories.includes('mobile')).length,
  12,
)
assert.deepEqual(
  Object.fromEntries(
    cases
      .filter((item) => item.statusType !== 'public')
      .map((item) => [item.key, item.statusType]),
  ),
  {
    mynails: 'private',
    yolo: 'private',
    geoblinker: 'prototype',
    wallpapers: 'private',
    tildonmobile: 'private',
  },
)

function inspectPage(html, locale, slug) {
  const route = pagePath(locale, slug)
  const url = `${origin}${route}`
  assert.equal(
    attribute(html.match(/<html\b[^>]*>/i)?.[0] ?? '', 'lang'),
    locale,
    `Wrong HTML language at ${route}`,
  )
  assert.equal(
    (html.match(/<h1\b/gi) ?? []).length,
    1,
    `Expected one H1 at ${route}`,
  )
  assert.equal(
    links(html).filter((tag) => attribute(tag, 'rel') === 'canonical').length,
    1,
    `Expected one canonical at ${route}`,
  )
  assert.equal(
    attribute(
      links(html).find((tag) => attribute(tag, 'rel') === 'canonical') ?? '',
      'href',
    ),
    url,
    `Wrong canonical at ${route}`,
  )
  const alternates = links(html).filter(
    (tag) =>
      attribute(tag, 'rel') === 'alternate' && attribute(tag, 'hreflang'),
  )
  assert.equal(
    alternates.length,
    9,
    `Expected eight languages and x-default at ${route}`,
  )
  for (const language of [...locales, 'x-default']) {
    const matches = alternates.filter(
      (tag) => attribute(tag, 'hreflang') === language,
    )
    assert.equal(
      matches.length,
      1,
      `Duplicate/missing ${language} alternate at ${route}`,
    )
    assert.equal(
      attribute(matches[0], 'href'),
      `${origin}${pagePath(language === 'x-default' ? 'uz' : language, slug)}`,
      `Wrong alternate route at ${route}`,
    )
  }
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim()
  assert.ok(title?.length > 15, `Missing useful title at ${route}`)
  const description = (html.match(/<meta\b[^>]*>/gi) ?? []).find(
    (tag) => attribute(tag, 'name') === 'description',
  )
  assert.ok(
    attribute(description ?? '', 'content')?.length > 50,
    `Missing useful description at ${route}`,
  )
  assert.ok(
    html.includes('href="https://t.me/ruzibekov_sh"'),
    `Missing real Telegram contact at ${route}`,
  )
  assert.ok(
    html.includes('href="mailto:ruzibekov44@gmail.com"'),
    `Missing real email contact at ${route}`,
  )
  assert.doesNotMatch(
    html,
    /<meta\b[^>]*(?:name|http-equiv)=["'](?:robots|x-robots-tag)["'][^>]*content=["'][^"']*noindex/i,
    `Public page is noindex at ${route}`,
  )
  assert.doesNotMatch(
    html,
    /\.claude-state|redesign-v\d|contentStatus|PRESENTATION-VALIDATION|SEO-REDESIGN-PLAN/,
    `Internal draft output at ${route}`,
  )
  const schemas = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ]
  assert.equal(
    schemas.length,
    1,
    `Expected one structured data graph at ${route}`,
  )
  const schema = JSON.parse(schemas[0][1])
  assert.equal(schema['@context'], 'https://schema.org')
  const person = schema['@graph'].find((node) => node['@type'] === 'Person')
  assert.equal(person?.name, 'Shavkatbek Ruzibekov')
  assert.equal(person?.email, 'ruzibekov44@gmail.com')
  assert.deepEqual(person?.sameAs, ['https://t.me/ruzibekov_sh'])
  assert.ok(
    !person.address && !person.aggregateRating && !person.award,
    `Unsupported credential at ${route}`,
  )
  assert.ok(schema['@graph'].some((node) => node['@type'] === 'WebSite'))
  assert.equal(
    schema['@graph'].filter((node) => node['@type'] === 'Service').length,
    serviceSlugs.includes(slug) ? 1 : 0,
  )
  if (serviceSlugs.includes(slug))
    assert.equal(
      schema['@graph'].find((node) => node['@type'] === 'Service').url,
      url,
    )
  const ids = new Set(
    [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]),
  )
  for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
    const href = match[1].replace(/&amp;/g, '&')
    if (/^(?:https?:|mailto:|tel:|data:)/.test(href)) continue
    const [path, fragment] = href.split('#')
    if (!path && fragment)
      assert.ok(ids.has(fragment), `Broken in-page link ${href} at ${route}`)
    if (!path) continue
    assert.ok(
      path.startsWith('/'),
      `Relative public asset/link ${href} at ${route}`,
    )
    const target = path.split('?')[0]
    const targetFile = join(destination, target)
    assert.ok(
      existsSync(targetFile) || existsSync(join(targetFile, 'index.html')),
      `Missing public target ${href} at ${route}`,
    )
  }
  for (const language of locales)
    assert.ok(
      html.includes(`href="${pagePath(language, slug)}"`),
      `Language switch loses page family at ${route}`,
    )
  for (const related of serviceSlugs.filter(
    (item) => item !== slug && slug !== 'work',
  ))
    assert.ok(
      html.includes(`href="${pagePath(locale, related)}"`),
      `Missing service link ${related} at ${route}`,
    )
  return title
}

for (const locale of locales) {
  for (const slug of [null, 'work', ...serviceSlugs]) {
    const route = pagePath(locale, slug)
    const html = read(`${route.slice(1)}/index.html`)
    const title = inspectPage(html, locale, slug)
    assert.ok(!titles.has(title), `Duplicate SEO title at ${route}`)
    titles.add(title)
  }
}
assert.equal(titles.size, 56)
for (const locale of locales) {
  const translations = ['ru', 'en', 'uz'].includes(locale)
    ? Object.fromEntries(
        cases.map((item) => [item.key, item.translations[locale]]),
      )
    : JSON.parse(
        readFileSync(join(root, `content/case-copy/${locale}.json`), 'utf8'),
      )
  validateCaseCopy(cases, translations, locale)
  const html = read(`${locale}/work/index.html`)
  if (['en', 'uz'].includes(locale)) {
    assert.doesNotMatch(
      html,
      /Открыть|Приват|Прототип/u,
      `Untranslated generic Russian gallery controls in ${locale}`,
    )
    for (const item of cases) {
      const words = translations[item.key]
      assert.doesNotMatch(
        [...words.actions, words.status].join(' '),
        /Открыть|Приват|Прототип/u,
        `Untranslated generic controls for ${locale}/${item.key}`,
      )
      assert.equal(words.actions.length, item.links.length)
      item.translations.ru.actions.forEach((label, index) => {
        if (/^Открыть сайт\s*↗?$/u.test(label))
          assert.equal(
            words.actions[index],
            locale === 'en' ? 'Visit website ↗' : 'Saytni ochish ↗',
            `Wrong website action translation for ${locale}/${item.key}`,
          )
      })
    }
  }
  const articles = [
    ...html.matchAll(
      /<article\b[^>]*class="gallery-case"[^>]*>[\s\S]*?<\/article>/g,
    ),
  ].map((match) => match[0])
  assert.equal(articles.length, 29, `Missing source cases in ${locale} gallery`)
  assert.equal(
    new Set(
      articles.map((article) =>
        attribute(article.match(/<article\b[^>]*>/)[0], 'data-case-key'),
      ),
    ).size,
    29,
  )
  for (const item of cases) {
    const words = translations[item.key]
    const article = articles.find((value) =>
      value.includes(`data-case-key="${item.key}"`),
    )
    assert.ok(article, `Missing ${locale}/${item.key}`)
    assert.ok(article.includes(`data-source-status="${item.statusType}"`))
    assert.ok(article.includes(`data-category="${item.categories.join(' ')}"`))
    assert.ok(article.includes(`src="${item.image.src}"`))
    assert.ok(article.includes(`alt="${escapeHtml(words.alt)}"`))
    assert.ok(article.includes(`<h2>${escapeHtml(words.title)}</h2>`))
    assert.ok(article.includes(escapeHtml(words.summary)))
    assert.ok(article.includes(escapeHtml(item.stack)))
    for (const field of ['task', 'solution', 'result'])
      assert.ok(
        article.includes(
          `data-case-field="${field}">${escapeHtml(words[field])}</dd>`,
        ),
        `Missing real ${field} for ${locale}/${item.key}`,
      )
    assert.equal((article.match(/<details\b/g) ?? []).length, 1)
    for (const [index, link] of item.links.entries())
      assert.ok(
        article.includes(
          `href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(words.actions[index])}</a>`,
        ),
        `Source project link changed at ${locale}/${item.key}`,
      )
    if (item.statusType !== 'public')
      assert.ok(
        article.includes(
          `<span class="gallery-availability">${escapeHtml(words.status)}</span>`,
        ),
      )
  }
  assert.ok(html.includes('data-filter="all" aria-pressed="true"'))
  assert.ok(
    html.includes('<b>29</b>') &&
      html.includes('<b>17</b>') &&
      html.includes('<b>12</b>'),
  )
}
assert.equal(
  read('index.html'),
  read('uz/index.html'),
  'Root fallback must retain Uzbek canonical instead of creating a duplicate canonical route',
)
const sitemap = read('sitemap.xml')
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => match[1],
)
assert.deepEqual(
  new Set(sitemapUrls),
  new Set(expectedPaths.map((path) => `${origin}${path}`)),
)
assert.equal(sitemapUrls.length, 56)
assert.ok(
  sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'),
)
assert.ok(
  !sitemap.includes('hreflang'),
  'Language alternates belong in HTML heads',
)
const robots = read('robots.txt')
assert.match(robots, /^User-agent: \*\nAllow: \/\n/m)
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`))
const legacySource = readFileSync(
  join(root, 'content/legacy-portfolio.html'),
  'utf8',
)
const archive = read('portfolio/index.html')
const immutableRows = [
  ...legacySource.matchAll(
    /<article\b[^>]*class="work-row\b[^>]*>[\s\S]*?<\/article>/g,
  ),
].map((match) => match[0])
for (const item of cases) {
  const row = immutableRows.find((value) =>
    value.includes(`data-i18n="work.${item.key}.desc"`),
  )
  assert.ok(row, `Case disappeared from immutable source: ${item.key}`)
  assert.deepEqual(
    item.links.map((link) => link.href),
    [...row.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1]),
    `Actual source project URLs changed for ${item.key}`,
  )
}
assert.equal(
  attribute(
    links(archive).find((tag) => attribute(tag, 'rel') === 'canonical'),
    'href',
  ),
  `${origin}/portfolio`,
)
assert.match(archive, /<meta name="robots" content="noindex, follow">/)
const sourceCases =
  legacySource.match(/<article\b[^>]*class="work-row\b/g) ?? []
assert.equal(sourceCases.length, 29, 'Original case count changed')
assert.equal(
  (archive.match(/<article\b[^>]*class="work-row\b/g) ?? []).length,
  29,
)
assert.ok(archive.includes('id="miyolo"'))
assert.ok(archive.includes('src="/assets/i18n.js'))
assert.ok(archive.includes('src="/assets/i18n-en.js'))
assert.ok(archive.includes('src="/assets/i18n-uz.js'))
assert.doesNotMatch(archive, /\b(?:src|href)=["'](?:assets|screenshots)\//)
const archiveLinks = (html) =>
  [
    ...html
      .replace(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*>/gi, '')
      .matchAll(/href="((?:https?:|mailto:)[^"]+)"/g),
  ].map((match) => match[1])
assert.deepEqual(
  archiveLinks(archive),
  archiveLinks(legacySource),
  'Original external portfolio links changed',
)
const walk = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(directory, entry.name))
      : [join(directory, entry.name)],
  )
const files = walk(destination)
assert.equal(files.filter((path) => path.endsWith('.html')).length, 58)
assert.ok(
  files.every(
    (path) =>
      !/(?:^|\/)(?:\.claude-state|node_modules|\.env|content|scripts)(?:\/|$)/.test(
        path.slice(destination.length),
      ),
  ),
)
assert.equal(escapeHtml('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;')
assert.equal(lineBreaks('A\\n<B>\nC'), 'A<br>&lt;B&gt;<br>C')
assert.throws(() => pagePath('xx'), /Unsupported locale/)
assert.throws(() => pagePath('uz', '../private'), /Unknown service/)
const sourceUzbek = Object.fromEntries(
  cases.map((item) => [item.key, item.translations.uz]),
)
const missingCaseCopy = structuredClone(sourceUzbek)
delete missingCaseCopy.mynails
assert.throws(
  () => validateCaseCopy(cases, missingCaseCopy, 'uz'),
  /translation keys/,
)
const wrongPrivateCopy = structuredClone(sourceUzbek)
wrongPrivateCopy.mynails.status = ''
assert.throws(
  () => validateCaseCopy(cases, wrongPrivateCopy, 'uz'),
  /source status/,
)
const wrongLinkCopy = structuredClone(sourceUzbek)
wrongLinkCopy.miyolo.actions = []
assert.throws(
  () => validateCaseCopy(cases, wrongLinkCopy, 'uz'),
  /Action labels/,
)
const valid = read('ru/services/mobile-apps/index.html')
assert.throws(
  () =>
    inspectPage(
      valid.replace(
        `${origin}/ru/services/mobile-apps`,
        `${origin}/be/services/mobile-apps`,
      ),
      'ru',
      'mobile-apps',
    ),
  /Wrong canonical/,
)
assert.throws(
  () =>
    inspectPage(
      valid.replace('hreflang="ky"', 'hreflang="en"'),
      'ru',
      'mobile-apps',
    ),
  /Duplicate\/missing/,
)
assert.throws(
  () =>
    inspectPage(
      valid.replace(
        'href="mailto:ruzibekov44@gmail.com"',
        'href="mailto:wrong@example.com"',
      ),
      'ru',
      'mobile-apps',
    ),
  /Missing real email/,
)
console.log(
  'Static verification passed: 56 canonical multilingual pages, reciprocal alternates, truthful metadata, real contacts, public assets, 29 preserved cases per gallery and controlled failure checks.',
)
