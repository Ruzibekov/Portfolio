import { caseKeys, casePath, escapeHtml } from './shared.mjs'
import { icon } from './icons.mjs'
import { imageSrc, imageTag } from './assets.mjs'
import { galleryLabels } from './gallery-labels.mjs'

const thumbSizes = '(min-width: 1021px) 160px, (min-width: 761px) 120px, 96px'
const sheetSizes = '(min-width: 761px) 472px, 100vw'
const previewWidth = 700
const storeHosts = [
  ['apps.apple.com', 'l-appstore'],
  ['play.google.com', 'l-googleplay'],
]

const storeIcon = (href) => {
  const host = new URL(href).hostname
  return storeHosts.find(([name]) => host === name)?.[1] ?? null
}

export function countProjects(cases) {
  return {
    total: cases.length,
    web: cases.filter((item) => item.categories.includes('web')).length,
    mobile: cases.filter((item) => item.categories.includes('mobile')).length,
    stores: cases.filter((item) =>
      item.links.some((link) => storeIcon(link.href)),
    ).length,
    online: cases.filter(
      (item) => item.categories.includes('web') && item.statusType === 'public',
    ).length,
  }
}

export function projectTag(item, ui) {
  return `${ui.work.filters[item.categories[0]]} · ${item.stack}`
}

function rowStatus({ item, words, online }) {
  const stores = item.links
    .map((link, index) => ({ icon: storeIcon(link.href), index }))
    .filter((entry) => entry.icon)
  if (stores.length)
    return stores
      .map(
        (entry) =>
          `<span class="nw">${icon(entry.icon)}${escapeHtml(words.actions[entry.index].replace(/\s*↗$/, ''))}</span>`,
      )
      .join('')
  if (words.status) return `<span>${escapeHtml(words.status)}</span>`
  if (item.links.length) return `<span>${escapeHtml(online)}</span>`
  return ''
}

function detailLinks({ locale, item, words, copy, labels }) {
  const caseLink = caseKeys.includes(item.key)
    ? `<a class="btn-s gallery-case-link" href="${casePath(locale, item.key)}">${escapeHtml(copy.caseStudy.openCase)} ${icon('i-arrow-right')}</a>`
    : ''
  const actions = item.links
    .map((link, index) => {
      const mark = storeIcon(link.href)
      return `<a class="btn-s line" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${mark ? icon(mark) : ''}${escapeHtml(words.actions[index])}</a>`
    })
    .join('')
  const availability =
    words.status || (!item.links.length ? labels.noPublicLink : '')
  return `${caseLink}${actions}${availability ? `<span class="priv gallery-availability">${escapeHtml(availability)}</span>` : ''}`
}

function renderRow({ locale, copy, ui, item, words, labels, online, number }) {
  const tag = projectTag(item, ui)
  const fields = ['task', 'solution', 'result']
    .map(
      (field) =>
        `<div><dt>${escapeHtml(labels[field])}</dt><dd data-case-field="${field}">${escapeHtml(words[field])}</dd></div>`,
    )
    .join('')
  return `<li class="row-item" id="${escapeHtml(item.id)}" data-case-key="${escapeHtml(item.key)}" data-category="${escapeHtml(item.categories.join(' '))}" data-cat="${item.categories[0]}" data-source-status="${item.statusType}" data-tag="${escapeHtml(tag)}" data-preview="${imageSrc(item.image, previewWidth)}">
<button class="row" type="button" aria-haspopup="dialog" aria-label="${escapeHtml(words.title)}: ${escapeHtml(labels.details)}"><span class="num" aria-hidden="true">${String(number).padStart(2, '0')}</span><span class="th">${imageTag({ key: item.image, alt: '', sizes: thumbSizes })}</span><span class="tx"><span class="tt">${escapeHtml(words.title)}</span><span class="tg">${escapeHtml(tag)}</span></span><span class="stt">${rowStatus({ item, words, online })}</span><span class="ar" aria-hidden="true">${icon('i-arrow-up-right')}</span></button>
<div class="row-detail" data-row-detail hidden><div class="sh-img">${imageTag({ key: item.image, alt: escapeHtml(words.alt), sizes: sheetSizes })}</div><h3>${escapeHtml(words.title)}</h3><p class="d gallery-summary">${escapeHtml(words.summary)}</p><p class="stack-line">${escapeHtml(item.stack)}</p><dl class="cs">${fields}</dl><div class="lk">${detailLinks({ locale, item, words, copy, labels })}</div></div>
</li>`
}

export function renderIndex({
  locale,
  copy,
  ui,
  words: presentation,
  cases,
  caseCopy,
  limit = 0,
  heading,
  eyebrow,
  compact = false,
  footerLink = '',
}) {
  const labels = galleryLabels[locale]
  const counts = countProjects(cases)
  const tabs = [
    ['all', counts.total],
    ['web', counts.web],
    ['mobile', counts.mobile],
  ]
    .map(
      ([category, count]) =>
        `<button type="button" data-filter="${category}" aria-pressed="${category === 'all'}"><span>${escapeHtml(ui.work.filters[category])}</span><b>${count}</b></button>`,
    )
    .join('')
  const rows = cases
    .map((item, index) =>
      renderRow({
        locale,
        copy,
        ui,
        item,
        words: caseCopy[item.key],
        labels,
        online: presentation.online,
        number: index + 1,
      }),
    )
    .join('')
  const more = limit
    ? `<div class="more" data-more><button class="btn g sm" type="button" data-show-more>${escapeHtml(presentation.showMore)}</button></div>`
    : ''
  const status = `<p class="sr" data-filter-status data-template="${escapeHtml(labels.status)}" aria-live="polite" aria-atomic="true">${escapeHtml(labels.status.replace('{count}', String(counts.total)))}</p>`
  const title = compact
    ? `<h2 class="sr" id="work-title">${heading}</h2>`
    : `<div class="ix-title"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2 class="h2" id="work-title">${heading}</h2></div>`
  const section = `<div class="sec-h ix-h${compact ? ' ix-compact' : ''}" data-r>${title}<div class="tabs" data-tabs role="group" aria-label="${escapeHtml(ui.accessibility.filtersLabel)}"><span class="pill" aria-hidden="true"></span>${tabs}</div></div>${status}
<ul class="idx" data-index${limit ? ` data-limit="${limit}"` : ''}>${rows}${more}</ul>${footerLink}`
  const overlays = `<div class="pv" data-pv aria-hidden="true"><div class="pv-f"><div class="pv-w"><img src="${imageSrc(cases[0].image, previewWidth)}" alt="" width="700" height="467" decoding="async"></div><div class="pv-c" data-preview-caption></div></div></div>
<div class="scrim" data-scrim></div>
<aside class="sheet" data-sheet role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="sheet-title"><span class="grab" aria-hidden="true"></span><div class="sh-top"><span class="eyebrow" data-sheet-tag></span><button class="sh-x" type="button" data-sheet-close aria-label="${escapeHtml(ui.controls.closeMenu)}">${icon('i-x')}</button></div><div class="sh-b" data-sheet-body></div></aside>`
  return { section, overlays }
}
