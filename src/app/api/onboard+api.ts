import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, adminName, adminEmail, adminPassword } = body;

    if (!companyName || !adminEmail || !adminPassword || !adminName) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;
    
    // We MUST use the service role key to bypass RLS and create an auth user via API
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Create Tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert([{ name: companyName }])
      .select()
      .single();

    if (tenantError) throw tenantError;

    // 2. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (authError) {
      // Rollback tenant creation if auth fails
      await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
      throw authError;
    }

    // 3. Create Profile mapped to Tenant
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert([{
        id: authData.user.id,
        tenant_id: tenant.id,
        full_name: adminName,
        role: 'tenant_admin'
      }]);

    if (profileError) throw profileError;

    return Response.json({ success: true, tenant, user: authData.user });

  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
