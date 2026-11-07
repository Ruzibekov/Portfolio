import { icon, spriteMarkup } from './icons.mjs'
import {
  defaultCanvas,
  fontPreloads,
  script,
  stylesheet,
  themeInit,
  versioned,
} from './assets.mjs'

export const origin = 'https://portfolio-ruzibekov.vercel.app'
export const indexNowKey = 'b7f99f917abf2960b601e7f62050f299'
export const locales = ['uz', 'ru', 'en', 'ky', 'kk', 'tg', 'uk', 'be']
export const serviceSlugs = [
  'web-development',
  'telegram-bots',
  'mobile-apps',
  'business-automation',
  'ai-integrations',
]
export const caseKeys = [
  'agentmama',
  'monarh',
  'miyolo',
  'okh',
  'besttracker',
  'altn',
]
const casePrefix = 'work/'
const areaServed = [
  'Uzbekistan',
  'Kazakhstan',
  'Kyrgyzstan',
  'Tajikistan',
  'Russia',
  'Ukraine',
  'Belarus',
]
const schemaLanguages = {
  uz: 'Uzbek',
  ru: 'Russian',
  en: 'English',
  ky: 'Kyrgyz',
  kk: 'Kazakh',
  tg: 'Tajik',
  uk: 'Ukrainian',
  be: 'Belarusian',
}
export const languageNames = {
  uz: 'O‘zbekcha',
  ru: 'Русский',
  en: 'English',
  ky: 'Кыргызча',
  kk: 'Қазақша',
  tg: 'Тоҷикӣ',
  uk: 'Українська',
  be: 'Беларуская',
}
const ogLocales = {
  uz: 'uz_UZ',
  ru: 'ru_RU',
  en: 'en_US',
  ky: 'ky_KG',
  kk: 'kk_KZ',
  tg: 'tg_TJ',
  uk: 'uk_UA',
  be: 'be_BY',
}

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  )
}

export function lineBreaks(value) {
  return escapeHtml(value).replace(/\\n|\r?\n/g, '<br>')
}

export function caseSlug(key) {
  if (!caseKeys.includes(key)) throw new Error(`Unknown case: ${key}`)
  return `${casePrefix}${key}`
}

export function isCaseSlug(slug) {
  return typeof slug === 'string' && slug.startsWith(casePrefix)
}

export function pagePath(locale, slug = null) {
  if (!locales.includes(locale))
    throw new Error(`Unsupported locale: ${locale}`)
  if (slug === null) return `/${locale}`
  if (slug === 'work') return `/${locale}/work`
  if (serviceSlugs.includes(slug)) return `/${locale}/services/${slug}`
  if (isCaseSlug(slug))
    return `/${locale}/${caseSlug(slug.slice(casePrefix.length))}`
  throw new Error(`Unknown service: ${slug}`)
}

export function casePath(locale, key) {
  return pagePath(locale, caseSlug(key))
}

export function absoluteUrl(path) {
  if (!path.startsWith('/') || path.startsWith('//'))
    throw new Error('Expected an absolute site path')
  return `${origin}${path}`
}

export const personId = `${origin}/#person`

