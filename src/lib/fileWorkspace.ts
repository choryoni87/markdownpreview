const DB_NAME = 'notion-md-preview-fs'
const STORE = 'handles'
const KEY_WORKSPACE = 'workspace'

/** 작업 폴더 안에 자동 생성되는 저장 전용 하위 폴더 이름 */
export const SAVE_DIR_NAME = 'save'

/** 사이드바 등 UI: `save/foo.md` → `foo.md` (내부 식별자는 그대로 `save/...`) */
export function displayMdFileLabel(name: string): string {
  const p = `${SAVE_DIR_NAME}/`
  return name.startsWith(p) ? name.slice(p.length) : name
}

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
  })
}

export async function storeWorkspaceDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(handle, KEY_WORKSPACE)
  })
}

export async function loadStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY_WORKSPACE)
      req.onsuccess = () => {
        const v = req.result
        resolve(
          v && typeof v === 'object' && 'kind' in v && v.kind === 'directory'
            ? (v as FileSystemDirectoryHandle)
            : null,
        )
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function ensureReadWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const opts = { mode: 'readwrite' as const }
  let p = await handle.queryPermission(opts)
  if (p === 'granted') return true
  p = await handle.requestPermission(opts)
  return p === 'granted'
}

export interface MdFileEntry {
  name: string
  handle: FileSystemFileHandle
}

