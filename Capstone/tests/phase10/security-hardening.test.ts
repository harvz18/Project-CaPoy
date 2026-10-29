import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

const assertTransactionalAdditiveMigration = (source: string, label: string) => {
  assert.match(source, /\bbegin\s*;/i, `${label} must open a transaction`)
  assert.match(source, /\bcommit\s*;/i, `${label} must commit a transaction`)
  assert.doesNotMatch(source, /\bdrop\s+table\b/i, `${label} must not drop tables`)
  assert.doesNotMatch(source, /\btruncate\b/i, `${label} must not truncate data`)
  assert.doesNotMatch(source, /\bdelete\s+from\b/i, `${label} must not delete rows`)
}

test('P0 archive remediation is default-deny and preserves archive data', () => {
  const migration = read('supabase/migrations/20261029000100_secure_beta_reset_archives.sql')

  assertTransactionalAdditiveMigration(migration, 'beta archive security migration')
  assert.match(migration, /to_regclass\('public\.beta_reset_archives'\)/i)
  assert.match(migration, /alter table public\.beta_reset_archives enable row level security/i)
  assert.match(
    migration,
    /revoke all privileges on table public\.beta_reset_archives from public, anon, authenticated/i,
  )
  assert.doesNotMatch(migration, /^\s*grant\b/im, 'archive migration must not grant client API access')
})

test('P0 category remediation permits only active category discovery', () => {
  const migration = read('supabase/migrations/20261029000200_secure_service_categories.sql')

  assertTransactionalAdditiveMigration(migration, 'service category security migration')
  assert.match(migration, /to_regclass\('public\.service_categories'\)/i)
  assert.match(migration, /alter table public\.service_categories enable row level security/i)
  assert.match(
    migration,
    /revoke all privileges on table public\.service_categories from public, anon, authenticated/i,
  )
  assert.match(migration, /grant select on table public\.service_categories to anon, authenticated/i)
  assert.match(migration, /for select\s+to anon, authenticated\s+using \(is_active = true\)/i)
  assert.doesNotMatch(migration, /^\s*grant\s+(?:insert|update|delete|all)/im)
  assert.doesNotMatch(migration, /for\s+(?:insert|update|delete|all)/i)
})

test('high-risk financial, booking, provider, and staff RPCs deny anonymous execution', () => {
  const grantMigration = read('supabase/migrations/20261029000300_harden_high_risk_rpc_grants.sql')
  const anonRevokeMigration = read('supabase/migrations/20261029000400_revoke_anon_high_risk_rpc_grants.sql')
  const signatures = [
    'admin_review_service(uuid, text, text)',
    'admin_set_account_status(uuid, public.account_status, text)',
    'approve_v14_provider_bank_payout(uuid, text)',
    'record_v14_refund_disbursement(uuid, text, text, text)',
    'verify_v14_payment_settlement(uuid, text, text)',
    'initiate_my_event_payment_v14(uuid, text, text, boolean)',
    'request_my_provider_payout(numeric)',
    'cancel_client_event_bookings(uuid, text)',
    'respond_to_provider_booking(uuid, boolean, text)',
    'submit_my_event_booking_requests_v14(uuid)',
    'provider_delete_service(uuid)',
    'provider_set_service_availability(uuid, boolean)',
    'superadmin_set_role_permission(text, text, boolean)',
    'superadmin_upsert_system_setting(text, jsonb, text)',
  ]

  assertTransactionalAdditiveMigration(grantMigration, 'high-risk RPC grant migration')
  assertTransactionalAdditiveMigration(anonRevokeMigration, 'high-risk RPC anonymous-revoke migration')
  signatures.forEach((signature) => {
    const escaped = signature.replace(/[()[\].?+*^$\\|]/g, '\\$&').replace(/, /g, ',\\s*')
    assert.match(
      grantMigration,
      new RegExp(`revoke all on function public\\.[^(]+\\(${escaped.slice(escaped.indexOf('\\(') + 2)} from public;`, 'i'),
      `must revoke PUBLIC execution for ${signature}`,
    )
    assert.match(
      grantMigration,
      new RegExp(`grant execute on function public\\.[^(]+\\(${escaped.slice(escaped.indexOf('\\(') + 2)} to authenticated;`, 'i'),
      `must grant authenticated execution for ${signature}`,
    )
    assert.match(
      anonRevokeMigration,
      new RegExp(`revoke all on function public\\.[^(]+\\(${escaped.slice(escaped.indexOf('\\(') + 2)} from anon;`, 'i'),
      `must revoke anonymous execution for ${signature}`,
    )
  })
})

