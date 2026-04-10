export function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  downloadBlobFile(filename, blob)
}

export function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  /* 즉시 revoke 하면 브라우저가 다운로드를 시작하기 전에 URL이 무효화되어 파일이 생성되지 않을 수 있음 */
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
