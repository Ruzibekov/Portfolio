import {
  breadcrumbNode,
  casePath,
  escapeHtml,
  faqNode,
  pagePath,
  processSteps,
  faq,
  renderDocument,
  serviceNode,
} from './shared.mjs'
import { icon } from './icons.mjs'
import { imageTag } from './assets.mjs'

const projectSizes =
  '(min-width: 1460px) 700px, (min-width: 900px) 45vw, calc(100vw - 40px)'

const projects = {
  monarh: {
    name: 'Monarh Market',
    image: 'monarh-shot',
    href: 'https://monarhmarket.ru',
  },
  okh: {
    name: 'OKH',
    image: 'okh-shot',
    href: 'https://apps.apple.com/app/id6794669727',
  },
  agentmama: {
    name: 'Agentmama',
    image: 'agentmama-shot',
    href: 'https://agentmama.ru',
  },
  miyolo: {
    name: 'Miyolo / Yolo',
    image: 'miyolo-shot',
    href: 'https://miyolo.ru',
  },
}
const proof = {
  'web-development': ['monarh', 'miyolo'],
  'telegram-bots': [],
  'mobile-apps': ['okh', 'miyolo'],
  'business-automation': ['agentmama'],
  'ai-integrations': ['agentmama'],
}

export function serviceFaq(copy, slug) {
  const service = copy.services[slug]
  const items = Object.hasOwn(service, 'faq') ? service.faq : copy.faq
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.some(
      (item) =>
        !item ||
        typeof item.question !== 'string' ||
        !item.question.trim() ||
        typeof item.answer !== 'string' ||
        !item.answer.trim(),
    ) ||
    new Set(items.map((item) => item.question.trim().toLowerCase())).size !==
      items.length
  )
    throw new Error(`Invalid service FAQ: ${copy.locale}/${slug}`)
  return items
}

export function renderService({ locale, copy, ui, words, slug }) {
  const service = copy.services[slug]
  if (!service || !Object.hasOwn(proof, slug))
    throw new Error(`Missing service content: ${locale}/${slug}`)
  const questions = serviceFaq(copy, slug)
  const evidence = proof[slug]
    .map((key) => {
      const project = projects[key]
      const caseWords = ui.caseStudies[key]
      return `<article class="proof" data-r>${imageTag({ key: project.image, alt: escapeHtml(caseWords.alt), sizes: projectSizes })}<div class="proof-copy"><h3><a href="${casePath(locale, key)}">${escapeHtml(project.name)}</a></h3><p>${escapeHtml(caseWords.summary)}</p><a class="text-link" href="${project.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(caseWords.linkLabel)} ${icon('i-arrow-up-right')}</a></div></article>`
    })
    .join('')
  const related = Object.entries(copy.services)
    .filter(([key]) => key !== slug)
    .map(
      ([key, item]) =>
        `<a class="way" href="${pagePath(locale, key)}"><span>${escapeHtml(item.name)}</span>${icon('i-arrow-up-right')}</a>`,
    )
    .join('')
  const body = `<section class="page-hero service-hero" aria-labelledby="service-title"><div class="wrap"><a class="back" href="${pagePath(locale)}">${icon('i-arrow-left')}<span>${escapeHtml(ui.detail.backHome)}</span></a><p class="eyebrow">${escapeHtml(ui.detail.eyebrow)}</p><h1 class="h1" id="service-title">${escapeHtml(service.name)}</h1><p class="lead">${escapeHtml(service.description)}</p><div class="cta"><a class="btn p" href="#contact"><span class="button-content">${escapeHtml(ui.detail.discussCta)}</span>${icon('i-arrow-down')}</a></div></div></section>
<section class="sec sec-tight" aria-labelledby="use-cases-title"><div class="wrap"><header class="sec-h" data-r><h2 class="h2 h2-s" id="use-cases-title">${escapeHtml(ui.detail.useCasesTitle)}</h2></header><ol class="uc" data-r>${service.useCases.map((useCase, index) => `<li><span class="num" aria-hidden="true">0${index + 1}</span><p>${escapeHtml(useCase)}</p></li>`).join('')}</ol></div></section>
${evidence ? `<section class="sec sec-tight" aria-labelledby="proof-title"><div class="wrap"><header class="sec-h ix-h" data-r><h2 class="h2 h2-s" id="proof-title">${escapeHtml(ui.work.eyebrow)}</h2><a class="text-link" href="${pagePath(locale, 'work')}#work">${escapeHtml(ui.work.allProjects)} ${icon('i-arrow-right')}</a></header><div class="proofs">${evidence}</div></div></section>` : ''}
<section class="sec sec-tight" aria-labelledby="process-title"><div class="wrap"><header class="sec-h" data-r><p class="eyebrow">${escapeHtml(words.processEyebrow)}</p><h2 class="h2 h2-s" id="process-title">${escapeHtml(words.processTitle)}</h2><p class="lead">${escapeHtml(ui.about.title)}</p></header>${processSteps({ ui })}</div></section>
${faq({ copy: { ...copy, faq: questions }, ui })}
<section class="sec sec-tight" aria-labelledby="related-title"><div class="wrap"><header class="sec-h" data-r><h2 class="h2 h2-s" id="related-title">${escapeHtml(ui.detail.relatedServicesTitle)}</h2></header><div class="related" data-r>${related}</div></div></section>`
  const path = pagePath(locale, slug)
  const offer = serviceNode(path, service)
  return renderDocument({
    locale,
    copy,
    ui,
    slug,
    graph: [
      offer,
      faqNode(path, questions),
      breadcrumbNode(path, [
        { name: copy.navigation.home, path: pagePath(locale) },
        { name: service.name, path },
      ]),
    ],
    about: offer['@id'],
    title: service.seo.title,
    description: service.seo.description,
    body,
    bodyClass: 'service-page',
  })
}
