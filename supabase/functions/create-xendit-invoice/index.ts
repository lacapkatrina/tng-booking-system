import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json();
        console.log("Create Xendit Invoice Body:", body);

        const {
            booking_id,
            external_id,
            amount,
            payer_email,
            description,
            customer,
            success_redirect_url,
            failure_redirect_url,
            business_unit_id
        } = body;

        if (!business_unit_id) {
            throw new Error("Missing business_unit_id in request");
        }

        // init supabase client with service role
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // lookup xendit api key
        const { data: gatewayData, error: gatewayError } = await supabaseClient
            .from('payment_gateway_settings')
            .select('api_key_encrypted, active')
            .eq('business_unit_id', business_unit_id)
            .eq('gateway_name', 'xendit')
            .maybeSingle()

        if (gatewayError) {
            throw new Error(`Database error looking up gateway: ${gatewayError.message}`);
        }

        if (!gatewayData) {
            throw new Error(`Xendit gateway NOT configured in 'payment_gateway_settings' for business_unit_id: ${business_unit_id}. Please ensure you added the secret key in the admin portal.`);
        }

        if (!gatewayData.active) {
            throw new Error('Xendit payment gateway is currently disabled in your settings.');
        }

        const xenditApiKey = gatewayData.api_key_encrypted;
        if (!xenditApiKey) {
            throw new Error("Xendit API key is empty in database settings.");
        }

        // Contact Xendit API
        console.log(`Calling Xendit for ${external_id} with amount ${amount}`);

        const xenditResponse = await fetch('https://api.xendit.co/v2/invoices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${btoa(xenditApiKey + ':')}`
            },
            body: JSON.stringify({
                external_id: external_id,
                amount: Number(amount),
                payer_email: payer_email,
                description: description,
                customer: customer,
                success_redirect_url: success_redirect_url,
                failure_redirect_url: failure_redirect_url,
                currency: 'PHP'
            })
        });

        const xenditData = await xenditResponse.json();

        if (!xenditResponse.ok) {
            console.error("Xendit API Error:", xenditData);
            throw new Error(`Xendit API says: ${xenditData.message || xenditData.error_code || 'Unknown Error'}`);
        }

        return new Response(JSON.stringify(xenditData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error("Function error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
