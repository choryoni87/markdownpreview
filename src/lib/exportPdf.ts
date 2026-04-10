import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const BG: Record<'light' | 'dark', string> = {
  light: '#faf9f5',
  dark: '#30302e',
}

/**
 * 미리보기 article DOM을 캡처해 다쪽 A4 PDF Blob으로 만듭니다.
 */
export async function capturePreviewAsPdfBlob(
  element: HTMLElement,
  theme: 'light' | 'dark',
): Promise<Blob> {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )

  /* allowTaint: true 이면 외부 이미지 등으로 캔버스가 오염돼 toDataURL / PDF 변환이 SecurityError 로 실패할 수 있음 */
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: BG[theme],
  })

  if (canvas.width < 2 || canvas.height < 2) {
    throw new Error('미리보기 영역 크기를 읽을 수 없습니다. 창을 조금 넓힌 뒤 다시 시도해 주세요.')
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 10
  const imgW = pageW - margin * 2
  const imgH = (canvas.height * imgW) / canvas.width
  const imgData = canvas.toDataURL('image/png', 0.92)

  let heightLeft = imgH
  let position = margin

  pdf.addImage(imgData, 'PNG', margin, position, imgW, imgH)
  heightLeft -= pageH - margin * 2

  while (heightLeft > 0) {
    position = heightLeft - imgH + margin
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', margin, position, imgW, imgH)
    heightLeft -= pageH - margin * 2
  }

  const out = pdf.output('blob')
  return out.type
    ? out
    : new Blob([out], { type: 'application/pdf' })
}
