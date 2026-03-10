// Initialize Supabase
const SUPABASE_URL = 'https://krjbpfjbbimqtnpjjkye.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LYvO32XRAOV3f4Fk5RFEBQ_6L9QqNzN';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let state = {
    businessUnitId: 'test-bu-1', // Mock default
    productId: 'test-product-1',
    productName: 'Full Day Exclusive',
    durationHours: 10,
    price: 25000,
    date: null,
    time: '08:00',
    quantity: 1
};

// --- DOM Elements ---
const packageCards = document.querySelectorAll('.package-card');
const dateInput = document.getElementById('booking-date');
const timeSlots = document.querySelectorAll('.time-slot');
const qtyMinus = document.getElementById('qty-minus');
const qtyPlus = document.getElementById('qty-plus');
const qtyDisplay = document.getElementById('qty-display');

// Summary Elems
const sumPackage = document.getElementById('summary-package');
const sumDate = document.getElementById('summary-date');
const sumTime = document.getElementById('summary-time');
const sumQty = document.getElementById('summary-qty');
const sumTotal = document.getElementById('summary-total-price');

// --- 2. Package Selection ---
packageCards.forEach(card => {
    card.addEventListener('click', () => {
        // Remove active class
        packageCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        // Update state
        state.price = parseInt(card.getAttribute('data-price'));
        state.productName = card.getAttribute('data-name');
        state.durationHours = parseInt(card.getAttribute('data-duration'));

        updateSummary();
    });
});

// --- 3. Date Picker ---
// Restrict past dates
const today = new Date().toISOString().split('T')[0];
dateInput.setAttribute('min', today);

dateInput.addEventListener('change', (e) => {
    state.date = e.target.value;

    // Simulate Availability Check caching
    checkAvailability();
    updateSummary();
});

// --- 4. Time Slot Picker ---
function checkAvailability() {
    // 8. AVAILABILITY CHECK LOGIC (Simulated for frontend)
    // 1. Check inventory mode
    // 2. Query booking_allocations or bookings where start_at matches
    // 3. Disable specific time slots if conflicting

    // For Hormozi urgency Demo: randomly show urgency
    if (state.date) {
        document.getElementById('urgency-indicator').classList.remove('hidden');
    }
}

// --- 5. Quantity Selector ---
qtyMinus.addEventListener('click', () => {
    if (state.quantity > 1) {
        state.quantity--;
        qtyDisplay.textContent = state.quantity;
        updateSummary();
    }
});

qtyPlus.addEventListener('click', () => {
    state.quantity++;
    qtyDisplay.textContent = state.quantity;
    updateSummary();
});

// --- 6. Update Summary ---
function updateSummary() {
    sumPackage.innerText = state.productName;
    sumDate.innerText = state.date ? new Date(state.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Select a date';
    sumTime.innerText = state.time;
    sumQty.innerText = state.quantity;

    const total = state.price * state.quantity;
    sumTotal.innerText = `₱${total.toLocaleString()}`;
}

// --- 9. Booking Creation & Payment Flow ---
document.getElementById('book-now-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    const btn = e.target;
    const errorMsg = document.getElementById('booking-error');
    errorMsg.classList.add('hidden');

    // Validate
    const name = document.getElementById('customer-name').value.trim();
    const email = document.getElementById('customer-email').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();

    if (!state.date || !name || !email || !phone) {
        errorMsg.innerText = "Please fill out all details and select a date.";
        errorMsg.classList.remove('hidden');
        return;
    }

    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        // Calculate Internal Datetimes
        const startAt = new Date(`${state.date}T${state.time}:00`);
        const endAt = new Date(startAt.getTime() + (state.durationHours * 60 * 60 * 1000));

        // 9. Create Booking using Legacy mapping + New mapping
        const bookingRef = `TNG-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000) + 10000}`;

        const payload = {
            customer_name: name,
            customer_email: email,
            customer_phone: phone, // new field added in schema
            booking_date: state.date, // Legacy preserved
            booking_time: state.time, // Legacy preserved

            // New internal engine fields
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            status: 'pending',
            payment_status: 'unpaid',
            quantity: state.quantity,
            total_amount: state.price * state.quantity,
            booking_reference: bookingRef
            // business_unit_id and product_id omitted in demo if not purely mocked
        };

        const { data, error } = await supabase.from('bookings').insert([payload]).select();

        if (error) throw error;

        // 10. Xendit Payment Flow logic
        console.log(`Checking Xendit Gateway settings for BU: ${state.businessUnitId}`);
        // Simulated: verify active, create payment request, handle webhook...
        console.log(`Redirecting to Xendit Payment URL for ${bookingRef}`);

        // 12. Simulate Success Confirmation
        setTimeout(() => {
            showConfirmation(bookingRef, state);
            btn.innerText = "Book Now & Pay Securely";
            btn.disabled = false;
        }, 1500);

    } catch (err) {
        console.error(err);
        errorMsg.innerText = "An error occurred. Please try again.";
        errorMsg.classList.remove('hidden');
        btn.innerText = "Book Now & Pay Securely";
        btn.disabled = false;
    }
});

function showConfirmation(ref, stateObj) {
    document.getElementById('conf-ref').innerText = ref;
    document.getElementById('conf-product').innerText = stateObj.productName;
    document.getElementById('conf-datetime').innerText = `${stateObj.date} at ${stateObj.time}`;
    document.getElementById('conf-qty').innerText = stateObj.quantity;

    document.getElementById('confirmation-overlay').classList.remove('hidden');
}
