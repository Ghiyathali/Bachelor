import { ROLES } from '../auth/permissions'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { register as registerAccount } from '../api/auth'
import { getErrorMessage } from '../api/client'

// Same rules as the backend (FR-14). The backend still checks again - it is the real security.
const registerSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email address.').max(256),
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters.')
      .max(30, 'Username can be at most 30 characters.')
      .regex(/^[^@\s]+$/, "Username cannot contain '@' or spaces."),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(72, 'Password can be at most 72 characters.'),
    confirmPassword: z.string(),
    role: z.enum(ROLES),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

type RegisterForm = z.infer<typeof registerSchema>

const inputClass = 'mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white'

// Admin only (#52): an Admin creates an account for a PYN staff member.
// The route is protected in router.tsx; the backend also rejects non-Admins (401/403).
export default function RegisterPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [createdUsername, setCreatedUsername] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema), defaultValues: { role: 'Standard User' } })

  async function onSubmit(values: RegisterForm) {
    setServerError(null)
    try {
      // confirmPassword is only for the form - the backend does not need it
      const result = await registerAccount({
        email: values.email,
        username: values.username,
        password: values.password,
        role: values.role,
      })
      setCreatedUsername(result.username)
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  // Clear the form so the Admin can create the next account.
  function createAnother() {
    reset()
    setCreatedUsername(null)
  }

  // Success screen (FR-14: "a confirmation is shown and the user can sign in")
  if (createdUsername) {
    return (
      <section className="mx-auto max-w-sm">
        <h1 className="text-3xl font-bold text-white">Account created</h1>
        <p className="mt-4 text-slate-300">
          <span className="font-semibold text-white">{createdUsername}</span> can now log in with the
          password you set. Share it with them securely.
        </p>
        <button
          type="button"
          onClick={createAnother}
          className="mt-6 inline-block rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500"
        >
          Create another account
        </button>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="text-3xl font-bold text-white">Create account</h1>
      <p className="mt-2 text-sm text-slate-400">
        Create a login for a PYN staff member. Choose the role this staff member needs.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300">Email</label>
          <input id="email" type="email" autoComplete="off" {...register('email')} className={inputClass} />
          {errors.email && <p className="mt-1 text-sm text-rose-300">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-300">Username</label>
          <input id="username" autoComplete="off" {...register('username')} className={inputClass} />
          {errors.username && <p className="mt-1 text-sm text-rose-300">{errors.username.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300">Password</label>
          <input id="password" type="password" autoComplete="new-password" {...register('password')} className={inputClass} />
          {errors.password && <p className="mt-1 text-sm text-rose-300">{errors.password.message}</p>}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">Confirm password</label>
          <input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} className={inputClass} />
          {errors.confirmPassword && <p className="mt-1 text-sm text-rose-300">{errors.confirmPassword.message}</p>}
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-slate-300">Role</label>
          <select id="role" {...register('role')} className={inputClass}>
            {ROLES.map(role => <option key={role}>{role}</option>)}
          </select>
          {errors.role && <p className="mt-1 text-sm text-rose-300">{errors.role.message}</p>}
        </div>

        {serverError && <p className="rounded-md bg-rose-950 px-3 py-2 text-sm text-rose-200">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </section>
  )
}
