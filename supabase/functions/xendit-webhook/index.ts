import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

serve(async (req) => {
    try {
        const callbackToken = req.headers.get('x-callback-token')

        const body = await req.json()
        console.log("Xendit Webhook Received", body)

        const externalId = body.external_id
        const status = body.status
        const invoiceId = body.id

        if (!externalId) throw new Error("Missing external_id in payload")

        // init supabase client with service role
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Lookup booking by externalId to get business unit id
        const { data: booking, error: bookingError } = await supabaseClient
            .from('bookings')
            .select('id, business_unit_id')
            .eq('booking_reference', externalId)
            .single()

        if (bookingError || !booking) {
            throw new Error(`Booking not found for external_id: ${externalId}`)
        }

        // Load Xendit settings for this business unit 
        const { data: gatewayData, error: gatewayError } = await supabaseClient
            .from('payment_gateway_settings')
            .select('webhook_secret_encrypted, active')
            .eq('business_unit_id', booking.business_unit_id)
            .eq('gateway_name', 'xendit')
            .single()

        if (gatewayError || !gatewayData) {
            throw new Error('Payment gateway not configured for this business unit');
        }

        // Verify callback token matches the saved webhook secret
        if (gatewayData.webhook_secret_encrypted && gatewayData.webhook_secret_encrypted !== callbackToken) {
            console.error("Invalid Webhook Callback Token from Xendit!")
            return new Response("Unauthorized", { status: 401 })
        }

        // Update booking status
        if (status === 'PAID' || status === 'SETTLED') {
            await supabaseClient
                .from('bookings')
                .update({ payment_status: 'paid' })
                .eq('id', booking.id)

            await supabaseClient
                .from('payments')
                .insert([{
                    booking_id: booking.id,
                    xendit_reference: invoiceId,
                    amount: body.paid_amount || body.amount,
                    payment_method: body.payment_method || 'xendit',
                    status: 'paid'
                }])

            console.log(`Successfully marked booking ${externalId} as PAID`)

            // TRIGGER EMAIL NOTIFICATION
            try {
                await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ booking_id: booking.id })
                })
            } catch (emailErr) {
                console.error("Failed to trigger email function:", emailErr.message)
            }
        } else if (status === 'EXPIRED') {
            await supabaseClient
                .from('bookings')
                .update({ payment_status: 'failed', status: 'cancelled' })
                .eq('id', booking.id)
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error("Webhook processing error:", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
