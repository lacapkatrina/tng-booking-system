import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json();
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
            .single()

        if (gatewayError || !gatewayData) {
            throw new Error('Payment gateway not configured for this business unit');
        }

        if (!gatewayData.active) {
            throw new Error('Payment gateway is currently disabled');
        }

        const xenditApiKey = gatewayData.api_key_encrypted;

        // Contact Xendit API
        const xenditResponse = await fetch('https://api.xendit.co/v2/invoices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${btoa(xenditApiKey + ':')}`
            },
            body: JSON.stringify({
                external_id: external_id,
                amount: amount,
                payer_email: payer_email,
                description: description,
                customer: customer,
                success_redirect_url: success_redirect_url,
                failure_redirect_url: failure_redirect_url,
                currency: 'PHP'
            })
        });

        if (!xenditResponse.ok) {
            const errorText = await xenditResponse.text();
            console.error("Xendit Error Response", errorText);
            throw new Error(`Xendit API error: ${errorText}`);
        }

        const xenditData = await xenditResponse.json();

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
