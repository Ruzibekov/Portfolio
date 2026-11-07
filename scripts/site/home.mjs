import { readFileSync } from 'node:fs'
import { icon } from './icons.mjs'
import { imageEntry, imageTag, versioned } from './assets.mjs'
import { countProjects, projectTag, renderIndex } from './index.mjs'

const future = JSON.parse(
  readFileSync(
    new URL('../../content/future-ui.json', import.meta.url),
    'utf8',
  ),
).locales
const heroKey = 'monarh'
const heroSizes = '(min-width: 1021px) 640px, calc(100vw - 40px)'
const indexLimit = 8
const serviceProofs = {
  'web-development': 'monarh',
  'mobile-apps': 'avtopark',
  'business-automation': 'payqr',
  'ai-integrations': 'agentmama',
}
const chevron =
  '<svg class="bt-chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 18 6-6-6-6"/></svg>'
const shotSizes = '(min-width: 1021px) 560px, 100vw'

function serviceShot(imageKey) {
  const { variants } = imageEntry(imageKey)
  const large = variants.at(-1)
  const attributes = `src="${large.src}" srcset="${variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ')}" sizes="${shotSizes}" alt="" width="${large.width}" height="${large.height}" loading="lazy" decoding="async"`
  return `<span class="bt-well"><span class="bt-frame"><span class="bt-pz"><img class="bt-g" ${attributes}><span class="bt-wipe"><img class="bt-in" ${attributes}></span><span class="bt-scanw"><i class="bt-scan"></i></span></span></span></span>`
}

function serviceChat(chat, e) {
  const lines = [
    `<span class="ch-u" style="--k:0">${e(chat.start)}</span>`,
    `<span class="ch-b" style="--k:1">${e(chat.ask)}</span>`,
    ...chat.opts.map(
      (option, index) =>
        `<span class="ch-o" style="--k:${index + 2}">${index + 1} · ${e(option)}</span>`,
    ),
  ]
  return `<span class="bt-well" aria-hidden="true"><span class="bt-frame"><span class="ch">${lines.join('')}</span></span></span>`
}

export function homeFaqItems(copy, futureCopy) {
  return [
    ...copy.faq,
    { question: futureCopy.faq.aiQuestion, answer: futureCopy.faq.aiAnswer },
  ]
}

export function technologies(cases) {
  return [
    ...new Set(
      cases.flatMap((item) => item.stack.split(',').map((part) => part.trim())),
    ),
  ].filter(Boolean)
}

