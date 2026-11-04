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

export function renderService({ locale, copy, ui, slug }) {
  const service = copy.services[slug]
  if (!service || !Object.hasOwn(proof, slug))
    throw new Error(`Missing service content: ${locale}/${slug}`)
  const questions = serviceFaq(copy, slug)
  const evidence = proof[slug]
    .map((key) => {
      const project = projects[key]
      const words = ui.caseStudies[key]
      return `<article class="service-project">${imageTag({ key: project.image, alt: escapeHtml(words.alt), sizes: projectSizes })}<div><h3><a href="${casePath(locale, key)}">${escapeHtml(project.name)}</a></h3><p>${escapeHtml(words.summary)}</p><a class="service-text-link" href="${project.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(words.linkLabel)} <span aria-hidden="true">↗</span></a></div></article>`
    })
    .join('')
  const related = Object.entries(copy.services)
    .filter(([key]) => key !== slug)
    .map(
      ([key, item]) =>
        `<a class="service-related-link" href="${pagePath(locale, key)}"><span>${escapeHtml(item.name)}</span><span aria-hidden="true">↗</span></a>`,
    )
    .join('')
  const body = `<section class="wrap service-hero" aria-labelledby="service-title"><a class="service-back" href="${pagePath(locale)}">← ${escapeHtml(ui.detail.backHome)}</a><p class="eyebrow">${escapeHtml(ui.detail.eyebrow)}</p><h1 id="service-title">${escapeHtml(service.name)}</h1><p class="service-intro">${escapeHtml(service.description)}</p><a class="button" href="#contact"><span class="button-content" data-magnetic-content>${escapeHtml(ui.detail.discussCta)} <span aria-hidden="true">↗</span></span></a></section>
<section class="wrap service-section service-use-cases" aria-labelledby="use-cases-title"><h2 id="use-cases-title">${escapeHtml(ui.detail.useCasesTitle)}</h2><ol>${service.useCases.map((useCase, index) => `<li><span aria-hidden="true">0${index + 1}</span><p>${escapeHtml(useCase)}</p></li>`).join('')}</ol></section>
${evidence ? `<section class="service-proof-band"><div class="wrap service-section"><div class="service-section-heading"><h2>${escapeHtml(ui.work.eyebrow)}</h2><a class="service-text-link" href="${pagePath(locale, 'work')}#work">${escapeHtml(ui.work.allProjects)} ↗</a></div><div class="service-projects">${evidence}</div></div></section>` : ''}
<section class="wrap service-section service-process-section" aria-labelledby="process-title"><h2 id="process-title">${escapeHtml(ui.about.title)}</h2>${processSteps({ ui })}</section>
${faq({ copy: { ...copy, faq: questions }, ui })}
<section class="wrap service-section service-related" aria-labelledby="related-title"><h2 id="related-title">${escapeHtml(ui.detail.relatedServicesTitle)}</h2><div>${related}</div></section>`
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
