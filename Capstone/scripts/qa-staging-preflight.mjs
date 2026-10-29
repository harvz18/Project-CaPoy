import process from 'node:process'

const fail = (message) => {
  console.error(`QA staging preflight failed: ${message}`)
  process.exitCode = 1
}

const environment = process.env.MV_QA_ENV
const targetUrl = process.env.QA_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
const allowedProjectRef = process.env.QA_ALLOWED_SUPABASE_PROJECT_REF
const liveProjectRef = process.env.QA_LIVE_SUPABASE_PROJECT_REF
const paymentMode = process.env.QA_PAYMENT_MODE
const confirmation = process.env.QA_RUN_CONFIRMATION

if (environment !== 'staging') {
  fail('MV_QA_ENV must be exactly "staging".')
} else if (!targetUrl) {
  fail('QA_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL is required.')
} else if (!allowedProjectRef) {
  fail('QA_ALLOWED_SUPABASE_PROJECT_REF is required.')
} else if (!liveProjectRef) {
  fail('QA_LIVE_SUPABASE_PROJECT_REF is required.')
} else if (allowedProjectRef === liveProjectRef) {
  fail('The staging and live project references must be different.')
} else if (paymentMode !== 'prototype') {
  fail('QA_PAYMENT_MODE must be exactly "prototype"; live payment processing is not permitted.')
} else if (confirmation !== 'I_UNDERSTAND_THIS_IS_STAGING') {
  fail('QA_RUN_CONFIRMATION must explicitly confirm the staging target.')
} else if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.QA_SUPABASE_SERVICE_ROLE_KEY) {
  fail('Service-role credentials are forbidden in the client E2E environment.')
} else {
  let projectRef = ''

  try {
    const parsedUrl = new URL(targetUrl)
    const matchedHost = /^([a-z0-9-]+)\.supabase\.co$/i.exec(parsedUrl.hostname)
    if (parsedUrl.protocol !== 'https:' || !matchedHost) {
      throw new Error('not a canonical hosted Supabase URL')
    }
    projectRef = matchedHost[1]
  } catch {
    fail('The target must be a canonical HTTPS Supabase project URL.')
  }

  if (!process.exitCode && projectRef !== allowedProjectRef) {
    fail('The configured project does not match QA_ALLOWED_SUPABASE_PROJECT_REF.')
  }

  if (!process.exitCode) {
    console.log(`QA staging preflight passed for approved project ${projectRef}.`)
  }
}