export async function listMarkdownFiles(
  dir: FileSystemDirectoryHandle,
): Promise<MdFileEntry[]> {
  const out: MdFileEntry[] = []
  for await (const [name, entry] of dir.entries() as AsyncIterableIterator<
    [string, FileSystemHandle]
  >) {
    if (
      entry.kind === 'file' &&
      /\.(md|markdown)$/i.test(name)
    ) {
      out.push({ name, handle: entry as FileSystemFileHandle })
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return out
}

/**
 * 작업 폴더 아래 `save/` 생성(없으면 만듦).
 * 일부 환경에서 빈 폴더가 바로 보이도록, 비어 있을 때만 표식 파일을 만든다.
 */
export async function ensureSaveDirectory(
  workspace: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle> {
  const dir = await workspace.getDirectoryHandle(SAVE_DIR_NAME, { create: true })
  let hasAny = false
  for await (const _ of dir.entries()) {
    hasAny = true
    break
  }
  if (!hasAny) {
    const fh = await dir.getFileHandle('.gitkeep', { create: true })
    const w = await fh.createWritable()
    try {
      await w.write(new TextEncoder().encode('\n'))
      await w.close()
    } catch (e) {
      await w.abort().catch(() => {})
      throw e
    }
  }
  return dir
}

/** 루트의 .md + `save/` 안의 .md (표시명 `save/파일.md`) */
export async function listWorkspaceMarkdownFiles(
  workspace: FileSystemDirectoryHandle,
): Promise<MdFileEntry[]> {
  const saveDir = await ensureSaveDirectory(workspace)
  const inSave = await listMarkdownFiles(saveDir)
  const prefixed = inSave.map((f) => ({
    name: `${SAVE_DIR_NAME}/${f.name}`,
    handle: f.handle,
  }))
  const root = await listMarkdownFiles(workspace)
  const merged = [...prefixed, ...root]
  merged.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return merged
}

const SAVE_NAME_PREFIX = `${SAVE_DIR_NAME}/`

/** 워크스페이스에서 .md 항목 삭제 (`save/` 하위·루트 모두) */
export async function deleteWorkspaceMarkdownFile(
  workspace: FileSystemDirectoryHandle,
  entry: MdFileEntry,
): Promise<void> {
  if (entry.name.startsWith(SAVE_NAME_PREFIX)) {
    const saveDir = await ensureSaveDirectory(workspace)
    const leaf = entry.name.slice(SAVE_NAME_PREFIX.length)
    await saveDir.removeEntry(leaf)
  } else {
    await workspace.removeEntry(entry.name)
  }
}

export async function readFileText(
  file: FileSystemFileHandle,
): Promise<string> {
  const fileObj = await file.getFile()
  return fileObj.text()
}

export async function writeFileText(
  file: FileSystemFileHandle,
  text: string,
): Promise<void> {
  const writable = await file.createWritable()
  try {
    await writable.write(
      new Blob([text], { type: 'text/markdown;charset=utf-8' }),
    )
    await writable.close()
  } catch (e) {
    await writable.abort().catch(() => {})
    throw e
  }
}

export async function writeHtmlFile(
  file: FileSystemFileHandle,
  html: string,
): Promise<void> {
  const writable = await file.createWritable()
  try {
    await writable.write(
      new Blob([html], { type: 'text/html;charset=utf-8' }),
    )
    await writable.close()
  } catch (e) {
    await writable.abort().catch(() => {})
    throw e
  }
}

export async function writePdfFile(
  file: FileSystemFileHandle,
  blob: Blob,
): Promise<void> {
  const writable = await file.createWritable()
  try {
    await writable.write(blob)
    await writable.close()
  } catch (e) {
    await writable.abort().catch(() => {})
    throw e
  }
}

const TITLE_PREFIX_CHARS = 5

/** 첫 번째 ATX 제목(`# …`)이 있으면 그 텍스트, 없으면 첫 비어 있지 않은 줄 */
export function extractDocumentTitle(markdown: string): string {
  const text = markdown.trim()
  if (!text) return '문서'
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s{0,3}#{1,6}\s+(.+?)(\s+#+\s*)?$/)
    if (m) {
      const t = m[1].trim()
      if (t) return t
    }
  }
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const stripped = first.replace(/^\s{0,3}#{1,6}\s*/, '').trim()
  return stripped || '문서'
}

function sanitizeFilenameBase(raw: string): string {
  let s = raw.replace(/[/\\?%*:|"<>]+/g, '').trim()
  s = s.replace(/\.+$/, '')
  return s || '문서'
}

/** 제목 앞 5글자로 `save/` 안에 쓸 파일 베이스명 */
export function fileBaseFromDocumentTitle(markdown: string): string {
  const title = extractDocumentTitle(markdown).trim()
  const prefix = [...title].slice(0, TITLE_PREFIX_CHARS).join('')
  return sanitizeFilenameBase(prefix)
}

/** `save/` 안에 쓸 .md 파일명 — 저장 시 항상 문서 제목 앞 5글자 기준 */
export function resolveMdFileNameForSave(markdown: string): string {
  return `${fileBaseFromDocumentTitle(markdown)}.md`
}

/** `save/` 안에 쓸 .html 파일명 — `.md` 와 동일 베이스 */
export function resolveHtmlFileNameForSave(markdown: string): string {
  return `${fileBaseFromDocumentTitle(markdown)}.html`
}

/** 다른 이름 저장: 입력 문자열에서 확장자를 떼고 정리한 뒤 형식에 맞는 확장자 부여 */
export function normalizeSaveFileName(
  raw: string,
  kind: 'markdown' | 'html' | 'pdf',
): string {
  const base = raw
    .trim()
    .replace(/\.(md|markdown)$/i, '')
    .replace(/\.html?$/i, '')
    .replace(/\.pdf$/i, '')
  const b = sanitizeFilenameBase(base)
  if (kind === 'markdown') return `${b}.md`
  if (kind === 'html') return `${b}.html`
  return `${b}.pdf`
}

export function supportsOpenFilePicker(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

/** 지원 브라우저에서 마크다운 파일 하나 고르기 (`showOpenFilePicker`). 취소·실패 시 null */
export async function openMarkdownFilePicker(): Promise<FileSystemFileHandle | null> {
  if (!supportsOpenFilePicker()) {
    return null
  }
  try {
    const handles = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'Markdown',
          accept: {
            'text/markdown': ['.md', '.markdown'],
            'text/plain': ['.md', '.markdown', '.txt'],
          },
        },
      ],
    })
    return handles[0] ?? null
  } catch {
    return null
  }
}

export async function pickWorkspaceFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    })
    if (await ensureReadWritePermission(handle)) {
      await ensureSaveDirectory(handle)
      await storeWorkspaceDirectoryHandle(handle)
      return handle
    }
  } catch {
    /* 사용자 취소 */
  }
  return null
}
