#!/usr/bin/env node
// Cache-bust local CSS/JS assets in index.html by appending a content hash
// query (?v=<hash>) to each reference. Same file content -> same hash (browser
// keeps cache); changed content -> new hash (browser refetches). Runs at build
// time, so the version is never stale and never forgotten.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const htmlPath = resolve(root, 'index.html')

// Assets to version: local CSS/JS only (skip external URLs).
const assetPattern = /(href|src)="(assets\/[^"?#]+\.(?:css|js))(?:\?v=[^"]*)?"/g

const hashOf = (relPath) => {
  const filePath = resolve(root, relPath)
  if (!existsSync(filePath)) return null
  return createHash('sha256')
    .update(readFileSync(filePath))
    .digest('hex')
    .slice(0, 10)
}

let html = readFileSync(htmlPath, 'utf8')
let count = 0

html = html.replace(assetPattern, (match, attr, relPath) => {
  const hash = hashOf(relPath)
  if (!hash) {
    console.warn(`cache-bust: asset not found, skipped: ${relPath}`)
    return match
  }
  count += 1
  return `${attr}="${relPath}?v=${hash}"`
})

writeFileSync(htmlPath, html)
console.log(`cache-bust: versioned ${count} asset reference(s) in index.html`)
