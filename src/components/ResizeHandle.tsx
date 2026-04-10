import { useCallback, useRef, type PointerEvent } from 'react'

type Props = {
  onDelta: (dx: number) => void
}

/** 세로 구분선 — 좌우 드래그로 인접 패널 너비 조절 */
export function ResizeHandle({ onDelta }: Props) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      dragging.current = true
      lastX.current = e.clientX
      e.currentTarget.setPointerCapture(e.pointerId)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      e.currentTarget.classList.add('is-dragging')
    },
    [],
  )

  const end = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    e.currentTarget.classList.remove('is-dragging')
  }, [])

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      const dx = e.clientX - lastX.current
      lastX.current = e.clientX
      if (dx !== 0) onDelta(dx)
    },
    [onDelta],
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="패널 너비 조절"
      className="resize-handle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    />
  )
}
