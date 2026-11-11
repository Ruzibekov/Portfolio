import { escapeHtml } from './shared.mjs'
import { icon } from './icons.mjs'
import { imageEntry } from './assets.mjs'
import {
  isOffline,
  liveStoreLinks,
  liveWebLink,
  monoText,
  imageKind,
  siteDomain,
  slabKind,
} from './project.mjs'

const actionLabel = (label) => label.replace(/\s*↗$/, '')

function slabImage({
  key,
  alt,
  sizes,
  lazy = true,
  priority = false,
  className = 'slab-img',
}) {
  const entry = imageEntry(key)
  const largest = entry.variants.at(-1)
  const srcset =
    entry.variants.length > 1
      ? ` srcset="${entry.variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ')}" sizes="${sizes}"`
      : ''
  const loading = lazy && !priority ? ' loading="lazy"' : ''
  const hint = priority ? ' fetchpriority="high"' : ''
  return `<img class="${className}" src="${largest.src}"${srcset} alt="${escapeHtml(alt)}" width="${largest.width}" height="${largest.height}"${loading}${hint} decoding="async" data-slab-img>`
}

function addressBar({ item, focusable }) {
  const domain = siteDomain(item)
  if (!domain) return '<div class="slab-bar" aria-hidden="true"></div>'
  const link = liveWebLink(item)
  const text = `<span class="slab-domain">${escapeHtml(monoText(domain))}</span>`
  if (!link)
    return `<div class="slab-bar" aria-hidden="true"><span class="slab-url">${text}</span></div>`
  return `<div class="slab-bar"${focusable ? '' : ' aria-hidden="true"'}><a class="slab-url" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer"${focusable ? '' : ' tabindex="-1"'} data-slab-url>${text}${icon('i-arrow-up-right', 'slab-url-icon')}</a></div>`
}

export function slab({
  item,
  words,
  sizes,
  alt = '',
  lazy = true,
  priority = false,
  focusable = false,
  hidden = false,
  className = '',
  attributes = '',
  image = item.screen,
}) {
  const kind = image ? imageKind(image) : slabKind(item)
  const picture = image
    ? slabImage({ key: image, alt, sizes, lazy, priority })
    : ''
  const fallback = `<span class="slab-fallback" aria-hidden="true">${icon(kind === 'browser' ? 'i-globe' : 'i-smartphone', 'slab-fallback-icon')}<span class="slab-fallback-title">${escapeHtml(words.title)}</span><span class="slab-fallback-stack">${escapeHtml(monoText(item.stack))}</span></span>`
  const bar = kind === 'browser' ? addressBar({ item, focusable }) : ''
  const classes = ['slab', `slab-${kind}`, className].filter(Boolean).join(' ')
  return `<figure class="${classes}" data-kind="${kind}" data-key="${escapeHtml(item.key)}"${hidden ? ' aria-hidden="true"' : ''}${attributes}>${bar}<div class="slab-screen${picture ? '' : ' is-empty'}" data-screen>${picture}${fallback}</div><span class="slab-dim" aria-hidden="true" data-dim></span></figure>`
}

export function projectStatus({ item, words, presentation, labels }) {
  const stores = liveStoreLinks(item)
  if (stores.length)
    return `<span class="status status-stores">${stores
      .map(
        (link) =>
          `<span class="status-store">${icon(link.icon)}<span>${escapeHtml(actionLabel(words.actions[link.index]))}</span></span>`,
      )
      .join('')}</span>`
  if (liveWebLink(item))
    return `<span class="status status-online"><span class="status-dot" aria-hidden="true"></span><span>${escapeHtml(presentation.online)}</span></span>`
  if (isOffline(item))
    return `<span class="status status-muted">${escapeHtml(presentation.offline)}</span>`
  if (words.status)
    return `<span class="status status-muted">${escapeHtml(words.status)}</span>`
  return `<span class="status status-muted">${escapeHtml(labels.noPublicLink)}</span>`
}

export function projectLinks({ item, words, className = 'btn btn-secondary' }) {
  return liveStoreLinks(item)
    .concat(
      liveWebLink(item)
        ? [{ ...liveWebLink(item), icon: null, web: true }]
        : [],
    )
    .sort((a, b) => a.index - b.index)
    .map(
      (link) =>
        `<a class="${className}" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${link.icon ? icon(link.icon) : ''}<span>${escapeHtml(actionLabel(words.actions[link.index]))}</span>${icon('i-arrow-up-right')}</a>`,
    )
    .join('')
}