test('staff reporting and operations RPCs retain authenticated-only execution', () => {
  const migration = read('supabase/migrations/20261029000500_harden_staff_reporting_rpc_grants.sql')
  const requiredFunctions = [
    'get_admin_booking_directory',
    'get_admin_financial_overview',
    'get_admin_v14_financial_operations',
    'get_audit_security_summary',
    'get_cash_flow_report',
    'get_permission_management_data',
    'get_superadmin_dashboard_analytics',
    'list_platform_audit_entries',
    'search_admin_dashboard',
    'update_support_ticket',
  ]

  assertTransactionalAdditiveMigration(migration, 'staff reporting RPC grant migration')
  requiredFunctions.forEach((name) => {
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\([^;]+ from public, anon;`, 'i'))
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\([^;]+ to authenticated;`, 'i'))
  })
})

test('identity-bound messaging, financial, and workspace RPCs deny anonymous execution', () => {
  const migration = read('supabase/migrations/20261029000600_harden_identity_bound_rpc_grants.sql')
  const requiredFunctions = [
    'get_my_client_refund_overview_v14',
    'get_my_event_payment_quote_v14',
    'get_my_provider_earnings',
    'get_v14_payment_settlement_context',
    'mark_booking_conversation_read',
    'open_booking_conversation',
    'open_coordinator_provider_conversation',
    'send_booking_message',
  ]

  assertTransactionalAdditiveMigration(migration, 'identity-bound RPC grant migration')
  requiredFunctions.forEach((name) => {
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\([^;]+ from public, anon;`, 'i'))
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\([^;]+ to authenticated;`, 'i'))
  })
})

test('planning and signed-in workspace RPCs use an explicit authenticated-only grant loop', () => {
  const migration = read('supabase/migrations/20261029000700_harden_planning_workspace_rpc_grants.sql')

  assertTransactionalAdditiveMigration(migration, 'planning workspace RPC grant migration')
  ;[
    'public.assign_event_coordinator_only(uuid,uuid)',
    'public.save_my_catering_service_selection_v15(uuid,uuid,integer,text,uuid,jsonb,boolean,text,text,boolean)',
    'public.save_my_florist_service_selection_v17(uuid,uuid,jsonb,text,boolean)',
    'public.save_my_photo_video_service_selection_v18(uuid,uuid,jsonb,text,boolean)',
    'public.save_my_venue_service_selection_v8(uuid,uuid,jsonb,text,boolean)',
    'public.stage_my_booking_replacement(uuid,uuid)',
    'public.submit_my_catering_food_tasting_request_v15(uuid,uuid,integer,jsonb)',
  ].forEach((signature) => assert.ok(migration.includes(signature), `missing ${signature}`))
  assert.match(migration, /function_oid := to_regprocedure\(function_signature\)/i)
  assert.match(migration, /revoke all on function %s from public, anon/i)
  assert.match(migration, /grant execute on function %s to authenticated/i)
})

test('event cancellation voids only pending prototype payments and preserves settled-refund handling', () => {
  const migration = read('supabase/migrations/20261029000800_cancel_pending_payments_on_event_cancellation.sql')

  assertTransactionalAdditiveMigration(migration, 'pending payment cancellation migration')
  ;[
    'create or replace function public.cancel_pending_payments_on_event_cancellation()',
    "new.status::text = 'cancelled'",
    "old.status = 'pending'",
    "event_row.status::text = 'cancelled'",
    "status = 'cancelled'",
    "payment.status = 'pending'",
    'aaa_cancel_pending_payments_on_event_cancellation_trigger',
    "event.status::text = 'cancelled'",
  ].forEach((fragment) => assert.ok(migration.includes(fragment), `pending payment cancellation migration is missing: ${fragment}`))
  assert.doesNotMatch(migration, /payment\.status\s+in\s*\([^)]*paid/i)
  assert.doesNotMatch(migration, /payment\.status\s+in\s*\([^)]*verified/i)
})

