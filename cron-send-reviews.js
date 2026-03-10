/**
 * Phase 7: Automated Review Request Sender
 * 
 * This standalone script runs as a cron job to automatically send review requests
 * to customers whose experiences have concluded.
 * 
 * Usage:
 * node cron-send-reviews.js
 * 
 * Note: Requires Node.js 18+ (for native fetch support). No external dependencies needed.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://krjbpfjbbimqtnpjjkye.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_LYvO32XRAOV3f4Fk5RFEBQ_6L9QqNzN';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

async function dbFetch(endpoint, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`DB Error (${res.status}): ${err}`);
    }
    return res.json();
}

async function processReviewRequests() {
    console.log('🔄 Starting automated review request job...');

    // 1. Fetch eligible bookings
    // Status MUST NOT be cancelled. Payment MUST be paid.
    // review_email_sent_at MUST be NULL.
    // Customer email MUST be present.
    let bookings = [];
    try {
        bookings = await dbFetch(
            'bookings?select=id,customer_name,customer_email,booking_date,start_at,status,payment_status,products(id,name),product_reviews(id)&payment_status=eq.paid&status=neq.cancelled&review_email_sent_at=is.null&customer_email=not.is.null&order=id.asc'
        );
    } catch (err) {
        console.error('❌ Failed to fetch bookings:', err.message);
        process.exit(1);
    }

    console.log(`Found ${bookings.length} potential bookings to process.`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eligibleBookings = [];

    // 2. Filter out bookings that don't meet date criteria or already have reviews
    for (const b of bookings) {
        // A review is already manually submitted by the user
        if (b.product_reviews && b.product_reviews.length > 0) {
            continue;
        }

        // Determine the actual visit date
        const visitDateStr = b.booking_date || b.start_at || null;
        let shouldSend = false;

        // Either it's marked as literally 'completed' by admin
        if (b.status === 'completed') {
            shouldSend = true;
        } else if (visitDateStr) {
            // Or the visit date has chronologically passed
            const visitDay = new Date(visitDateStr);
            visitDay.setHours(0, 0, 0, 0);

            if (visitDay < today) {
                shouldSend = true;
            }
        }

        if (shouldSend) {
            eligibleBookings.push(b);
        }
    }

    console.log(`✅ ${eligibleBookings.length} bookings are eligible for review requests.`);

    if (eligibleBookings.length === 0) {
        console.log('🏁 Job finished. No emails to send.');
        return;
    }

    // 3. Process sending and logging
    let successCount = 0;

    for (const b of eligibleBookings) {
        try {
            // -------------------------------------------------------------
            // Simulated Email Sending Logic
            // In production, integrate SendGrid, Postmark, AWS SES, or similar
            // -------------------------------------------------------------
            const productName = b.products ? b.products.name : 'Experience';
            console.log(`\n📧 Sending email to: ${b.customer_email}`);
            console.log(`   Subject: How was your experience at ${productName}?`);
            console.log(`   Body: Hi ${b.customer_name},\n   We hope you enjoyed your time with us! Please leave a review using this personalized link: https://tng.example.com/review.html?booking=${b.id}\n`);

            // Mark as sent
            await dbFetch(`bookings?id=eq.${b.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ review_email_sent_at: new Date().toISOString() })
            });

            console.log(`   ✅ Successfully logged sent status for booking ${b.id}`);
            successCount++;
        } catch (err) {
            console.error(`   ❌ Unexpected error processing booking ${b.id}:`, err.message);
        }
    }

    console.log(`\n🏁 Job finished. Successfully processed ${successCount} emails.`);
}

// Execute
processReviewRequests().catch(console.error);
