import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const expectedPublicRpcNames = [
  'calculate_venue_starting_quote_v8',
  'get_public_commission_rate',
  'get_public_payment_terms',
  'list_available_event_coordinators',
  'list_event_coordinator_review_data',
  'list_phase11_package_catering_menus',
  'list_phase9_package_venue_requirements',
  'list_public_service_decision_signals',
].sort()

const fail = (message) => {
  console.error(`QA staging schema guard failed: ${message}`)
  process.exit(1)
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  })
  if (result.error) fail(result.error.message)
  if (result.status !== 0) fail((result.stderr || result.stdout || 'command failed').trim())
  return result.stdout
}

const parseCliJson = (output) => {
  const start = output.indexOf('{')
  if (start < 0) fail('Supabase CLI did not return JSON output.')
  try {
    return JSON.parse(output.slice(start))
  } catch {
    fail('Supabase CLI returned malformed JSON output.')
  }
}

run(process.execPath, ['scripts/qa-staging-preflight.mjs'])

const linkedProjectRefPath = resolve(root, 'supabase/.temp/project-ref')
let linkedProjectRef = ''
try {
  linkedProjectRef = readFileSync(linkedProjectRefPath, 'utf8').trim()
} catch {
  fail('No linked Supabase project reference was found.')
}

if (linkedProjectRef !== process.env.QA_ALLOWED_SUPABASE_PROJECT_REF) {
  fail('The Supabase CLI is not linked to the approved staging project.')
}

const dryRun = parseCliJson(run(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  'supabase', 'db', 'push', '--linked', '--dry-run',
]))
if (dryRun.upToDate !== true) {
  fail('Local migrations are not in parity with the approved staging database.')
}

const contractSql = `
  select
    coalesce((select relrowsecurity from pg_class where oid = 'public.beta_reset_archives'::regclass), false) as archive_rls,
    coalesce((select relrowsecurity from pg_class where oid = 'public.service_categories'::regclass), false) as category_rls,
    not has_table_privilege('anon', 'public.beta_reset_archives', 'select, insert, update, delete') as archive_anon_denied,
    not has_table_privilege('authenticated', 'public.beta_reset_archives', 'select, insert, update, delete') as archive_authenticated_denied,
    not has_table_privilege('anon', 'public.service_categories', 'insert, update, delete') as category_anon_writes_denied,
    not has_table_privilege('authenticated', 'public.service_categories', 'insert, update, delete') as category_authenticated_writes_denied,
    coalesce((
      select json_agg(name order by name)
      from (
        select p.proname as name
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.prosecdef
          and has_function_privilege('anon', p.oid, 'execute')
      ) anonymous_rpc
    ), '[]'::json) as public_rpc_names;
`
const contractResult = parseCliJson(run(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  'supabase', 'db', 'query', '--linked', contractSql,
]))
const contract = contractResult.rows?.[0]
if (!contract) fail('The critical schema contract query returned no row.')

const requiredBooleans = [
  'archive_rls',
  'category_rls',
  'archive_anon_denied',
  'archive_authenticated_denied',
  'category_anon_writes_denied',
  'category_authenticated_writes_denied',
]
for (const field of requiredBooleans) {
  if (contract[field] !== true) fail(`Critical schema assertion failed: ${field}.`)
}

const actualPublicRpcNames = Array.isArray(contract.public_rpc_names)
  ? [...contract.public_rpc_names].sort()
  : []
if (JSON.stringify(actualPublicRpcNames) !== JSON.stringify(expectedPublicRpcNames)) {
  fail('Anonymous RPC allowlist differs from the reviewed public marketplace contract.')
}

console.log(`QA staging schema guard passed for approved project ${linkedProjectRef}.`)