export function breadcrumbNode(path, items) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absoluteUrl(path)}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export function faqNode(path, items) {
  return {
    '@type': 'FAQPage',
    '@id': `${absoluteUrl(path)}#faq`,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

export function serviceNode(path, service) {
  const url = absoluteUrl(path)
  return {
    '@type': 'Service',
    '@id': `${url}#service`,
    name: service.name,
    description: service.description,
    serviceType: service.name,
    url,
    provider: { '@id': personId },
    areaServed: areaServed.map((name) => ({ '@type': 'Country', name })),
    availableLanguage: locales.map((code) => ({
      '@type': 'Language',
      name: schemaLanguages[code],
      alternateName: code,
    })),
  }
}

export function head({
  locale,
  title,
  description,
  role,
  slug = null,
  graph = [],
  about = null,
}) {
  const path = pagePath(locale, slug)
  const canonical = absoluteUrl(path)
  const breadcrumb = graph.find((node) => node['@type'] === 'BreadcrumbList')
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId,
        name: 'Shavkatbek Ruzibekov',
        url: origin,
        jobTitle: role,
        image: `${origin}${versioned('/assets/avatar.jpg')}`,
        email: 'ruzibekov44@gmail.com',
        sameAs: ['https://t.me/ruzibekov_sh'],
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: origin,
        name: 'Shavkatbek Ruzibekov',
        inLanguage: locales,
        publisher: { '@id': personId },
      },
      {
        '@type': 'WebPage',
        '@id': `${canonical}#page`,
        url: canonical,
        name: title,
        description,
        inLanguage: locale,
        isPartOf: { '@id': `${origin}/#website` },
        about: { '@id': about ?? personId },
        ...(breadcrumb ? { breadcrumb: { '@id': breadcrumb['@id'] } } : {}),
      },
      ...graph,
    ],
  }
  const json = JSON.stringify(schema).replace(/</g, '\\u003c')
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="author" content="Shavkatbek Ruzibekov">
<meta name="google-site-verification" content="rGHEWrWbzSXJ61d0tmQsZc5wO5qhwP5FtKCLaTwnMQU">
<meta name="yandex-verification" content="67977ee61149d111">
<meta name="theme-color" content="${defaultCanvas}" id="themeColorMeta">
<link rel="canonical" href="${canonical}">
${locales.map((language) => `<link rel="alternate" hreflang="${language}" href="${absoluteUrl(pagePath(language, slug))}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${absoluteUrl(pagePath('uz', slug))}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${ogLocales[locale]}">
${locales
  .filter((language) => language !== locale)
  .map(
    (language) =>
      `<meta property="og:locale:alternate" content="${ogLocales[language]}">`,
  )
  .join('\n')}
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${origin}${versioned('/assets/og-products.png')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${origin}${versioned('/assets/og-products.png')}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${fontPreloads(locale)
  .map(
    (href) =>
      `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`,
  )
  .join('\n')}
<script>${themeInit}</script>
<link rel="stylesheet" href="${stylesheet.path}">
<script type="application/ld+json">${json}</script>`
}

const languageCountries = {
  uz: 'uz',
  ru: 'ru',
  en: 'gb',
  ky: 'kg',
  kk: 'kz',
  tg: 'tj',
  uk: 'ua',
  be: 'by',
}

const languageFlag = (locale) =>
  `<img class="language-flag" src="${versioned(`/assets/flags/${languageCountries[locale]}.svg`)}" width="20" height="15" alt="" aria-hidden="true">`

export const typoBreaks = (value) =>
  lineBreaks(value).replace(/ ([—–]) /g, '&nbsp;$1 ')

export const telegramUrl = 'https://t.me/ruzibekov_sh'

export function header({ locale, copy, ui, slug = null }) {
  const home = pagePath(locale)
  const navLinks = ['services', 'work', 'about', 'faq']
    .map(
      (key) =>
        `<a href="${home}#${key === 'work' ? 'work' : key}">${escapeHtml(copy.navigation[key])}</a>`,
    )
    .join('')
  const languages = `<details class="language-picker" data-language-picker><summary aria-label="${escapeHtml(copy.navigation.language)}: ${escapeHtml(ui.languageName)}">${languageFlag(locale)}<span>${locale.toUpperCase()}</span>${icon('i-chevron-down', 'language-chevron')}</summary><nav class="language-list" aria-label="${escapeHtml(copy.navigation.language)}">${locales.map((language) => `<a href="${pagePath(language, slug)}" lang="${language}" hreflang="${language}"${language === locale ? ' aria-current="page"' : ''}>${languageFlag(language)}<span>${escapeHtml(languageNames[language])}</span></a>`).join('')}</nav></details>`
  return `<a class="skip-link" href="#main">${escapeHtml(ui.accessibility.skipLink)}</a>
<header class="top" data-header><div class="wrap">
<a class="brand" href="${home}" aria-label="${escapeHtml(ui.accessibility.homeLabel)}"><span class="mark" aria-hidden="true">SR</span><span class="brand-name">Shavkatbek Ruzibekov</span></a>
<nav class="nav" aria-label="${escapeHtml(ui.accessibility.mainNavigation)}">${navLinks}</nav>
<div class="top-actions">${languages}
<button class="theme-toggle" type="button" data-theme-toggle aria-pressed="false" aria-label="${escapeHtml(ui.controls.switchToDark)}" data-light-action="${escapeHtml(ui.controls.switchToLight)}" data-dark-action="${escapeHtml(ui.controls.switchToDark)}">${icon('i-contrast')}</button>
<a class="btn k sm" href="${telegramUrl}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(ui.contact.cta)}">${icon('l-telegram')}<span>${escapeHtml(copy.navigation.contact)}</span></a>
<button class="menu-toggle" type="button" data-menu-toggle data-menu-label="${escapeHtml(ui.controls.menu)}" data-close-label="${escapeHtml(ui.controls.closeMenu)}" aria-label="${escapeHtml(ui.controls.menu)}" aria-controls="mobile-menu" aria-expanded="false">${icon('i-menu', 'menu-open')}${icon('i-x', 'menu-close')}</button></div></div></header>
<nav class="sheetnav" id="mobile-menu" data-mobile-menu aria-label="${escapeHtml(ui.accessibility.mobileNavigation)}">${navLinks}</nav>`
}

export function processSteps({ ui }) {
  return `<ol class="pr">${Object.values(ui.process)
    .map(
      (step, index) =>
        `<li class="st" data-r style="--i:${index}"><span class="num" aria-hidden="true">0${index + 1}</span><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.description)}</p></li>`,
    )
    .join('')}</ol>`
}

