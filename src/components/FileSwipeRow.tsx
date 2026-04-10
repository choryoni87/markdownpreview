import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import type { MdFileEntry } from '../lib/fileWorkspace'

const ACTION_W = 76

type Props = {
  entry: MdFileEntry
  label: string
  isActive: boolean
  globalSwipeOpen: string | null
  onGlobalSwipeOpen: (name: string | null) => void
  onSelectFile: (entry: MdFileEntry) => void
  onHideFromList: (entry: MdFileEntry) => void
  onRowContextMenu: (e: MouseEvent, entry: MdFileEntry) => void
}

export function FileSwipeRow({
  entry,
  label,
  isActive,
  globalSwipeOpen,
  onGlobalSwipeOpen,
  onSelectFile,
  onHideFromList,
  onRowContextMenu,
}: Props) {
  const [offset, setOffset] = useState(0)
  const dragRef = useRef<{
    id: number
    startX: number
    startOffset: number
  } | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    if (
      globalSwipeOpen !== null &&
      globalSwipeOpen !== entry.name &&
      offset !== 0
    ) {
      setOffset(0)
    }
  }, [globalSwipeOpen, entry.name, offset])

  const applySnap = (clamped: number) => {
    if (clamped < -ACTION_W / 2) {
      setOffset(-ACTION_W)
      onGlobalSwipeOpen(entry.name)
    } else {
      setOffset(0)
      if (globalSwipeOpen === entry.name) onGlobalSwipeOpen(null)
    }
  }

  const onPointerDownFront = (e: PointerEvent) => {
    if (e.button !== 0) return
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startOffset: offset,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMoveFront = (e: PointerEvent) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.startX
    const raw = d.startOffset + dx
    const clamped = Math.max(-ACTION_W, Math.min(0, raw))
    setOffset(clamped)
    // preventDefault는 클릭 합성을 막을 수 있어 호출하지 않음(스와이프·탭 공존)
  }

  const endDrag = (e: PointerEvent) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.startX
    const moved = Math.abs(dx) > 14
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* */
    }

    // 스와이프로 열린 상태에서 탭 → 메뉴만 닫기
    if (d.startOffset <= -12 && !moved) {
      setOffset(0)
      onGlobalSwipeOpen(null)
      suppressClickRef.current = true
      return
    }

    const raw = d.startOffset + dx
    const clamped = Math.max(-ACTION_W, Math.min(0, raw))
    applySnap(clamped)

    // 포인터 탭이 click으로 이어지지 않는 환경 대비: 여기서 직접 파일 열기
    if (!moved && clamped >= -ACTION_W / 2) {
      suppressClickRef.current = true
      void onSelectFile(entry)
      return
    }

    suppressClickRef.current = moved
  }

  const onClickFile = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (offset <= -12) {
      setOffset(0)
      onGlobalSwipeOpen(null)
      return
    }
    void onSelectFile(entry)
  }

  const onClickHide = (ev: MouseEvent) => {
    ev.stopPropagation()
    setOffset(0)
    onGlobalSwipeOpen(null)
    onHideFromList(entry)
  }

  return (
    <li className="files-sidebar-item files-sidebar-swipe-item">
      <div className="files-sidebar-swipe-track">
        <div
          className="files-sidebar-swipe-actions"
          style={{ width: ACTION_W }}
          aria-hidden
        >
          <button
            type="button"
            className="files-sidebar-swipe-hide"
            title="목록에서만 제거"
            onClick={onClickHide}
          >
            숨김
          </button>
        </div>
        <div
          className="files-sidebar-swipe-front"
          style={{ transform: `translateX(${offset}px)` }}
        >
          <button
            type="button"
            className={
              'files-sidebar-file' +
              (isActive ? ' is-active' : '')
            }
            onPointerDown={onPointerDownFront}
            onPointerMove={onPointerMoveFront}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onContextMenu={(e) => onRowContextMenu(e, entry)}
            onClick={onClickFile}
          >
            {label}
          </button>
        </div>
      </div>
    </li>
  )
}
