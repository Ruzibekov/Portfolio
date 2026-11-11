import {
  absoluteUrl,
  breadcrumbNode,
  caseKeys,
  casePath,
  caseSlug,
  escapeHtml,
  pagePath,
  personId,
  renderDocument,
} from './shared.mjs'
import { galleryLabels } from './work.mjs'
import { icon } from './icons.mjs'
import { imageSrc } from './assets.mjs'
import { liveLinks, monoText, projectType } from './project.mjs'
import { projectLinks, projectStatus, slab } from './slab.mjs'

const storyFields = ['task', 'solution', 'result']
const serviceByCategory = { web: 'web-development', mobile: 'mobile-apps' }
const extraServices = { agentmama: ['ai-integrations'] }
const descriptionLimit = 160
const shotSizes = '(min-width: 1024px) 760px, calc(100vw - 40px)'
const gallerySizes = '(min-width: 1024px) 270px, 220px'

export function caseServices(item) {
  const slugs = item.categories.map((category) => {
    const slug = serviceByCategory[category]
    if (!slug) throw new Error(`No service for category ${category}`)
    return slug
  })
  return [...new Set([...slugs, ...(extraServices[item.key] ?? [])])]
}

export function caseStack(item) {
  return item.stack
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function caseDescription(words) {
  const combined = `${words.summary} ${words.task}`
  return combined.length <= descriptionLimit ? combined : words.summary
}

export function caseTitle(item, words, strings) {
  const descriptor = strings.descriptors[item.categories[0]]
  if (!descriptor)
    throw new Error(`Missing descriptor for ${item.categories[0]}`)
  return `${words.title} — ${descriptor} | Shavkatbek Ruzibekov`
}

function requireStrings(copy, locale) {
  const strings = copy.caseStudy
  const keys = [
    'breadcrumb',
    'stack',
    'links',
    'services',
    'ctaTitle',
    'pager',
    'previous',
    'next',
    'openCase',
  ]
  if (
    !strings ||
    !copy.navigation?.home ||
    keys.some((key) => typeof strings[key] !== 'string' || !strings[key]) ||
    !strings.descriptors?.web ||
    !strings.descriptors?.mobile
  )
    throw new Error(`Incomplete case study copy for ${locale}`)
  return strings
}

function neighbours(key) {
  const index = caseKeys.indexOf(key)
  const total = caseKeys.length
  return {
    previous: caseKeys[(index - 1 + total) % total],
    next: caseKeys[(index + 1) % total],
  }
}

function creativeWorkNode({ item, words, locale, path }) {
  const url = absoluteUrl(path)
  const external = liveLinks(item).map((link) => link.href)
  return {
    '@type': 'CreativeWork',
    '@id': `${url}#case`,
    name: words.title,
    description: words.summary,
    image: absoluteUrl(imageSrc(item.image)),
    url,
    inLanguage: locale,
    creator: { '@id': personId },
    keywords: caseStack(item),
    ...(external.length ? { sameAs: external } : {}),
  }
}

export function renderCase({
  locale,
  copy,
  ui,
  words: presentation,
  cases,
  caseCopy,
  key,
}) {
  const item = cases.find((entry) => entry.key === key)
  const words = caseCopy[key]
  if (!item || !words) throw new Error(`Missing case source: ${locale}/${key}`)
  const strings = requireStrings(copy, locale)
  const labels = galleryLabels[locale]
  if (!labels) throw new Error(`Missing case labels for ${locale}`)
  const path = casePath(locale, key)
  const crumbs = [
    { name: copy.navigation.home, path: pagePath(locale) },
    { name: copy.navigation.work, path: pagePath(locale, 'work') },
    { name: words.title, path },
  ]
  const breadcrumb = `<nav class="case-breadcrumb" aria-label="${escapeHtml(strings.breadcrumb)}"><ol>${crumbs
    .map((crumb, index) =>
      index === crumbs.length - 1
        ? `<li><span aria-current="page">${escapeHtml(crumb.name)}</span></li>`
        : `<li><a href="${crumb.path}">${escapeHtml(crumb.name)}</a></li>`,
    )
    .join('')}</ol></nav>`
  const chips = caseStack(item)
    .map((part) => `<li>${escapeHtml(part)}</li>`)
    .join('')
  const story = storyFields
    .map(
      (field) =>
        `<section class="case-block" aria-labelledby="case-${field}-title"><h2 class="case-block-title" id="case-${field}-title">${escapeHtml(labels[field])}</h2><p data-case-field="${field}">${escapeHtml(words[field])}</p></section>`,
    )
    .join('')
  const links = projectLinks({ item, words })
  const services = caseServices(item)
    .map(
      (slug) =>
        `<li><a class="related-link" href="${pagePath(locale, slug)}"><span>${escapeHtml(copy.services[slug].name)}</span>${icon('i-arrow-right')}</a></li>`,
    )
    .join('')
  const gallery = (item.gallery ?? [])
    .map(
      (image) =>
        `<li>${slab({ item, words, image, sizes: gallerySizes, alt: words.alt, className: 'flat-slab gallery-slab' })}</li>`,
    )
    .join('')
  const { previous, next } = neighbours(key)
  const pagerLink = (target, relation, label) =>
    `<a class="case-pager-link case-pager-${relation}" href="${casePath(locale, target)}" rel="${relation}">${relation === 'prev' ? icon('i-arrow-left') : ''}<span class="case-pager-text"><span>${escapeHtml(label)}</span><strong>${escapeHtml(caseCopy[target].title)}</strong></span>${relation === 'next' ? icon('i-arrow-right') : ''}</a>`
  const body = `<section class="page-hero case-hero" aria-labelledby="case-title"><div class="wrap">${breadcrumb}<div class="case-head"><div class="case-copy"><h1 class="h1 page-title" id="case-title">${escapeHtml(words.title)}</h1><p class="case-tag"><span>${escapeHtml(projectType(item, ui))}</span><span class="mono">${escapeHtml(monoText(item.stack))}</span>${projectStatus({ item, words, presentation, labels })}</p><p class="lead case-lead">${escapeHtml(words.summary)}</p><ul class="case-chips" aria-label="${escapeHtml(strings.stack)}">${chips}</ul>${links ? `<div class="case-links" aria-label="${escapeHtml(strings.links)}" role="group">${links}</div>` : ''}</div><div class="case-shot">${slab({ item, words, sizes: shotSizes, alt: words.alt, lazy: false, priority: true, focusable: true, className: 'flat-slab case-slab', attributes: ` style="view-transition-name: slab-${escapeHtml(item.key)}"` })}</div></div></div></section>
<section class="sec sec-tight" aria-label="${escapeHtml(words.title)}"><div class="wrap story-grid">${story}</div></section>
${gallery ? `<section class="sec sec-tight case-gallery" aria-label="${escapeHtml(words.alt)}"><div class="wrap"><ul class="gallery-row">${gallery}</ul></div></section>` : ''}
<section class="sec sec-tight"><div class="wrap case-more"><section class="case-services" aria-labelledby="case-services-title"><h2 class="case-block-title" id="case-services-title">${escapeHtml(strings.services)}</h2><ul class="related">${services}</ul></section><section class="case-cta" aria-labelledby="case-cta-title"><h2 class="h3" id="case-cta-title">${escapeHtml(strings.ctaTitle)}</h2><a class="btn btn-secondary" href="${escapeHtml(copy.identity.contact.telegram)}" target="_blank" rel="noopener noreferrer">${icon('l-telegram')}<span class="button-content">${escapeHtml(copy.hero.primaryCta)}</span></a></section></div></section>
<nav class="wrap case-pager" aria-label="${escapeHtml(strings.pager)}">${pagerLink(previous, 'prev', strings.previous)}${pagerLink(next, 'next', strings.next)}</nav>`
  return renderDocument({
    locale,
    copy,
    ui,
    slug: caseSlug(key),
    title: caseTitle(item, words, strings),
    description: caseDescription(words),
    graph: [
      breadcrumbNode(path, crumbs),
      creativeWorkNode({ item, words, locale, path }),
    ],
    about: `${absoluteUrl(path)}#case`,
    words: presentation,
    body,
    bodyClass: 'case-page',
  })
}
