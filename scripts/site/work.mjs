import {
  breadcrumbNode,
  escapeHtml,
  pagePath,
  renderDocument,
  typoBreaks,
} from './shared.mjs'
import { icon } from './icons.mjs'
import { galleryLabels } from './gallery-labels.mjs'
import { renderShowroom } from './index.mjs'

export { galleryLabels }

export function validateCaseCopy(cases, translations, locale) {
  if (
    !translations ||
    typeof translations !== 'object' ||
    Array.isArray(translations)
  )
    throw new Error(`Missing case translations for ${locale}`)
  const caseKeys = cases.map((item) => item.key).sort()
  if (Object.keys(translations).sort().join(',') !== caseKeys.join(','))
    throw new Error(
      `Case translation keys do not match source portfolio for ${locale}`,
    )
  for (const item of cases) {
    const words = translations[item.key]
    const screenCount = item.screens?.length ?? 0
    if (
      screenCount > 1 &&
      (!Array.isArray(words.screenAlts) ||
        words.screenAlts.length !== screenCount ||
        words.screenAlts.some((alt) => typeof alt !== 'string' || !alt.trim()))
    )
      throw new Error(`Missing screen alts for ${locale}/${item.key}`)
    for (const field of [
      'title',
      'summary',
      'task',
      'solution',
      'result',
      'alt',
    ]) {
      if (typeof words[field] !== 'string' || !words[field].trim())
        throw new Error(
          `Missing ${field} translation for ${locale}/${item.key}`,
        )
    }
    if (
      typeof words.status !== 'string' ||
      (item.statusType !== 'public' && !words.status.trim()) ||
      (item.statusType === 'public' && words.status !== '')
    )
      throw new Error(
        `Invalid source status translation for ${locale}/${item.key}`,
      )
    if (
      !Array.isArray(words.actions) ||
      words.actions.length !== item.links.length ||
      words.actions.some((label) => typeof label !== 'string' || !label.trim())
    )
      throw new Error(
        `Action labels do not match real links for ${locale}/${item.key}`,
      )
    for (const link of item.links)
      if (!/^https:\/\//.test(link.href))
        throw new Error(`Unexpected public project link for ${item.key}`)
  }
}

export function renderWork({ locale, copy, ui, words, cases, caseCopy }) {
  validateCaseCopy(cases, caseCopy, locale)
  if (!galleryLabels[locale])
    throw new Error(`Missing gallery controls for ${locale}`)
  const { section, overlays } = renderShowroom({
    locale,
    copy,
    ui,
    words,
    cases,
    caseCopy,
    variant: 'work',
    heading: typoBreaks(ui.work.title),
  })
  const body = `<section class="page-hero work-hero" aria-labelledby="gallery-title"><div class="wrap"><a class="back-link" href="${pagePath(locale)}">${icon('i-arrow-left')}<span>${escapeHtml(ui.detail.backHome)}</span></a><h1 class="h1 page-title" id="gallery-title">${escapeHtml(copy.navigation.work)} <span class="count">${cases.length}</span></h1><p class="lead page-lead">${escapeHtml(ui.work.intro)}</p></div></section>
<section class="sec sec-tight" id="work" aria-labelledby="work-title"><div class="wrap">${section}</div></section>`
  return renderDocument({
    locale,
    copy,
    ui,
    words,
    slug: 'work',
    graph: [
      breadcrumbNode(pagePath(locale, 'work'), [
        { name: copy.navigation.home, path: pagePath(locale) },
        { name: copy.navigation.work, path: pagePath(locale, 'work') },
      ]),
    ],
    title: `${ui.work.allProjects} | Shavkatbek Ruzibekov`,
    description: `${ui.work.intro} ${ui.hero.intro}`,
    body,
    bodyClass: 'work-page',
    bodyEnd: overlays,
  })
}
