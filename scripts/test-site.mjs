import assert from 'node:assert/strict'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
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
  fontLicenses,
  fontPreloads,
  imageEntry,
  imageSrc,
  script,
  stylesheet,
  themeColors,
  versioned,
} from './site/assets.mjs'
import { galleryLabels } from './site/work.mjs'
import { countProjects, isOffline } from './site/project.mjs'
import { brotliDecompressSync, inflateSync } from 'node:zlib'

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
const motionCopy = readJson('content/motion.json').locales
assert.deepEqual(
  Object.keys(motionCopy).sort(),
  [...locales].sort(),
  'Motion copy must cover every locale',
)
for (const locale of locales)
  assert.ok(
    motionCopy[locale].viewCase.trim(),
    `Empty cursor label at ${locale}`,
  )
assert.ok(
  script.content.includes(':not(.skip-link)') &&
    stylesheet.content.includes('@keyframes word-rise'),
  'Motion layer must be bundled into the site assets',
)
assert.match(
  stylesheet.content,
  /@media \(prefers-reduced-motion: reduce\) \{\s*\.rise,/,
  'Hero word rise must be disabled for reduced motion',
)
const localeCopy = Object.fromEntries(
  locales.map((locale) => [locale, readJson(`content/locales/${locale}.json`)]),
)
const futureCopy = readJson('content/future-ui.json').locales
const presentationCopy = readJson('content/locales/presentation.json').locales
const portfolioCopy = readJson('content/portfolio-b.json')
assert.deepEqual(Object.keys(portfolioCopy).sort(), [...locales].sort())
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
      /<details class="faq-item"><summary><span class="faq-q">([\s\S]*?)<\/span><svg\b[\s\S]*?<\/svg><\/summary><p>([\s\S]*?)<\/p><\/details>/g,
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
    payqr: 'private',
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
      `<meta name="theme-color" content="${themeColors.dark}" data-dark="${themeColors.dark}" data-light="${themeColors.light}" id="themeColorMeta">`,
    ),
    `Theme colour meta does not carry both theme colours at ${route}`,
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
      'web-development': ['miyolo'],
      'telegram-bots': [],
      'mobile-apps': ['besttracker'],
      'business-automation': [],
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
    ...html.matchAll(/<li class="sr-item"[^>]*>[\s\S]*?<\/template><\/li>/g),
  ].map((match) => match[0])
  assert.equal(articles.length, 29, `Missing source cases in ${locale} gallery`)
  assert.equal(
    new Set(
      articles.map((article) =>
        attribute(article.match(/<li\b[^>]*>/)[0], 'data-key'),
      ),
    ).size,
    29,
  )
  assert.equal(
    articles.filter((article) => /^<li\b[^>]*\shidden[\s>]/.test(article))
      .length,
    0,
    `Work index must list every project at ${locale}`,
  )
  for (const item of cases) {
    const words = translations[item.key]
    const article = articles.find((value) =>
      value.includes(`data-key="${item.key}"`),
    )
    assert.ok(article, `Missing ${locale}/${item.key}`)
    assert.ok(article.includes(`id="${item.id}"`))
    assert.ok(article.includes(`data-category="${item.categories.join(' ')}"`))
    if (item.screen) {
      assert.ok(article.includes(`src="${imageSrc(item.screen)}"`))
      if ((item.screens?.length ?? 0) > 1)
        for (const alt of words.screenAlts)
          assert.ok(
            article.includes(`alt="${escapeHtml(alt)}"`),
            `Trio alt ${locale}/${item.key}`,
          )
      else assert.ok(article.includes(`alt="${escapeHtml(words.alt)}"`))
    } else
      assert.ok(
        article.includes('class="slab-screen is-empty"'),
        `Project without capture needs the typographic slab: ${item.key}`,
      )
    assert.ok(
      article.includes(`<h3 class="sr-title">${escapeHtml(words.title)}</h3>`),
    )
    assert.ok(
      article.includes(
        `<span class="sr-row-title">${escapeHtml(words.title)}</span>`,
      ),
    )
    assert.ok(article.includes(escapeHtml(words.summary)))
    assert.ok(article.includes(escapeHtml(item.stack)))
    for (const field of ['task', 'solution', 'result'])
      assert.ok(
        article.includes(
          `data-case-field="${field}">${escapeHtml(words[field])}</dd>`,
        ),
        `Missing real ${field} for ${locale}/${item.key}`,
      )
    for (const link of item.links) {
      const tag = `href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer"`
      if (link.offline)
        assert.ok(
          !article.includes(`href="${escapeHtml(link.href)}"`),
          `Offline project still links out at ${locale}/${item.key}`,
        )
      else
        assert.ok(
          article.includes(tag),
          `Source project link changed at ${locale}/${item.key}`,
        )
    }
    if (isOffline(item)) {
      assert.ok(
        article.includes(escapeHtml(portfolioCopy[locale].offline)),
        `Offline project needs the offline state at ${locale}/${item.key}`,
      )
      assert.ok(
        !article.includes('status-online'),
        `Offline project shows an online badge at ${locale}/${item.key}`,
      )
    }
    if (item.statusType !== 'public')
      assert.ok(article.includes(escapeHtml(words.status)))
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
  const counts = countProjects(cases)
  const words = portfolioCopy[locale]
  assert.ok(home.includes('class="home-page"'))
  const homeRows = home.match(/<li class="sr-item"[^>]*>/g) ?? []
  assert.equal(
    homeRows.length,
    cases.filter((item) => item.screen).length,
    `Home showroom must list every captured project at ${locale}`,
  )
  assert.equal(
    homeRows.filter((tag) => !/\shidden(?:[\s>])/.test(tag)).length,
    8,
    `Home showroom must show eight rows first at ${locale}`,
  )
  assert.equal((home.match(/data-limit="8"/g) ?? []).length, 1)
  assert.doesNotMatch(home, /class="(?:bento|tile|row-item|bt )|data-work-grid/)
  assert.ok(
    home.includes(
      `<li><b>${counts.total}</b><span>${escapeHtml(words.stats.projects)}</span></li><li><b>${counts.stores}</b><span>${escapeHtml(words.stats.stores)}</span></li><li><b>${counts.online}</b><span>${escapeHtml(words.stats.online)}</span></li>`,
    ),
    `Hero stats must be computed from the data at ${locale}`,
  )
  const servicesSection =
    home.match(/<section class="sec" id="services"[\s\S]*?<\/section>/)?.[0] ??
    ''
  const tiles =
    servicesSection.match(/<a class="svc-row"[^>]*>[\s\S]*?<\/a>/g) ?? []
  assert.equal(tiles.length, 5, `Services must render 5 rows at ${locale}`)
  assert.equal(
    (servicesSection.match(/class="stand-item[ "]/g) ?? []).length,
    5,
    `Services stand must hold five proofs at ${locale}`,
  )
  const bento = presentationCopy[locale].services.bento
  const proofCases = {
    'web-development': 'miyolo',
    'mobile-apps': 'besttracker',
    'business-automation': 'payqr',
    'ai-integrations': 'agentmama',
  }
  serviceSlugs.forEach((slug, index) => {
    const service = copy.services[slug]
    const tile = tiles[index]
    assert.ok(
      tile.startsWith(
        `<a class="svc-row" href="${pagePath(locale, slug)}" aria-label="${escapeHtml(service.name)}" data-svc="${index}"`,
      ),
      `Services row ${index + 1} must link the ${slug} page at ${locale}`,
    )
    assert.ok(tile.includes(escapeHtml(service.pitch)))
    assert.ok(tile.includes(service.tags.map(escapeHtml).join(' · ')))
    assert.ok(
      tile.includes(
        escapeHtml(service.short.replace('Telegram-', 'Telegram‑')),
      ),
    )
    const caption = proofCases[slug]
      ? `${bento.proof}: ${translations[proofCases[slug]].title}`
      : bento.chat.cap
    assert.ok(
      tile.includes(`<span class="svc-cap">${escapeHtml(caption)}</span>`),
      `Services row ${slug} has no caption at ${locale}`,
    )
    assert.ok(
      servicesSection.includes(
        `<p class="stand-cap">${escapeHtml(caption)}</p>`,
      ),
      `Services stand ${slug} has no caption at ${locale}`,
    )
    if (locale !== 'ru')
      assert.notEqual(service.pitch, localeCopy.ru.services[slug].pitch)
  })
  assert.equal(
    (servicesSection.match(/class="chat-opt"/g) ?? []).length,
    bento.chat.opts.length,
  )
  const heroHeading =
    home.match(/<h1 class="h1" id="intro-title">([\s\S]*?)<\/h1>/)?.[1] ?? ''
  const heroLines = heroHeading
    .split('<span class="h1-line">')
    .slice(1)
    .map((line) =>
      line
        .replace(/<svg[\s\S]*?<\/svg>/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
  const expectedLines = words.title.map((line) =>
    escapeHtml(
      line
        .replace(/\s*→\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim(),
    ),
  )
  assert.deepEqual(
    heroLines,
    expectedLines,
    `Missing localized heading at ${locale}`,
  )
  assert.equal(
    (
      heroHeading.match(
        /<span class="rise-mask"><span class="rise" style="--i:\d+">/g,
      ) ?? []
    ).length,
    expectedLines.join(' ').split(' ').length,
    `Hero words must each sit in a rise mask at ${locale}`,
  )
  assert.equal(
    (heroHeading.match(/class="[^"]*h1-arrow/g) ?? []).length,
    words.title.filter((line) => /\s*→\s*$/.test(line)).length,
    `Hero arrow must stay attached to its line at ${locale}`,
  )
  const heroSlabs =
    home.match(/<figure class="slab[^"]*hero-slab"[^>]*>/g) ?? []
  assert.ok(heroSlabs.length > 0, `Hero slabs are missing at ${locale}`)
  for (const tag of heroSlabs)
    assert.equal(
      attribute(tag, 'data-cursor'),
      escapeHtml(motionCopy[locale].viewCase),
      `Hero slab cursor label is not localized at ${locale}`,
    )
  assert.ok(home.includes(escapeHtml(words.statement)))
  assert.ok(
    home.includes(`<a class="sr-all" href="${pagePath(locale, 'work')}">`),
  )
  for (const key of caseKeys.filter(
    (key) => cases.find((entry) => entry.key === key).screen,
  ))
    assert.ok(
      home.includes(`href="${casePath(locale, key)}" data-open-case="${key}"`),
      `Home does not link the case page ${locale}/${key}`,
    )
  const gallery = read(`${locale}/work/index.html`)
  for (const key of caseKeys)
    assert.ok(
      gallery.includes(
        `href="${casePath(locale, key)}" data-open-case="${key}"><span>${escapeHtml(copy.caseStudy.openCase)}`,
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
      html.includes(
        `<h1 class="h1 page-title" id="case-title">${escapeHtml(words.title)}</h1>`,
      ),
      `Wrong case heading at ${route}`,
    )
    assert.ok(html.includes(escapeHtml(words.summary)))
    const shot =
      html.match(/<div class="case-shot">([\s\S]*?)<\/figure><\/div>/)?.[1] ??
      ''
    assert.ok(
      shot.includes(`style="view-transition-name: slab-${key}"`),
      `Case slab must carry its shared-element name at ${route}`,
    )
    const screens = item.screens ?? []
    if (screens.length > 1) {
      const images = [...shot.matchAll(/<img\b[^>]*>/g)].map((m) => m[0])
      assert.deepEqual(
        images.map((image) => attribute(image, 'src')).sort(),
        screens.map((key) => imageSrc(key)).sort(),
        `Case trio must show its own screens at ${route}`,
      )
      assert.ok(
        images.every((image) => !attribute(image, 'loading')),
        `Case trio screens load eagerly at ${route}`,
      )
    }
    if (item.screen) {
      const centre =
        screens.length > 1 ? (shot.split('trio-centre')[1] ?? '') : shot
      const hero = centre.match(/<img\b[^>]*>/)?.[0] ?? ''
      const alt = screens.length > 1 ? words.screenAlts[0] : words.alt
      assert.ok(
        attribute(hero, 'src') === imageSrc(item.screen) &&
          hero.includes(`alt="${escapeHtml(alt)}"`) &&
          attribute(hero, 'fetchpriority') === 'high' &&
          !attribute(hero, 'loading'),
        `Missing eager localized hero image at ${route}`,
      )
    } else
      assert.ok(
        shot.includes('class="slab-screen is-empty"') && !shot.includes('<img'),
        `Case without a capture needs the typographic slab at ${route}`,
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
    item.links.forEach((link) =>
      assert.equal(
        html.includes(
          `href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">`,
        ),
        !link.offline,
        `Wrong external case link state at ${route}`,
      ),
    )
    if (isOffline(item))
      assert.ok(
        html.includes(escapeHtml(portfolioCopy[locale].offline)) &&
          !html.includes('status-online'),
        `Offline case must say so at ${route}`,
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
        `href="${copy.identity.contact.telegram}" target="_blank" rel="noopener noreferrer"><svg class="lg" aria-hidden="true" focusable="false"><use href="#l-telegram"/></svg><span class="button-content">${escapeHtml(copy.hero.primaryCta)}`,
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
    assert.ok(
      imageEntry(item.image).width >= 900 &&
        imageEntry(item.image).width > imageEntry(item.image).height,
      `Case schema image must stay the wide case shot: ${item.key}`,
    )
    assert.equal(work.inLanguage, locale)
    assert.equal(work.creator['@id'], `${origin}/#person`)
    assert.deepEqual(work.keywords, caseStack(item))
    assert.deepEqual(
      work.sameAs ?? [],
      item.links.filter((link) => !link.offline).map((link) => link.href),
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
    item.links.filter((link) => !link.offline).map((link) => link.href),
    [...row.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1]),
    `Actual source project URLs changed for ${item.key}`,
  )
  for (const link of item.links.filter((entry) => entry.offline))
    assert.ok(
      row.includes(`<span>${new URL(link.href).hostname}</span>`),
      `Offline project must stay as plain text in the archive: ${item.key}`,
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
const pngSize = (path) => {
  const data = readFileSync(path)
  assert.equal(
    data.subarray(1, 4).toString('latin1'),
    'PNG',
    `${path} is not a PNG`,
  )
  return [data.readUInt32BE(16), data.readUInt32BE(20)]
}
const socialMeta = (html, key) =>
  (html.match(/<meta\b[^>]*>/gi) ?? [])
    .filter((tag) =>
      [attribute(tag, 'property'), attribute(tag, 'name')].includes(key),
    )
    .map((tag) => attribute(tag, 'content'))
const socialImages = new Map()
const socialSize = (page, url) => {
  assert.ok(url.startsWith(`${origin}/`), `${page} social image ${url}`)
  const file = join(destination, publicPath(url.slice(origin.length)))
  assert.ok(existsSync(file), `${page} social image is missing: ${url}`)
  if (!socialImages.has(file)) socialImages.set(file, pngSize(file))
  return socialImages.get(file)
}
htmlFiles.forEach((path, index) => {
  const html = htmlText[index]
  const page = path.slice(destination.length)
  const ogImages = socialMeta(html, 'og:image')
  const twitterImages = socialMeta(html, 'twitter:image')
  assert.equal(twitterImages.length, 1, `${page} twitter:image`)
  assert.deepEqual(
    socialSize(page, twitterImages[0]),
    [1200, 630],
    `${page} twitter:image size`,
  )
  assert.deepEqual(socialMeta(html, 'twitter:card'), ['summary_large_image'])
  if (page === '/portfolio/index.html') {
    assert.equal(ogImages.length, 1, `${page} archive og:image`)
    assert.deepEqual(socialSize(page, ogImages[0]), [1200, 630])
    return
  }
  assert.equal(ogImages.length, 2, `${page} needs a wide and a square og:image`)
  assert.equal(ogImages[0], twitterImages[0], `${page} first og:image`)
  const sizes = ogImages.map((url) => socialSize(page, url))
  assert.deepEqual(sizes, [
    [1200, 630],
    [1200, 1200],
  ])
  assert.deepEqual(
    socialMeta(html, 'og:image:width').map(Number),
    sizes.map(([width]) => width),
    `${page} og:image:width`,
  )
  assert.deepEqual(
    socialMeta(html, 'og:image:height').map(Number),
    sizes.map(([, height]) => height),
    `${page} og:image:height`,
  )
  const alts = socialMeta(html, 'og:image:alt')
  assert.equal(alts.length, 2, `${page} og:image:alt`)
  assert.ok(alts.every((alt) => alt.startsWith('Shavkatbek Ruzibekov: ')))
})
assert.equal(socialImages.size, 3)
for (const file of socialImages.keys())
  assert.ok(statSync(file).size <= 300 * 1024, `${file} exceeds 300 KB`)
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
for (const path of files.filter(
  (file) => imageExtensions.test(file) && !socialImages.has(file),
))
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
  if (fontLicenses.includes(url)) continue
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
const mobileCases = cases.filter((item) => item.categories.includes('mobile'))
assert.equal(mobileCases.length, 12)
for (const item of mobileCases) {
  const screens = item.screens
  assert.ok(
    Array.isArray(screens) && screens.length >= 1 && screens.length <= 3,
    `Mobile project needs an explicit list of 1-3 screens: ${item.key}`,
  )
  assert.equal(new Set(screens).size, screens.length, item.key)
  assert.equal(
    screens[0],
    item.screen,
    `Centre screen is the lead: ${item.key}`,
  )
  for (const key of screens) {
    const entry = imageEntry(key)
    assert.ok(entry.height > entry.width, `Screen must be a phone: ${key}`)
    for (const variant of entry.variants) {
      const path = join(root, variant.src.slice(1))
      assert.ok(existsSync(path), `Missing screen file ${variant.src}`)
      assert.ok(statSync(path).size <= 250 * 1024, `Screen over 250 KB: ${key}`)
    }
  }
  for (const locale of locales) {
    const words = caseTranslations(locale)[item.key]
    if (screens.length > 1) {
      assert.equal(words.screenAlts?.length, screens.length, item.key)
      assert.equal(new Set(words.screenAlts).size, screens.length, item.key)
    }
  }
  const html = read('uz/work/index.html')
  const template =
    html
      .split(`<li class="sr-item" id="${item.id}" data-key="${item.key}"`)[1]
      ?.split('</template>')[0] ?? ''
  const stage =
    template.split('data-part="slab"')[1]?.split('data-part="detail"')[0] ?? ''
  const sources = [...stage.matchAll(/<img\b[^>]*>/g)].map((match) =>
    attribute(match[0], 'src'),
  )
  assert.deepEqual(
    sources.sort(),
    screens.map((key) => imageSrc(key)).sort(),
    `Stage slab must show exactly its own screens: ${item.key}`,
  )
}
assert.equal(imageEntry('altn-emu-1').width, 540)
assert.equal(imageEntry('monarh-shot').variants.length, 2)
const home = read('uz/index.html')
const lcp = home
  .match(
    /<figure class="slab slab-browser hero-slab"[^>]*data-d="0"[\s\S]*?<\/figure>/,
  )?.[0]
  ?.match(/<img\b[^>]*>/)?.[0]
assert.ok(
  attribute(lcp ?? '', 'fetchpriority') === 'high' &&
    !attribute(lcp ?? '', 'loading'),
  'Home LCP image must stay eager with high fetch priority',
)
assert.ok((attribute(lcp, 'src') ?? '').includes('agentmama-web'))
const projectCounts = countProjects(cases)
assert.equal(
  projectCounts.online,
  cases.filter((item) =>
    item.links.some(
      (link) => !link.offline && !/apps\.apple|play\.google/.test(link.href),
    ),
  ).length,
)
assert.equal(
  projectCounts.online,
  14,
  'Online count must follow the checked links',
)
assert.equal(projectCounts.stores, 6)
const offlineKeys = ['monarh', 'les44', 'supertour']
for (const key of offlineKeys)
  assert.ok(
    cases.some((item) => item.key === key),
    `Offline project disappeared from the data: ${key}`,
  )
assert.deepEqual(
  cases.filter(isOffline).map((item) => item.key),
  offlineKeys,
)
for (const item of cases)
  for (const link of item.links.filter((entry) => entry.offline))
    assert.match(link.offline.checkedOn, /^\d{4}-\d{2}-\d{2}$/)
const offlineHrefs = cases.flatMap((item) =>
  item.links.filter((link) => link.offline).map((link) => link.href),
)
const publicHtml = htmlFiles.map((path) => [
  path.slice(destination.length),
  readFileSync(path, 'utf8'),
])
for (const [path, html] of publicHtml)
  for (const href of offlineHrefs)
    assert.ok(
      !html.includes(`href="${escapeHtml(href)}"`),
      `Dead external link ${href} rendered at ${path}`,
    )
let offlineBlocks = 0
for (const [path, html] of publicHtml)
  for (const key of offlineKeys)
    for (const block of html.matchAll(
      new RegExp(
        `<(li|a) class="(?:sr-item|placard)"[^>]*data-key="${key}"[\\s\\S]*?</\\1>`,
        'g',
      ),
    )) {
      offlineBlocks += 1
      assert.ok(
        !block[0].includes('status-online'),
        `Offline project ${key} shows an online badge at ${path}`,
      )
    }
assert.ok(
  offlineBlocks >= offlineKeys.length * 8,
  'Offline badge check found no gallery rows',
)
for (const locale of ['uz', 'ru', 'en']) {
  const page = read(`${locale}/index.html`)
  for (const marker of [
    'data-hero>',
    'data-hero-track>',
    'data-hero-stage>',
    'data-hall role="group"',
    'data-world>',
    'data-placards>',
    'data-minimap role="group"',
    'data-showroom data-variant="home"',
    'data-stage>',
    'data-stage-world>',
    'data-info-copy>',
    'data-list>',
    'data-chips role="group"',
    'data-services>',
  ])
    assert.ok(page.includes(marker), `Missing ${marker} at ${locale} home`)
  assert.equal((page.match(/class="hero-step"/g) ?? []).length, 6)
  assert.equal(
    (page.match(/class="slab slab-[a-z]+ hero-slab"/g) ?? []).length,
    6,
  )
  assert.equal((page.match(/<a class="placard"/g) ?? []).length, 6)
  assert.equal((page.match(/class="minimap-dot"/g) ?? []).length, 6)
  assert.equal(
    (page.match(/hero-slab"[^>]*>/g) ?? []).filter(
      (tag) => !tag.includes('aria-hidden'),
    ).length,
    1,
    `Only the front hero slab is exposed at ${locale}`,
  )
  const workPage = read(`${locale}/work/index.html`)
  assert.ok(workPage.includes('data-showroom data-variant="work"'))
}
assert.doesNotMatch(
  stylesheet.content,
  /gradient\(/i,
  'Shipped CSS uses a gradient',
)
assert.doesNotMatch(
  stylesheet.content,
  /text-shadow|box-shadow:[^;]*rgba\((?!2, 3, 1[24],|16, 19, 43,)/,
  'Shipped CSS uses a glow or coloured shadow',
)
function base128(bytes, state) {
  let value = 0
  for (let index = 0; index < 5; index += 1) {
    const byte = bytes[state.offset]
    state.offset += 1
    value = value * 128 + (byte & 0x7f)
    if (!(byte & 0x80)) return value
  }
  throw new Error('Bad UIntBase128')
}
function woffCodepoints(path) {
  const bytes = readFileSync(join(root, path))
  assert.equal(bytes.toString('latin1', 0, 4), 'wOF2', `${path} is not WOFF2`)
  const tables = bytes.readUInt16BE(12)
  const compressed = bytes.readUInt32BE(20)
  const state = { offset: 48 }
  const entries = []
  for (let index = 0; index < tables; index += 1) {
    const flags = bytes[state.offset]
    state.offset += 1
    const known = flags & 0x3f
    let tag = known
    if (known === 63) {
      tag = bytes.toString('latin1', state.offset, state.offset + 4)
      state.offset += 4
    }
    const version = flags >> 6
    const length = base128(bytes, state)
    const glyphTable = known === 10 || known === 11
    const transformed = glyphTable ? version === 0 : version !== 0
    const stored = transformed ? base128(bytes, state) : length
    entries.push({ tag, stored })
  }
  const data = brotliDecompressSync(
    bytes.subarray(state.offset, state.offset + compressed),
  )
  let position = 0
  let cmap = null
  for (const entry of entries) {
    if (entry.tag === 0) cmap = data.subarray(position, position + entry.stored)
    position += entry.stored
  }
  assert.ok(cmap, `${path} has no cmap`)
  const found = new Set()
  const records = cmap.readUInt16BE(2)
  for (let index = 0; index < records; index += 1) {
    const offset = cmap.readUInt32BE(4 + index * 8 + 4)
    const format = cmap.readUInt16BE(offset)
    if (format === 12) {
      const groups = cmap.readUInt32BE(offset + 12)
      for (let group = 0; group < groups; group += 1) {
        const base = offset + 16 + group * 12
        const first = cmap.readUInt32BE(base)
        const last = cmap.readUInt32BE(base + 4)
        for (let code = first; code <= last && code < 0x10000; code += 1)
          found.add(code)
      }
    }
    if (format === 4) {
      const segments = cmap.readUInt16BE(offset + 6) / 2
      const ends = offset + 14
      const starts = ends + segments * 2 + 2
      const deltas = starts + segments * 2
      const ranges = deltas + segments * 2
      for (let segment = 0; segment < segments; segment += 1) {
        const last = cmap.readUInt16BE(ends + segment * 2)
        const first = cmap.readUInt16BE(starts + segment * 2)
        const delta = cmap.readInt16BE(deltas + segment * 2)
        const range = cmap.readUInt16BE(ranges + segment * 2)
        for (let code = first; code <= last && code !== 0xffff; code += 1) {
          const glyph = range
            ? cmap.readUInt16BE(
                ranges + segment * 2 + range + (code - first) * 2,
              )
            : (code + delta) & 0xffff
          if (glyph) found.add(code)
        }
      }
    }
  }
  return found
}
for (const font of [
  'assets/fonts/unbounded-latin.woff2',
  'assets/fonts/onest-latin.woff2',
]) {
  const codes = woffCodepoints(font)
  for (const code of [0x02bb, 0x02bc, 0x2018, 0x41, 0x7a])
    assert.ok(
      codes.has(code),
      `${font} lacks U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
    )
}
assert.ok(woffCodepoints('assets/fonts/unbounded-cyrillic.woff2').has(0x0436))
assert.ok(woffCodepoints('assets/fonts/onest-cyrillic.woff2').has(0x0436))
for (const code of [0x41, 0x2f, 0xb7, 0x2192])
  assert.ok(woffCodepoints('assets/fonts/jetbrainsmono-latin.woff2').has(code))
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
      valid.replaceAll(
        `href="${casePath('ru', 'besttracker')}"`,
        'href="https://apps.apple.com/app/id6794669727"',
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
const tokenBlock = (selector) => {
  const body =
    readFileSync(join(root, 'assets/tokens.css'), 'utf8').match(
      new RegExp(`${selector}\\s*\\{([^}]*)\\}`),
    )?.[1] ?? ''
  return Object.fromEntries(
    [...body.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.replace(/\s+/g, ' ').trim().toLowerCase(),
    ]),
  )
}
const darkTokens = tokenBlock(':root')
const lightTokens = {
  ...darkTokens,
  ...tokenBlock("\\[data-theme='light'\\]"),
}
assert.deepEqual(themeColors, { dark: '#0b0c0e', light: '#ecedef' })
assert.equal(darkTokens['theme-color'], darkTokens.canvas)
assert.equal(lightTokens['theme-color'], lightTokens.canvas)
assert.deepEqual(
  [darkTokens.accent, darkTokens['accent-press'], darkTokens['on-accent']],
  ['#b5f23d', '#9cd922', '#0b0c0e'],
)
assert.deepEqual(
  [lightTokens.accent, lightTokens['on-accent'], lightTokens['accent-text']],
  ['#0b0c0e', '#b5f23d', lightTokens.ink],
)
assert.equal(darkTokens['contact-shadow'], 'rgba(0, 0, 0, 0.42)')
assert.equal(lightTokens['contact-shadow'], 'rgba(0, 0, 0, 0.16)')
const luminance = (hex) => {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((pair) => parseInt(pair, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}
for (const [theme, tokens] of [
  ['dark', darkTokens],
  ['light', lightTokens],
]) {
  for (const [name, value] of Object.entries(tokens))
    for (const colour of value.match(/rgba?\([^)]*\)/g) ?? [])
      assert.match(
        colour,
        /^rgba\(0, 0, 0, 0?\.\d+\)$/,
        `${theme} --${name} must be pure black rgba: ${colour}`,
      )
  for (const text of ['ink', 'muted', 'faint'])
    for (const ground of ['canvas', 'surface', 'card'])
      assert.ok(
        contrast(tokens[text], tokens[ground]) >= 4.5,
        `${theme} ${text} on ${ground} is below AA`,
      )
  for (const ground of ['canvas', 'surface', 'card'])
    assert.ok(
      contrast(tokens['accent-text'], tokens[ground]) >= 4.5,
      `${theme} accent-text on ${ground} is below AA`,
    )
  for (const fill of ['accent', 'accent-press'])
    assert.ok(
      contrast(tokens['on-accent'], tokens[fill]) >= 4.5,
      `${theme} on-accent on ${fill} is below AA`,
    )
  assert.ok(contrast(tokens['line-strong'], tokens.canvas) >= 3)
  assert.ok(
    contrast(tokens.accent, tokens.canvas) >= 3,
    `${theme} accent fill does not stand off the canvas`,
  )
}
assert.match(
  stylesheet.content,
  /\[data-theme='light'\] \.placard-num \{\s*background: var\(--accent\);\s*color: var\(--on-accent\);/,
)
const retiredColours =
  /#(?:0b1033|181f52|262e6b|353f84|2f3874|5a6499|1f275c|f3f4fa|a7adcf|979ec4|d63a1f|b42a12|ff7a63|a82710|3dd68c|03040f|e7e9f1|cfd3e2|b6bcd2|c3c8da|757e9e|10132b|4a5175|50577b|0b6b3e)\b|rgba\((?:2, ?3, ?1[24]|16, ?19, ?43)/i
for (const path of files.filter(
  (file) =>
    /\.(?:html|css|js|svg|json|xml|txt)$/.test(file) &&
    !file.startsWith(join(destination, 'portfolio')),
))
  assert.doesNotMatch(
    readFileSync(path, 'utf8'),
    retiredColours,
    `Retired palette colour in ${path.slice(destination.length)}`,
  )
assert.deepEqual(
  readFileSync(join(destination, 'favicon.svg'), 'utf8')
    .match(/fill="#[0-9a-f]{6}"/gi)
    .map((fill) => fill.slice(6, 13).toLowerCase()),
  [darkTokens.canvas, darkTokens.accent],
)
const themeMeta = { dataset: themeColors, content: themeColors.dark }
themeMeta.setAttribute = (name, value) => {
  themeMeta[name] = value
}
for (const [saved, expected] of [
  ['light', themeColors.light],
  ['dark', themeColors.dark],
  [null, themeColors.dark],
]) {
  themeMeta.content = themeColors.dark
  const element = { dataset: {}, classList: { add() {} } }
  new Function(
    'document',
    'localStorage',
    readFileSync(join(root, 'assets/theme-init.js'), 'utf8'),
  )(
    {
      documentElement: element,
      querySelector: (selector) =>
        selector === 'meta[name="theme-color"]' ? themeMeta : null,
    },
    { getItem: () => saved },
  )
  assert.equal(element.dataset.theme, saved ?? 'dark')
  assert.equal(themeMeta.content, expected, `theme-init meta for ${saved}`)
}
const firstPixel = (path) => {
  const data = readFileSync(path)
  const chunks = []
  let colourType = 0
  for (let offset = 8; offset < data.length; ) {
    const length = data.readUInt32BE(offset)
    const type = data.subarray(offset + 4, offset + 8).toString('latin1')
    if (type === 'IHDR') colourType = data[offset + 17]
    if (type === 'IDAT')
      chunks.push(data.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  assert.ok([2, 6].includes(colourType), `${path} must be RGB or RGBA`)
  const pixel = inflateSync(Buffer.concat(chunks)).subarray(1, 4)
  return `#${[...pixel].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}
for (const [path, size] of [
  ['assets/og-products.png', [1200, 630]],
  ['assets/og-products-square.png', [1200, 1200]],
  ['og-image.png', [1200, 630]],
]) {
  const file = join(root, path)
  assert.deepEqual(pngSize(file), size, `${path} size`)
  assert.ok(statSync(file).size <= 300 * 1024, `${path} exceeds 300 KB`)
  assert.equal(firstPixel(file), darkTokens.canvas, `${path} canvas colour`)
}
assert.equal(
  readFileSync(join(root, 'og-image.png')).compare(
    readFileSync(join(root, 'assets/og-products.png')),
  ),
  0,
)
const heroHtml = read('uz/index.html')
const heroFigures = heroHtml
  .split('<figure ')
  .slice(1)
  .map((part) => part.split('</figure>')[0])
  .filter((figure) => /^class="[^"]*\bhero-slab\b/.test(figure))
const heroFigure = (attribute) =>
  heroFigures.find((figure) => figure.includes(attribute)) ?? ''
const firstPhoneHero = heroFigure('data-m="0"')
assert.match(firstPhoneHero, /slab-trio/, 'The first phone hero slab is a trio')
const firstPhoneImages = firstPhoneHero.match(/<img\b[^>]*>/g) ?? []
assert.equal(firstPhoneImages.length, 3)
assert.ok(
  firstPhoneImages.every((tag) => !/loading="lazy"/.test(tag)),
  'First-viewport trio screens must load eagerly',
)
assert.deepEqual(
  firstPhoneImages.map((tag) => /fetchpriority="high"/.test(tag)),
  [false, false, true],
  'Only the centre screen of the first-viewport trio gets high fetch priority',
)
assert.equal(
  (heroHtml.match(/fetchpriority="high"/g) ?? []).length,
  2,
  'Exactly the desktop and the phone first slabs get high priority',
)
const laterTrio = heroFigures.find(
  (figure) =>
    figure.includes('slab-trio') &&
    !figure.includes('data-m="0"') &&
    !figure.includes('data-d="0"'),
)
if (laterTrio)
  assert.ok(
    (laterTrio.match(/<img\b[^>]*>/g) ?? [])
      .slice(0, -1)
      .every((tag) => /loading="lazy"/.test(tag)),
    'Flank phones of later trios stay lazy',
  )
const cropDir = mkdtempSync(join(tmpdir(), 'crop-check-'))
const cropSource = 'screenshots/okh-shot.webp'
for (const [crops, message] of [
  [
    [{ source: cropSource, box: [0, 0, 0, 10], output: 'screenshots/x.png' }],
    /positive/,
  ],
  [
    [
      {
        source: cropSource,
        box: [0, 0, 99999, 10],
        output: 'screenshots/x.png',
      },
    ],
    /outside/,
  ],
  [
    [{ source: cropSource, box: [-1, 0, 10, 10], output: 'screenshots/x.png' }],
    /outside/,
  ],
  [
    [{ source: cropSource, box: [0, 0, 10], output: 'screenshots/x.png' }],
    /four integers/,
  ],
  [
    [
      { source: cropSource, box: [0, 0, 10, 10], output: 'screenshots/x.png' },
      { source: cropSource, box: [0, 0, 10, 10], output: 'screenshots/x.png' },
    ],
    /repeats output/,
  ],
  [
    [
      {
        source: cropSource,
        box: [0, 0, 10, 10],
        output: 'screenshots/../x.png',
      },
    ],
    /under screenshots/,
  ],
  [
    [{ source: cropSource, box: [0, 0, 10, 10], output: '/tmp/x.png' }],
    /under screenshots/,
  ],
  [
    [
      {
        source: 'package.json',
        box: [0, 0, 10, 10],
        output: 'screenshots/x.png',
      },
    ],
    /source must be/,
  ],
  [[], /non-empty/],
]) {
  const config = join(cropDir, 'crops.json')
  writeFileSync(config, JSON.stringify({ crops }))
  const result = spawnSync(
    'python3',
    [join(root, 'scripts/crop-screens.py'), config],
    {
      encoding: 'utf8',
    },
  )
  assert.equal(
    result.status,
    1,
    `crop-screens must reject ${JSON.stringify(crops)}`,
  )
  assert.match(result.stderr, /^crop-screens: /)
  assert.match(result.stderr, message)
}
rmSync(cropDir, { recursive: true, force: true })
assert.ok(!existsSync(join(root, 'screenshots/x.png')))
assert.ok(!existsSync(join(root, 'x.png')))
const phoneCheck = spawnSync(
  'python3',
  [join(root, 'scripts/check-phones.py')],
  { encoding: 'utf8' },
)
assert.equal(phoneCheck.status, 0, phoneCheck.stderr)
assert.match(phoneCheck.stdout, /Checked 38 phone captures: 0 problems/)
const trimRules = spawnSync(
  'python3',
  [
    '-c',
    [
      'import importlib.util, sys',
      'from PIL import Image, ImageDraw',
      `spec = importlib.util.spec_from_file_location("check", ${JSON.stringify(join(root, 'scripts/check-phones.py'))})`,
      'check = importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(check)',
      'image = Image.new("RGB", (200, 400), (255, 255, 255))',
      'draw = ImageDraw.Draw(image)',
      'draw.rectangle((0, 0, 199, 29), fill=(190, 190, 190))',
      'draw.rectangle((20, 8, 120, 20), fill=(20, 20, 20))',
      'draw.rectangle((10, 60, 190, 90), fill=(30, 120, 200))',
      'for x in range(10, 190, 6): draw.line((x, 60, x, 90), fill=(250, 250, 250))',
      'card = Image.new("RGB", (200, 400), (239, 239, 239))',
      'ImageDraw.Draw(card).rectangle((12, 30, 187, 80), fill=(255, 255, 255))',
      'results = [check.leftover_band(image, 30, 1), check.leftover_band(image, 22, 1), check.clean_cut(image, 75, 74), check.clean_cut(image, 30, 29), check.leftover_band(card, 20, 1)]',
      'print(results)',
      'sys.exit(0 if results == [False, True, False, True, False] else 1)',
    ].join('\n'),
  ],
  { encoding: 'utf8' },
)
assert.equal(trimRules.status, 0, trimRules.stdout + trimRules.stderr)
for (const locale of ['uz', 'ru', 'en']) {
  const catalogue = new Map(
    [
      ...read(`${locale}/work/index.html`).matchAll(
        /data-key="([^"]+)"[^>]*>(?:(?!<\/li>).)*?class="sr-row-num" aria-hidden="true">(\d+)</gs,
      ),
    ].map(([, key, number]) => [key, number]),
  )
  assert.equal(catalogue.size, cases.length, `Work list numbers at ${locale}`)
  assert.deepEqual(
    [...new Set(catalogue.values())].length,
    cases.length,
    `Catalogue numbers are unique at ${locale}`,
  )
  const home = read(`${locale}/index.html`)
  const homeRows = [
    ...home.matchAll(
      /<li class="sr-item" data-key="([^"]+)"[^>]*data-number="(\d+)"[^>]*>(?:(?!<\/li>).)*?<\/a>/gs,
    ),
  ]
  assert.ok(homeRows.length > 0, `Home showroom rows at ${locale}`)
  for (const [row, key, number] of homeRows) {
    assert.equal(number, catalogue.get(key), `Home row ${key} at ${locale}`)
    assert.ok(!row.includes('sr-row-num'), `Home row ${key} has no number`)
  }
  const placards = [
    ...home.matchAll(
      /<a class="placard"[^>]*data-key="([^"]+)"[^>]*><span class="placard-num" aria-hidden="true">(\d+)</g,
    ),
  ]
  assert.equal(placards.length, 6, `Hero placards at ${locale}`)
  for (const [, key, number] of placards)
    assert.equal(number, catalogue.get(key), `Placard ${key} at ${locale}`)
  assert.ok(!home.includes('class="sr-num"'), `Home showroom has no numbers`)
  const firstInfo = read(`${locale}/work/index.html`).match(
    /class="sr-num" data-num>(\d+)</,
  )?.[1]
  assert.equal(firstInfo, '01', `Work showroom info ${locale}`)
  assert.match(
    home,
    /data-minimap-step aria-hidden="true">1 \/ 6</,
    `Hero counter is a position at ${locale}`,
  )
  const dock = home.split('class="hero-dock"')[1] ?? ''
  assert.ok(
    dock.indexOf('data-minimap') >= 0 &&
      dock.indexOf('data-minimap') < dock.indexOf('data-placards'),
    `Hero controls come before the placard at ${locale}`,
  )
  const dots = [...home.matchAll(/<button class="minimap-dot"[^>]*>/g)].map(
    ([tag]) => attribute(tag, 'tabindex'),
  )
  assert.deepEqual(dots, ['0', '-1', '-1', '-1', '-1', '-1'])
  for (const item of cases.filter((entry) => caseKeys.includes(entry.key))) {
    const page = read(`${locale}/work/${item.key}/index.html`)
    const tag = page.match(/<p class="case-tag">(.*?)<\/p>/s)?.[1] ?? ''
    assert.ok(tag, `Case tag row at ${locale}/${item.key}`)
    assert.ok(!tag.includes('class="mono"'), `Case tag stack at ${item.key}`)
    const storeLinks = /class="case-links"[^]*?(App Store|Google Play)/.test(
      page,
    )
    if (storeLinks)
      assert.ok(
        !tag.includes('status-stores'),
        `Case tag repeats store links at ${locale}/${item.key}`,
      )
    assert.match(page, /<ul class="case-chips"/, `Case chips at ${item.key}`)
  }
}
for (const item of cases.filter((entry) => entry.screens?.length > 1))
  assert.equal(item.screen, item.screens[0], `Trio centre leads ${item.key}`)
const imageManifest = readJson('screenshots/web/manifest.json')
const phoneCaptures = Object.entries(imageManifest).filter(
  ([, entry]) => entry.width < entry.height,
)
assert.ok(phoneCaptures.length >= 30, 'Phone captures are present')
for (const [key, entry] of phoneCaptures)
  for (const variant of entry.variants)
    assert.ok(
      Math.abs(variant.width / variant.height - 9 / 19.5) <= 0.004,
      `${key} ${variant.width}x${variant.height} fits the 9:19.5 phone screen`,
    )
console.log(
  'Static verification passed: 104 canonical multilingual pages, reciprocal alternates, truthful metadata, real contacts, public assets, 29 preserved cases per gallery and controlled failure checks.',
)
