import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../../', import.meta.url)
const styleSources = [
  'assets/fonts.css',
  'assets/tokens.css',
  'assets/base.css',
  'assets/scene.css',
  'assets/pages.css',
]
const scriptSources = [
  'assets/site.js',
  'assets/scene.js',
  'assets/showroom.js',
]
const themeSource = 'assets/theme-init.js'
const imageManifestSource = 'screenshots/web/manifest.json'
const fontFiles = {
  displayLatin: '/assets/fonts/unbounded-latin.woff2',
  displayCyrillic: '/assets/fonts/unbounded-cyrillic.woff2',
  latin: '/assets/fonts/onest-latin.woff2',
  cyrillic: '/assets/fonts/onest-cyrillic.woff2',
  cyrillicExt: '/assets/fonts/onest-cyrillic-ext.woff2',
}
const localeFonts = {
  uz: ['displayLatin', 'latin'],
  en: ['displayLatin', 'latin'],
  ru: ['displayCyrillic', 'latin', 'cyrillic'],
  uk: ['displayCyrillic', 'latin', 'cyrillic'],
  be: ['displayCyrillic', 'latin', 'cyrillic'],
  ky: ['latin', 'cyrillic', 'cyrillicExt'],
  kk: ['latin', 'cyrillic', 'cyrillicExt'],
  tg: ['latin', 'cyrillic', 'cyrillicExt'],
}
export const fontLicenses = [
  '/assets/fonts/onest-LICENSE',
  '/assets/fonts/unbounded-LICENSE',
  '/assets/fonts/jetbrainsmono-LICENSE',
]

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
export const script = bundle(
  scriptSources.map((path) => readSource(path).toString('utf8')).join('\n'),
  'js',
)
export const themeInit = readSource(themeSource).toString('utf8').trim()
export const bundledSources = [...styleSources, ...scriptSources, themeSource]

export const defaultCanvas = (() => {
  const block = stylesheet.content.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ''
  const value = block.match(/--canvas:\s*([^;]+);/)?.[1].trim()
  if (!value) throw new Error('Default theme --canvas token is missing')
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
