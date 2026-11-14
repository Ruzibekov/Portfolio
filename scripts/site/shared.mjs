import { readFileSync } from 'node:fs'
import { icon, spriteMarkup } from './icons.mjs'
import {
  fontPreloads,
  script,
  stylesheet,
  themeColors,
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
export const showroomLead = ['agentmama', 'majiidtv', 'miyolo']
const sourceCases = JSON.parse(
  readFileSync(new URL('../../content/cases.json', import.meta.url), 'utf8'),
).cases
export const caseKeys = [
  ...showroomLead,
  ...sourceCases
    .map((item) => item.key)
    .filter((key) => !showroomLead.includes(key)),
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
  imageAlt,
}) {
  if (!imageAlt) throw new Error(`Missing social image alt for ${locale}`)
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
<meta name="theme-color" content="${themeColors.dark}" data-dark="${themeColors.dark}" data-light="${themeColors.light}" id="themeColorMeta">
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
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
<meta property="og:image" content="${origin}${versioned('/assets/og-products-square.png')}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="1200">
<meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
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
<style>@view-transition{navigation:auto}</style>
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
  lineBreaks(value)
    .replace(/ ([—–]) ([^\s<]{1,8})(?=[\s<.,!?]|$)/g, '&nbsp;$1&nbsp;$2')
    .replace(/ ([—–])/g, '&nbsp;$1')

export const telegramUrl = 'https://t.me/ruzibekov_sh'

const navKeys = ['services', 'work', 'about', 'faq']

const navAnchors = (locale, copy, attributes = '') =>
  navKeys
    .map(
      (key) =>
        `<a href="${pagePath(locale)}#${key}" data-nav-link="${key}"${attributes}>${escapeHtml(copy.navigation[key])}</a>`,
    )
    .join('')

export function header({ locale, copy, ui, slug = null }) {
  const home = pagePath(locale)
  const languages = `<details class="language-picker" data-language-picker><summary class="language-trigger" aria-label="${escapeHtml(copy.navigation.language)}: ${escapeHtml(ui.languageName)}">${languageFlag(locale)}<span class="language-code">${locale.toUpperCase()}</span>${icon('i-chevron-down', 'language-chevron')}</summary><nav class="language-list" aria-label="${escapeHtml(copy.navigation.language)}">${locales.map((language) => `<a href="${pagePath(language, slug)}" lang="${language}" hreflang="${language}"${language === locale ? ' aria-current="page"' : ''}>${languageFlag(language)}<span>${escapeHtml(languageNames[language])}</span></a>`).join('')}</nav></details>`
  return `<a class="skip-link" href="#main">${escapeHtml(ui.accessibility.skipLink)}</a>
<header class="nav" data-header><div class="wrap nav-bar">
<a class="brand" href="${home}" aria-label="${escapeHtml(ui.accessibility.homeLabel)}"><span class="mark" aria-hidden="true">SR</span><span class="brand-name">Shavkatbek Ruzibekov</span></a>
<nav class="nav-links" aria-label="${escapeHtml(ui.accessibility.mainNavigation)}">${navAnchors(locale, copy)}</nav>
<div class="nav-actions">${languages}
<button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-pressed="true" aria-label="${escapeHtml(ui.controls.switchToLight)}" data-light-action="${escapeHtml(ui.controls.switchToLight)}" data-dark-action="${escapeHtml(ui.controls.switchToDark)}">${icon('i-contrast')}</button>
<a class="btn btn-nav" href="${telegramUrl}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(ui.contact.cta)}" data-nav-cta>${icon('l-telegram')}<span>${escapeHtml(copy.navigation.contact)}</span></a>
<button class="icon-btn menu-toggle" type="button" data-menu-toggle data-menu-label="${escapeHtml(ui.controls.menu)}" data-close-label="${escapeHtml(ui.controls.closeMenu)}" aria-label="${escapeHtml(ui.controls.menu)}" aria-controls="mobile-menu" aria-expanded="false">${icon('i-menu', 'menu-open')}${icon('i-x', 'menu-close')}</button></div></div></header>
<div class="menu-scrim" data-menu-scrim></div>
<div class="menu-sheet" id="mobile-menu" data-mobile-menu role="dialog" aria-modal="true" aria-label="${escapeHtml(ui.accessibility.mobileNavigation)}" inert><nav class="menu-links" aria-label="${escapeHtml(ui.accessibility.mobileNavigation)}">${navAnchors(locale, copy)}</nav><a class="btn btn-primary btn-block" href="${telegramUrl}" target="_blank" rel="noopener noreferrer">${icon('l-telegram')}<span>${escapeHtml(ui.contact.cta)}</span></a></div>`
}

export function processSteps({ ui }) {
  return `<ol class="process">${Object.values(ui.process)
    .map(
      (step, index) =>
        `<li class="process-step"><span class="process-num" aria-hidden="true">0${index + 1}</span><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.description)}</p></li>`,
    )
    .join('')}</ol>`
}

