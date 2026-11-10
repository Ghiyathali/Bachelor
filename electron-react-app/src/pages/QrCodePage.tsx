import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { FEEDBACK_URL } from '../config'
import Icon from '../components/Icon'
import pangaeaLogo from '../../pangaea-logo.png'

const secondaryButton =
  'inline-flex items-center gap-2 border border-line bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-hover disabled:opacity-50'

// FR-02: generate one universal QR code that points to the feedback page,
// show it on a printable page, and let staff print it or save it as a PDF.
// #80: the poster is shown as an A4 sheet, exactly as it prints.
export default function QrCodePage() {
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Generate the QR code once, inside the app (no internet service involved).
  useEffect(() => {
    QRCode.toDataURL(FEEDBACK_URL, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQrImage)
      .catch(() => setError('Could not generate the QR code.'))
  }, [])

  // "Link copied" goes back to "Copy link" after two seconds.
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  // Export PDF: in the Electron app, save the file directly via the main process.
  // In a plain browser (no electronAPI), open the print dialog, which offers "Save as PDF".
  async function handleExportPdf() {
    const savePdf = window.electronAPI?.savePdf
    if (!savePdf) {
      window.print()
      return
    }
    setStatus(null)
    try {
      const result = await savePdf()
      if (result.saved) setStatus(`Saved to ${result.filePath}`)
    } catch {
      setStatus('Could not export the PDF.')
    }
  }

  // #80: copy the feedback link, e.g. to share it on WhatsApp or by email.
  async function handleCopyLink() {
    setStatus(null)
    try {
      await navigator.clipboard.writeText(FEEDBACK_URL)
      setCopied(true)
    } catch {
      setStatus("Couldn't copy the link.")
    }
  }

  return (
    <section>
      {/* Controls: hidden on the printed page / PDF */}
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Feedback QR code</h1>
          <p className="mt-2 text-body">One code for every event. Print it and put it up at the venue.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void handleCopyLink()} className={secondaryButton}>
            <Icon name={copied ? 'circleCheck' : 'link'} className={`h-4 w-4 ${copied ? 'text-success' : ''}`} />
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button type="button" onClick={() => void handleExportPdf()} disabled={!qrImage} className={secondaryButton}>
            <Icon name="download" className="h-4 w-4" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!qrImage}
            className="inline-flex items-center gap-2 bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            <Icon name="printer" className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>
      {status && <p className="mt-3 text-right text-sm text-muted print:hidden">{status}</p>}

      {/* A4 preview. When printing, only the sheet is printed, filling the page. */}
      <div className="mt-8 flex justify-center print:m-0 print:block">
        <div className="flex aspect-[210/297] w-full max-w-md flex-col items-center rounded-sm border border-line bg-white px-10 pb-8 pt-12 text-center text-black shadow-card print:h-screen print:max-w-none print:aspect-auto print:rounded-none print:border-0 print:px-[20mm] print:pb-[10mm] print:pt-[18mm] print:shadow-none">
          <img src={pangaeaLogo} alt="Pangaea Youth Network" className="w-40 max-w-full print:w-[70mm]" />
          <p className="mt-8 text-3xl font-bold tracking-tight text-stone-900 print:mt-[18mm] print:text-[34pt]">
            Scan to give feedback
          </p>
          {error && <p className="mt-8 text-red-700">{error}</p>}
          {qrImage && (
            <img src={qrImage} alt={`QR code linking to ${FEEDBACK_URL}`} className="mt-6 w-56 max-w-full print:mt-[12mm] print:w-[110mm]" />
          )}
          <p className="mt-4 text-sm text-stone-600 print:mt-[8mm] print:text-[14pt]">Anonymous · takes about a minute</p>
          <p className="mt-auto text-xs text-stone-400 print:text-[10pt]">{FEEDBACK_URL}</p>
        </div>
      </div>
    </section>
  )
}
