import { readFileSync } from 'node:fs'

const projectFile = (file) => new URL(`../../${file}`, import.meta.url)
const futureCopy = () =>
  JSON.parse(readFileSync(projectFile('content/future-ui.json'), 'utf8'))
    .locales
const cases = [
  {
    key: 'agentmama',
    name: 'Agentmama',
    category: 'web ai',
    image: 'agentmama-shot.webp',
    width: 1400,
    height: 933,
    stack: 'React / Next.js / FastAPI',
    url: 'https://agentmama.ru',
  },
  {
    key: 'monarh',
    name: 'Monarh Market',
    category: 'web',
    image: 'monarh-shot.webp',
    width: 1400,
    height: 933,
    stack: 'Bitrix / JavaScript / CSS',
    url: 'https://monarhmarket.ru',
  },
  {
    key: 'miyolo',
    name: 'Miyolo / Yolo',
    category: 'web mobile',
    image: 'miyolo-shot.webp',
    width: 900,
    height: 600,
    stack: 'CS-Cart / PHP / Flutter',
    url: 'https://miyolo.ru',
  },
  {
    key: 'okh',
    name: 'OKH',
    category: 'mobile',
    image: 'okh-shot.webp',
    width: 1400,
    height: 933,
    stack: 'Flutter / FastAPI / Yandex Maps',
    url: 'https://apps.apple.com/app/id6794669727',
  },
]

export function homeFaqItems(copy, future) {
  return [
    ...copy.faq,
    { question: future.faq.aiQuestion, answer: future.faq.aiAnswer },
  ]
}

