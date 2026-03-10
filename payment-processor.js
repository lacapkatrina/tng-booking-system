/**
 * XENDIT INTEGRATION MODULE
 * Scopes Xendit settings per Business Unit.
 * Ensures security and validation rules are followed.
 */

const PaymentProcessor = {
    /**
     * Load Xendit settings for a specific business unit
     */
    async getXenditSettings(db, businessUnitId) {
        const { data, error } = await db
            .from('payment_gateway_settings')
            .select('*')
            .eq('business_unit_id', businessUnitId)
            .eq('gateway_name', 'xendit')
            .single();

        if (error || !data) {
            console.error(`Xendit settings not found for BU: ${businessUnitId}`);
            return null;
        }
        return data;
    },

    /**
     * Initiate a payment request via Xendit
     */
    async initiatePayment(db, bookingId) {
        // 1. Load booking to get business_unit_id and amount
        const { data: booking, error: bError } = await db
            .from('bookings')
            .select('*, products(name)')
            .eq('id', bookingId)
            .single();

        if (bError || !booking) {
            throw new Error('Booking not found.');
        }

        const buId = booking.business_unit_id;
        if (!buId) {
            throw new Error('Booking is not associated with a Business Unit.');
        }

        // 2. Load Xendit Settings for this BU
        const settings = await this.getXenditSettings(db, buId);

        // 15. VALIDATION: ensure BU has an active Xendit config
        if (!settings || !settings.active) {
            throw new Error(`Payment processing is currently disabled for this Business Unit. Please contact support or enable it in Admin Settings.`);
        }

        // 15. VALIDATION: Ensure keys are present if active
        if (!settings.api_key_encrypted) {
            throw new Error('Xendit API Key is missing for this Business Unit. Please check Payment Gateway Settings.');
        }

        // 3. Prepare Xendit Request
        const isTestMode = settings.test_mode;
        console.log(`Initiating Xendit ${isTestMode ? 'TEST' : 'LIVE'} payment for booking ${booking.booking_reference}`);

        const payload = {
            external_id: booking.booking_reference,
            amount: booking.total_amount,
            payer_email: booking.customer_email,
            description: `Booking for ${booking.products?.name || 'Item'}`,
            // In a real app, this would be a real Xendit API URL
            // We simulate the API call here
            success_redirect_url: window.location.origin + '/booking-success.html',
            failure_redirect_url: window.location.origin + '/booking-failed.html',
        };

        // 16. SECURITY: Never expose secrets in payloads or console
        // We use the apiKey from DB (simulated)
        const apiKey = settings.api_key_encrypted;

        try {
            // SIMULATED XENDIT API CALL
            // const response = await fetch('https://api.xendit.co/v2/invoices', { ... });

            console.log('Sending request to Xendit with API Key:', '********'); // Hidden in logs

            // Mocking a successful invoice creation
            const mockInvoice = {
                id: 'xen_inv_' + Math.random().toString(36).substr(2, 9),
                invoice_url: `https://checkout.xendit.co/v2/invoices/${payload.external_id}`,
                status: 'PENDING'
            };

            // 4. Update booking with Xendit reference
            await db
                .from('bookings')
                .update({
                    xendit_reference: mockInvoice.id,
                    payment_status: 'pending'
                })
                .eq('id', booking.id);

            // 5. Log transaction in payments table
            await db
                .from('payments')
                .insert([{
                    booking_id: booking.id,
                    xendit_reference: mockInvoice.id,
                    amount: booking.total_amount,
                    payment_method: 'xendit',
                    status: 'pending'
                }]);

            return mockInvoice;

        } catch (err) {
            console.error('Xendit API Error:', err);
            throw new Error('Could not create payment request with Xendit.');
        }
    },

    /**
     * Verify Webhook (Simulated - would normally be server-side)
     */
    async verifyWebhook(db, payload, xenditCallbackToken) {
        // 1. Find the booking by external_id
        const externalId = payload.external_id;
        const { data: booking } = await db
            .from('bookings')
            .select('business_unit_id')
            .eq('booking_reference', externalId)
            .single();

        if (!booking) return false;

        // 2. Load the specific BU secret
        const settings = await this.getXenditSettings(db, booking.business_unit_id);
        if (!settings) return false;

        // 16. SECURITY: Webhook verification must use the saved secret for the correct BU
        const savedSecret = settings.webhook_secret_encrypted;

        // In a real server-side scenario:
        // return xenditCallbackToken === savedSecret;

        console.log(`Verifying webhook for BU ${booking.business_unit_id} using secret: ********`);
        return true; // Simulated success
    }
};

window.PaymentProcessor = PaymentProcessor;
