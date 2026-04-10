type Props = {
  message: string | null
}

export function SaveToast({ message }: Props) {
  if (!message) return null
  return (
    <div className="app-toast-region" aria-live="polite">
      <div className="app-toast" role="status">
        {message}
      </div>
    </div>
  )
}
