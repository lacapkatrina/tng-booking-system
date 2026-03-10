// Admin User Authentication and Signup Flow
window.AuthManager = {
    db: null,

    init(supabaseDb) {
        this.db = supabaseDb;
        this.checkSession();
    },

    showForm(formId) {
        document.getElementById('login-card').classList.add('hidden');
        document.getElementById('signup-card').classList.add('hidden');
        document.getElementById('forgot-card').classList.add('hidden');
        document.getElementById(`${formId}-card`).classList.remove('hidden');
    },

    async checkSession() {
        // Automatically fetch session to verify login state on refresh
        const { data: { session } } = await this.db.auth.getSession();

        if (session) {
            this.handleSuccessfulLogin();
        }

        // Listen to state changes
        this.db.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                this.handleSuccessfulLogin();
            } else if (event === 'SIGNED_OUT') {
                document.getElementById('login-screen').classList.remove('hidden');
                document.getElementById('admin-dashboard').classList.add('hidden');
                this.showForm('login');
            }
        });
    },

    async handleSuccessfulLogin() {
        // Enforce Phase 6.2 Status Rules
        const { data: { session } } = await this.db.auth.getSession();
        if (!session) return;

        const { data: profile } = await this.db.from('admin_profiles').select('*').eq('id', session.user.id).single();

        if (profile && profile.status === 'Deactivated') {
            await this.logout();
            const err = document.getElementById('login-error');
            if (err) {
                err.textContent = 'Account deactivated. Please contact support.';
                err.classList.remove('hidden');
            }
            return;
        }

        if (profile && profile.status === 'Suspended') {
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('admin-dashboard').classList.add('hidden');
            document.querySelector('.login-wrapper').innerHTML = `
                <div class="login-card" style="text-align:center;">
                    <h2 style="color:#EF4444;">Account Suspended</h2>
                    <p>Your access has been temporarily blocked.</p>
                    <button class="btn-primary" style="margin-top:20px;" onclick="window.AuthManager.logout(); setTimeout(()=>location.reload(), 500);">Log Out</button>
                </div>
            `;
            return;
        }

        if (profile && profile.status === 'Pending Approval') {
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('admin-dashboard').classList.add('hidden');
            document.querySelector('.login-wrapper').innerHTML = `
                <div class="login-card" style="text-align:center;">
                    <h2 style="color:#F59E0B;">Pending Approval</h2>
                    <p>Your account is under review and cannot access the system modules yet.</p>
                    <button class="btn-primary" style="margin-top:20px;" onclick="window.AuthManager.logout(); setTimeout(()=>location.reload(), 500);">Log Out</button>
                </div>
            `;
            return;
        }

        // Update last login timestamp
        await this.db.from('admin_profiles').update({
            last_login_at: new Date().toISOString()
        }).eq('id', session.user.id);

        // Active State
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');

        // Initialize SPA Routing logic
        if (window.AdminRouter) {
            window.AdminRouter.init(this.db);
        }
    },

    async login(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');
        const err = document.getElementById('login-error');

        btn.textContent = 'Logging in...';
        btn.disabled = true;
        err.classList.add('hidden');

        const { error } = await this.db.auth.signInWithPassword({
            email, password: pass
        });

        if (error) {
            err.textContent = error.message;
            err.classList.remove('hidden');
        }

        btn.textContent = 'Login';
        btn.disabled = false;
    },

    async signup(e) {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const mobile = document.getElementById('signup-mobile').value;
        const job = document.getElementById('signup-job').value;
        const pass = document.getElementById('signup-password').value;

        const btn = document.getElementById('signup-btn');
        const msg = document.getElementById('signup-msg');

        btn.textContent = 'Creating account...';
        btn.disabled = true;
        msg.classList.add('hidden');

        // Request user signup. The Postgres trigger will intercept this internally 
        // to map them properly to 'Pending Approval' in admin_profiles mapping!
        const { data, error } = await this.db.auth.signUp({
            email,
            password: pass,
            options: {
                data: {
                    full_name: name,
                    mobile_number: mobile,
                    job_title: job
                }
            }
        });

        if (error) {
            msg.style.color = '#E53E3E';
            msg.textContent = error.message;
            msg.classList.remove('hidden');
            btn.textContent = 'Sign Up';
            btn.disabled = false;
        } else {
            msg.style.color = '#10B981';
            msg.innerHTML = `Your account is pending admin approval.<br>Please wait for an admin to grant access.`;
            msg.classList.remove('hidden');
            btn.style.display = 'none';
        }
    },

    async forgotPassword(e) {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        const btn = document.getElementById('forgot-btn');
        const msg = document.getElementById('forgot-msg');

        btn.textContent = 'Sending...';
        btn.disabled = true;
        msg.classList.add('hidden');

        // Trigger password reset via email relay
        const { error } = await this.db.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/admin.html?reset=true',
        });

        if (error) {
            msg.style.color = '#E53E3E';
            msg.textContent = error.message;
        } else {
            msg.style.color = '#10B981';
            msg.textContent = 'Password reset link sent! Check your email.';
        }
        msg.classList.remove('hidden');
        btn.textContent = 'Send Reset Link';
        btn.disabled = false;
    },

    async logout() {
        await this.db.auth.signOut();
    }
};

// Map DOM Events purely to these functions
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('admin-login-form')?.addEventListener('submit', (e) => window.AuthManager.login(e));
    document.getElementById('admin-signup-form')?.addEventListener('submit', (e) => window.AuthManager.signup(e));
    document.getElementById('admin-forgot-form')?.addEventListener('submit', (e) => window.AuthManager.forgotPassword(e));
});
