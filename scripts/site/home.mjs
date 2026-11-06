import { readFileSync } from 'node:fs'
import { imageTag, versioned } from './assets.mjs'

const readCopy = (path) =>
  JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'))
const presentation = readCopy('content/portfolio-b.json')
const future = readCopy('content/future-ui.json').locales
const projectSizes =
  '(min-width: 1280px) 800px, (min-width: 801px) 65vw, calc(100vw - 40px)'
const projects = [
  {
    key: 'monarh',
    name: 'МонархМаркет',
    stack: 'Bitrix · JavaScript · CSS',
    url: 'https://monarhmarket.ru',
  },
  {
    key: 'miyolo',
    name: 'Miyolo / YOLO',
    stack: 'CS-Cart · PHP · Flutter',
    url: 'https://miyolo.ru',
  },
  {
    key: 'okh',
    name: 'OKH',
    stack: 'Flutter · FastAPI · Yandex Maps',
    url: 'https://apps.apple.com/app/id6794669727',
  },
]

export function homeFaqItems(copy, futureCopy) {
  return [
    ...copy.faq,
    { question: futureCopy.faq.aiQuestion, answer: futureCopy.faq.aiAnswer },
  ]
}

export function renderHome({ locale, copy, ui, shared }) {
  const words = presentation[locale]
  if (!words) throw new Error(`Missing portfolio presentation for ${locale}`)
  const e = shared.escapeHtml
  const br = shared.lineBreaks
  const arrow = '<span class="b-arrow" aria-hidden="true">↗</span>'
  const contact = `<a class="button b-contact-button" href="https://t.me/ruzibekov_sh" target="_blank" rel="noopener noreferrer">${e(ui.contact.cta)} ${arrow}</a>`
  const stages = projects
    .map((project, index) => {
      const casePath = shared.casePath(locale, project.key)
      const name =
        project.key === 'monarh' && locale === 'en'
          ? 'Monarh Market'
          : project.name
      return `<article class="b-project" id="${project.key}">
<div class="b-project-heading"><span class="b-ordinal" aria-hidden="true">0${index + 1}</span><h2><a class="case-title-link" href="${casePath}">${e(name)}</a></h2><span class="b-heading-rule" aria-hidden="true"></span></div>
<a class="b-project-media${index === 0 ? ' b-lead-media' : ''}" href="${casePath}" tabindex="-1">${imageTag({ key: `${project.key}-shot`, alt: e(ui.caseStudies[project.key].alt), sizes: projectSizes, priority: index === 0 })}</a>
<div class="b-case-line"><p>${e(ui.caseStudies[project.key].summary)}</p><a class="text-link b-external" href="${project.url}" target="_blank" rel="noopener noreferrer">${e(project.key === 'okh' ? 'App Store' : words.openWebsite)} ${arrow}</a></div>
<p class="b-project-stack">${e(project.stack)}</p>
</article>`
    })
    .join('')
  const serviceLinks = shared.serviceSlugs
    .map(
      (slug, index) =>
        `<li><a href="${shared.pagePath(locale, slug)}"><span class="b-ordinal" aria-hidden="true">0${index + 1}</span><span>${e(copy.services[slug].name)}</span>${arrow}</a><p>${e(copy.services[slug].description)}</p></li>`,
    )
    .join('')
  const faqItems = homeFaqItems(copy, future[locale])
  const faq = faqItems
    .map(
      (item) =>
        `<details><summary>${e(item.question)}</summary><p>${e(item.answer)}</p></details>`,
    )
    .join('')
  const body = `<div class="wrap b-layout">
<aside class="b-author" aria-labelledby="intro-title"><div class="b-author-profile"><img src="${versioned('/assets/avatar.jpg')}" alt="Shavkatbek Ruzibekov" width="56" height="56" decoding="async"><p>${br(words.author)}</p></div><h1 id="intro-title">${words.title.map(e).join('<br>')}</h1><p class="b-statement">${e(words.statement)}</p>${contact}<div class="b-scope">${words.scope.map((line) => `<span>${e(line)}</span>`).join('')}</div></aside>
<section class="b-projects" id="work" aria-label="${e(ui.work.eyebrow)}">${stages}<a class="text-link b-all-projects" href="${shared.pagePath(locale, 'work')}">${e(ui.work.allProjects)} ${arrow}</a>
<section class="b-personal" id="about" aria-labelledby="about-title"><h2 id="about-title">${e(words.aboutTitle)}</h2><p>${e(words.aboutText)}</p></section>
<section class="b-services" id="services" aria-labelledby="services-title"><h2 id="services-title">${e(copy.navigation.services)}</h2><ul>${serviceLinks}</ul></section>
<section class="b-faq" id="faq" aria-labelledby="faq-title"><h2 id="faq-title">${e(copy.navigation.faq)}</h2><div>${faq}</div></section>
</section></div>`
  return shared.renderDocument({
    locale,
    copy,
    ui: {
      ...ui,
      contact: {
        ...ui.contact,
        title: words.contactTitle,
        intro: words.contactIntro,
      },
    },
    title: copy.seo.title,
    description: copy.seo.description,
    graph: [shared.faqNode(shared.pagePath(locale), faqItems)],
    body,
    bodyClass: 'portfolio-b home-page',
    homePresentation: words,
  })
}
