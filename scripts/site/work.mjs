import {
  breadcrumbNode,
  caseKeys,
  casePath,
  escapeHtml,
  pagePath,
  renderDocument,
} from './shared.mjs'
import { imageTag } from './assets.mjs'

const gallerySizes = '(min-width: 900px) 580px, calc(100vw - 42px)'

export const galleryLabels = {
  uz: {
    task: 'Vazifa',
    solution: 'Nima qildim',
    result: 'Natija',
    details: 'Loyiha tafsilotlari',
    noPublicLink: 'Ochiq havola ko‘rsatilmagan',
    status: 'Ko‘rsatilgan ishlar: {count}',
  },
  ru: {
    task: 'Задача',
    solution: 'Что сделал',
    result: 'Результат',
    details: 'Подробнее о проекте',
    noPublicLink: 'Публичная ссылка не указана',
    status: 'Показано работ: {count}',
  },
  en: {
    task: 'Task',
    solution: 'What I did',
    result: 'Result',
    details: 'Project details',
    noPublicLink: 'No public link provided',
    status: 'Projects shown: {count}',
  },
  ky: {
    task: 'Милдет',
    solution: 'Эмне кылдым',
    result: 'Натыйжа',
    details: 'Долбоор тууралуу',
    noPublicLink: 'Ачык шилтеме көрсөтүлгөн эмес',
    status: 'Көрсөтүлгөн иштер: {count}',
  },
  kk: {
    task: 'Міндет',
    solution: 'Не істедім',
    result: 'Нәтиже',
    details: 'Жоба туралы',
    noPublicLink: 'Ашық сілтеме көрсетілмеген',
    status: 'Көрсетілген жұмыстар: {count}',
  },
  tg: {
    task: 'Вазифа',
    solution: 'Чӣ кор кардам',
    result: 'Натиҷа',
    details: 'Тафсилоти лоиҳа',
    noPublicLink: 'Пайванди оммавӣ нишон дода нашудааст',
    status: 'Корҳои нишон додашуда: {count}',
  },
  uk: {
    task: 'Завдання',
    solution: 'Що зробив',
    result: 'Результат',
    details: 'Докладніше про проєкт',
    noPublicLink: 'Публічне посилання не вказане',
    status: 'Показано робіт: {count}',
  },
  be: {
    task: 'Задача',
    solution: 'Што зрабіў',
    result: 'Вынік',
    details: 'Падрабязней пра праект',
    noPublicLink: 'Публічная спасылка не пазначана',
    status: 'Паказана работ: {count}',
  },
}

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

export function renderWork({ locale, copy, ui, cases, caseCopy }) {
  validateCaseCopy(cases, caseCopy, locale)
  const labels = galleryLabels[locale]
  if (!labels) throw new Error(`Missing gallery controls for ${locale}`)
  const count = (category) =>
    category === 'all'
      ? cases.length
      : cases.filter((item) => item.categories.includes(category)).length
  const filters = ['all', 'web', 'mobile']
    .map(
      (category) =>
        `<button type="button" data-filter="${category}" aria-pressed="${category === 'all'}"><span>${escapeHtml(ui.work.filters[category])}</span><b>${count(category)}</b></button>`,
    )
    .join('')
  const cards = cases
    .map((item, index) => {
      const words = caseCopy[item.key]
      const actions = item.links
        .map(
          (link, index) =>
            `<a href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(words.actions[index])}</a>`,
        )
        .join('')
      const caseLink = caseKeys.includes(item.key)
        ? `<a class="gallery-case-link" href="${casePath(locale, item.key)}">${escapeHtml(copy.caseStudy.openCase)} <span aria-hidden="true">→</span></a>`
        : ''
      const availability =
        words.status || (!item.links.length ? labels.noPublicLink : '')
      return `<article class="gallery-case" id="${escapeHtml(item.id)}" data-case-key="${escapeHtml(item.key)}" data-category="${escapeHtml(item.categories.join(' '))}" data-source-status="${item.statusType}">
${imageTag({ key: item.image, alt: escapeHtml(words.alt), sizes: gallerySizes, className: 'gallery-image', lazy: index > 1 })}
<div class="gallery-case-copy"><h2>${escapeHtml(words.title)}</h2><p class="gallery-summary">${escapeHtml(words.summary)}</p><p class="gallery-stack">${escapeHtml(item.stack)}</p>
<details class="gallery-details"><summary><span>${escapeHtml(labels.details)}</span><span aria-hidden="true">+</span></summary><dl>${['task', 'solution', 'result'].map((field) => `<div><dt>${escapeHtml(labels[field])}</dt><dd data-case-field="${field}">${escapeHtml(words[field])}</dd></div>`).join('')}</dl></details>
<div class="gallery-actions">${caseLink}${actions}${availability ? `<span class="gallery-availability">${escapeHtml(availability)}</span>` : ''}</div></div></article>`
    })
    .join('')
  const body = `<section class="wrap gallery-hero" aria-labelledby="gallery-title"><a class="service-back" href="${pagePath(locale)}">← ${escapeHtml(ui.detail.backHome)}</a><p class="eyebrow">${escapeHtml(ui.detail.eyebrow)}</p><h1 id="gallery-title">${escapeHtml(copy.navigation.work)}<span class="gallery-total">${cases.length}</span></h1><p>${escapeHtml(ui.work.intro)}</p></section>
<section class="wrap gallery-section" id="work" aria-labelledby="gallery-title"><div class="gallery-controls"><div class="work-filters gallery-filters" role="group" aria-label="${escapeHtml(ui.accessibility.filtersLabel)}">${filters}</div><p class="gallery-status" data-filter-status data-template="${escapeHtml(labels.status)}" aria-live="polite">${escapeHtml(labels.status.replace('{count}', String(cases.length)))}</p></div><div class="work-gallery" data-work-grid>${cards}</div></section>`
  return renderDocument({
    locale,
    copy,
    ui,
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
  })
}
