import { readFileSync } from 'node:fs'
import { icon } from './icons.mjs'
import { versioned } from './assets.mjs'
import { countProjects, monoText, projectType } from './project.mjs'
import { projectStatus, slab } from './slab.mjs'
import { galleryLabels } from './gallery-labels.mjs'
import { catalogueNumber, renderShowroom } from './index.mjs'

const future = JSON.parse(
  readFileSync(
    new URL('../../content/future-ui.json', import.meta.url),
    'utf8',
  ),
).locales
const motionCopy = JSON.parse(
  readFileSync(new URL('../../content/motion.json', import.meta.url), 'utf8'),
).locales
const heroSequence = [
  'agentmama',
  'majiidtv',
  'besttracker',
  'miyolo',
  'stefa',
  'wottank',
]
const heroPhoneSequence = ['besttracker', 'agentmama', 'stefa']
export const serviceProofs = {
  'web-development': 'miyolo',
  'telegram-bots': null,
  'mobile-apps': 'besttracker',
  'business-automation': 'payqr',
  'ai-integrations': 'agentmama',
}
const heroSizes = '(min-width: 1024px) 640px, 300px'
const standSizes = '(min-width: 1024px) 520px, 1px'
const indexLimit = 8
const two = (value) => String(value).padStart(2, '0')

function homeFaqItems(copy, futureCopy) {
  return [
    ...copy.faq,
    { question: futureCopy.faq.aiQuestion, answer: futureCopy.faq.aiAnswer },
  ]
}

function technologies(cases) {
  return [
    ...new Set(
      cases.flatMap((item) => item.stack.split(',').map((part) => part.trim())),
    ),
  ].filter(Boolean)
}

function projectHref({ shared, locale, item }) {
  return shared.caseKeys.includes(item.key)
    ? shared.casePath(locale, item.key)
    : `${shared.pagePath(locale, 'work')}#${item.id}`
}

export function heroTitle(lines, e) {
  let index = 0
  return lines
    .map((line) => {
      const arrow = /\s*→\s*$/.test(line)
      const words = line
        .replace(/\s*→\s*$/, '')
        .split(/\s+/)
        .filter(Boolean)
      const masks = words
        .map((word, position) => {
          const tail =
            arrow && position === words.length - 1
              ? icon('i-arrow-right', 'h1-arrow')
              : ''
          return `<span class="rise-mask"><span class="rise" style="--i:${index++}">${e(word)}${tail}</span></span>`
        })
        .join(' ')
      return `<span class="h1-line">${masks}</span>`
    })
    .join('')
}

