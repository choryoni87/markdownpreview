import mermaid from 'mermaid'

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

let themeConfigured: 'light' | 'dark' | null = null

export function configureMermaid(theme: 'light' | 'dark') {
  if (themeConfigured === theme) return
  themeConfigured = theme
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    securityLevel: 'strict',
    fontFamily: 'inherit',
  })
}

/**
 * Renders `data-mermaid` placeholders inside `root` to inline SVG.
 */
export async function hydrateMermaid(root: HTMLElement) {
  const nodes = root.querySelectorAll<HTMLElement>('.mermaid-chart')
  let i = 0
  for (const el of nodes) {
    const raw = el.getAttribute('data-mermaid')
    if (raw == null) continue
    el.replaceChildren()
    let text: string
    try {
      text = decodeURIComponent(raw)
    } catch {
      el.innerHTML = `<pre class="mermaid-error">잘못된 다이어그램 데이터</pre>`
      continue
    }
    const id = `mmd-${Date.now()}-${i++}-${Math.random().toString(36).slice(2, 9)}`
    try {
      const { svg } = await mermaid.render(id, text)
      if (svg.includes('Syntax error in text')) {
        el.innerHTML = `<div class="mermaid-error-banner" role="alert">
<p class="mermaid-error-title">Mermaid 다이어그램 문법 오류</p>
<p class="mermaid-error-hint">코드가 최신 Mermaid 규칙과 맞지 않을 때 나타납니다. 예: <code>venn-beta</code>의 교집합은 <code>union A,B</code>처럼 <strong>쉼표</strong>로 연결하고, <code>title "제목"</code>은 따옴표로 감싸 주세요. <code>pie</code>는 <code>pie showData</code> 다음 줄에 <code>title</code>을 쓰는 편이 안전합니다.</p>
<pre class="mermaid-error-source">${escapeHtml(text)}</pre>
</div>`
      } else {
        el.innerHTML = svg
      }
    } catch {
      el.innerHTML = `<pre class="mermaid-error">${escapeHtml(text)}</pre>`
    }
  }
}