export function renderHome({
  locale,
  copy,
  ui,
  words,
  cases,
  caseCopy,
  shared,
}) {
  if (!words) throw new Error(`Missing portfolio presentation for ${locale}`)
  const e = shared.escapeHtml
  const counts = countProjects(cases)
  const hero = cases.find((item) => item.key === heroKey)
  const heroWords = caseCopy[heroKey]
  const stats = `<b>${counts.total}</b> ${e(words.stats.projects)} · <b>${counts.stores}</b> ${e(words.stats.stores)} · <b>${counts.online}</b> ${e(words.stats.online)}`
  const steps = words.build
    .map(
      (label, index) =>
        `<span class="bs"><span aria-hidden="true">0${index + 1}</span> ${e(label)}</span>`,
    )
    .join('')
  const heading = words.title
    .map((line) => `<span class="wd">${e(line)}</span>`)
    .join('')
  const heroBlock = `<section class="hero" aria-labelledby="intro-title"><div class="wrap"><div class="hero-g"><div class="hero-copy">
<p class="eyebrow">${e(copy.hero.eyebrow)}</p>
<h1 class="h1" id="intro-title" data-build-title>${heading}</h1>
<p class="mono" data-r>${stats}</p>
<p class="lead" data-r style="--i:1">${e(words.statement)}</p>
<div class="cta" data-r style="--i:1"><a class="btn p" href="${shared.telegramUrl}" target="_blank" rel="noopener noreferrer">${icon('l-telegram')}<span>${e(copy.hero.primaryCta)}</span></a><a class="btn g" href="#work"><span>${e(copy.hero.secondaryCta)}</span>${icon('i-arrow-down')}</a></div>
</div><div class="hero-art"><div class="build" data-build data-st="1"><div class="bimg" data-build-image>${imageTag({ key: hero.image, alt: '', sizes: heroSizes, className: 'l1', lazy: false })}<span class="hw"><span class="hi">${imageTag({ key: hero.image, alt: e(ui.caseStudies[heroKey].alt), sizes: heroSizes, className: 'l2', priority: true })}</span></span><span class="hs" aria-hidden="true"><i></i></span></div><div class="bsteps" aria-hidden="true">${steps}</div><div class="bname"><b>${e(heroWords.title)}</b><span>${e(projectTag(hero, ui))}</span></div></div></div></div></div></section>`
  const bento = ui.services.bento
  const serviceTiles = shared.serviceSlugs
    .map((slug, index) => {
      const service = copy.services[slug]
      const title = service.short.replace('Telegram-', 'Telegram‑')
      const proofKey = serviceProofs[slug]
      const well = proofKey
        ? serviceShot(cases.find((item) => item.key === proofKey).image)
        : serviceChat(bento.chat, e)
      const caption = proofKey
        ? `${bento.proof}: ${caseCopy[proofKey].title}`
        : bento.chat.cap
      return `<a class="bt bt-${slug}" href="${shared.pagePath(locale, slug)}" aria-label="${e(service.name)}" data-r style="--i:${index}" data-bt><span class="bt-h"><span class="num" aria-hidden="true">0${index + 1}</span>${chevron}</span><div class="bt-b"><h3>${e(title)}</h3><span class="bt-p">${e(service.pitch)}</span><span class="bt-tg">${service.tags.map(e).join(' · ')}</span></div>${well}<span class="bt-cap">${e(caption)}</span></a>`
    })
    .join('')
  const servicesBlock = `<section class="sec sv-s2" id="services" aria-labelledby="services-title"><div class="wrap"><header class="sec-h" data-r><p class="eyebrow">${e(copy.navigation.services)}</p><h2 class="h2" id="services-title">${shared.typoBreaks(ui.services.title.replace(/\n/g, ' '))}</h2></header><div class="sv-grid">${serviceTiles}</div></div></section>`
  const { section, overlays } = renderIndex({
    locale,
    copy,
    ui,
    words,
    cases,
    caseCopy,
    limit: indexLimit,
    eyebrow: ui.work.eyebrow,
    heading: shared.typoBreaks(ui.work.title),
    footerLink: `<p class="all-link"><a class="text-link b-all-projects" href="${shared.pagePath(locale, 'work')}">${e(ui.work.allProjects)} ${icon('i-arrow-right')}</a></p>`,
  })
  const workBlock = `<section class="sec" id="work" aria-labelledby="work-title"><div class="wrap">${section}</div></section>`
  const processBlock = `<section class="sec" id="process" aria-labelledby="process-title"><div class="wrap"><header class="sec-h" data-r><p class="eyebrow">${e(words.processEyebrow)}</p><h2 class="h2" id="process-title">${e(words.processTitle)}</h2></header>${shared.processSteps({ ui })}</div></section>`
  const stack = technologies(cases)
    .map((name) => `<li>${e(name)}</li>`)
    .join('')
  const aboutBlock = `<section class="sec" id="about" aria-labelledby="about-title"><div class="wrap ab"><div data-r><p class="eyebrow">${e(copy.navigation.about)}</p><div class="me"><img src="${versioned('/assets/avatar.jpg')}" alt="Shavkatbek Ruzibekov" width="68" height="68" loading="lazy" decoding="async"><div><b>Shavkatbek Ruzibekov</b><span>${e(copy.identity.role)}</span></div></div><h2 class="h2" id="about-title">${e(words.aboutTitle)}</h2><p>${e(words.aboutText)}</p><p>${e(ui.about.title)}</p></div><ul class="stk" data-r style="--i:1" aria-label="${e(copy.caseStudy.stack)}">${stack}</ul></div></section>`
  const faqItems = homeFaqItems(copy, future[locale])
  const faqBlock = shared.faq({ copy: { ...copy, faq: faqItems }, ui })
  return shared.renderDocument({
    locale,
    copy,
    ui,
    title: copy.seo.title,
    description: copy.seo.description,
    graph: [shared.faqNode(shared.pagePath(locale), faqItems)],
    body: `${heroBlock}${servicesBlock}${workBlock}${processBlock}${aboutBlock}${faqBlock}`,
    bodyClass: 'home-page',
    bodyEnd: overlays,
  })
}
