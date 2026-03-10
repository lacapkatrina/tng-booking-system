const SUPABASE_URL = 'https://krjbpfjbbimqtnpjjkye.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LYvO32XRAOV3f4Fk5RFEBQ_6L9QqNzN';

async function seed() {
    console.log("1. Signing up user...");
    const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: 'kay@thenextperience.com',
            password: '@Tng2026',
            data: { full_name: 'Kay', job_title: 'Super Admin' }
        })
    });
    const signupData = await signupRes.json();
    console.log("Signup Response:", signupData);

    const userId = signupData?.user?.id || signupData?.id;

    console.log("2. Waiting 2 seconds for Postgres trigger to build profile...");
    await new Promise(r => setTimeout(r, 2000));

    console.log("3. Fetching Admin Role ID...");
    const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/roles?name=eq.Admin&select=id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const roleData = await roleRes.json();
    const roleId = roleData?.[0]?.id;
    console.log("Role ID:", roleId);

    if (roleId) {
        console.log("4. Forcing Profile to Active & Admin Role...");
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_profiles?email=eq.kay@thenextperience.com`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ status: 'Active', role_id: roleId })
        });
        console.log("Update Response:", await updateRes.json());
        console.log("Done! You can now login.");
    }
}

seed();
