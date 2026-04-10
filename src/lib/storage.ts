export type Theme = 'light' | 'dark'

export interface AppSettings {
  markdown: string
  editorVisible: boolean
  /** 왼쪽 파일(폴더) 목록 패널 표시 여부 */
  fileListVisible: boolean
  theme: Theme
  editorFontPx: number
  showLineNumbers: boolean
  /** 워크스페이스에서 마지막으로 연 .md 파일 이름(복원용) */
  lastActiveMdName: string | null
  /** 파일 목록 사이드바 너비(px) */
  layoutSidebarPx: number
  /** 마크다운 에디터 영역 너비(px), 에디터 표시 시만 사용 */
  layoutEditorPx: number
  /**
   * 목록에서만 숨긴 .md (`save/파일.md` 형식 키). 디스크 파일은 유지됨.
   */
  hiddenMdListNames: string[]
}

const KEY = 'notion-md-preview:v2'

const DEFAULTS: Omit<AppSettings, 'markdown'> = {
  editorVisible: true,
  fileListVisible: true,
  theme: 'light',
  editorFontPx: 13,
  showLineNumbers: true,
  lastActiveMdName: null,
  layoutSidebarPx: 220,
  layoutEditorPx: 400,
  hiddenMdListNames: [],
}

export function loadAll(sampleWhenNoKey: string): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      return { ...DEFAULTS, markdown: sampleWhenNoKey }
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      ...DEFAULTS,
      editorVisible:
        typeof parsed.editorVisible === 'boolean'
          ? parsed.editorVisible
          : DEFAULTS.editorVisible,
      fileListVisible:
        typeof parsed.fileListVisible === 'boolean'
          ? parsed.fileListVisible
          : DEFAULTS.fileListVisible,
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      editorFontPx: clampFontSize(parsed.editorFontPx),
      showLineNumbers:
        typeof parsed.showLineNumbers === 'boolean'
          ? parsed.showLineNumbers
          : DEFAULTS.showLineNumbers,
      markdown:
        typeof parsed.markdown === 'string'
          ? parsed.markdown
          : sampleWhenNoKey,
      lastActiveMdName:
        typeof parsed.lastActiveMdName === 'string'
          ? parsed.lastActiveMdName
          : null,
      layoutSidebarPx: clampLayoutPx(
        parsed.layoutSidebarPx,
        DEFAULTS.layoutSidebarPx,
        140,
        560,
      ),
      layoutEditorPx: clampLayoutPx(
        parsed.layoutEditorPx,
        DEFAULTS.layoutEditorPx,
        200,
        1400,
      ),
      hiddenMdListNames: normalizeHiddenList(parsed.hiddenMdListNames),
    }
  } catch {
    return { ...DEFAULTS, markdown: sampleWhenNoKey }
  }
}

export function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        markdown: settings.markdown,
        editorVisible: settings.editorVisible,
        fileListVisible: settings.fileListVisible,
        theme: settings.theme,
        editorFontPx: settings.editorFontPx,
        showLineNumbers: settings.showLineNumbers,
        lastActiveMdName: settings.lastActiveMdName,
        layoutSidebarPx: settings.layoutSidebarPx,
        layoutEditorPx: settings.layoutEditorPx,
        hiddenMdListNames: settings.hiddenMdListNames,
      }),
    )
  } catch {
    /* quota or private mode */
  }
}

const HIDDEN_LIST_MAX = 500

function normalizeHiddenList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const x of v) {
    if (typeof x === 'string' && x.length > 0 && x.length < 512) out.push(x)
    if (out.length >= HIDDEN_LIST_MAX) break
  }
  return out
}

function clampLayoutPx(
  n: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function clampFontSize(n: unknown): number {
  const x =
    typeof n === 'number' && Number.isFinite(n) ? n : DEFAULTS.editorFontPx
  return Math.min(22, Math.max(11, Math.round(x)))
}
