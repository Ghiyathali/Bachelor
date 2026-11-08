import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { FEEDBACK_URL } from '../config'
import pangaeaLogo from '../../pangaea-logo.png'

// FR-02: generate one universal QR code that points to the feedback page,
// show it on a printable page, and let staff print it or save it as a PDF.
export default function QrCodePage() {
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  // Generate the QR code once, inside the app (no internet service involved).
  useEffect(() => {
    QRCode.toDataURL(FEEDBACK_URL, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQrImage)
      .catch(() => setError('Could not generate the QR code.'))
  }, [])

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

  return (
    <section>
      {/* Controls: hidden on the printed page / PDF */}
      <div className="mb-8 print:hidden">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Feedback QR code</h1>
        <p className="mt-2 text-body">
          One code for every event. Print it and put it up at the venue.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!qrImage}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={!qrImage}
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-body hover:bg-hover disabled:opacity-50"
          >
            Export PDF
          </button>
        </div>
        {status && <p className="mt-3 text-sm text-muted">{status}</p>}
      </div>

      {/* The printable page: white with black text, so it prints cleanly */}
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-xl border border-stone-200 bg-white p-6 sm:p-10 print:border-0 text-center text-black">
        <img src={pangaeaLogo} alt="Pangaea Youth Network" className="mb-6 w-48 max-w-full" />
        <p className="text-4xl font-bold">Scan to give feedback</p>
        {error && <p className="mt-8 text-red-700">{error}</p>}
        {qrImage && (
          <img src={qrImage} alt={`QR code linking to ${FEEDBACK_URL}`} className="mt-8 w-80 max-w-full" />
        )}
        <p className="mt-6 text-sm text-gray-600">{FEEDBACK_URL}</p>
        <p className="mt-2 text-sm text-gray-600">Pangaea Youth Network</p>
      </div>
    </section>
  )
}
