import { useEffect, useId } from 'react'

type Props = {
  open: boolean
  onClose: () => void
}

export function MarkdownHelpDialog({ open, onClose }: Props) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="help-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="help-dialog-head">
          <h2 id={titleId} className="help-dialog-title">
            마크다운 도움말
          </h2>
          <button
            type="button"
            className="help-dialog-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="help-dialog-body">
          <p className="help-lead">
            자주 쓰는 문법만 정리했습니다. 줄 앞{' '}
            <kbd className="help-kbd">#</kbd> 개수로 제목 단계가 정해집니다.
          </p>

          <section className="help-section">
            <h3 className="help-section-title">제목</h3>
            <pre className="help-code" tabIndex={0}>
{`# 큰 제목
## 소제목
### 더 작은 제목`}
            </pre>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">문단·줄바꿈</h3>
            <p className="help-section-note">
              문단을 <strong>띄워 쓰려면</strong> 문장 묶음 사이에{' '}
              <kbd className="help-kbd">빈 줄</kbd>을 한 줄 넣으세요. 같은 문단 안에서{' '}
              <strong>줄만 바꾸려면</strong> 줄 끝에{' '}
              <kbd className="help-kbd">스페이스 두 칸</kbd>을 넣은 뒤 Enter 합니다.
            </p>
            <pre className="help-code" tabIndex={0}>
{`첫 번째 문단입니다.

두 번째 문단입니다. (위 문단과 사이에 빈 줄 한 줄)

한 문단 안에서 줄만 바꿀 때는${'  '}
이 줄의 바로 윗줄 끝에 스페이스를 두 칸 넣었습니다.`}
            </pre>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">강조</h3>
            <pre className="help-code" tabIndex={0}>
{`**굵게**  *기울임*  ~~취소선~~`}
            </pre>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">목록</h3>
            <pre className="help-code" tabIndex={0}>
{`- 순서 없음
- 항목

1. 순서 있음
2. 항목`}
            </pre>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">링크·이미지</h3>
            <pre className="help-code" tabIndex={0}>
{`[보이는 글자](https://주소)
![설명](https://이미지주소)`}
            </pre>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">인용·코드·구분선</h3>
            <pre className="help-code" tabIndex={0}>
{`> 인용문

\`한 줄 코드\`

\`\`\`
여러 줄 코드 블록
\`\`\`

---`}
            </pre>
          </section>
        </div>
      </div>
    </div>
  )
}
