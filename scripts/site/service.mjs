import {
  breadcrumbNode,
  caseKeys,
  casePath,
  escapeHtml,
  faq,
  faqNode,
  pagePath,
  renderDocument,
  serviceNode,
  telegramUrl,
} from './shared.mjs'
import { icon } from './icons.mjs'
import { slab } from './slab.mjs'
import { chatSlab, serviceProofs } from './home.mjs'

const proofSizes = '(min-width: 1024px) 520px, calc(100vw - 40px)'

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

export function renderService({
  locale,
  copy,
  ui,
  words,
  slug,
  cases,
  caseCopy,
}) {
  const service = copy.services[slug]
  if (!service || !Object.hasOwn(serviceProofs, slug))
    throw new Error(`Missing service content: ${locale}/${slug}`)
  const questions = serviceFaq(copy, slug)
  const bento = ui.services.bento
  const proofKey = serviceProofs[slug]
  const item = proofKey ? cases.find((entry) => entry.key === proofKey) : null
  const proof = item
    ? slab({
        item,
        words: caseCopy[proofKey],
        sizes: proofSizes,
        alt: caseCopy[proofKey].alt,
        lazy: false,
        priority: true,
        className: 'stand-slab',
      })
    : chatSlab(bento.chat, escapeHtml)
  const proofHref = item
    ? caseKeys.includes(item.key)
      ? casePath(locale, item.key)
      : `${pagePath(locale, 'work')}#${item.id}`
    : null
  const caption = item
    ? `<a class="stand-cap-link" href="${proofHref}"><span>${escapeHtml(`${bento.proof}: ${caseCopy[proofKey].title}`)}</span>${icon('i-arrow-right')}</a>`
    : escapeHtml(bento.chat.cap)
  const related = Object.entries(copy.services)
    .filter(([key]) => key !== slug)
    .map(
      ([key, entry]) =>
        `<li><a class="related-link" href="${pagePath(locale, key)}"><span>${escapeHtml(entry.name)}</span>${icon('i-arrow-right')}</a></li>`,
    )
    .join('')
  const body = `<section class="page-hero service-hero" aria-labelledby="service-title"><div class="wrap service-grid"><div class="service-copy"><a class="back-link" href="${pagePath(locale)}">${icon('i-arrow-left')}<span>${escapeHtml(ui.detail.backHome)}</span></a><h1 class="h1 page-title" id="service-title">${escapeHtml(service.name)}</h1><p class="lead">${escapeHtml(service.description)}</p><h2 class="service-sub">${escapeHtml(ui.detail.useCasesTitle)}</h2><ol class="use-cases">${service.useCases.map((useCase, index) => `<li><span class="use-num" aria-hidden="true">0${index + 1}</span><p>${escapeHtml(useCase)}</p></li>`).join('')}</ol><div class="cta-row"><a class="btn btn-primary" href="${telegramUrl}" target="_blank" rel="noopener noreferrer" data-primary-cta>${icon('l-telegram')}<span>${escapeHtml(words.discussTask)}</span></a></div></div><div class="service-proof" data-tilt><div class="stand-pose">${proof}</div><p class="stand-cap">${caption}</p></div></div></section>
${faq({ copy: { ...copy, faq: questions }, ui })}
<section class="sec sec-tight" aria-labelledby="related-title"><div class="wrap"><header class="sec-head"><h2 class="h2" id="related-title">${escapeHtml(ui.detail.relatedServicesTitle)}</h2></header><ul class="related">${related}</ul></div></section>`
  const path = pagePath(locale, slug)
  const offer = serviceNode(path, service)
  return renderDocument({
    locale,
    copy,
    ui,
    words,
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
