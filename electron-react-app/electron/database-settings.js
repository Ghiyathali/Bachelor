// The "Database connection" window: staff enter the connection string(s) once. The values go to
// the main process (through database-preload.cjs), which encrypts and saves them and restarts the
// app. This window never reads the saved values back; it only shows whether one is saved.
const form = /** @type {HTMLFormElement} */ (document.getElementById('connection-form'))
const statusMessage = /** @type {HTMLElement} */ (document.getElementById('status'))
const button = /** @type {HTMLButtonElement} */ (form.querySelector('button'))
window.databaseSettings.state().then(state => {
  if (state.environmentOverride) {
    statusMessage.textContent = 'This launch uses environment variables. Quit and launch normally to change saved settings.'
    button.disabled = true
  } else if (state.saved) {
    statusMessage.textContent = 'A connection is saved. Enter replacement values to change it.'
  }
}).catch(() => { statusMessage.textContent = 'Could not read connection status.' })
// The inputs are cleared after saving, so a connection string never stays on screen.
form.addEventListener('submit', async event => {
  event.preventDefault()
  button.disabled = true
  statusMessage.textContent = 'Saving securely…'
  const postgres = /** @type {HTMLInputElement} */ (document.getElementById('postgres'))
  const pyn = /** @type {HTMLInputElement} */ (document.getElementById('pyn'))
  try {
    const result = await window.databaseSettings.save({ postgres: postgres.value, pynSource: pyn.value })
    statusMessage.textContent = result.error ?? 'Saved. Restarting Pangaea…'
  } catch {
    statusMessage.textContent = 'Could not save connection settings. Please try again.'
  } finally {
    postgres.value = ''
    pyn.value = ''
    button.disabled = false
  }
})
