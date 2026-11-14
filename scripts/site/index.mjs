import {
  caseKeys,
  casePath,
  escapeHtml,
  pagePath,
  showroomLead,
} from './shared.mjs'
import { icon } from './icons.mjs'
import { galleryLabels } from './gallery-labels.mjs'
import {
  countProjects,
  domainOf,
  isOffline,
  liveWebLink,
  monoText,
  projectType,
} from './project.mjs'
import { projectLinks, projectStatus, slab } from './slab.mjs'

const stageSizes = '(min-width: 1024px) 560px, 300px'
const sheetSizes = '(min-width: 761px) 440px, calc(100vw - 48px)'
const two = (value) => String(value).padStart(2, '0')

export function catalogueNumber(cases, key) {
  const index = leadOrder(cases).findIndex((item) => item.key === key)
  if (index < 0) throw new Error(`Project is not in the catalogue: ${key}`)
  return index + 1
}

function leadOrder(cases) {
  const lead = showroomLead.map((key) => {
    const item = cases.find((entry) => entry.key === key)
    if (!item) throw new Error(`Showroom lead project is missing: ${key}`)
    return item
  })
  return [...lead, ...cases.filter((item) => !showroomLead.includes(item.key))]
}

function rowHref({ locale, item, variant }) {
  if (caseKeys.includes(item.key)) return casePath(locale, item.key)
  return variant === 'work'
    ? `#${item.id}`
    : `${pagePath(locale, 'work')}#${item.id}`
}

function infoCopy({ item, words, ui, presentation, labels, number }) {
  const numbered = number
    ? `<span class="sr-num" data-num>${two(number)}</span>`
    : ''
  return `<div class="sr-info-head">${numbered}<h3 class="sr-title">${escapeHtml(words.title)}</h3></div><p class="sr-meta"><span>${escapeHtml(projectType(item, ui))}</span><span class="mono">${escapeHtml(monoText(item.stack))}</span>${projectStatus({ item, words, presentation, labels })}</p><p class="sr-summary">${escapeHtml(words.summary)}</p>`
}

function infoLinks({ locale, item, copy, labels }) {
  const open = caseKeys.includes(item.key)
    ? `<a class="btn btn-ink sr-open" href="${casePath(locale, item.key)}" data-open-case="${escapeHtml(item.key)}"><span>${escapeHtml(copy.caseStudy.openCase)}</span>${icon('i-arrow-right')}</a>`
    : `<button class="btn btn-ink sr-open" type="button" data-open-sheet="${escapeHtml(item.key)}"><span>${escapeHtml(labels.details)}</span>${icon('i-arrow-right')}</button>`
  const web = liveWebLink(item)
  const live = web
    ? `<a class="btn btn-quiet sr-live" href="${escapeHtml(web.href)}" target="_blank" rel="noopener noreferrer"><span class="mono">${escapeHtml(monoText(domainOf(web.href)))}</span>${icon('i-arrow-up-right')}</a>`
    : ''
  return `${open}${live}`
}

function detail({ locale, item, words, copy, labels, presentation }) {
  const fields = ['task', 'solution', 'result']
    .map(
      (field) =>
        `<div><dt>${escapeHtml(labels[field])}</dt><dd data-case-field="${field}">${escapeHtml(words[field])}</dd></div>`,
    )
    .join('')
  const caseLink = caseKeys.includes(item.key)
    ? `<a class="btn btn-secondary" href="${casePath(locale, item.key)}"><span>${escapeHtml(copy.caseStudy.openCase)}</span>${icon('i-arrow-right')}</a>`
    : ''
  const availability = isOffline(item)
    ? presentation.offline
    : words.status || (!item.links.length ? labels.noPublicLink : '')
  return `<div class="sheet-slab">${slab({ item, words, sizes: sheetSizes, alt: words.alt, focusable: true, className: 'flat-slab', trio: true })}</div><h3 class="sheet-title" id="sheet-title">${escapeHtml(words.title)}</h3><p class="sheet-summary">${escapeHtml(words.summary)}</p><p class="sheet-stack mono">${escapeHtml(monoText(item.stack))}</p><dl class="sheet-fields">${fields}</dl><div class="sheet-links">${caseLink}${projectLinks({ item, words })}${availability ? `<span class="sheet-availability">${escapeHtml(availability)}</span>` : ''}</div>`
}

function row({
  locale,
  copy,
  ui,
  item,
  words,
  labels,
  presentation,
  number,
  variant,
  visible,
  selected,
}) {
  const title = escapeHtml(words.title)
  const parts = [
    [
      'copy',
      infoCopy({
        item,
        words,
        ui,
        presentation,
        labels,
        number: variant === 'home' ? 0 : number,
      }),
    ],
    ['links', infoLinks({ locale, item, copy, labels })],
    [
      'slab',
      slab({
        item,
        words,
        sizes: stageSizes,
        alt: words.alt,
        className: 'sr-slab',
        trio: true,
      }),
    ],
    ['detail', detail({ locale, item, words, copy, labels, presentation })],
  ]
    .map(([name, html]) => `<div data-part="${name}">${html}</div>`)
    .join('')
  return `<li class="sr-item"${variant === 'work' ? ` id="${escapeHtml(item.id)}"` : ''} data-key="${escapeHtml(item.key)}" data-category="${escapeHtml(item.categories.join(' '))}" data-title="${title}" data-number="${two(number)}"${visible ? '' : ' hidden'}><a class="sr-row" href="${rowHref({ locale, item, variant })}" aria-label="${title}" data-row${selected ? ' aria-current="true"' : ''}>${variant === 'home' ? '' : `<span class="sr-row-num" aria-hidden="true">${two(number)}</span>`}<span class="sr-row-title">${title}</span><span class="sr-row-type">${escapeHtml(projectType(item, ui))}</span></a><template data-row-template>${parts}</template></li>`
}

