// 1. Initialize Supabase connecting details
const SUPABASE_URL = 'https://krjbpfjbbimqtnpjjkye.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LYvO32XRAOV3f4Fk5RFEBQ_6L9QqNzN';

// Create a single supabase client for interacting with your database
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Supabase client initialized successfully!');

// 2. Select HTML elements to interact with
const form = document.getElementById('booking-form');
const messageEl = document.getElementById('message');
const submitBtn = document.getElementById('submit-btn');

// 3. Handle Form Submission
form.addEventListener('submit', async (e) => {
    // Prevent the page from reloading when submitting
    e.preventDefault();

    // Get the values the user typed in
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    // Change button text while loading
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Booking...';
    submitBtn.disabled = true;

    try {
        // PHASE C & D: Compatibility Mapping
        // Convert the old text date/time into real timezone-aware timestamps for the new `start_at` and `end_at` fields
        const startAt = new Date(`${date}T${time}:00`);

        // We will default the booking to exactly 1 hour for old standard bookings
        const endAt = new Date(startAt.getTime() + (60 * 60 * 1000));

        // Send data to the 'bookings' table in Supabase
        const { data, error } = await supabase
            .from('bookings')
            .insert([
                {
                    // Legacy user-facing fields (Phase C ensures these stay the same)
                    customer_name: name,
                    customer_email: email,
                    booking_date: date,
                    booking_time: time,

                    // New Internal Booking Engine Fields (Phase D)
                    start_at: startAt.toISOString(),
                    end_at: endAt.toISOString(),
                    status: 'pending', // Explicitly using the safe defaults we set up
                    payment_status: 'unpaid',
                    quantity: 1
                }
            ]);

        if (error) {
            throw error;
        }

        // Show Success Message
        showMessage('Booking confirmed! We will see you then.', 'success');
        form.reset(); // Clear the form

    } catch (error) {
        console.error('Error details:', error);
        // Show Error Message
        showMessage('Oops! Make sure you created the "bookings" table in your Supabase dashboard.', 'error');
    } finally {
        // Reset the button
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
    }
});

// Helper function to show notifications on the screen
function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`; // e.g. 'message success' OR 'message error'

    // Hide the message after 5 seconds
    setTimeout(() => {
        messageEl.className = 'hidden';
    }, 5000);
}