export function faq({ copy, ui }) {
  return `<section class="sec" id="faq" aria-labelledby="faq-title"><div class="wrap"><header class="sec-h" data-r><p class="eyebrow">${escapeHtml(copy.navigation.faq)}</p><h2 class="h2" id="faq-title">${typoBreaks(ui.faq.title)}</h2></header><div class="faq-list" data-r>${copy.faq.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</div></div></section>`
}

export function contactSection({ copy, ui }) {
  const strap = ui.contact.strap
    .split(' · ')
    .map((part) => `<span class="nw">${escapeHtml(part)}</span>`)
    .join(' · ')
  return `<section class="sec" id="contact" aria-labelledby="contact-title"><div class="wrap"><div class="ct" data-r><div><p class="eyebrow">${escapeHtml(copy.navigation.contact)}</p><h2 class="h2" id="contact-title">${typoBreaks(ui.contact.title)}</h2><p class="lead">${escapeHtml(ui.contact.intro)}</p><p class="strap">${strap}</p></div><div class="ct-r"><a class="btn p" href="${telegramUrl}" target="_blank" rel="noopener noreferrer">${icon('l-telegram')}<span class="button-content">${escapeHtml(ui.contact.cta)}</span></a><a class="way" href="mailto:ruzibekov44@gmail.com">${icon('i-mail')}<span>ruzibekov44@gmail.com</span></a></div></div></div></section>`
}

export function footer({ ui, copy }) {
  return `${contactSection({ copy, ui })}
<footer class="foot"><div class="wrap"><span>© 2026 Shavkatbek Ruzibekov</span><span>${escapeHtml(ui.footer.line)}</span><a class="to-top" href="#top" aria-label="${escapeHtml(copy.navigation.home)}">${icon('i-arrow-up')}</a></div></footer>`
}

export function renderDocument({
  locale,
  copy,
  ui,
  title,
  description,
  slug = null,
  graph = [],
  about = null,
  body,
  bodyClass = '',
  bodyEnd = '',
}) {
  return `<!doctype html>
<html lang="${locale}" data-theme="light"><head>${head({ locale, title, description, role: copy.identity.role, slug, graph, about })}</head>
<body class="${escapeHtml(bodyClass)}" id="top">${spriteMarkup}${header({ locale, copy, ui, slug })}<main id="main">${body}</main>${footer({ copy, ui })}${bodyEnd}
<script src="${script.path}" defer></script></body></html>`
}
