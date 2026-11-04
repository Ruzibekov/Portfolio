import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCaseCopy } from './site/work.mjs'
import { serviceFaq } from './site/service.mjs'
import {
  caseKeys,
  casePath,
  caseSlug,
  escapeHtml,
  lineBreaks,
  locales,
  origin,
  pagePath,
  serviceSlugs,
} from './site/shared.mjs'
import { caseServices, caseStack } from './site/case.mjs'
import {
  darkCanvas,
  fontPreloads,
  imageEntry,
  imageSrc,
  script,
  stylesheet,
  versioned,
} from './site/assets.mjs'
import { galleryLabels } from './site/work.mjs'

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
const caseSlugs = caseKeys.map(caseSlug)
const pageSlugs = [null, 'work', ...serviceSlugs, ...caseSlugs]
const expectedPaths = locales.flatMap((locale) =>
  pageSlugs.map((slug) => pagePath(locale, slug)),
)
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'))
const localeCopy = Object.fromEntries(
  locales.map((locale) => [locale, readJson(`content/locales/${locale}.json`)]),
)
const futureCopy = readJson('content/future-ui.json').locales
const decodeHtml = (value) =>
  value
    .replace(/<br>/g, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
const visibleFaq = (html) =>
  [
    ...html.matchAll(
      /<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g,
    ),
  ].map((match) => ({
    question: decodeHtml(match[1]),
    answer: decodeHtml(match[2]),
  }))
const graphNodes = (schema, type) =>
  schema['@graph'].filter((node) => node['@type'] === type)
function assertBreadcrumb(schema, route, names) {
  const [breadcrumb] = graphNodes(schema, 'BreadcrumbList')
  assert.ok(breadcrumb, `Missing BreadcrumbList at ${route}`)
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.name),
    names,
    `Wrong breadcrumb names at ${route}`,
  )
  assert.equal(
    breadcrumb.itemListElement.at(-1).item,
    `${origin}${route}`,
    `Breadcrumb must end at the page itself at ${route}`,
  )
  breadcrumb.itemListElement.forEach((item, index) =>
    assert.equal(item.position, index + 1),
  )
}
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
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? ''
  assert.equal(
    attribute(htmlTag, 'data-theme'),
    'dark',
    `Default theme is not dark at ${route}`,
  )
  assert.ok(
    html.includes(
      `<meta name="theme-color" content="${darkCanvas}" id="themeColorMeta">`,
    ),
    `Theme colour does not match the dark canvas at ${route}`,
  )
  const stylesheets = links(html).filter(
    (tag) => attribute(tag, 'rel') === 'stylesheet',
  )
  assert.deepEqual(
    stylesheets.map((tag) => attribute(tag, 'href')),
    [stylesheet.path],
    `Expected exactly one stylesheet bundle at ${route}`,
  )
  assert.deepEqual(
    links(html)
      .filter((tag) => attribute(tag, 'rel') === 'preload')
      .map((tag) => attribute(tag, 'href')),
    fontPreloads(locale),
    `Wrong font preloads at ${route}`,
  )
  assert.ok(
    html.includes(`<script src="${script.path}" defer></script>`),
    `Missing fingerprinted script at ${route}`,
  )
  assert.equal(
    (html.match(/<script\b[^>]*\bsrc=/gi) ?? []).length,
    1,
    `Unexpected external script at ${route}`,
  )
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
  assert.ok(!schemas[0][1].includes('<'), `Unescaped JSON-LD at ${route}`)
  const schema = JSON.parse(schemas[0][1])
  assert.equal(schema['@context'], 'https://schema.org')
  const copy = localeCopy[locale]
  const person = schema['@graph'].find((node) => node['@type'] === 'Person')
  assert.equal(person?.name, 'Shavkatbek Ruzibekov')
  assert.equal(person?.jobTitle, copy.identity.role)
  assert.equal(person?.image, `${origin}${versioned('/assets/avatar.jpg')}`)
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
  if (serviceSlugs.includes(slug)) {
    const [service] = graphNodes(schema, 'Service')
    assert.equal(service.url, url)
    assert.equal(service.name, copy.services[slug].name)
    assert.deepEqual(
      service.areaServed.map((area) => [area['@type'], area.name]),
      [
        'Uzbekistan',
        'Kazakhstan',
        'Kyrgyzstan',
        'Tajikistan',
        'Russia',
        'Ukraine',
        'Belarus',
      ].map((name) => ['Country', name]),
    )
    assert.deepEqual(
      service.availableLanguage.map((language) => language.alternateName),
      locales,
    )
    assertBreadcrumb(schema, route, [
      copy.navigation.home,
      copy.services[slug].name,
    ])
    const proofCases = {
      'web-development': ['monarh', 'miyolo'],
      'telegram-bots': [],
      'mobile-apps': ['okh', 'miyolo'],
      'business-automation': ['agentmama'],
      'ai-integrations': ['agentmama'],
    }
    for (const key of proofCases[slug])
      assert.ok(
        html.includes(`href="${casePath(locale, key)}"`),
        `Service proof must link to its detailed case: ${route}/${key}`,
      )
    if (['ru', 'be', 'uk'].includes(locale)) {
      assert.ok(
        Array.isArray(copy.services[slug].faq) &&
          copy.services[slug].faq.length >= 3,
        `Missing service-specific FAQ at ${route}`,
      )
      assert.ok(
        copy.services[slug].faq.some(
          ({ question }) =>
            !copy.faq.some((item) => item.question === question),
        ),
        `Service FAQ only repeats the homepage at ${route}`,
      )
    }
  }
  const faqPages = graphNodes(schema, 'FAQPage')
  if (slug === null || serviceSlugs.includes(slug)) {
    assert.equal(faqPages.length, 1, `Missing FAQPage at ${route}`)
    const visible = visibleFaq(html)
    assert.ok(visible.length > 0, `Missing visible FAQ at ${route}`)
    assert.deepEqual(
      faqPages[0].mainEntity.map((entry) => ({
        question: entry.name,
        answer: entry.acceptedAnswer.text,
      })),
      visible,
      `FAQPage differs from visible FAQ at ${route}`,
    )
    const expected =
      slug === null
        ? [
            ...copy.faq,
            {
              question: futureCopy[locale].faq.aiQuestion,
              answer: futureCopy[locale].faq.aiAnswer,
            },
          ]
        : serviceFaq(copy, slug)
    assert.deepEqual(
      visible,
      expected.map(({ question, answer }) => ({ question, answer })),
      `Visible FAQ differs from source copy at ${route}`,
    )
  } else assert.equal(faqPages.length, 0, `Unexpected FAQPage at ${route}`)
  if (slug === 'work')
    assertBreadcrumb(schema, route, [
      copy.navigation.home,
      copy.navigation.work,
    ])
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
    (item) => item !== slug && (slug === null || serviceSlugs.includes(slug)),
  ))
    assert.ok(
      html.includes(`href="${pagePath(locale, related)}"`),
      `Missing service link ${related} at ${route}`,
    )
  return title
}

