// Checks the password fields in Manage accounts → Edit before anything is sent.
// Same rules as the server (FR-14): 8 to 72 characters, and both new fields must match.
// Changing your OWN password also needs the current one. All fields empty = keep the password.
export const MIN_PASSWORD = 8
export const MAX_PASSWORD = 72

export interface PasswordFields {
  newPassword: string
  confirm: string
  current: string
  self: boolean
}

export function wantsPasswordChange({ newPassword, confirm, current }: PasswordFields): boolean {
  return newPassword !== '' || confirm !== '' || current !== ''
}

// The first problem to show, or null when the fields are fine (or empty).
export function passwordProblem(fields: PasswordFields): string | null {
  if (!wantsPasswordChange(fields)) return null
  const { newPassword, confirm, current, self } = fields
  if (self && current === '') return 'Enter your current password.'
  if (newPassword.length < MIN_PASSWORD) return `The new password must be at least ${MIN_PASSWORD} characters.`
  if (newPassword.length > MAX_PASSWORD) return `The new password can be at most ${MAX_PASSWORD} characters.`
  if (newPassword !== confirm) return 'The new passwords do not match.'
  return null
}