export function renderShowroom({
  locale,
  copy,
  ui,
  words: presentation,
  cases,
  caseCopy,
  limit = 0,
  variant,
  heading,
}) {
  const labels = galleryLabels[locale]
  if (!labels) throw new Error(`Missing gallery labels for ${locale}`)
  const counts = countProjects(cases)
  const ordered = leadOrder(cases)
  const listed =
    variant === 'home' ? ordered.filter((item) => item.screen) : ordered
  const visibleCount = limit ? Math.min(limit, listed.length) : listed.length
  const first = listed[0]
  const firstWords = caseCopy[first.key]
  const chips = [
    ['all', counts.total],
    ['web', counts.web],
    ['mobile', counts.mobile],
  ]
    .filter(([, count]) => count > 0)
    .map(
      ([category, count]) =>
        `<button class="chip" type="button" data-filter="${category}" aria-pressed="${category === 'all'}"><span>${escapeHtml(ui.work.filters[category])}</span>${variant === 'home' ? '' : `<b>${count}</b>`}</button>`,
    )
    .join('')
  const rows = listed
    .map((item, index) =>
      row({
        locale,
        copy,
        ui,
        item,
        words: caseCopy[item.key],
        labels,
        presentation,
        number: ordered.indexOf(item) + 1,
        variant,
        visible: index < visibleCount,
        selected: index === 0,
      }),
    )
    .join('')
  const status = `<p class="sr" data-filter-status data-template="${escapeHtml(ui.work.filterStatus)}" aria-live="polite" aria-atomic="true">${escapeHtml(ui.work.filterStatus.replace('{count}', String(visibleCount)))}</p>`
  const title =
    variant === 'home'
      ? `<div class="showroom-title"><p class="eyebrow">${escapeHtml(ui.work.eyebrow)}</p><h2 class="h2" id="work-title">${heading}</h2></div>`
      : `<h2 class="sr" id="work-title">${heading}</h2>`
  if (variant === 'home' && !/\d+/.test(ui.work.allProjects))
    throw new Error(`All-projects label needs a count: ${locale}`)
  const allLink =
    variant === 'home'
      ? `<a class="sr-all" href="${pagePath(locale, 'work')}"><span>${escapeHtml(ui.work.allProjects.replace(/\d+/, String(counts.total)))}</span>${icon('i-arrow-right')}</a>`
      : ''
  const stage = `<div class="sr-stage" data-stage><div class="sr-world" data-stage-world>${slab({ item: first, words: firstWords, sizes: stageSizes, alt: firstWords.alt, className: 'sr-slab is-current', trio: true })}</div></div>`
  const info = `<div class="sr-info" data-info><div class="sr-copy" data-info-copy>${infoCopy({ item: first, words: firstWords, ui, presentation, labels, number: variant === 'home' ? 0 : ordered.indexOf(first) + 1 })}</div><div class="sr-actions"><button class="icon-btn icon-btn-lg" type="button" data-step="-1" data-label="${escapeHtml(copy.caseStudy.previous)}" aria-label="${escapeHtml(copy.caseStudy.previous)}" hidden>${icon('i-arrow-left')}</button><button class="icon-btn icon-btn-lg" type="button" data-step="1" data-label="${escapeHtml(copy.caseStudy.next)}" aria-label="${escapeHtml(copy.caseStudy.next)}" hidden>${icon('i-arrow-right')}</button><span class="sr-links" data-info-links data-primary-cta>${infoLinks({ locale, item: first, copy, labels })}</span></div></div>`
  const section = `<div class="sec-head showroom-head">${title}<div class="chips" data-chips role="group" aria-label="${escapeHtml(ui.accessibility.filtersLabel)}" hidden>${chips}</div></div>${status}
<div class="showroom showroom-${variant}" data-showroom data-variant="${variant}"${limit ? ` data-limit="${limit}"` : ''}><div class="sr-main">${stage}${info}</div><div class="sr-panel"><ol class="sr-list" data-list>${rows}</ol>${allLink}</div></div>`
  const overlays = `<div class="scrim" data-scrim></div>
<aside class="sheet" data-sheet role="dialog" aria-modal="true" aria-labelledby="sheet-title" inert><div class="sheet-top"><span class="sheet-tag" data-sheet-tag></span><button class="icon-btn sheet-close" type="button" data-sheet-close aria-label="${escapeHtml(ui.controls.closeMenu)}">${icon('i-x')}</button></div><div class="sheet-body" data-sheet-body></div></aside>`
  return { section, overlays }
}
