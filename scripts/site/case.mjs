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

const storyFields = ['task', 'solution', 'result']
const serviceByCategory = { web: 'web-development', mobile: 'mobile-apps' }
const extraServices = { agentmama: ['ai-integrations'] }
const descriptionLimit = 160
const arrow = '<span aria-hidden="true">↗</span>'

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
  const external = item.links.map((link) => link.href)
  return {
    '@type': 'CreativeWork',
    '@id': `${url}#case`,
    name: words.title,
    description: words.summary,
    image: absoluteUrl(item.image.src),
    url,
    inLanguage: locale,
    creator: { '@id': personId },
    keywords: caseStack(item),
    ...(external.length ? { sameAs: external } : {}),
  }
}

export function renderCase({ locale, copy, ui, cases, caseCopy, key }) {
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
        `<section class="case-block" aria-labelledby="case-${field}-title"><h2 id="case-${field}-title">${escapeHtml(labels[field])}</h2><p data-case-field="${field}">${escapeHtml(words[field])}</p></section>`,
    )
    .join('')
  const externalLinks = item.links.length
    ? `<section class="case-aside-group" aria-labelledby="case-links-title"><h2 id="case-links-title">${escapeHtml(strings.links)}</h2><ul class="case-link-list">${item.links
        .map(
          (link, index) =>
            `<li><a class="case-external" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(words.actions[index])}</a></li>`,
        )
        .join('')}</ul></section>`
    : ''
  const services = caseServices(item)
    .map(
      (slug) =>
        `<li><a class="case-service" href="${pagePath(locale, slug)}"><span>${escapeHtml(copy.services[slug].name)}</span><span aria-hidden="true">→</span></a></li>`,
    )
    .join('')
  const { previous, next } = neighbours(key)
  const pagerLink = (target, relation, label) =>
    `<a class="case-pager-link case-pager-${relation}" href="${casePath(locale, target)}" rel="${relation}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(caseCopy[target].title)}</strong></a>`
  const body = `<section class="wrap case-hero" aria-labelledby="case-title">${breadcrumb}<h1 id="case-title">${escapeHtml(words.title)}</h1><p class="case-lead">${escapeHtml(words.summary)}</p><ul class="case-chips" aria-label="${escapeHtml(strings.stack)}">${chips}</ul></section>
<figure class="wrap case-shot"><img src="${escapeHtml(item.image.src)}" alt="${escapeHtml(words.alt)}" width="${item.image.width}" height="${item.image.height}" fetchpriority="high"></figure>
<div class="wrap case-layout"><div class="case-story">${story}</div><aside class="case-aside">${externalLinks}<section class="case-aside-group" aria-labelledby="case-services-title"><h2 id="case-services-title">${escapeHtml(strings.services)}</h2><ul class="case-link-list">${services}</ul></section><section class="case-cta" aria-labelledby="case-cta-title"><h2 id="case-cta-title">${escapeHtml(strings.ctaTitle)}</h2><a class="button" href="${escapeHtml(copy.identity.contact.telegram)}" target="_blank" rel="noopener noreferrer"><span class="button-content">${escapeHtml(copy.hero.primaryCta)} ${arrow}</span></a></section></aside></div>
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
    body,
    bodyClass: 'case-page',
  })
}
