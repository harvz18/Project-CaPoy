'use client'

import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useEffect, useState } from 'react'
import {
  mdiArrowRight,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiLockOutline,
} from '@mdi/js'
import heroImage from '../../images/Header.png'
import { Brand } from '@/components/brand'
import { MdiIcon } from '@/components/icons'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(searchParams.get('error') === 'unauthorized'
    ? 'This account does not have access to this workspace.'
    : '')

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard')
    })
  }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || !password || loading) return

    const supabase = getSupabase()
    if (!supabase) {
      setMessage('Supabase is not configured. Add the public project keys to web/.env.local.')
      return
    }

    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: { captchaToken: undefined },
    })
    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    if (!remember) {
      sessionStorage.setItem('multivent_session_only', 'true')
    }
    router.replace('/dashboard')
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <Image src={heroImage} alt="An elegant MULTIVENT celebration" priority fill sizes="(max-width: 900px) 100vw, 56vw" />
        <div className="login-visual__veil" />
        <div className="login-visual__content">
          <Brand />
          <div className="login-visual__statement">
            <span className="eyebrow eyebrow--light">EVERY EVENT, ONE PLACE</span>
            <h1>Every great event<br />starts with trust.</h1>
            <p>One secure workspace to keep the MULTIVENT community safe, reliable, and moving beautifully.</p>
          </div>
          <p className="login-visual__foot">MULTIVENT Operations Console · 2026</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel__inner">
          <div className="mobile-brand"><Brand /></div>
          <span className="eyebrow">WELCOME TO MULTIVENT</span>
          <h2>Welcome back</h2>
          <p className="login-panel__intro">Sign in to continue to your workspace.</p>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <label>
              <span>Email address</span>
              <div className="input-wrap">
                <input
                  autoComplete="email"
                  inputMode="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@multivent.com"
                  type="email"
                  value={email}
                />
              </div>
            </label>

            <label>
              <span>Password</span>
              <div className="input-wrap">
                <MdiIcon path={mdiLockOutline} className="input-icon" />
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button className="icon-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <MdiIcon path={showPassword ? mdiEyeOffOutline : mdiEyeOutline} />
                </button>
              </div>
            </label>

            <div className="login-options">
              <label className="check-label">
                <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
                <span>Keep me signed in</span>
              </label>
              <a href="mailto:support@multivent.com?subject=MULTIVENT%20staff%20access">Need access help?</a>
            </div>

            {message && <div className="form-alert" role="alert">{message}</div>}

            <button className="primary-button" disabled={loading || !email.trim() || !password} type="submit">
              <span>{loading ? 'Verifying access…' : 'Sign in securely'}</span>
              {!loading && <MdiIcon path={mdiArrowRight} />}
            </button>
          </form>

          {!isSupabaseConfigured && <p className="config-note">Setup required: see <code>web/README.md</code>.</p>}
        </div>
      </section>
    </main>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
