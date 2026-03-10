/**
 * PricingManager - Handles Business Unit Holidays and Product Price Overrides
 */
window.PricingManager = {
    db: null,

    init(dbInstance) {
        this.db = dbInstance;
        this.setupEventListeners();
    },

    setupEventListeners() {
        const holidayForm = document.getElementById('holiday-form');
        if (holidayForm) {
            holidayForm.addEventListener('submit', (e) => this.handleHolidaySubmit(e));
        }

        const overrideForm = document.getElementById('override-form');
        if (overrideForm) {
            overrideForm.addEventListener('submit', (e) => this.handleOverrideSubmit(e));
        }
    },

    async loadData() {
        if (!window.currentBusinessUnitId) return;
        console.log("PricingManager loading data for BU:", window.currentBusinessUnitId);
        await Promise.all([
            this.loadHolidays(),
            this.loadOverrides(),
            this.loadProductsForDropdown()
        ]);
    },

    async loadHolidays() {
        const tbody = document.getElementById('holidays-table-body');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Loading...</td></tr>';

        const [localRes, natRes] = await Promise.all([
            this.db.from('business_unit_holidays').select('*').eq('business_unit_id', window.currentBusinessUnitId),
            this.db.from('national_holidays').select('*')
        ]);

        if (localRes.error || natRes.error) {
            console.error("Holidays load error:", localRes.error || natRes.error);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading holidays.</td></tr>';
            return;
        }

        const locals = (localRes.data || []).map(h => ({ ...h, scope: 'local' }));
        const nats = (natRes.data || []).map(h => ({ ...h, scope: 'national' }));
        const all = [...locals, ...nats].sort((a, b) => new Date(a.holiday_date) - new Date(b.holiday_date));

        if (all.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">No holidays defined yet.</td></tr>';
            return;
        }

        tbody.innerHTML = all.map(h => `
            <tr>
                <td><strong>${h.holiday_date}</strong></td>
                <td>${h.name}</td>
                <td><span class="badge ${h.scope === 'national' ? 'approved' : 'pending'}" style="font-size:0.75rem;">${h.scope === 'national' ? 'Natl (All Venues)' : 'Local (This Venue)'}</span></td>
                <td><small>${new Date(h.created_at).toLocaleDateString()}</small></td>
                <td style="text-align:right;">
                    <button class="btn-primary" style="background:#4F46E5; padding:5px 10px; font-size:0.8rem; margin-right:5px;" onclick="window.PricingManager.editHoliday('${h.id}', '${h.holiday_date}', '${h.name.replace(/'/g, "\\'")}', '${h.scope}')">Edit</button>
                    <button class="btn-primary" style="background:#DC2626; padding:5px 10px; font-size:0.8rem;" onclick="window.PricingManager.deleteHoliday('${h.id}', '${h.scope}')">Delete</button>
                </td>
            </tr>
        `).join('');
    },

    async handleHolidaySubmit(e) {
        e.preventDefault();
        const id = document.getElementById('holiday-id').value;
        const origScope = document.getElementById('holiday-original-scope').value;
        const scope = document.getElementById('holiday-scope').value;
        const holiday_date = document.getElementById('holiday-date').value;
        const name = document.getElementById('holiday-name').value.trim();

        let result;

        if (id && origScope && origScope !== scope) {
            // Scope changed, delete old
            const oldTable = origScope === 'national' ? 'national_holidays' : 'business_unit_holidays';
            await this.db.from(oldTable).delete().eq('id', id);

            // Insert new without explicit ID
            const newTable = scope === 'national' ? 'national_holidays' : 'business_unit_holidays';
            const payload = { holiday_date, name };
            if (scope === 'local') payload.business_unit_id = window.currentBusinessUnitId;
            result = await this.db.from(newTable).insert([payload]);
        } else {
            const table = scope === 'national' ? 'national_holidays' : 'business_unit_holidays';
            const payload = { holiday_date, name };
            if (scope === 'local') payload.business_unit_id = window.currentBusinessUnitId;

            if (id) {
                payload.id = id;
                result = await this.db.from(table).upsert([payload]);
            } else {
                result = await this.db.from(table).insert([payload]);
            }
        }

        if (result.error) {
            window.showMessage("Error saving holiday: " + result.error.message, "error");
        } else {
            window.showMessage("Holiday saved successfully!", "success");
            this.resetHolidayForm();
            this.loadHolidays();
        }
    },

    editHoliday(id, date, name, scope) {
        document.getElementById('holiday-id').value = id;
        document.getElementById('holiday-original-scope').value = scope;
        document.getElementById('holiday-scope').value = scope;
        document.getElementById('holiday-date').value = date;
        document.getElementById('holiday-name').value = name;
        document.querySelector('#holiday-form').scrollIntoView({ behavior: 'smooth' });
    },

    async deleteHoliday(id, scope) {
        if (!confirm("Delete this holiday?")) return;
        const table = scope === 'national' ? 'national_holidays' : 'business_unit_holidays';
        const { error } = await this.db.from(table).delete().eq('id', id);
        if (error) window.showMessage("Error deleting holiday", "error");
        else {
            window.showMessage("Holiday deleted", "success");
            this.loadHolidays();
        }
    },

    resetHolidayForm() {
        const form = document.getElementById('holiday-form');
        if (form) form.reset();
        document.getElementById('holiday-id').value = '';
        document.getElementById('holiday-original-scope').value = '';
    },

    async autoFetchHolidays() {
        if (!confirm("This will import the standard 2026 Philippine holidays to your National Holiday calendar. Proceed?")) return;

        const phHolidays = [
            { holiday_date: '2026-01-01', name: 'New Year\'s Day' },
            { holiday_date: '2026-02-17', name: 'Chinese New Year' },
            { holiday_date: '2026-02-25', name: 'EDSA People Power Revolution Anniversary' },
            { holiday_date: '2026-03-20', name: 'Eid\'l Fitr (Approximate)' },
            { holiday_date: '2026-04-02', name: 'Maundy Thursday' },
            { holiday_date: '2026-04-03', name: 'Good Friday' },
            { holiday_date: '2026-04-04', name: 'Black Saturday' },
            { holiday_date: '2026-04-09', name: 'Araw ng Kagitingan' },
            { holiday_date: '2026-05-01', name: 'Labor Day' },
            { holiday_date: '2026-05-27', name: 'Eid\'l Adha (Approximate)' },
            { holiday_date: '2026-06-12', name: 'Independence Day' },
            { holiday_date: '2026-08-21', name: 'Ninoy Aquino Day' },
            { holiday_date: '2026-08-31', name: 'National Heroes Day' },
            { holiday_date: '2026-11-01', name: 'All Saints\' Day' },
            { holiday_date: '2026-11-02', name: 'All Souls\' Day' },
            { holiday_date: '2026-11-30', name: 'Bonifacio Day' },
            { holiday_date: '2026-12-08', name: 'Feast of the Immaculate Conception of Mary' },
            { holiday_date: '2026-12-24', name: 'Christmas Eve' },
            { holiday_date: '2026-12-25', name: 'Christmas Day' },
            { holiday_date: '2026-12-30', name: 'Rizal Day' },
            { holiday_date: '2026-12-31', name: 'Last Day of the Year' }
        ];

        window.showMessage("Importing holidays...", "success");

        const { error } = await this.db.from('national_holidays').upsert(phHolidays, { onConflict: 'holiday_date' });

        if (error) {
            console.error(error);
            window.showMessage("Error importing holidays: " + error.message, "error");
        } else {
            window.showMessage("Successfully imported 2026 holidays!", "success");
            this.loadHolidays();
        }
    },

    async loadProductsForDropdown() {
        const select = document.getElementById('override-product-id');
        if (!select) return;

        const { data } = await this.db.from('products').select('id, name').eq('business_unit_id', window.currentBusinessUnitId).order('name');

        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Product --</option>' +
            (data || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        select.value = currentVal;
    },

    async loadOverrides() {
        const tbody = document.getElementById('overrides-table-body');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Loading...</td></tr>';

        const { data, error } = await this.db
            .from('product_price_overrides')
            .select('*, products(name)')
            .eq('business_unit_id', window.currentBusinessUnitId)
            .order('date', { ascending: true });

        if (error) {
            console.error("Overrides load error:", error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading overrides.</td></tr>';
            return;
        }

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#94a3b8;">No overrides defined.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(o => `
            <tr>
                <td><strong>${o.products?.name || 'Unknown'}</strong></td>
                <td>${o.date}</td>
                <td style="font-weight:700;">₱${parseFloat(o.override_price).toLocaleString()}</td>
                <td>${o.label || '—'}</td>
                <td>${o.is_active ? '<span style="color:green; font-weight:600;">Active</span>' : '<span style="color:red;">Inactive</span>'}</td>
                <td style="text-align:right;">
                    <button class="btn-primary" style="background:#4F46E5; padding:5px 10px; font-size:0.8rem; margin-right:5px;" onclick='window.PricingManager.editOverride(${JSON.stringify(o).replace(/'/g, "&#39;")})'>Edit</button>
                    <button class="btn-primary" style="background:#DC2626; padding:5px 10px; font-size:0.8rem;" onclick="window.PricingManager.deleteOverride('${o.id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    },

    async handleOverrideSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('override-id').value;
        const product_id = document.getElementById('override-product-id').value;
        const date = document.getElementById('override-date').value;
        const override_price = parseFloat(document.getElementById('override-price').value);
        const label = document.getElementById('override-label').value.trim();
        const notes = document.getElementById('override-notes').value.trim();
        const is_active = document.getElementById('override-active').checked;

        const payload = {
            business_unit_id: window.currentBusinessUnitId,
            product_id,
            date,
            override_price,
            label,
            notes,
            is_active
        };

        let result;
        if (id) {
            payload.id = id;
            result = await this.db.from('product_price_overrides').upsert([payload]);
        } else {
            result = await this.db.from('product_price_overrides').insert([payload]);
        }

        if (result.error) {
            window.showMessage("Error saving override: " + result.error.message, "error");
        } else {
            window.showMessage("Override saved successfully!", "success");
            this.resetOverrideForm();
            this.loadOverrides();
        }
    },

    editOverride(o) {
        document.getElementById('override-id').value = o.id;
        document.getElementById('override-product-id').value = o.product_id;
        document.getElementById('override-date').value = o.date;
        document.getElementById('override-price').value = o.override_price;
        document.getElementById('override-label').value = o.label || '';
        document.getElementById('override-notes').value = o.notes || '';
        document.getElementById('override-active').checked = o.is_active;
        document.querySelector('#override-form').scrollIntoView({ behavior: 'smooth' });
    },

    async deleteOverride(id) {
        if (!confirm("Delete this override?")) return;
        const { error } = await this.db.from('product_price_overrides').delete().eq('id', id);
        if (error) window.showMessage("Error deleting override", "error");
        else {
            window.showMessage("Override deleted", "success");
            this.loadOverrides();
        }
    },

    resetOverrideForm() {
        const form = document.getElementById('override-form');
        if (form) form.reset();
        document.getElementById('override-id').value = '';
    }
};

/**
 * Tab Switching Helper
 */
window.switchPricingTab = function (tab) {
    document.getElementById('pricing-holidays-tab').style.display = tab === 'holidays' ? 'block' : 'none';
    document.getElementById('pricing-overrides-tab').style.display = tab === 'overrides' ? 'block' : 'none';

    document.querySelectorAll('.pricing-tab-btn').forEach(btn => {
        const isCurrent = btn.getAttribute('data-tab') === tab;
        btn.classList.toggle('active', isCurrent);
        btn.style.borderBottom = isCurrent ? '2px solid var(--primary)' : 'none';
        btn.style.color = isCurrent ? 'var(--primary)' : '#64748b';
    });
};
