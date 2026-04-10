import DOMPurify, { type Config } from 'dompurify'
import hljs from 'highlight.js'
import katex from 'katex'
import { marked, type Token, type Tokens } from 'marked'
import { createSlugger } from './slugger'

type RendererThis = {
  parser: { parseInline: (tokens: Token[]) => string }
}

/** Display KaTeX HTML (fenced / $$), filled per `renderDocument` call. */
let katexChunkList: string[] = []
/** Inline `$...$` KaTeX HTML, same lifecycle. */
let katexInlineList: string[] = []

let hooksInstalled = false

function ensureDomPurifyHooks() {
  if (hooksInstalled) return
  hooksInstalled = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'A') return
    const href = node.getAttribute('href')
    if (!href || href.startsWith('#')) return
    if (/^https?:\/\//i.test(href)) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

type HeadingWithSlug = Tokens.Heading & { slug?: string }

function preprocessDisplayMath(source: string) {
  return source.replace(/\$\$([\s\S]*?)\$\$/g, (_, body: string) => {
    return `\n\n\`\`\`katex\n${body.trim()}\n\`\`\`\n\n`
  })
}

const FENCE_START = '\uE000'
const FENCE_END = '\uE001'

function protectFencedBlocks(source: string) {
  const blocks: string[] = []
  const text = source.replace(/```[\s\S]*?```/g, (m) => {
    blocks.push(m)
    return `${FENCE_START}${blocks.length - 1}${FENCE_END}`
  })
  return { text, blocks }
}

function unprotectFencedBlocks(text: string, blocks: string[]) {
  return text.replace(
    new RegExp(`${FENCE_START}(\\d+)${FENCE_END}`, 'g'),
    (_, i) => blocks[Number(i)] ?? '',
  )
}

/** Single-line / escaped `$...$` outside fenced blocks → KaTeX placeholders. */
function preprocessInlineMath(source: string) {
  const { text, blocks } = protectFencedBlocks(source)
  const merged = text.replace(
    /\$(?!\$)((?:\\.|[^$])+?)\$(?!\$)/g,
    (_, expr: string) => {
      try {
        const k = katex.renderToString(expr, {
          displayMode: false,
          throwOnError: false,
          strict: false,
        })
        const idx = katexInlineList.length
        katexInlineList.push(k)
        return `<span class="katex-inline-ph" data-katex-inline="${idx}"></span>`
      } catch {
        return `$${expr}$`
      }
    },
  )
  return unprotectFencedBlocks(merged, blocks)
}

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    code({ text, lang }) {
      const norm = lang?.trim().toLowerCase()
      if (norm === 'mermaid') {
        return `<div class="mermaid-chart" data-mermaid="${encodeURIComponent(text)}"></div>\n`
      }
      if (norm === 'katex' || norm === 'math') {
        try {
          const k = katex.renderToString(text.trimEnd(), {
            displayMode: true,
            throwOnError: false,
            strict: false,
          })
          const idx = katexChunkList.length
          katexChunkList.push(k)
          return `<div class="katex-ph" data-katex-ph="${idx}"></div>\n`
        } catch {
          return `<pre><code>${escapeHtml(text)}</code></pre>`
        }
      }
      const language =
        lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      let highlighted: string
      try {
        highlighted = hljs.highlight(text, { language }).value
      } catch {
        try {
          highlighted = hljs.highlightAuto(text).value
        } catch {
          highlighted = escapeHtml(text)
        }
      }
      const cls = lang
        ? `hljs language-${lang}`
        : 'hljs language-plaintext'
      return `<pre><code class="${cls}">${highlighted}</code></pre>`
    },
    heading: function (this: RendererThis, token: Tokens.Heading) {
      const { tokens, depth } = token
      const slug = (token as HeadingWithSlug).slug
      const body = this.parser.parseInline(tokens)
      const idAttr = slug ? ` id="${escapeHtml(slug)}"` : ''
      return `<h${depth}${idAttr}>${body}</h${depth}>\n`
    },
  },
})

const PURIFY: Config = {
  ADD_TAGS: ['input'],
  ADD_ATTR: [
    'checked',
    'disabled',
    'class',
    'type',
    'id',
    'data-katex-ph',
    'data-katex-inline',
    'data-mermaid',
  ],
  RETURN_TRUSTED_TYPE: false,
}

export interface TocItem {
  depth: number
  text: string
  slug: string
}

function injectKatexChunks(html: string) {
  return html.replace(
    /<div class="katex-ph" data-katex-ph="(\d+)"><\/div>/g,
    (_, i) => katexChunkList[Number(i)] ?? '',
  )
}

function injectInlineKatex(html: string) {
  return html.replace(
    /<span class="katex-inline-ph" data-katex-inline="(\d+)"><\/span>/g,
    (_, i) => katexInlineList[Number(i)] ?? '',
  )
}

export function renderDocument(source: string): { html: string; toc: TocItem[] } {
  ensureDomPurifyHooks()
  katexChunkList = []
  katexInlineList = []
  const prepped = preprocessInlineMath(preprocessDisplayMath(source))
  const tokens = marked.lexer(prepped) as Token[]
  const slugger = createSlugger()
  const toc: TocItem[] = []

  marked.walkTokens(tokens, (token) => {
    if (token.type !== 'heading') return
    const h = token as HeadingWithSlug
    const slug = slugger.slug(h.text)
    h.slug = slug
    toc.push({ depth: h.depth, text: h.text, slug })
  })

  const raw = marked.parser(tokens)
  let html = DOMPurify.sanitize(raw, PURIFY) as string
  html = injectKatexChunks(html)
  html = injectInlineKatex(html)
  return { html, toc }
}
