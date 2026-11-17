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

// Checks the "Create the first admin account" form before anything is sent.
// Same rules as the server (FR-14), so the user sees mistakes straight away.
export interface FirstAdminFields {
  username: string
  email: string
  password: string
  confirm: string
}

// One message per field that has a problem; empty object = everything is fine.
export function firstAdminProblems({ username, email, password, confirm }: FirstAdminFields): Partial<Record<keyof FirstAdminFields, string>> {
  const problems: Partial<Record<keyof FirstAdminFields, string>> = {}
  const name = username.trim()
  if (name.length < 3 || name.length > 30) problems.username = 'The username must be 3 to 30 characters.'
  else if (/[@\s]/.test(name)) problems.username = "The username cannot contain '@' or spaces."
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) problems.email = 'Enter a valid email address.'
  // An empty password counts as "too short" here (on the Edit page, empty means "keep the password").
  const passwordIssue = password === '' && confirm === ''
    ? `The password must be at least ${MIN_PASSWORD} characters.`
    : passwordProblem({ newPassword: password, confirm, current: '', self: false })
  if (passwordIssue) {
    if (passwordIssue.includes('match')) problems.confirm = passwordIssue
    else problems.password = passwordIssue.replace('The new password', 'The password')
  }
  return problems
}
