import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type UIEvent,
} from 'react'

const LINE_HEIGHT_RATIO = 1.55

export type EditorPaneHandle = {
  setScrollTopFromRatio: (ratio: number) => void
}

type Props = {
  value: string
  onChange: (v: string) => void
  fontPx: number
  /** 기본값 2 */
  tabSize?: 2 | 4 | 8
  showLineNumbers: boolean
  /** 스크롤 비율 0~1 (에디터 높이 대비) — 미리보기와 연동 시 사용 */
  onScrollRatioChange?: (ratio: number) => void
}

export const EditorPane = forwardRef<EditorPaneHandle, Props>(
  function EditorPane(
    {
      value,
      onChange,
      fontPx,
      tabSize = 2,
      showLineNumbers,
      onScrollRatioChange,
    },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const gutterInnerRef = useRef<HTMLDivElement>(null)
    const lineCount = useMemo(
      () => Math.max(1, value.split('\n').length),
      [value],
    )
    const lineHeightPx = fontPx * LINE_HEIGHT_RATIO

    const syncGutter = (scrollTop: number) => {
      const el = gutterInnerRef.current
      if (el) el.style.transform = `translateY(-${scrollTop}px)`
    }

    useImperativeHandle(
      ref,
      () => ({
        setScrollTopFromRatio(ratio: number) {
          const ta = textareaRef.current
          if (!ta) return
          const max = ta.scrollHeight - ta.clientHeight
          const top = max <= 0 ? 0 : Math.max(0, Math.min(max, ratio * max))
          ta.scrollTop = top
          syncGutter(top)
        },
      }),
      [],
    )

    const onScroll = (e: UIEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget
      syncGutter(ta.scrollTop)
      if (onScrollRatioChange) {
        const max = ta.scrollHeight - ta.clientHeight
        const ratio = max <= 0 ? 0 : ta.scrollTop / max
        onScrollRatioChange(ratio)
      }
    }

    const gutterNumbers = useMemo(
      () =>
        Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i}
            className="editor-gutter-line"
            style={{
              height: lineHeightPx,
              lineHeight: `${lineHeightPx}px`,
            }}
          >
            {i + 1}
          </div>
        )),
      [lineCount, lineHeightPx],
    )

    return (
      <div className="editor-body">
        {showLineNumbers ? (
          <div
            className="editor-gutter"
            style={{ fontSize: fontPx, lineHeight: LINE_HEIGHT_RATIO }}
            aria-hidden
          >
            <div ref={gutterInnerRef} className="editor-gutter-inner">
              {gutterNumbers}
            </div>
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={onScroll}
          aria-label="마크다운 소스"
          style={{
            fontSize: fontPx,
            lineHeight: LINE_HEIGHT_RATIO,
            tabSize,
            MozTabSize: tabSize,
          }}
        />
      </div>
    )
  },
)

EditorPane.displayName = 'EditorPane'
