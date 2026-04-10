import { useEffect, useId, useState, type FormEvent } from 'react'
import { normalizeSaveFileName } from '../lib/fileWorkspace'

export type SaveAsKind = 'markdown' | 'html' | 'pdf'

type Props = {
  open: boolean
  defaultMdFileName: string
  onClose: () => void
  onConfirm: (kind: SaveAsKind, fileName: string) => void
}

export function SaveAsDialog({
  open,
  defaultMdFileName,
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId()
  const [kind, setKind] = useState<SaveAsKind>('markdown')
  const [fileName, setFileName] = useState(defaultMdFileName)

  useEffect(() => {
    if (!open) return
    setKind('markdown')
    setFileName(defaultMdFileName)
  }, [open, defaultMdFileName])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const onKindChange = (next: SaveAsKind) => {
    if (next === kind) return
    setKind(next)
    setFileName((prev) => normalizeSaveFileName(prev, next))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const finalName = normalizeSaveFileName(fileName, kind)
    onConfirm(kind, finalName)
    onClose()
  }

  return (
    <div
      className="save-as-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="save-as-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="save-as-title">
          다른 이름으로 저장
        </h2>
        <form onSubmit={handleSubmit} className="save-as-form">
          <fieldset className="save-as-fieldset">
            <legend className="save-as-legend">형식</legend>
            <label className="save-as-radio">
              <input
                type="radio"
                name="save-as-kind"
                checked={kind === 'markdown'}
                onChange={() => onKindChange('markdown')}
              />
              <span>Markdown (.md)</span>
            </label>
            <label className="save-as-radio">
              <input
                type="radio"
                name="save-as-kind"
                checked={kind === 'html'}
                onChange={() => onKindChange('html')}
              />
              <span>HTML (.html)</span>
            </label>
            <label className="save-as-radio">
              <input
                type="radio"
                name="save-as-kind"
                checked={kind === 'pdf'}
                onChange={() => onKindChange('pdf')}
              />
              <span>PDF (.pdf) — 현재 미리보기 캡처</span>
            </label>
          </fieldset>
          <label className="save-as-filename-label">
            <span className="save-as-filename-caption">파일 이름</span>
            <input
              type="text"
              className="save-as-filename-input"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <p className="save-as-hint">
            확장자는 형식에 맞게 자동으로 맞춰 저장됩니다. PDF는 현재 테마의
            미리보기 카드를 그림으로 붙인 A4 문서입니다.
          </p>
          <div className="save-as-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary">
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