test('staging E2E preflight is explicit, staging-only, and excludes privileged credentials', () => {
  const preflight = read('scripts/qa-staging-preflight.mjs')
  const schemaGuard = read('scripts/qa-staging-schema-guard.mjs')
  const packageJson = read('package.json')
  const environmentTemplate = read('.env.qa.example')
  const runbook = read('docs/QA_STAGING_RUNBOOK.md')

  assert.match(packageJson, /"qa:staging:preflight"\s*:\s*"node scripts\/qa-staging-preflight\.mjs"/)
  assert.match(preflight, /MV_QA_ENV must be exactly "staging"/)
  assert.match(preflight, /QA_ALLOWED_SUPABASE_PROJECT_REF is required/)
  assert.match(preflight, /QA_LIVE_SUPABASE_PROJECT_REF is required/)
  assert.match(preflight, /staging and live project references must be different/)
  assert.match(preflight, /projectRef !== allowedProjectRef/)
  assert.match(preflight, /QA_PAYMENT_MODE must be exactly "prototype"/)
  assert.match(preflight, /I_UNDERSTAND_THIS_IS_STAGING/)
  assert.match(preflight, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(environmentTemplate, /^MV_QA_ENV=staging$/m)
  assert.match(environmentTemplate, /^QA_PAYMENT_MODE=prototype$/m)
  assert.match(environmentTemplate, /^QA_LIVE_SUPABASE_PROJECT_REF=your-live-project-ref$/m)
  assert.match(runbook, /Never use the linked live project as a substitute for this staging matrix\./)
  assert.match(packageJson, /"qa:staging:schema-guard"\s*:\s*"node scripts\/qa-staging-schema-guard\.mjs"/)
  assert.match(schemaGuard, /The Supabase CLI is not linked to the approved staging project/)
  assert.match(schemaGuard, /archive_rls/)
  assert.match(schemaGuard, /category_anon_writes_denied/)
  assert.match(schemaGuard, /Anonymous RPC allowlist differs from the reviewed public marketplace contract/)
})

test('trigger-only security-definer functions deny direct client execution', () => {
  const migration = read('supabase/migrations/20261029000900_revoke_trigger_function_client_execution.sql')
  const triggerFunctions = [
    'cancel_pending_payments_on_event_cancellation',
    'capture_platform_audit',
    'enforce_v14_payment_eligibility',
    'handle_new_auth_user',
    'phase14_queue_cancelled_event_refunds',
    'protect_profile_authorization_fields',
    'sync_event_booking_progress',
    'validate_v18_photo_video_package_jsonb',
  ]

  assertTransactionalAdditiveMigration(migration, 'trigger execution authorization migration')
  triggerFunctions.forEach((functionName) => {
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${functionName}\\(\\) from public, anon, authenticated;`, 'i'),
      `${functionName} must not be directly executable by API roles`,
    )
  })
  assert.doesNotMatch(migration, /grant execute on function/i)
})

test('identity-scoped workspace RPCs deny anonymous execution but retain signed-in access', () => {
  const migration = read('supabase/migrations/20261029001000_harden_identity_scoped_workspace_rpc_grants.sql')
  const signatures = [
    'activate_my_v15_food_tasting_direct_menu_fallback(uuid)',
    'calculate_my_florist_service_quote_v17(uuid,uuid,jsonb)',
    'get_my_client_wallet()',
    'list_my_support_context()',
    'schedule_my_v15_catering_food_tasting(uuid,date,time without time zone,text)',
    'submit_my_v15_food_tasting_final_menu(uuid,jsonb)',
  ]

  assertTransactionalAdditiveMigration(migration, 'identity-scoped workspace authorization migration')
  signatures.forEach((signature) => {
    assert.match(migration, new RegExp(`'public\\.${signature.replace(/[()[\].?+*^$\\|]/g, '\\$&').replace(/, /g, ',\\s*')}'`))
  })
  assert.match(migration, /revoke all on function %s from public, anon/i)
  assert.match(migration, /grant execute on function %s to authenticated/i)
  assert.doesNotMatch(migration, /can_reference_my_support_context/)
})

test('participant and staff mutation RPCs deny anonymous execution but retain signed-in access', () => {
  const migration = read('supabase/migrations/20261029001100_harden_participant_and_staff_mutation_rpc_grants.sql')
  const signatures = [
    'assign_event_coordinator(uuid,uuid)',
    'create_coordination_task(uuid,text,text,timestamp with time zone)',
    'record_cash_remittance(uuid,uuid,uuid,numeric,numeric,text,text)',
    'respond_to_catering_food_tasting(uuid,text,text,date,time without time zone)',
    'review_cash_remittance(uuid,text,text)',
    'staff_assign_event_coordinator(uuid,uuid)',
    'verify_cash_remittance(uuid,text)',
  ]

  assertTransactionalAdditiveMigration(migration, 'participant and staff mutation authorization migration')
  signatures.forEach((signature) => {
    assert.match(migration, new RegExp(`'public\\.${signature.replace(/[()[\].?+*^$\\|]/g, '\\$&').replace(/, /g, ',\\s*')}'`))
  })
  assert.match(migration, /revoke all on function %s from public, anon/i)
  assert.match(migration, /grant execute on function %s to authenticated/i)
})

test('internal workflow helpers deny direct API execution', () => {
  const migration = read('supabase/migrations/20261029001200_revoke_internal_helper_client_execution.sql')
  const signatures = [
    'create_v14_external_refund_obligation(uuid,text)',
    'phase11_provider_allocation_available_amount(uuid,uuid,uuid)',
    'process_phase11_payout_eligibility(uuid)',
    'sanitize_platform_audit_state(text,jsonb)',
    'v18_photo_video_booking_for_actor(uuid)',
  ]

  assertTransactionalAdditiveMigration(migration, 'internal helper authorization migration')
  signatures.forEach((signature) => {
    assert.match(migration, new RegExp(`'public\\.${signature.replace(/[()[\].?+*^$\\|]/g, '\\$&').replace(/, /g, ',\\s*')}'`))
  })
  assert.match(migration, /revoke all on function %s from public, anon, authenticated/i)
  assert.doesNotMatch(migration, /grant execute on function/i)
})

test('event-scoped quotes and role dashboards deny anonymous execution but retain signed-in access', () => {
  const migration = read('supabase/migrations/20261029001300_harden_event_quote_and_dashboard_rpc_grants.sql')
  const signatures = [
    'calculate_catering_menu_quote(uuid,uuid,jsonb)',
    'calculate_event_venue_quote_v8(uuid,uuid,jsonb)',
    'get_business_dashboard()',
    'get_coordinator_dashboard()',
    'get_event_schedule_availability(uuid)',
    'list_bookable_event_coordinators(uuid)',
  ]

  assertTransactionalAdditiveMigration(migration, 'event quote and dashboard authorization migration')
  signatures.forEach((signature) => {
    assert.match(migration, new RegExp(`'public\\.${signature.replace(/[()[\].?+*^$\\|]/g, '\\$&').replace(/, /g, ',\\s*')}'`))
  })
  assert.match(migration, /revoke all on function %s from public, anon/i)
  assert.match(migration, /grant execute on function %s to authenticated/i)
})

test('authorization helpers deny anonymous execution while preserving authenticated policy use', () => {
  const migration = read('supabase/migrations/20261029001400_harden_authorization_helper_rpc_grants.sql')
  const signatures = [
    'can_view_booking_conversation(uuid)',
    'can_view_provider_profile(uuid)',
    'has_permission(text)',
    'is_platform_staff()',
    'is_valid_booking_message_member(uuid,boolean)',
    'user_has_permission(uuid,text)',
  ]

  assertTransactionalAdditiveMigration(migration, 'authorization helper grant migration')
  signatures.forEach((signature) => {
    assert.match(migration, new RegExp(`'public\\.${signature.replace(/[()[\].?+*^$\\|]/g, '\\$&').replace(/, /g, ',\\s*')}'`))
  })
  assert.match(migration, /revoke all on function %s from public, anon/i)
  assert.match(migration, /grant execute on function %s to authenticated/i)
})
