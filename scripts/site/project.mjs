import { imageEntry } from './assets.mjs'

const storeHosts = [
  ['apps.apple.com', 'l-appstore'],
  ['play.google.com', 'l-googleplay'],
]
const monoPattern = /^[\x20-\x7E·→/]+$/

function storeIcon(href) {
  const host = new URL(href).hostname
  return storeHosts.find(([name]) => host === name)?.[1] ?? null
}

export function liveLinks(item) {
  return item.links
    .map((link, index) => ({ ...link, index }))
    .filter((link) => !link.offline)
}

export function liveWebLink(item) {
  return liveLinks(item).find((link) => !storeIcon(link.href)) ?? null
}

export function liveStoreLinks(item) {
  return liveLinks(item)
    .map((link) => ({ ...link, icon: storeIcon(link.href) }))
    .filter((link) => link.icon)
}

export function isOffline(item) {
  return item.links.length > 0 && item.links.every((link) => link.offline)
}

export function domainOf(href) {
  return new URL(href).hostname.replace(/^www\./, '')
}

export function siteDomain(item) {
  const link = item.links.find((entry) => !storeIcon(entry.href))
  return link ? domainOf(link.href) : null
}

export function monoText(value) {
  const text = String(value)
  if (!monoPattern.test(text))
    throw new Error(`Monospace text must be ASCII identifiers only: ${text}`)
  return text
}

export function countProjects(cases) {
  return {
    total: cases.length,
    web: cases.filter((item) => item.categories.includes('web')).length,
    mobile: cases.filter((item) => item.categories.includes('mobile')).length,
    stores: cases.filter((item) => liveStoreLinks(item).length).length,
    online: cases.filter((item) => liveWebLink(item)).length,
  }
}

export function projectType(item, ui) {
  return ui.work.filters[item.categories[0]]
}

export function imageKind(key) {
  const { width, height } = imageEntry(key)
  return width > height ? 'browser' : 'phone'
}

export function slabKind(item) {
  if (item.screen) return imageKind(item.screen)
  return item.categories.includes('web') ? 'browser' : 'phone'
}

export function validateProjectMedia(cases) {
  for (const item of cases) {
    for (const key of [item.screen, ...(item.gallery ?? [])].filter(Boolean))
      imageEntry(key)
    for (const link of item.links) {
      if (!link.offline) continue
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(link.offline.checkedOn ?? '') ||
        !link.offline.evidence?.trim()
      )
        throw new Error(`Offline link needs a dated check: ${item.key}`)
    }
    monoText(item.stack)
  }
}
