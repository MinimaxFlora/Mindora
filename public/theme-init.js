(function () {
  try {
    var preference = localStorage.getItem('mindora:theme') || 'system'
    var dark =
      preference === 'dark' ||
      (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  } catch (_) {
    // Storage can be unavailable in restricted browsing modes.
  }
})()
