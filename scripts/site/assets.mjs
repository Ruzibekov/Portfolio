import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../../', import.meta.url)
const styleSources = [
  'assets/fonts.css',
  'assets/site.css',
  'assets/services.css',
  'assets/work-gallery.css',
  'assets/bento.css',
  'assets/case.css',
  'assets/portfolio-b.css',
]
const scriptSource = 'assets/site.js'
const themeSource = 'assets/theme-init.js'
const imageManifestSource = 'screenshots/web/manifest.json'
const fontFiles = {
  latin: '/assets/fonts/onest-latin.woff2',
  cyrillic: '/assets/fonts/onest-cyrillic.woff2',
  cyrillicExt: '/assets/fonts/onest-cyrillic-ext.woff2',
}
const localeFonts = {
  uz: ['latin'],
  en: ['latin'],
  ru: ['latin', 'cyrillic'],
  uk: ['latin', 'cyrillic'],
  be: ['latin', 'cyrillic'],
  ky: ['latin', 'cyrillic', 'cyrillicExt'],
  kk: ['latin', 'cyrillic', 'cyrillicExt'],
  tg: ['latin', 'cyrillic', 'cyrillicExt'],
}

const readSource = (path) => {
  const url = new URL(path, root)
  if (!existsSync(url)) throw new Error(`Missing source asset: ${path}`)
  return readFileSync(url)
}
const digest = (content) =>
  createHash('sha256').update(content).digest('hex').slice(0, 10)
const versions = new Map()

export function versioned(publicPath) {
  if (!publicPath.startsWith('/assets/'))
    throw new Error(`Only /assets/ files are versioned: ${publicPath}`)
  if (!versions.has(publicPath))
    versions.set(publicPath, digest(readSource(publicPath.slice(1))))
  return `${publicPath}?v=${versions.get(publicPath)}`
}

const versionCssUrls = (css) =>
  css.replace(
    /url\((['"]?)(\/assets\/[^'")?#]+)\1\)/g,
    (_, quote, path) => `url(${quote}${versioned(path)}${quote})`,
  )

const bundle = (content, extension) => ({
  path: `/assets/site.${digest(content)}.${extension}`,
  content,
})

export const stylesheet = bundle(
  styleSources
    .map((path) => versionCssUrls(readSource(path).toString('utf8')))
    .join('\n'),
  'css',
)
export const script = bundle(readSource(scriptSource).toString('utf8'), 'js')
export const themeInit = readSource(themeSource).toString('utf8').trim()
export const bundledSources = [...styleSources, scriptSource, themeSource]

export const darkCanvas = (() => {
  const blocks = [
    ...stylesheet.content.matchAll(
      /:root\[data-theme=['"]dark['"]\]\s*\{([^}]*)\}/g,
    ),
  ]
  const value = blocks
    .map((block) => block[1].match(/--canvas:\s*([^;]+);/)?.[1].trim())
    .filter(Boolean)
    .at(-1)
  if (!value) throw new Error('Dark theme --canvas token is missing')
  return value
})()

export function fontPreloads(locale) {
  const subsets = localeFonts[locale]
  if (!subsets) throw new Error(`No font subsets for ${locale}`)
  return subsets.map((subset) => versioned(fontFiles[subset]))
}

const imageManifest = JSON.parse(
  readSource(imageManifestSource).toString('utf8'),
)

export function imageEntry(key) {
  const entry = imageManifest[key]
  if (!entry?.variants?.length)
    throw new Error(`Image ${key} is not in ${imageManifestSource}`)
  return entry
}

export function imageSrc(key, maxWidth = Infinity) {
  const { variants } = imageEntry(key)
  return (
    variants.filter((variant) => variant.width <= maxWidth).at(-1) ??
    variants[0]
  ).src
}

export function imageTag({
  key,
  alt,
  sizes,
  className = '',
  priority = false,
  lazy = !priority,
}) {
  const entry = imageEntry(key)
  const srcset =
    entry.variants.length > 1
      ? ` srcset="${entry.variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ')}" sizes="${sizes}"`
      : ''
  const loading = lazy ? ' loading="lazy"' : ''
  const hint = priority ? ' fetchpriority="high"' : ' decoding="async"'
  const classAttribute = className ? ` class="${className}"` : ''
  return `<img${classAttribute} src="${imageSrc(key)}"${srcset} alt="${alt}" width="${entry.width}" height="${entry.height}"${loading}${hint}>`
}
