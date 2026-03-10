// Admin Route Management System
window.AdminRouter = {
    db: null,
    businessUnits: [], // stores {id, name, slug}
    currentSlug: null,
    currentModule: null,

    // Map URL segments to DOM module IDs and initialization functions
    routes: {
        'dashboard': { module: 'business-units-module' },
        'business-units': { module: 'business-units-module' },
        'products': { module: 'products-module', init: () => window.loadProducts && window.loadProducts() },
        'add-ons': { module: 'addons-module', init: () => window.loadAddons && window.loadAddons() },
        'resources': { module: 'resources-module', init: () => window.loadResources && window.loadResources() },
        'slot-templates': { module: 'slot-templates-module', init: () => window.loadSlotTemplates && window.loadSlotTemplates() },
        'product-resource-rules': { module: 'rules-module', init: () => window.loadRules && window.loadRules() },
        'bookings': { module: 'bookings-module', init: () => window.loadBookings && window.loadBookings() },
        'calendar': { module: 'calendar-module', init: () => window.loadCalendar && window.loadCalendar() },
        'payments': { module: 'payments-module', init: () => window.loadPayments && window.loadPayments() },
        'payment-gateway-settings': { module: 'gateway-module', init: () => window.loadGatewaySettings && window.loadGatewaySettings() },
        'reviews': { module: 'reviews-module', init: () => window.loadReviews && window.loadReviews() },
        'promos': { module: 'promos-module', init: () => window.PromoManager && window.PromoManager.loadDashboard() },
        'users-roles': { module: 'users-roles-module', init: () => window.AdminUsers && window.AdminUsers.loadUsersDashboard() },
        'pricing-rules': { module: 'pricing-rules-module', init: () => window.PricingManager && window.PricingManager.loadData() },
        'business-closures': { module: 'closures-module', init: () => window.loadClosures && window.loadClosures() }
    },

    async init(supabaseDb) {
        this.db = supabaseDb;
        await this.loadBusinessUnits();

        // Intercept global link clicks for SPA routing
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[data-route]');
            if (link) {
                e.preventDefault();
                const targetModuleStr = link.getAttribute('data-route');
                this.navigate(this.currentSlug, targetModuleStr);
            }
        });

        // Listen for browser back/forward buttons (Hash changes)
        window.addEventListener('hashchange', () => {
            this.resolveCurrentUrl();
        });

        // Resolve the initial URL on load
        this.resolveCurrentUrl();
    },

    async loadBusinessUnits() {
        const { data } = await this.db.from('business_units').select('id, name, slug').order('name');
        this.businessUnits = data || [];

        // Populate the top dropdown switcher
        const select = document.getElementById('bu-select');
        const tbody = document.getElementById('bu-list-tbody');

        if (select) {
            select.innerHTML = '';
            if (tbody) tbody.innerHTML = '';

            if (this.businessUnits.length === 0) {
                select.innerHTML = '<option value="">No Business Units</option>';
                if (tbody) tbody.innerHTML = '<tr><td colspan="3">No business units found. Add one above!</td></tr>';
            } else {
                this.businessUnits.forEach(bu => {
                    const opt = document.createElement('option');
                    opt.value = bu.id;
                    opt.textContent = bu.name;
                    opt.dataset.slug = bu.slug;
                    select.appendChild(opt);

                    if (tbody) {
                        tbody.innerHTML += `
                        <tr>
                            <td><small>${bu.id}</small><br><small style="color:#6b7280;">/${bu.slug}</small></td>
                            <td><strong>${bu.name}</strong></td>
                            <td style="text-align: right;">
                                <button class="btn-primary" style="background:#DC2626; padding:5px 10px; font-size:0.8rem;" onclick="deleteBusinessUnit('${bu.id}')">Delete</button>
                            </td>
                        </tr>
                        `;
                    }
                });

                // Phase 6.9/6.11 logic: Handle single BU or initial selection
                if (this.businessUnits.length === 1) {
                    const onlyBu = this.businessUnits[0];
                    select.value = onlyBu.id;
                    window.currentBusinessUnitId = onlyBu.id;
                    this.currentSlug = onlyBu.slug;
                    // Optionally disable switcher if only one exists to prevent "accidental" selection of nothing
                    select.disabled = true;
                    select.style.opacity = '0.7';
                } else if (window.currentBusinessUnitId) {
                    select.value = window.currentBusinessUnitId;
                }
            }

            if (!select.dataset.routed) {
                select.dataset.routed = 'true';
                select.addEventListener('change', (e) => {
                    const selectedOpt = e.target.options[e.target.selectedIndex];
                    const newSlug = selectedOpt.dataset.slug;
                    window.currentBusinessUnitId = e.target.value;
                    this.navigate(newSlug, this.currentModule || 'dashboard');
                });
            }
        }

        window.populateBusinessUnitDropdown = () => this.loadBusinessUnits();
    },

    navigate(slug, modulePath, itemId = null) {
        if (!slug && this.businessUnits.length > 0) {
            slug = this.businessUnits[0].slug;
        }

        let hash = `admin/${slug}/${modulePath}`;
        if (itemId) hash += `/${itemId}`;

        window.location.hash = hash;
        // resolveCurrentUrl will trigger via hashchange event or immediate call below
        this.resolveCurrentUrl();
    },

    resolveCurrentUrl() {
        // Hash format: #admin/slug/module[/id]
        let hash = window.location.hash.substring(1); // remove #

        // Normalize: if hash doesn't start with admin/, try to parse it anyway or fallback
        const segments = hash.split('/');

        let targetSlug = null;
        let targetModule = null;
        let targetId = null;

        if (segments.length >= 3 && segments[0] === 'admin') {
            targetSlug = segments[1];
            targetModule = segments[2];
            targetId = segments[3] || null;
        } else {
            // Default Fallback logic
            if (this.businessUnits.length > 0) {
                targetSlug = this.businessUnits[0].slug;
            }
            targetModule = 'business-units';
            // Force hash visually
            if (targetSlug) {
                window.location.hash = `admin/${targetSlug}/${targetModule}`;
            }
        }

        // Validate Route
        if (!this.routes[targetModule]) {
            targetModule = 'dashboard';
        }

        // Validate Slug against cache (Security & Consistency)
        const bu = this.businessUnits.find(b => b.slug === targetSlug);
        if (!bu && this.businessUnits.length > 0) {
            // Tampering or invalid slug: redirect to first available
            const first = this.businessUnits[0];
            console.warn(`Access denied for slug "${targetSlug}". Redirecting to ${first.slug}`);
            this.navigate(first.slug, targetModule);
            return;
        }

        if (bu) {
            window.currentBusinessUnitId = bu.id;
            this.currentSlug = bu.slug;
            // Update the switcher visually
            const select = document.getElementById('bu-select');
            if (select) select.value = bu.id;
        } else {
            // If invalid slug and no redirect happened (e.g., no business units at all, or targetSlug was null initially)
            // Fallback to first BU if available, otherwise currentSlug remains null
            if (this.businessUnits.length > 0) {
                this.currentSlug = this.businessUnits[0].slug;
                window.currentBusinessUnitId = this.businessUnits[0].id;
                // Ensure the hash reflects the fallback
                window.location.hash = `admin/${this.currentSlug}/${targetModule}`;
            }
        }

        this.currentModule = targetModule;
        this.renderView();

        if (targetId) {
            this.handleDetailView(targetModule, targetId);
        }
    },

    renderView() {
        const routeConfig = this.routes[this.currentModule];
        if (!routeConfig) return;

        // Hide all modules
        document.querySelectorAll('.module').forEach(mod => mod.classList.add('hidden'));

        // Show target module
        const targetEl = document.getElementById(routeConfig.module);
        if (targetEl) targetEl.classList.remove('hidden');

        // Update Nav Menu UI Active States
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-route="${this.currentModule}"]`);
        if (activeNav) activeNav.classList.add('active');

        // Fire Initialization Logic
        if (routeConfig.init) {
            try {
                routeConfig.init();
            } catch (e) {
                console.error("Module init failed:", e);
            }
        }
    },

    handleDetailView(moduleName, itemId) {
        setTimeout(() => {
            if (moduleName === 'bookings' && window.viewBooking) {
                this.db.from('bookings').select('*, products(name)').eq('id', itemId).single()
                    .then(({ data }) => {
                        if (data) window.viewBooking(data);
                    });
            }
        }, 300);
    }
};