export function faq({ copy, ui, title = ui.faq.title }) {
  return `<section class="sec faq-sec" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 class="h2" id="faq-title">${typoBreaks(title)}</h2><div class="faq-list">${copy.faq.map((item) => `<details class="faq-item"><summary><span class="faq-q">${escapeHtml(item.question)}</span>${icon('i-plus', 'faq-icon')}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</div></div></section>`
}

export function contactSection({ copy, ui }) {
  const strap = ui.contact.strap
    .split(' · ')
    .map((part) => `<span class="nw">${escapeHtml(part)}</span>`)
    .join(' · ')
  return `<section class="sec contact-sec" id="contact" aria-labelledby="contact-title"><div class="wrap"><div class="contact" data-contact><div class="contact-copy"><h2 class="h2" id="contact-title">${typoBreaks(
    ui.contact.title
      .split('\n')
      .map((part) => part.trim())
      .join(' '),
  )}</h2><p class="lead">${escapeHtml(ui.contact.intro)}</p><p class="contact-strap">${strap}</p></div><div class="contact-actions"><div class="contact-slab"><span class="contact-handle">${icon('l-telegram')}<span class="mono">${escapeHtml(telegramUrl.replace('https://t.me/', '@'))}</span></span><a class="btn btn-primary btn-block btn-tall" href="${telegramUrl}" target="_blank" rel="noopener noreferrer" data-primary-cta>${icon('l-telegram')}<span class="button-content">${escapeHtml(ui.contact.cta)}</span></a><a class="mail-link" href="mailto:ruzibekov44@gmail.com">${icon('i-mail')}<span>ruzibekov44@gmail.com</span></a></div></div></div></div></section>`
}

export function footer({ locale, ui, copy, words }) {
  return `${contactSection({ copy, ui })}
<footer class="footer"><div class="wrap footer-row"><p class="footer-brand"><span class="mark" aria-hidden="true">SR</span><span>${escapeHtml(ui.footer.line)}</span></p><ul class="footer-links">${navKeys.map((key) => `<li><a href="${pagePath(locale)}#${key}"><span>${escapeHtml(copy.navigation[key])}</span></a></li>`).join('')}</ul><a class="btn btn-quiet to-top" href="#top">${icon('i-arrow-up')}<span>${escapeHtml(words.backToTop)}</span></a><p class="footer-copy">© 2026 Shavkatbek Ruzibekov</p></div></footer>`
}

export function renderDocument({
  locale,
  copy,
  ui,
  words,
  title,
  description,
  slug = null,
  graph = [],
  about = null,
  body,
  bodyClass = '',
  bodyEnd = '',
}) {
  if (!words?.backToTop) throw new Error(`Missing page words for ${locale}`)
  return `<!doctype html>
<html lang="${locale}" data-theme="dark"><head>${head({ locale, title, description, role: copy.identity.role, slug, graph, about, imageAlt: `Shavkatbek Ruzibekov: ${words.title.join(' ')}` })}</head>
<body class="${escapeHtml(bodyClass)}" id="top">${spriteMarkup}${header({ locale, copy, ui, slug })}<main id="main">${body}</main>${footer({ locale, copy, ui, words })}${bodyEnd}
<script src="${script.path}" defer></script></body></html>`
}