function heroScene({ locale, copy, ui, words, cases, caseCopy, shared }) {
  const e = shared.escapeHtml
  const labels = galleryLabels[locale]
  const viewLabel = motionCopy[locale]?.viewCase
  if (!viewLabel) throw new Error(`Missing motion copy for ${locale}`)
  const entries = heroSequence.map((key, index) => {
    const item = cases.find((entry) => entry.key === key)
    if (!item?.screen) throw new Error(`Hero slab needs a capture: ${key}`)
    return {
      item,
      words: caseCopy[key],
      d: index,
      m: heroPhoneSequence.indexOf(key),
    }
  })
  const figures = entries
    .map(({ item, words: itemWords, d, m }) =>
      slab({
        item,
        words: itemWords,
        sizes: heroSizes,
        alt: itemWords.alt,
        lazy: d > 2 && m < 0,
        priority: d === 0 || m === 0,
        focusable: d === 0,
        hidden: d !== 0,
        className: 'hero-slab',
        attributes: ` data-d="${d}" data-m="${m}" data-cursor="${e(viewLabel)}"`,
        trio: true,
      }),
    )
    .join('')
  const placards = entries
    .map(
      ({ item, words: itemWords, d, m }) =>
        `<a class="placard" href="${projectHref({ shared, locale, item })}" data-d="${d}" data-m="${m}" data-key="${e(item.key)}"${shared.caseKeys.includes(item.key) ? '' : ` data-sheet-key="${e(item.key)}"`}><span class="placard-num" aria-hidden="true">${two(catalogueNumber(cases, item.key))}</span><span class="placard-body"><span class="placard-title">${e(itemWords.title)}</span><span class="placard-meta"><span>${e(projectType(item, ui))}</span><span class="mono">${e(monoText(item.stack))}</span></span></span>${projectStatus({ item, words: itemWords, presentation: words, labels })}</a>`,
    )
    .join('')
  const dots = entries
    .map(
      ({ words: itemWords, d, m }) =>
        `<button class="minimap-dot" type="button" data-d="${d}" data-m="${m}" data-title="${e(itemWords.title)}" aria-label="${d + 1}. ${e(itemWords.title)}" tabindex="${d === 0 ? 0 : -1}"><span class="minimap-pip"></span></button>`,
    )
    .join('')
  const steps = heroSequence
    .map(
      (_, index) =>
        `<span class="hero-step" style="--step:${index}" aria-hidden="true"></span>`,
    )
    .join('')
  const minimap = `<div class="minimap" data-minimap role="group" aria-label="${e(words.minimapLabel)}" hidden><span class="minimap-step" data-minimap-step aria-hidden="true">1 / ${heroSequence.length}</span><button class="icon-btn icon-btn-lg minimap-nav" type="button" data-hero-step="-1" aria-label="${e(copy.caseStudy.previous)}">${icon('i-arrow-left')}</button><div class="minimap-rail">${dots}</div><button class="icon-btn icon-btn-lg minimap-nav" type="button" data-hero-step="1" aria-label="${e(copy.caseStudy.next)}">${icon('i-arrow-right')}</button></div><p class="sr" data-hero-live aria-live="polite" aria-atomic="true"></p>`
  return { figures, placards, minimap, steps }
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
  const scene = heroScene({
    locale,
    copy,
    ui,
    words,
    cases,
    caseCopy,
    shared,
  })
  const stats = [
    [counts.total, words.stats.projects],
    [counts.stores, words.stats.stores],
    [counts.online, words.stats.online],
  ]
    .map(([value, unit]) => `<li><b>${value}</b><span>${e(unit)}</span></li>`)
    .join('')
  const heroBlock = `<section class="hero" aria-labelledby="intro-title" data-hero><div class="hero-track" data-hero-track>${scene.steps}<div class="hero-stage" data-hero-stage>
<div class="hero-copy"><p class="hero-name">Shavkatbek Ruzibekov</p><h1 class="h1" id="intro-title">${heroTitle(words.title, e)}</h1><p class="lead hero-lead">${e(words.statement)}</p><ul class="stats" aria-label="${e(copy.navigation.work)}">${stats}</ul><div class="cta-row"><a class="btn btn-primary" href="${shared.telegramUrl}" target="_blank" rel="noopener noreferrer" data-primary-cta>${icon('l-telegram')}<span>${e(copy.hero.primaryCta)}</span></a><a class="btn btn-secondary" href="#work"><span>${e(copy.hero.secondaryCta)}</span>${icon('i-arrow-down')}</a></div></div>
<div class="hall" data-hall role="group" aria-label="${e(words.hallLabel)}" tabindex="0"><div class="world" data-world>${scene.figures}</div></div>
<div class="hero-dock">${scene.minimap}<div class="placards" data-placards>${scene.placards}</div></div>
</div></div></section>`
  const bento = ui.services.bento
  const serviceRows = shared.serviceSlugs
    .map((slug, index) => {
      const service = copy.services[slug]
      const proofKey = serviceProofs[slug]
      const caption = proofKey
        ? `${bento.proof}: ${caseCopy[proofKey].title}`
        : bento.chat.cap
      return `<li><a class="svc-row" href="${shared.pagePath(locale, slug)}" aria-label="${e(service.name)}" data-svc="${index}"${index === 0 ? ' aria-current="true"' : ''}><span class="svc-num" aria-hidden="true">${two(index + 1)}</span><span class="svc-main"><h3>${e(service.short.replace('Telegram-', 'Telegram‑'))}</h3><span class="svc-pitch">${e(service.pitch)}</span><span class="svc-tags">${service.tags.map(e).join(' · ')}</span><span class="svc-cap">${e(caption)}</span></span>${icon('i-arrow-right', 'svc-chevron')}</a></li>`
    })
    .join('')
  const stands = shared.serviceSlugs
    .map((slug, index) => {
      const proofKey = serviceProofs[slug]
      const caption = proofKey
        ? `${bento.proof}: ${caseCopy[proofKey].title}`
        : bento.chat.cap
      const proof = proofKey
        ? slab({
            item: cases.find((entry) => entry.key === proofKey),
            words: caseCopy[proofKey],
            sizes: standSizes,
            className: 'stand-slab',
          })
        : chatSlab(bento.chat, e)
      return `<div class="stand-item${index === 0 ? ' is-active' : ''}" data-stand="${index}"><div class="stand-pose">${proof}</div><p class="stand-cap">${e(caption)}</p></div>`
    })
    .join('')
  const servicesBlock = `<section class="sec" id="services" aria-labelledby="services-title"><div class="wrap"><header class="sec-head"><h2 class="h2" id="services-title">${shared.typoBreaks(ui.services.title.replace(/\n/g, ' '))}</h2><p class="sec-intro">${e(ui.services.intro)}</p></header><div class="services" data-services><ol class="svc-list">${serviceRows}</ol><div class="stand" aria-hidden="true">${stands}</div></div></div></section>`
  const { section, overlays } = renderShowroom({
    locale,
    copy,
    ui,
    words,
    cases,
    caseCopy,
    shared,
    limit: indexLimit,
    variant: 'home',
    heading: ui.work.title
      .split('\n')
      .map((line, index) =>
        index ? `<span class="h2-muted">${e(line)}</span>` : e(line),
      )
      .join(' '),
  })
  const workBlock = `<section class="sec" id="work" aria-labelledby="work-title"><div class="wrap">${section}</div></section>`
  const processBlock = `<section class="sec" id="process" aria-labelledby="process-title"><div class="wrap"><header class="sec-head"><h2 class="h2" id="process-title">${e(words.processTitle)}</h2></header>${shared.processSteps({ ui })}</div></section>`
  const stack = technologies(cases)
    .map((name) => `<li>${e(monoText(name))}</li>`)
    .join('')
  const aboutBlock = `<section class="sec" id="about" aria-labelledby="about-title"><div class="wrap about"><div class="about-copy"><div class="me"><span class="avatar"><img src="${versioned('/assets/avatar.jpg')}" alt="Shavkatbek Ruzibekov" width="72" height="72" loading="lazy" decoding="async"></span><span class="me-text"><b>Shavkatbek Ruzibekov</b><span>${e(copy.identity.role)}</span></span></div><h2 class="h2" id="about-title">${e(words.aboutTitle)}</h2><p class="about-text">${e(words.aboutText)}</p><p class="about-statement">${e(ui.about.title)}</p></div><ul class="stack-panel" aria-label="${e(copy.caseStudy.stack)}">${stack}</ul></div></section>`
  const faqItems = homeFaqItems(copy, future[locale])
  const faqBlock = shared.faq({ copy: { ...copy, faq: faqItems }, ui })
  return shared.renderDocument({
    locale,
    copy,
    ui,
    words,
    title: copy.seo.title,
    description: copy.seo.description,
    graph: [shared.faqNode(shared.pagePath(locale), faqItems)],
    body: `${heroBlock}${servicesBlock}${workBlock}${processBlock}${aboutBlock}${faqBlock}`,
    bodyClass: 'home-page',
    bodyEnd: overlays,
  })
}

export function chatSlab(chat, e) {
  const lines = [
    `<span class="chat-out">${e(chat.start)}</span>`,
    `<span class="chat-in">${e(chat.ask)}</span>`,
    ...chat.opts.map(
      (option, index) =>
        `<span class="chat-opt">${index + 1} · ${e(option)}</span>`,
    ),
  ]
  return `<figure class="slab slab-phone stand-slab" data-kind="phone" aria-hidden="true"><div class="slab-screen chat-screen">${lines.join('')}</div><span class="slab-dim" aria-hidden="true"></span></figure>`
}