export function renderHome({ locale, copy, ui, shared }) {
  const f = futureCopy()[locale]
  if (!f) throw new Error(`Missing future-facing interface copy for ${locale}`)
  const e = shared.escapeHtml
  const br = shared.lineBreaks
  const arrow = '<span class="arrow" aria-hidden="true">↗</span>'
  const cards = cases
    .map(
      (
        item,
      ) => `<article class="project-card" id="${item.key}" data-category="${item.category}">
    <a class="case-figure-link" href="${shared.casePath(locale, item.key)}" tabindex="-1"><figure class="case-figure"><img src="/screenshots/${item.image}" width="${item.width}" height="${item.height}" alt="${e(ui.caseStudies[item.key].alt)}" loading="lazy"></figure></a>
    <div class="case-meta"><div><h3><a class="case-title-link" href="${shared.casePath(locale, item.key)}">${e(item.name)}</a></h3><p>${e(ui.caseStudies[item.key].summary)}</p><span class="case-stack">${e(item.stack)}</span></div><a class="text-link" href="${item.url}" target="_blank" rel="noopener noreferrer">${e(ui.caseStudies[item.key].linkLabel)} ${arrow}</a></div>
  </article>`,
    )
    .join('')
  const serviceCards = shared.serviceSlugs
    .map((slug) => {
      const service = copy.services[slug]
      return `<article class="service${slug === 'ai-integrations' ? ' service-ai' : ''}"><h3><a href="${shared.pagePath(locale, slug)}">${e(service.name)}</a></h3><p>${e(service.description)}</p><a class="text-link service-details" href="${shared.pagePath(locale, slug)}">${e(ui.services.detailsLabel)} ${arrow}</a></article>`
    })
    .join('')
  const steps = Object.values(ui.process)
    .map(
      (step, index) =>
        `<li><span class="technical-label">0${index + 1} / ${e(f.process.labels[index])}</span><h3>${e(step.title)}</h3><p>${e(step.description)}</p></li>`,
    )
    .join('')
  const faqItems = homeFaqItems(copy, f)
  const faq = faqItems
    .map(
      (item) =>
        `<details><summary>${e(item.question)}</summary><p>${e(item.answer)}</p></details>`,
    )
    .join('')
  const b = f.bento
  const tile = (slug, kind, [title, meta], visual) =>
    `<a class="tile tile-${kind}" href="${shared.pagePath(locale, slug)}"><span class="tile-label"><span><strong>${e(title)}</strong><span>${e(meta)}</span></span><span class="tile-arrow" aria-hidden="true">↗</span></span><span class="tile-visual" aria-hidden="true">${visual}</span></a>`
  const browser = `<span class="mock-browser"><span class="mock-bar"><i></i><i></i><i></i><span>monarhmarket.ru</span></span><img src="/screenshots/monarh-shot.webp" width="1400" height="933" alt="" fetchpriority="high"></span>`
  const chat = `<span class="mock-chat"><span class="bubble">${e(b.chat[0])}</span><span class="keys"><span>${e(b.chat[1])}</span><span>${e(b.chat[2])}</span></span><span class="bubble own">${e(b.chat[3])}</span></span>`
  const phones = `<span class="mock-phone"><img src="/screenshots/altn-emu-1.png" width="1080" height="2400" alt="" loading="lazy"></span><span class="mock-phone"><img src="/screenshots/besttracker-emu-1.png" width="1080" height="2400" alt="" loading="lazy"></span>`
  const prompt = `<span class="mock-prompt"><span>${e(b.prompt[0])}</span><span class="answer">${e(b.prompt[1])}</span></span>`
  const stats = b.stats
    .map(
      ([value, label]) =>
        `<li><strong>${e(value)}</strong><span>${e(label)}</span></li>`,
    )
    .join('')
  const body = `<section class="wrap bento-hero" aria-labelledby="hero-title">
    <div class="tile tile-intro"><p class="availability"><span aria-hidden="true"></span>${e(b.available)}</p>
      <div><h1 id="hero-title">${e(b.title[0])} <span class="title-accent">${e(b.title[1])}</span> ${e(b.title[2])}</h1>
      <p class="hero-intro">${e(b.intro)}</p>
      <div class="hero-actions"><a class="button" href="${e(copy.identity.contact.telegram)}" target="_blank" rel="noopener noreferrer"><span class="button-content">${e(copy.hero.primaryCta)} ${arrow}</span></a><a class="button button-quiet" href="#work">${e(copy.hero.secondaryCta)}</a></div></div>
    </div>
    ${tile('web-development', 'web', b.web, browser)}
    ${tile('telegram-bots', 'bot', b.bot, chat)}
    ${tile('mobile-apps', 'mobile', b.mobile, phones)}
    ${tile('ai-integrations', 'ai', b.ai, prompt)}
  </section>
  <ul class="wrap bento-stats">${stats}</ul>
  <div class="work-band"><section class="wrap section" id="work" aria-labelledby="work-title">
    <div class="section-heading"><div><p class="technical-label">${e(f.work.eyebrow)}</p><h2 id="work-title">${br(f.work.title)}</h2></div><p>${e(f.work.intro)}</p></div>
    <div class="work-toolbar"><div class="filters" role="group" aria-label="${e(ui.accessibility.filtersLabel)}">${[
      ['all', 4],
      ['web', 3],
      ['mobile', 2],
      ['ai', 1],
    ]
      .map(
        ([filter, count]) =>
          `<button class="filter" type="button" data-filter="${filter}" aria-pressed="${filter === 'all'}">${e(filter === 'ai' ? 'AI' : ui.work.filters[filter])} (${count})</button>`,
      )
      .join(
        '',
      )}</div><a class="text-link" href="/${locale}/work">${e(ui.work.allProjects)} ${arrow}</a></div>
    <p class="sr-only" aria-live="polite" data-filter-status data-template="${e(ui.work.filterStatus)}">${e(ui.work.filterStatus.replace('{count}', '4'))}</p>
    <div class="work-grid" data-work-grid data-active-filter="all">${cards}</div>
  </section></div>
  <section class="wrap section" id="services" aria-labelledby="services-title"><div class="services-heading"><h2 id="services-title">${br(f.services.title)}</h2><p>${e(f.services.intro)}</p></div><div class="service-grid">${serviceCards}</div></section>
  <section class="wrap section" id="about" aria-labelledby="about-title"><div class="ownership"><div class="person"><img src="/assets/avatar.jpg" width="58" height="58" alt="Shavkatbek Ruzibekov" loading="lazy"><div><strong>Shavkatbek Ruzibekov</strong><span>${e(copy.identity.role)}</span></div></div><h2 id="about-title">${e(ui.about.title)}</h2></div><ol class="process">${steps}</ol></section>
  <section class="wrap section rule faq" id="faq" aria-labelledby="faq-title"><h2 id="faq-title">${br(ui.faq.title)}</h2><div class="faq-list">${faq}</div></section>`
  return shared.renderDocument({
    locale,
    copy,
    ui: { ...ui, contact: { ...ui.contact, title: f.contact.title } },
    title: copy.seo.title,
    description: copy.seo.description,
    graph: [shared.faqNode(shared.pagePath(locale), faqItems)],
    body,
    bodyClass: 'concept-v5 home-page',
  })
}
