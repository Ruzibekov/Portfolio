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

export function pagePath(locale, slug = null) {
  if (!locales.includes(locale))
    throw new Error(`Unsupported locale: ${locale}`)
  if (slug !== null && slug !== 'work' && !serviceSlugs.includes(slug))
    throw new Error(`Unknown service: ${slug}`)
  if (slug === 'work') return `/${locale}/work`
  return `/${locale}${slug ? `/services/${slug}` : ''}`
}

export function absoluteUrl(path) {
  if (!path.startsWith('/') || path.startsWith('//'))
    throw new Error('Expected an absolute site path')
  return `${origin}${path}`
}

export function head({
  locale,
  title,
  description,
  slug = null,
  service = null,
  canonicalPath = null,
}) {
  const path = canonicalPath ?? pagePath(locale, slug)
  const canonical = absoluteUrl(path)
  const personId = `${origin}/#person`
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId,
        name: 'Shavkatbek Ruzibekov',
        url: origin,
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
        about: { '@id': service ? `${canonical}#service` : personId },
      },
      ...(service
        ? [
            {
              '@type': 'Service',
              '@id': `${canonical}#service`,
              name: service.name,
              description: service.description,
              serviceType: service.name,
              url: canonical,
              provider: { '@id': personId },
            },
          ]
        : []),
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
<meta name="theme-color" content="#eceef1" id="themeColorMeta">
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
<meta property="og:image" content="${origin}/assets/og-products.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${origin}/assets/og-products.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/onest-latin.woff2" as="font" type="font/woff2" crossorigin>
<script src="/assets/theme-init.js"></script>
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/services.css">
${slug === 'work' ? '<link rel="stylesheet" href="/assets/work-gallery.css">' : ''}
<link rel="stylesheet" href="/assets/bento.css">
<script type="application/ld+json">${json}</script>`
}

export function header({ locale, copy, ui, slug = null }) {
  const home = pagePath(locale)
  const navigation = ['work', 'services', 'about']
  const navLinks = navigation
    .map(
      (key) =>
        `<a href="${home}#${key}">${escapeHtml(copy.navigation[key])}</a>`,
    )
    .join('')
  const languages = `<details class="language-picker"><summary>${escapeHtml(ui.languageName)}<span aria-hidden="true">⌄</span></summary><nav class="language-list" aria-label="${escapeHtml(copy.navigation.language)}">${locales.map((language) => `<a href="${pagePath(language, slug)}" lang="${language}" hreflang="${language}"${language === locale ? ' aria-current="page"' : ''}>${escapeHtml(languageNames[language])}</a>`).join('')}</nav></details>`
  return `<a class="skip-link" href="#main">${escapeHtml(ui.accessibility.skipLink)}</a>
<header class="site-header"><div class="wrap header-inner">
<a class="wordmark" href="${home}" aria-label="${escapeHtml(ui.accessibility.homeLabel)}"><span>Shavkatbek</span><span>Ruzibekov</span></a>
<nav class="nav" aria-label="${escapeHtml(ui.accessibility.mainNavigation)}">${navLinks}</nav>
<div class="header-actions">${languages}
<button class="theme-toggle" type="button" data-theme-toggle aria-pressed="true" aria-label="${escapeHtml(ui.controls.switchToLight)}" data-light-label="${escapeHtml(ui.controls.lightTheme)}" data-dark-label="${escapeHtml(ui.controls.darkTheme)}" data-light-action="${escapeHtml(ui.controls.switchToLight)}" data-dark-action="${escapeHtml(ui.controls.switchToDark)}">${escapeHtml(ui.controls.lightTheme)}</button>
<a class="header-link" href="#contact">${escapeHtml(copy.navigation.contact)} <span aria-hidden="true">↗</span></a>
<button class="menu-toggle" type="button" data-menu-toggle data-menu-label="${escapeHtml(ui.controls.menu)}" data-close-label="${escapeHtml(ui.controls.closeMenu)}" aria-controls="mobile-menu" aria-expanded="false">${escapeHtml(ui.controls.menu)}</button></div></div>
<nav class="wrap mobile-menu" id="mobile-menu" data-mobile-menu aria-label="${escapeHtml(ui.accessibility.mobileNavigation)}" hidden>${navLinks}<a href="${home}#faq">${escapeHtml(copy.navigation.faq)}</a><a href="#contact">${escapeHtml(copy.navigation.contact)}</a></nav></header>`
}

export function processSteps({ ui }) {
  return `<ol class="service-process">${Object.values(ui.process)
    .map(
      (step, index) =>
        `<li><span class="service-step-number" aria-hidden="true">0${index + 1}</span><div><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.description)}</p></div></li>`,
    )
    .join('')}</ol>`
}

export function faq({ copy, ui }) {
  return `<section class="wrap service-section service-faq" id="faq" aria-labelledby="faq-title"><h2 id="faq-title">${lineBreaks(ui.faq.title)}</h2><div>${copy.faq.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join('')}</div></section>`
}

export function footer({ copy, ui }) {
  return `<section class="wrap contact service-contact" id="contact" aria-labelledby="contact-title"><div><p class="eyebrow">${escapeHtml(copy.navigation.contact)}</p><h2 id="contact-title">${lineBreaks(ui.contact.title)}</h2></div><div><p>${escapeHtml(ui.contact.intro)}</p><a class="button" href="https://t.me/ruzibekov_sh" target="_blank" rel="noopener noreferrer"><span class="button-content" data-magnetic-content>${escapeHtml(ui.contact.cta)} <span aria-hidden="true">↗</span></span></a><a class="service-email" href="mailto:ruzibekov44@gmail.com">ruzibekov44@gmail.com</a></div></section>
<footer class="wrap site-footer service-footer"><p>Shavkatbek Ruzibekov</p><p>${escapeHtml(ui.footer.line)}</p><a href="#top">↑</a></footer>`
}

export function renderDocument({
  locale,
  copy,
  ui,
  title,
  description,
  slug = null,
  service = null,
  body,
  bodyClass = '',
  canonicalPath = null,
}) {
  return `<!doctype html>
<html lang="${locale}" data-theme="light"><head>${head({ locale, title, description, slug, service, canonicalPath })}</head>
<body class="${escapeHtml(bodyClass)}" id="top">${header({ locale, copy, ui, slug })}<main id="main">${body}</main>${footer({ locale, copy, ui })}
<script src="/assets/site.js" defer></script></body></html>`
}
