// The address of the feedback page (FR-02) - the feedback-form app in this repo.
// The QR code always encodes this same URL - one universal code for every event.
// Defaults to the local dev server (feedback-form runs on port 5174). A phone can only
// open it once the page is hosted publicly: set VITE_FEEDBACK_URL at build time then,
// just like VITE_API_URL in api/client.ts.
export const FEEDBACK_URL: string =
  import.meta.env.VITE_FEEDBACK_URL ?? 'http://localhost:5174'
