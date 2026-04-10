import katexCss from 'katex/dist/katex.min.css?raw'
import hljsCss from 'highlight.js/styles/github-dark.css?raw'
import previewCss from '../styles/preview.css?raw'
import tokensCss from '../styles/tokens.css?raw'
import { configureMermaid, hydrateMermaid } from './mermaidRender'
import { renderDocument } from './markdown'

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const EXPORT_WRAPPER_CSS = `
body{margin:0;font-family:var(--font-sans);background:var(--canvas-bg);color:var(--text-primary);}
.export-shell{min-height:100vh;padding:32px 20px;box-sizing:border-box;}
.export-page{max-width:var(--page-max-width);margin:0 auto;background:var(--page-bg);border:var(--page-border);border-radius:16px;padding:var(--space-6) var(--space-6) var(--space-7);box-shadow:var(--page-shadow);}
`

function buildStandaloneHtmlSync(
  bodyHtml: string,
  theme: 'light' | 'dark',
  title = '문서',
): string {
  const t = escapeHtml(title)
  const themeAttr = theme === 'dark' ? 'dark' : 'light'
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t}</title>
<style>
${tokensCss}
${previewCss}
${hljsCss}
${katexCss}
${EXPORT_WRAPPER_CSS}
</style>
</head>
<body data-theme="${themeAttr}">
<div class="export-shell">
  <article class="export-page notion-preview">${bodyHtml}</article>
</div>
</body>
</html>
`
}

/**
 * 단일 HTML: 인라인 CSS + KaTeX, Mermaid는 SVG로 굳힘(file://에서도 표시).
 */
export async function buildStandaloneHtml(
  markdown: string,
  theme: 'light' | 'dark',
  title = '문서',
): Promise<string> {
  const { html } = renderDocument(markdown)
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  configureMermaid(theme)
  await hydrateMermaid(wrap)
  return buildStandaloneHtmlSync(wrap.innerHTML, theme, title)
}
