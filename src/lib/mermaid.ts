let sequence = 0
let queue: Promise<unknown> = Promise.resolve()
let initializedTheme: 'light' | 'dark' | null = null

export async function renderMermaidDiagram(code: string, theme: 'light' | 'dark'): Promise<string> {
  const task = queue.then(async () => {
    const mermaid = (await import('mermaid')).default
    if (initializedTheme !== theme) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
        theme: theme === 'dark' ? 'dark' : 'neutral',
        fontFamily:
          'Inter, SF Pro Text, Segoe UI, system-ui, -apple-system, PingFang SC, Microsoft YaHei, sans-serif',
        flowchart: { htmlLabels: false, useMaxWidth: true },
        sequence: { useMaxWidth: true },
        gantt: { useMaxWidth: true },
      })
      initializedTheme = theme
    }
    const id = `mindora-mermaid-${Date.now()}-${sequence++}`
    try {
      const { svg } = await mermaid.render(id, code)
      return svg
    } finally {
      document.getElementById(`d${id}`)?.remove()
      document.getElementById(id)?.remove()
    }
  })

  queue = task.catch(() => undefined)
  return task
}
