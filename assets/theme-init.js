;(() => {
  const root = document.documentElement
  let theme = 'light'
  try {
    const saved = localStorage.getItem('sr-product-intelligence-theme')
    if (saved === 'dark' || saved === 'light') theme = saved
    if (
      saved !== 'dark' &&
      saved !== 'light' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    )
      theme = 'dark'
  } catch {
    root.dataset.storage = 'unavailable'
  }
  root.dataset.theme = theme
  root.classList.add('js')
})()
