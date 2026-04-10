import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  EditorPane,
  type EditorPaneHandle,
} from './components/EditorPane'
import { FileSidebar } from './components/FileSidebar'
import { MarkdownHelpDialog } from './components/MarkdownHelpDialog'
import { ResizeHandle } from './components/ResizeHandle'
import {
  SaveAsDialog,
  type SaveAsKind,
} from './components/SaveAsDialog'
import { SaveToast } from './components/SaveToast'
import { buildStandaloneHtml } from './lib/exportHtml'
import { downloadBlob, downloadBlobFile } from './lib/download'
import {
  SAVE_DIR_NAME,
  deleteWorkspaceMarkdownFile,
  ensureReadWritePermission,
  ensureSaveDirectory,
  displayMdFileLabel,
  listWorkspaceMarkdownFiles,
  loadStoredDirectoryHandle,
  openMarkdownFilePicker,
  pickWorkspaceFolder,
  supportsOpenFilePicker,
  readFileText,
  resolveMdFileNameForSave,
  supportsFileSystemAccess,
  writeFileText,
  writeHtmlFile,
  writePdfFile,
  type MdFileEntry,
} from './lib/fileWorkspace'
import { configureMermaid, hydrateMermaid } from './lib/mermaidRender'
import { renderDocument } from './lib/markdown'
import {
  loadAll,
  saveSettings,
  type AppSettings,
  type Theme,
} from './lib/storage'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/preview.css'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'

const DEBOUNCE_SAVE_MS = 400

const HANDLE_PX = 6
const SIDEBAR_MIN = 140
const SIDEBAR_MAX = 560
const EDITOR_MIN = 200
const EDITOR_MAX = 1400
const PREVIEW_MIN = 200

function layoutHandleCount(fileListVisible: boolean, editorVisible: boolean) {
  if (!fileListVisible && !editorVisible) return 0
  if (fileListVisible && editorVisible) return 2
  return 1
}

const SAMPLE_MARKDOWN = `# 마크다운 프리뷰

**Phase 3** — 수식(KaTeX)·다이어그램(Mermaid)·적응형 미리보기·PWA(오프라인 캐시)까지 포함했습니다.

## 수식 (KaTeX)

인라인은 \`$ ... $\` 블록으로 쓸 수 있습니다. 예: $\\int_0^1 x\\,dx = \\frac{1}{2}$

디스플레이 수식은 \`$$ ... $$\` 또는 \`\`\`katex 펜스\`\`\`:

$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$

## 다이어그램 (Mermaid)

\`\`\`mermaid
flowchart LR
  A[마크다운] --> B[미리보기]
  B --> C[HTML 내보내기]
\`\`\`

## 표

| Phase | 내용 |
|-------|------|
| 3 | 긴 문서일수록 미리보기 대기 시간이 조금 늘어납니다 |

## 인용

> HTML 저장 시 Mermaid는 SVG로 굳어져서 오프라인 파일에서도 보입니다.

---

[Marked](https://marked.js.org/) · [KaTeX](https://katex.org/) · [Mermaid](https://mermaid.js.org/)
`

function debounceMsFor(length: number) {
  if (length > 12000) return 420
  if (length > 6000) return 300
  return 200
}