for (const locale of locales) {
  for (const slug of pageSlugs) {
    const route = pagePath(locale, slug)
    const html = read(`${route.slice(1)}/index.html`)
    const title = inspectPage(html, locale, slug)
    assert.ok(!titles.has(title), `Duplicate SEO title at ${route}`)
    titles.add(title)
  }
}
assert.equal(titles.size, 104)
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
    assert.ok(article.includes(`src="${imageSrc(item.image)}"`))
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
assert.equal(sitemapUrls.length, 104)
const caseTranslations = (locale) =>
  ['ru', 'en', 'uz'].includes(locale)
    ? Object.fromEntries(
        cases.map((item) => [item.key, item.translations[locale]]),
      )
    : readJson(`content/case-copy/${locale}.json`)
for (const locale of locales) {
  const copy = localeCopy[locale]
  const translations = caseTranslations(locale)
  const home = read(`${locale}/index.html`)
  for (const key of ['agentmama', 'monarh', 'miyolo', 'okh'])
    assert.ok(
      home.includes(
        `<a class="case-title-link" href="${casePath(locale, key)}">`,
      ),
      `Home card does not open the case page ${locale}/${key}`,
    )
  const gallery = read(`${locale}/work/index.html`)
  for (const key of caseKeys)
    assert.ok(
      gallery.includes(
        `<a class="gallery-case-link" href="${casePath(locale, key)}">${escapeHtml(copy.caseStudy.openCase)}`,
      ),
      `Gallery does not link the case page ${locale}/${key}`,
    )
  caseKeys.forEach((key, index) => {
    const item = cases.find((entry) => entry.key === key)
    const words = translations[key]
    const route = casePath(locale, key)
    const url = `${origin}${route}`
    const html = read(`${route.slice(1)}/index.html`)
    assert.ok(
      html.includes(`<h1 id="case-title">${escapeHtml(words.title)}</h1>`),
      `Wrong case heading at ${route}`,
    )
    assert.ok(html.includes(escapeHtml(words.summary)))
    const hero =
      html.match(/<figure class="wrap case-shot">(<img\b[^>]*>)/)?.[1] ?? ''
    assert.ok(
      attribute(hero, 'src') === imageSrc(item.image) &&
        hero.includes(`alt="${escapeHtml(words.alt)}"`) &&
        attribute(hero, 'fetchpriority') === 'high' &&
        !attribute(hero, 'loading'),
      `Missing eager localized hero image at ${route}`,
    )
    for (const field of ['task', 'solution', 'result']) {
      assert.ok(
        html.includes(
          `>${escapeHtml(galleryLabels[locale][field])}</h2><p data-case-field="${field}">${escapeHtml(words[field])}</p>`,
        ),
        `Missing localized ${field} at ${route}`,
      )
    }
    for (const part of caseStack(item))
      assert.ok(html.includes(`<li>${escapeHtml(part)}</li>`))
    item.links.forEach((link, linkIndex) =>
      assert.ok(
        html.includes(
          `href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(words.actions[linkIndex])}</a>`,
        ),
        `Missing external case link at ${route}`,
      ),
    )
    for (const slug of caseServices(item))
      assert.ok(
        html.includes(
          `href="${pagePath(locale, slug)}"><span>${escapeHtml(copy.services[slug].name)}</span>`,
        ),
        `Missing related service ${slug} at ${route}`,
      )
    assert.ok(
      html.includes(
        `href="${copy.identity.contact.telegram}" target="_blank" rel="noopener noreferrer"><span class="button-content">${escapeHtml(copy.hero.primaryCta)}`,
      ),
      `Missing case CTA at ${route}`,
    )
    const previous = caseKeys.at(index - 1)
    const next = caseKeys[(index + 1) % caseKeys.length]
    assert.ok(html.includes(`href="${casePath(locale, previous)}" rel="prev"`))
    assert.ok(html.includes(`href="${casePath(locale, next)}" rel="next"`))
    assert.ok(sitemapUrls.includes(url), `Case page missing in sitemap ${url}`)
    const schema = JSON.parse(
      html.match(
        /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
      )[1],
    )
    assertBreadcrumb(schema, route, [
      copy.navigation.home,
      copy.navigation.work,
      words.title,
    ])
    const [work] = graphNodes(schema, 'CreativeWork')
    assert.ok(work, `Missing CreativeWork at ${route}`)
    assert.equal(work.name, words.title)
    assert.equal(work.description, words.summary)
    assert.equal(work.url, url)
    assert.equal(work.image, `${origin}${imageSrc(item.image)}`)
    assert.equal(work.inLanguage, locale)
    assert.equal(work.creator['@id'], `${origin}/#person`)
    assert.deepEqual(work.keywords, caseStack(item))
    assert.deepEqual(
      work.sameAs,
      item.links.map((link) => link.href),
    )
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)[1]
    assert.ok(
      title.startsWith(`${escapeHtml(words.title)} — `) &&
        title.endsWith(' | Shavkatbek Ruzibekov'),
      `Unexpected case title at ${route}`,
    )
  })
}
assert.throws(() => caseSlug('mynails'), /Unknown case/)
assert.throws(() => pagePath('uz', 'work/mynails'), /Unknown case/)
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
assert.equal(files.filter((path) => path.endsWith('.html')).length, 106)
assert.ok(
  files.every(
    (path) =>
      !/(?:^|\/)(?:\.claude-state|node_modules|\.env|content|scripts)(?:\/|$)/.test(
        path.slice(destination.length),
      ),
  ),
)
const htmlFiles = files.filter((path) => path.endsWith('.html'))
const htmlText = htmlFiles.map((path) => readFileSync(path, 'utf8'))
const imageExtensions = /\.(?:png|jpe?g|webp|avif|gif|svg)$/i
const publicPath = (url) => url.split(/[?#]/)[0]
const imageUrls = htmlText.flatMap((html) =>
  (html.match(/<img\b[^>]*>/gi) ?? []).flatMap((tag) => {
    const sources = [attribute(tag, 'src')]
    const srcset = attribute(tag, 'srcset')
    if (srcset)
      sources.push(
        ...srcset.split(',').map((part) => part.trim().split(/\s+/)[0]),
      )
    assert.ok(
      attribute(tag, 'width') && attribute(tag, 'height'),
      `Image without intrinsic size: ${tag}`,
    )
    if (srcset)
      assert.ok(attribute(tag, 'sizes'), `srcset without sizes: ${tag}`)
    return sources
  }),
)
assert.ok(imageUrls.length > 100, 'Expected rendered images across the site')
for (const url of imageUrls) {
  assert.ok(url?.startsWith('/'), `Image source must be absolute: ${url}`)
  assert.ok(
    existsSync(join(destination, publicPath(url))),
    `Image does not resolve to a shipped file: ${url}`,
  )
}
for (const path of files.filter((file) => imageExtensions.test(file)))
  assert.ok(
    statSync(path).size <= 250 * 1024,
    `Shipped image is over 250 KB: ${path.slice(destination.length)}`,
  )
const referencedText = [...htmlText, stylesheet.content].join('\n')
for (const path of files.filter((file) =>
  ['/screenshots/', '/assets/'].some((prefix) =>
    file.slice(destination.length).startsWith(prefix),
  ),
)) {
  const url = path.slice(destination.length)
  if (url === '/assets/fonts/onest-LICENSE') continue
  assert.ok(referencedText.includes(url), `Unreferenced shipped file: ${url}`)
}
for (const match of referencedText.matchAll(/\/assets\/[^"'()\s,]+/g)) {
  const url = match[0]
  if (url === stylesheet.path || url === script.path) continue
  assert.match(
    url,
    /\?v=[0-9a-f]{10}$/,
    `Long-cached asset without a content version: ${url}`,
  )
  assert.equal(url, versioned(publicPath(url)), `Stale asset version: ${url}`)
}
for (const bundle of [stylesheet, script]) {
  assert.match(bundle.path, /^\/assets\/site\.[0-9a-f]{10}\.(?:css|js)$/)
  assert.equal(
    readFileSync(join(destination, bundle.path), 'utf8'),
    bundle.content,
  )
}
assert.equal(imageEntry('altn-emu-1').width, 540)
assert.equal(imageEntry('monarh-shot').variants.length, 2)
const home = read('uz/index.html')
const lcp = home.match(/<span class="mock-browser">[\s\S]*?(<img\b[^>]*>)/)?.[1]
assert.ok(
  attribute(lcp ?? '', 'fetchpriority') === 'high' &&
    !attribute(lcp ?? '', 'loading'),
  'Home LCP image must stay eager with high fetch priority',
)
const vercel = readJson('vercel.json')
const cacheFor = (source) =>
  vercel.headers
    .find((rule) => rule.source === source)
    ?.headers.find((header) => header.key === 'Cache-Control')?.value
assert.equal(cacheFor('/assets/(.*)'), 'public, max-age=31536000, immutable')
assert.match(cacheFor('/screenshots/(.*)') ?? '', /max-age=2592000/)
assert.match(
  readFileSync(join(root, 'assets/theme-init.js'), 'utf8'),
  /let theme = 'dark'/,
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
const invalidFaqCopy = structuredClone(localeCopy.ru)
for (const badFaq of [
  null,
  [],
  [{ question: '', answer: 'Answer' }],
  [{ question: 'Question', answer: ' ' }],
  [{ question: 1, answer: 'Answer' }],
  [
    { question: 'Question', answer: 'Answer' },
    { question: ' question ', answer: 'Another answer' },
  ],
]) {
  invalidFaqCopy.services['mobile-apps'].faq = badFaq
  assert.throws(
    () => serviceFaq(invalidFaqCopy, 'mobile-apps'),
    /Invalid service FAQ/,
  )
}
const fallbackFaqCopy = structuredClone(localeCopy.en)
delete fallbackFaqCopy.services['mobile-apps'].faq
assert.deepEqual(
  serviceFaq(fallbackFaqCopy, 'mobile-apps'),
  fallbackFaqCopy.faq,
)
assert.throws(
  () =>
    inspectPage(
      valid.replace(
        `<a href="${casePath('ru', 'okh')}">`,
        '<a href="https://apps.apple.com/app/id6794669727">',
      ),
      'ru',
      'mobile-apps',
    ),
  /Service proof must link/,
)
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
  'Static verification passed: 104 canonical multilingual pages, reciprocal alternates, truthful metadata, real contacts, public assets, 29 preserved cases per gallery and controlled failure checks.',
)
