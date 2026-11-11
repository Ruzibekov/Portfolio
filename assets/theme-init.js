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
  root.classList.add('js')
})()
