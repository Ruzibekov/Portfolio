;(() => {
  const root = document.documentElement
  let theme = 'dark'
  try {
    const saved = localStorage.getItem('sr-product-intelligence-theme')
    if (saved === 'dark' || saved === 'light') theme = saved
  } catch {
    root.dataset.storage = 'unavailable'
  }
  root.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta?.dataset[theme]) meta.setAttribute('content', meta.dataset[theme])
  root.classList.add('js')
})()
