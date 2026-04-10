import { useState, type MouseEvent } from 'react'
import {
  SAVE_DIR_NAME,
  displayMdFileLabel,
  type MdFileEntry,
} from '../lib/fileWorkspace'
import { FileSwipeRow } from './FileSwipeRow'

type Props = {
  fsSupported: boolean
  dirHandleReady: boolean
  files: MdFileEntry[]
  activeFileName: string | null
  onOpenFolder: () => void
  /** 파일 패널 전체 접기(왼쪽 목록 숨김) */
  onHideFileList: () => void
  onSelectFile: (entry: MdFileEntry) => void
  onHideFromList: (entry: MdFileEntry) => void
  onDeleteFilePermanent: (entry: MdFileEntry) => void
}

type CtxMenu =
  | {
      x: number
      y: number
      entry: MdFileEntry
    }
  | null

export function FileSidebar({
  fsSupported,
  dirHandleReady,
  files,
  activeFileName,
  onOpenFolder,
  onHideFileList,
  onSelectFile,
  onHideFromList,
  onDeleteFilePermanent,
}: Props) {
  const [swipeOpenName, setSwipeOpenName] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null)

  const onRowContextMenu = (e: MouseEvent, entry: MdFileEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setSwipeOpenName(null)
    setCtxMenu({ x: e.clientX, y: e.clientY, entry })
  }

  return (
    <aside className="files-sidebar" aria-label="워크스페이스 파일">
      <div className="files-sidebar-head">
        <span className="files-sidebar-title">파일</span>
        <div className="files-sidebar-actions">
          <button
            type="button"
            className="files-sidebar-btn"
            onClick={onOpenFolder}
            title="폴더 열기"
          >
            폴더
          </button>
          <button
            type="button"
            className="files-sidebar-btn files-sidebar-panel-hide"
            onClick={onHideFileList}
            title="파일 목록 접기"
            aria-label="파일 목록 접기"
          >
            <span aria-hidden>⬅️</span>
          </button>
        </div>
      </div>
      {!fsSupported ? (
        <p className="files-sidebar-hint">
          이 브라우저는 폴더 접근 API를 지원하지 않습니다. Chrome 또는 Edge를
          사용해 주세요.
        </p>
      ) : !dirHandleReady ? (
        <p className="files-sidebar-hint">
          <strong>폴더</strong>를 열면 상단 작업 폴더 안에{' '}
          <strong>{SAVE_DIR_NAME}</strong> 폴더가 만들어지고,{' '}
          <strong>저장</strong>은{' '}
          <strong>{SAVE_DIR_NAME}/</strong>에, 파일 이름은{' '}
          <strong>문서 제목 앞 5글자</strong>로 정해집니다.{' '}
          <strong>다른 이름으로 저장</strong>에서 형식·이름을 고를 수 있습니다.
        </p>
      ) : files.length === 0 ? (
        <p className="files-sidebar-hint">이 폴더에 .md 파일이 없습니다.</p>
      ) : (
        <ul className="files-sidebar-list">
          {files.map((f) => (
            <FileSwipeRow
              key={f.name}
              entry={f}
              label={displayMdFileLabel(f.name)}
              isActive={f.name === activeFileName}
              globalSwipeOpen={swipeOpenName}
              onGlobalSwipeOpen={setSwipeOpenName}
              onSelectFile={onSelectFile}
              onHideFromList={onHideFromList}
              onRowContextMenu={onRowContextMenu}
            />
          ))}
        </ul>
      )}
      {ctxMenu ? (
        <div
          className="files-ctx-backdrop"
          role="presentation"
          onClick={() => setCtxMenu(null)}
        >
          <div
            className="files-ctx-menu"
            role="menu"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="files-ctx-item files-ctx-danger"
              role="menuitem"
              onClick={() => {
                const e = ctxMenu.entry
                setCtxMenu(null)
                onDeleteFilePermanent(e)
              }}
            >
              파일 삭제
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