function App() {
  const [boot] = useState(() => loadAll(SAMPLE_MARKDOWN))

  const [markdown, setMarkdown] = useState(boot.markdown)
  const [baseline, setBaseline] = useState(boot.markdown)
  const [html, setHtml] = useState(() => renderDocument(boot.markdown).html)
  const [toc, setToc] = useState(() => renderDocument(boot.markdown).toc)
  const [editorVisible, setEditorVisible] = useState(boot.editorVisible)
  const [fileListVisible, setFileListVisible] = useState(boot.fileListVisible)
  const [theme, setTheme] = useState<Theme>(boot.theme)
  const [editorFontPx, setEditorFontPx] = useState(boot.editorFontPx)
  const [showLineNumbers, setShowLineNumbers] = useState(
    boot.showLineNumbers,
  )

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(
    null,
  )
  const [mdFiles, setMdFiles] = useState<MdFileEntry[]>([])
  const [hiddenMdListNames, setHiddenMdListNames] = useState<string[]>(
    boot.hiddenMdListNames,
  )
  const [activeFileName, setActiveFileName] = useState<string | null>(null)

  const visibleMdFiles = useMemo(
    () => mdFiles.filter((f) => !hiddenMdListNames.includes(f.name)),
    [mdFiles, hiddenMdListNames],
  )
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const toastHideRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showSaveToast = useCallback((message = '저장 완료') => {
    if (toastHideRef.current !== null) {
      window.clearTimeout(toastHideRef.current)
    }
    setToastMessage(message)
    toastHideRef.current = window.setTimeout(() => {
      setToastMessage(null)
      toastHideRef.current = null
    }, 2600)
  }, [])

  useEffect(() => {
    return () => {
      if (toastHideRef.current !== null) {
        window.clearTimeout(toastHideRef.current)
      }
    }
  }, [])
  const [paneWidths, setPaneWidths] = useState({
    sidebar: boot.layoutSidebarPx,
    editor: boot.layoutEditorPx,
  })

  const previewArticleRef = useRef<HTMLElement>(null)
  const previewShellRef = useRef<HTMLDivElement>(null)
  const editorPaneRef = useRef<EditorPaneHandle>(null)
  const scrollSyncLockRef = useRef(false)
  const mainRef = useRef<HTMLElement>(null)
  const importFileInputRef = useRef<HTMLInputElement>(null)
  const fsSupported = supportsFileSystemAccess()

  useEffect(() => {
    if (!fsSupported) return
    let cancelled = false
    void (async () => {
      const h = await loadStoredDirectoryHandle()
      if (cancelled || !h) return
      if (!(await ensureReadWritePermission(h))) return
      if (cancelled) return
      setDirHandle(h)
      const files = await listWorkspaceMarkdownFiles(h)
      if (cancelled) return
      setMdFiles(files)
      const persisted = loadAll(SAMPLE_MARKDOWN)
      const lastName = persisted.lastActiveMdName
      const hidden = persisted.hiddenMdListNames
      if (lastName && !hidden.includes(lastName)) {
        const entry = files.find((f) => f.name === lastName)
        if (entry) {
          try {
            const text = await readFileText(entry.handle)
            if (cancelled) return
            setMarkdown(text)
            setBaseline(text)
            setActiveFileName(entry.name)
          } catch {
            /* ignore */
          }
        } else {
          if (!cancelled) {
            setActiveFileName(null)
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fsSupported])

  useEffect(() => {
    const ms = debounceMsFor(markdown.length)
    const id = window.setTimeout(() => {
      const { html: h, toc: t } = renderDocument(markdown)
      setHtml(h)
      setToc(t)
    }, ms)
    return () => window.clearTimeout(id)
  }, [markdown])

  useLayoutEffect(() => {
    const el = mainRef.current
    if (!el) return
    const clampToMain = () => {
      const mainW = el.clientWidth
      if (mainW < 320) return
      const hPx = layoutHandleCount(fileListVisible, editorVisible) * HANDLE_PX
      setPaneWidths(({ sidebar: s, editor: e }) => {
        const sw = fileListVisible ? s : 0
        if (!editorVisible && !fileListVisible) {
          return { sidebar: s, editor: e }
        }
        if (!editorVisible) {
          const maxS = Math.max(SIDEBAR_MIN, mainW - hPx - PREVIEW_MIN)
          return {
            sidebar: Math.min(
              SIDEBAR_MAX,
              Math.max(SIDEBAR_MIN, Math.min(s, maxS)),
            ),
            editor: e,
          }
        }
        if (!fileListVisible) {
          const maxE = Math.max(EDITOR_MIN, mainW - hPx - PREVIEW_MIN)
          const ne = Math.min(
            EDITOR_MAX,
            Math.max(EDITOR_MIN, Math.min(e, maxE)),
          )
          return { sidebar: s, editor: ne }
        }
        let ne = Math.min(
          EDITOR_MAX,
          Math.max(EDITOR_MIN, Math.min(e, mainW - hPx - sw - PREVIEW_MIN)),
        )
        let ns = Math.min(
          SIDEBAR_MAX,
          Math.max(SIDEBAR_MIN, Math.min(s, mainW - hPx - ne - PREVIEW_MIN)),
        )
        ne = Math.min(
          EDITOR_MAX,
          Math.max(EDITOR_MIN, Math.min(ne, mainW - hPx - ns - PREVIEW_MIN)),
        )
        return { sidebar: ns, editor: ne }
      })
    }
    const ro = new ResizeObserver(clampToMain)
    ro.observe(el)
    clampToMain()
    return () => ro.disconnect()
  }, [editorVisible, fileListVisible])

  useLayoutEffect(() => {
    configureMermaid(theme)
    const el = previewArticleRef.current
    if (!el) return
    let cancelled = false
    void hydrateMermaid(el).then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [html, theme])

  useEffect(() => {
    const id = window.setTimeout(() => {
      const payload: AppSettings = {
        markdown,
        editorVisible,
        fileListVisible,
        theme,
        editorFontPx,
        showLineNumbers,
        lastActiveMdName: activeFileName,
        layoutSidebarPx: paneWidths.sidebar,
        layoutEditorPx: paneWidths.editor,
        hiddenMdListNames,
      }
      saveSettings(payload)
    }, DEBOUNCE_SAVE_MS)
    return () => window.clearTimeout(id)
  }, [
    markdown,
    editorVisible,
    fileListVisible,
    theme,
    editorFontPx,
    showLineNumbers,
    activeFileName,
    paneWidths.sidebar,
    paneWidths.editor,
    hiddenMdListNames,
  ])

  const onSidebarResizeDelta = (dx: number) => {
    setPaneWidths(({ sidebar: s, editor: e }) => {
      const mainW = mainRef.current?.clientWidth ?? 0
      const hPx = layoutHandleCount(fileListVisible, editorVisible) * HANDLE_PX
      const nextS = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, s + dx))
      if (!editorVisible) {
        const maxS = Math.max(SIDEBAR_MIN, mainW - hPx - PREVIEW_MIN)
        return { sidebar: Math.min(nextS, maxS), editor: e }
      }
      const maxS = Math.max(SIDEBAR_MIN, mainW - hPx - e - PREVIEW_MIN)
      return { sidebar: Math.min(nextS, maxS), editor: e }
    })
  }

  const onEditorResizeDelta = (dx: number) => {
    setPaneWidths(({ sidebar: s, editor: e }) => {
      const mainW = mainRef.current?.clientWidth ?? 0
      const hPx = layoutHandleCount(fileListVisible, editorVisible) * HANDLE_PX
      const sw = fileListVisible ? s : 0
      const nextE = Math.max(EDITOR_MIN, Math.min(EDITOR_MAX, e + dx))
      const maxE = Math.max(EDITOR_MIN, mainW - hPx - sw - PREVIEW_MIN)
      return { sidebar: s, editor: Math.min(nextE, maxE) }
    })
  }

  const openFolder = async () => {
    const h = await pickWorkspaceFolder()
    if (!h) return
    setDirHandle(h)
    setMdFiles(await listWorkspaceMarkdownFiles(h))
  }

  const selectFile = async (entry: MdFileEntry) => {
    if (markdown !== baseline) {
      if (
        !window.confirm(
          '저장하지 않은 변경이 있습니다. 이 파일을 열까요?',
        )
      ) {
        return
      }
    }
    try {
      const text = await readFileText(entry.handle)
      setMarkdown(text)
      setBaseline(text)
      setActiveFileName(entry.name)
    } catch {
      window.alert('파일을 읽지 못했습니다.')
    }
  }

  const saveMdToDisk = async () => {
    if (!fsSupported) {
      downloadBlob(
        resolveMdFileNameForSave(markdown),
        markdown,
        'text/markdown;charset=utf-8',
      )
      showSaveToast()
      return
    }
    if (!dirHandle) {
      window.alert(
        '왼쪽 「폴더」로 작업 폴더를 먼저 열어 주세요. 목록이 접혀 있으면 화면 왼쪽 ➡️ 버튼으로 펼칠 수 있습니다.',
      )
      return
    }
    try {
      const saveDir = await ensureSaveDirectory(dirHandle)
      const nameOnly = resolveMdFileNameForSave(markdown)
      const fh = await saveDir.getFileHandle(nameOnly, { create: true })
      await writeFileText(fh, markdown)
      setBaseline(markdown)
      setActiveFileName(`${SAVE_DIR_NAME}/${nameOnly}`)
      setMdFiles(await listWorkspaceMarkdownFiles(dirHandle))
      showSaveToast()
    } catch {
      window.alert('저장에 실패했습니다.')
    }
  }

  const toggleTheme = () =>
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  const handleSaveAsConfirm = async (kind: SaveAsKind, fileName: string) => {
    if (kind === 'pdf') {
      const el = previewArticleRef.current
      if (!el) {
        window.alert('미리보기 영역을 찾을 수 없습니다.')
        return
      }

      /* 저장 대화상자를 캡처 전에 연다 → 사용자 제스처가 유지돼 브라우저가 저장을 허용하기 쉬움 */
      let pickedFileHandle: FileSystemFileHandle | null = null
      const canPickSave =
        typeof window.showSaveFilePicker === 'function' &&
        window.isSecureContext &&
        !dirHandle
      if (canPickSave) {
        try {
          pickedFileHandle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: 'PDF',
                accept: { 'application/pdf': ['.pdf'] },
              },
            ],
          })
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return
          }
          pickedFileHandle = null
        }
      }

      try {
        const { capturePreviewAsPdfBlob } = await import('./lib/exportPdf')
        const blob = await capturePreviewAsPdfBlob(el, theme)

        if (pickedFileHandle) {
          const writable = await pickedFileHandle.createWritable()
          try {
            await writable.write(blob)
            await writable.close()
          } catch (e) {
            await writable.abort().catch(() => {})
            throw e
          }
          showSaveToast()
          return
        }

        if (fsSupported && dirHandle) {
          if (!(await ensureReadWritePermission(dirHandle))) {
            window.alert(
              '작업 폴더에 쓰기 권한이 필요합니다. 폴더를 다시 연 뒤 허용해 주세요.',
            )
            return
          }
          const saveDir = await ensureSaveDirectory(dirHandle)
          const fh = await saveDir.getFileHandle(fileName, { create: true })
          await writePdfFile(fh, blob)
          showSaveToast()
          return
        }

        downloadBlobFile(fileName, blob)
        showSaveToast()
      } catch (err) {
        console.error(err)
        const msg =
          err instanceof Error ? err.message : String(err)
        window.alert(
          `PDF 저장에 실패했습니다.\n${msg}\n\n이미지·다이어그램이 포함된 경우 일시적으로 제거 후 다시 시도해 보세요.`,
        )
      }
      return
    }
    if (kind === 'markdown') {
      if (!fsSupported) {
        downloadBlob(fileName, markdown, 'text/markdown;charset=utf-8')
        showSaveToast()
        return
      }
      if (!dirHandle) {
        window.alert(
          '왼쪽 「폴더」로 작업 폴더를 먼저 열어 주세요. 목록이 접혀 있으면 화면 왼쪽 ➡️ 버튼으로 펼칠 수 있습니다.',
        )
        return
      }
      try {
        const saveDir = await ensureSaveDirectory(dirHandle)
        const fh = await saveDir.getFileHandle(fileName, { create: true })
        await writeFileText(fh, markdown)
        setBaseline(markdown)
        setActiveFileName(`${SAVE_DIR_NAME}/${fileName}`)
        setMdFiles(await listWorkspaceMarkdownFiles(dirHandle))
        showSaveToast()
      } catch {
        window.alert('저장에 실패했습니다.')
      }
      return
    }
    const doc = await buildStandaloneHtml(markdown, theme)
    if (!fsSupported || !dirHandle) {
      downloadBlob(fileName, doc, 'text/html;charset=utf-8')
      showSaveToast()
      return
    }
    try {
      const saveDir = await ensureSaveDirectory(dirHandle)
      const fh = await saveDir.getFileHandle(fileName, { create: true })
      await writeHtmlFile(fh, doc)
      showSaveToast()
    } catch {
      window.alert('HTML 저장에 실패했습니다.')
    }
  }

  const hideFromList = (entry: MdFileEntry) => {
    const dirtyActive =
      entry.name === activeFileName && markdown !== baseline
    if (
      !window.confirm(
        dirtyActive
          ? '저장하지 않은 변경이 있습니다. 목록에서만 숨길까요? 디스크의 파일은 그대로 둡니다.'
          : '이 파일을 목록에서만 숨길까요? 디스크의 실제 파일은 삭제되지 않습니다.',
      )
    ) {
      return
    }
    setHiddenMdListNames((prev) =>
      prev.includes(entry.name) ? prev : [...prev, entry.name],
    )
    if (entry.name === activeFileName) {
      setMarkdown('')
      setBaseline('')
      setActiveFileName(null)
    }
  }

  const deleteFilePermanent = async (entry: MdFileEntry) => {
    if (!dirHandle) return
    const label = displayMdFileLabel(entry.name)
    if (
      !window.confirm(
        `「${label}」을(를) 파일 삭제합니다. 디스크에서도 지워지며 되돌릴 수 없습니다. 계속할까요?`,
      )
    ) {
      return
    }
    try {
      await deleteWorkspaceMarkdownFile(dirHandle, entry)
      setHiddenMdListNames((prev) => prev.filter((n) => n !== entry.name))
      if (entry.name === activeFileName) {
        setMarkdown('')
        setBaseline('')
        setActiveFileName(null)
      }
      setMdFiles(await listWorkspaceMarkdownFiles(dirHandle))
    } catch {
      window.alert('파일을 삭제하지 못했습니다.')
    }
  }

  const startNewDoc = () => {
    if (
      !window.confirm(
        '새 문서를 시작할까요? 저장하지 않은 내용은 사라집니다.',
      )
    ) {
      return
    }
    setMarkdown('')
    setBaseline('')
    setActiveFileName(null)
  }

  const loadMarkdownFromDisk = async () => {
    if (markdown !== baseline) {
      if (
        !window.confirm(
          '저장하지 않은 변경이 있습니다. 파일을 불러올까요?',
        )
      ) {
        return
      }
    }
    if (supportsOpenFilePicker()) {
      const handle = await openMarkdownFilePicker()
      if (!handle) return
      try {
        const text = await readFileText(handle)
        setMarkdown(text)
        setBaseline(text)
        setActiveFileName(handle.name)
      } catch {
        window.alert('파일을 읽지 못했습니다.')
      }
      return
    }
    importFileInputRef.current?.click()
  }

  const onImportFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void (async () => {
      try {
        const text = await file.text()
        setMarkdown(text)
        setBaseline(text)
        setActiveFileName(file.name)
      } catch {
        window.alert('파일을 읽지 못했습니다.')
      }
    })()
  }

  const withScrollSyncLock = (fn: () => void) => {
    if (scrollSyncLockRef.current) return
    scrollSyncLockRef.current = true
    try {
      fn()
    } finally {
      requestAnimationFrame(() => {
        scrollSyncLockRef.current = false
      })
    }
  }

  const onPreviewShellScroll = () => {
    if (!editorVisible) return
    if (scrollSyncLockRef.current) return
    const shell = previewShellRef.current
    const editor = editorPaneRef.current
    if (!shell || !editor) return
    const max = shell.scrollHeight - shell.clientHeight
    if (max <= 0) return
    const ratio = shell.scrollTop / max
    withScrollSyncLock(() => {
      editor.setScrollTopFromRatio(ratio)
    })
  }

  const onEditorScrollRatio = (ratio: number) => {
    if (!editorVisible) return
    if (scrollSyncLockRef.current) return
    const shell = previewShellRef.current
    if (!shell) return
    const max = shell.scrollHeight - shell.clientHeight
    if (max <= 0) return
    withScrollSyncLock(() => {
      shell.scrollTop = ratio * max
    })
  }

  return (
    <div className="app-root" data-theme={theme}>
      <header className="app-header">
        <div className="app-header-start">
          <h1 className="app-title">
            <span className="app-title-brand">MARKDOWN PREVIEW</span>
            {activeFileName ? (
              <span className="app-title-file" title={displayMdFileLabel(activeFileName)}>
                {displayMdFileLabel(activeFileName)}
              </span>
            ) : null}
          </h1>
        </div>
        <div className="app-header-center">
          <details className="settings-dropdown">
            <summary className="settings-summary">설정</summary>
            <div className="settings-panel">
              <label className="settings-field">
                <span>글자 크기</span>
                <input
                  type="range"
                  min={11}
                  max={22}
                  value={editorFontPx}
                  onChange={(e) =>
                    setEditorFontPx(Number.parseInt(e.target.value, 10))
                  }
                />
                <span className="settings-value">{editorFontPx}px</span>
              </label>
              <label className="settings-field settings-check">
                <input
                  type="checkbox"
                  checked={showLineNumbers}
                  onChange={(e) => setShowLineNumbers(e.target.checked)}
                />
                <span>줄 번호</span>
              </label>
            </div>
          </details>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setHelpOpen(true)}
          >
            도움말
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            className="visually-hidden-import"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            aria-hidden
            tabIndex={-1}
            onChange={onImportFileInputChange}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void loadMarkdownFromDisk()}
            title="디스크에서 마크다운 파일 열기"
          >
            불러오기
          </button>
          <button type="button" className="btn-secondary" onClick={startNewDoc}>
            새 문서
          </button>
          <button type="button" className="btn-secondary" onClick={saveMdToDisk}>
            저장
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setSaveAsOpen(true)}
          >
            다른 이름으로 저장
          </button>
          <button
            type="button"
            className="toggle-editor"
            aria-pressed={editorVisible}
            onClick={() => setEditorVisible((v) => !v)}
          >
            {editorVisible ? '에디터 숨기기' : '에디터 보이기'}
          </button>
        </div>
        <div className="app-header-end">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={
              theme === 'light' ? '다크 테마로 전환' : '라이트 테마로 전환'
            }
            aria-label={
              theme === 'light' ? '다크 테마로 전환' : '라이트 테마로 전환'
            }
          >
            <span className="theme-toggle-icon" aria-hidden>
              {theme === 'light' ? '🌙' : '☀️'}
            </span>
          </button>
        </div>
      </header>
      <main
        ref={mainRef}
        className={`app-main${editorVisible ? '' : ' editor-hidden'}${fileListVisible ? '' : ' file-list-hidden'}`}
        aria-label="파일, 에디터, 프리뷰"
      >
        {!fileListVisible ? (
          <button
            type="button"
            className="file-list-reveal"
            onClick={() => setFileListVisible(true)}
            title="파일 목록 펼치기"
            aria-label="파일 목록 펼치기"
          >
            <span className="file-list-reveal-emoji" aria-hidden>
              ➡️
            </span>
          </button>
        ) : null}
        {fileListVisible ? (
          <>
            <div
              className="layout-pane-sidebar"
              style={{ width: paneWidths.sidebar }}
            >
              <FileSidebar
                fsSupported={fsSupported}
                dirHandleReady={!!dirHandle}
                files={visibleMdFiles}
                activeFileName={activeFileName}
                onOpenFolder={openFolder}
                onHideFileList={() => setFileListVisible(false)}
                onSelectFile={(e) => void selectFile(e)}
                onHideFromList={hideFromList}
                onDeleteFilePermanent={(e) => void deleteFilePermanent(e)}
              />
            </div>
            <ResizeHandle onDelta={onSidebarResizeDelta} />
          </>
        ) : null}
        {editorVisible ? (
          <>
            <div
              className="editor-pane"
              style={{ width: paneWidths.editor }}
            >
              <div className="editor-pane-label">Markdown</div>
              <EditorPane
                ref={editorPaneRef}
                value={markdown}
                onChange={setMarkdown}
                fontPx={editorFontPx}
                showLineNumbers={showLineNumbers}
                onScrollRatioChange={onEditorScrollRatio}
              />
            </div>
            <ResizeHandle onDelta={onEditorResizeDelta} />
          </>
        ) : null}
        <div
          ref={previewShellRef}
          className="preview-shell"
          onScroll={onPreviewShellScroll}
        >
          <div className="preview-layout">
            {toc.length > 0 && !editorVisible ? (
              <nav className="preview-toc" aria-label="목차">
                <div className="preview-toc-title">목차</div>
                <ul className="preview-toc-list">
                  {toc.map((item) => (
                    <li
                      key={`${item.slug}-${item.depth}-${item.text}`}
                      className={`preview-toc-item preview-toc-depth-${item.depth}`}
                    >
                      <a href={`#${item.slug}`}>{item.text}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            <article
              ref={previewArticleRef}
              className="preview-page notion-preview"
              dangerouslySetInnerHTML={{ __html: html }}
              aria-label="렌더된 프리뷰"
            />
          </div>
        </div>
      </main>
      <SaveAsDialog
        open={saveAsOpen}
        defaultMdFileName={resolveMdFileNameForSave(markdown)}
        onClose={() => setSaveAsOpen(false)}
        onConfirm={(kind, fileName) => void handleSaveAsConfirm(kind, fileName)}
      />
      <MarkdownHelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
      <SaveToast message={toastMessage} />
    </div>
  )
}

export default App
