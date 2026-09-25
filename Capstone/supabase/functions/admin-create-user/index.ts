import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CreateUserInput = {
  full_name?: string
  email?: string
  phone?: string
  password?: string
  role?: string
  account_status?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = request.headers.get('Authorization') || ''
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const { data: authData, error: authError } = await callerClient.auth.getUser()
    if (authError || !authData.user) return json({ error: 'Authentication is required.' }, 401)

    const input = await request.json() as CreateUserInput
    const role = String(input.role || '')
    const accountStatus = String(input.account_status || 'active')
    const allowedRoles = ['event_coordinator', 'assistant', 'customer_service', 'admin']
    if (!allowedRoles.includes(role)) return json({ error: 'Unsupported internal role.' }, 400)
    if (!['active', 'suspended', 'disabled'].includes(accountStatus)) {
      return json({ error: 'Unsupported account status.' }, 400)
    }

    const requiredPermission = role === 'event_coordinator' ? 'coordinators.create' : 'users.create'
    const { data: permitted, error: permissionError } = await callerClient.rpc('has_permission', {
      target_permission: requiredPermission,
    })
    if (permissionError || !permitted) return json({ error: 'You do not have permission to create this account.' }, 403)

    const fullName = String(input.full_name || '').trim()
    const email = String(input.email || '').trim().toLowerCase()
    const phone = String(input.phone || '').trim()
    const password = String(input.password || '')
    if (!fullName || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return json({ error: 'Name, valid email, and an 8-character password are required.' }, 400)
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      phone: phone || undefined,
      // Create through the ordinary client path first. Only this service-role
      // function promotes the profile to the requested internal role below.
      user_metadata: { full_name: fullName, phone, default_role: 'client', requested_internal_role: role },
    })
    if (createError || !created.user) return json({ error: createError?.message || 'Unable to create account.' }, 400)

    const { data: roleRow, error: roleError } = await adminClient.from('roles').select('id').eq('name', role).single()
    if (roleError || !roleRow) {
      await adminClient.auth.admin.deleteUser(created.user.id)
      return json({ error: 'The selected role is not installed. Apply database migration 30 first.' }, 409)
    }

    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: created.user.id,
      full_name: fullName,
      email,
      phone: phone || null,
      default_role: role,
      account_status: accountStatus,
      updated_at: new Date().toISOString(),
    })
    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id)
      return json({ error: profileError.message }, 400)
    }

    await adminClient.from('user_roles').delete().eq('user_id', created.user.id)
    const { error: assignmentError } = await adminClient.from('user_roles').insert({
      user_id: created.user.id,
      role_id: roleRow.id,
      assigned_by: authData.user.id,
    })
    if (assignmentError) {
      await adminClient.auth.admin.deleteUser(created.user.id)
      return json({ error: assignmentError.message }, 400)
    }

    const { data: callerProfile } = await adminClient.from('profiles').select('default_role').eq('id', authData.user.id).single()
    await adminClient.from('audit_logs').insert({
      actor_id: authData.user.id,
      actor_role: callerProfile?.default_role || 'superadmin',
      action: 'internal_user.created',
      resource_type: 'profile',
      resource_id: created.user.id,
      new_state: { full_name: fullName, email, role, account_status: accountStatus },
      result: 'success',
      metadata: { created_via: 'admin-create-user' },
    })

    return json({ user_id: created.user.id, role, account_status: accountStatus }, 201)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500)
  }
})

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
