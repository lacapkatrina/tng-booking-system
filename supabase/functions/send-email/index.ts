import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN')
const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY')

serve(async (req) => {
    try {
        const { booking_id } = await req.json()

        if (!booking_id) throw new Error("Missing booking_id")

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Fetch booking details with product and BU info
        const { data: booking, error: bError } = await supabaseClient
            .from('bookings')
            .select('*, products(*), business_units(*)')
            .eq('id', booking_id)
            .single()

        if (bError || !booking) throw new Error("Booking not found")

        const customerEmail = booking.customer_email
        const customerName = booking.customer_name
        const ref = booking.booking_reference
        const productName = booking.products?.name
        const venueName = booking.business_units?.name
        const date = new Date(booking.booking_date).toLocaleDateString()
        const time = booking.booking_time

        // Construct Email Content
        const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #10B981;">Booking Confirmed!</h2>
        <p>Hi ${customerName},</p>
        <p>Your booking for <strong>${productName}</strong> at <strong>${venueName}</strong> has been successfully paid and confirmed.</p>
        
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Reference:</strong> ${ref}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Quantity:</strong> ${booking.quantity}</p>
        </div>

        <p>You can present your QR code at the venue. You can view your digital ticket here:</p>
        <p><a href="${Deno.env.get('PUBLIC_SITE_URL')}/booking.html?success=true&ref=${ref}&bookingId=${booking_id}&product=${booking.product_id}" 
              style="display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 6px;">View Digital Ticket & QR Code</a></p>
        
        <p>Thank you for choosing TNG!</p>
      </div>
    `

        if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
            console.warn("Mailgun secrets not set. Skipping email send but marking as success.")
            return new Response(JSON.stringify({ success: true, message: "Secrets missing" }), { status: 200 })
        }

        const formData = new URLSearchParams()
        formData.append('from', `TNG Bookings <postmaster@${MAILGUN_DOMAIN}>`)
        formData.append('to', customerEmail)
        formData.append('subject', `Booking Confirmed: ${ref}`)
        formData.append('html', htmlContent)

        const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa('api:' + MAILGUN_API_KEY)}`
            },
            body: formData
        })

        const result = await response.json()
        console.log("Email Result:", result)

        return new Response(JSON.stringify({ success: true }), { status: 200 })

    } catch (error) {
        console.error("Email Error:", error.message)
        return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
})
