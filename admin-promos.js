// Promo Management System for Admin Dashboard
window.PromoManager = {
    db: null,
    currentBuId: null,

    init(supabaseDb) {
        this.db = supabaseDb;

        // Listen to BU changes
        const buSelect = document.getElementById('bu-select');
        if (buSelect) {
            buSelect.addEventListener('change', (e) => {
                this.currentBuId = e.target.value;
                if (this.currentBuId) {
                    this.loadDashboard();
                } else {
                    this.clearDashboard();
                }
            });
        }

        // Add "Promo Modal" to the DOM
        this.createPromoModal();
    },

    clearDashboard() {
        if (document.getElementById('promos-tbody')) {
            document.getElementById('promos-tbody').innerHTML = '<tr><td colspan="6">Select a business unit to load promos.</td></tr>';
        }
    },

    async loadDashboard() {
        if (!this.currentBuId) return;

        try {
            // Fetch all promos (we'll fetch all globally for now, or could restrict by BU if promo system is BU-scoped. 
            // In Phase 1 migration, promo_codes didn't have business_unit_id, so they are global. 
            // We just show all promos.)

            const { data: promos, error: promoErr } = await this.db.from('promo_codes').select('*').order('created_at', { ascending: false });
            if (promoErr) throw promoErr;

            this.renderPromosTable(promos || []);

            // Fetch bookings with promos for stats
            const { data: bookings, error: bErr } = await this.db.from('bookings')
                .select('discount_amount, promo_code_text, product_id, business_unit_id')
                .not('promo_code_id', 'is', null);

            let totalUsage = 0;
            let totalDiscounts = 0;

            if (!bErr && bookings) {
                totalUsage = bookings.length;
                totalDiscounts = bookings.reduce((sum, b) => sum + (Number(b.discount_amount) || 0), 0);
            }

            const statUsage = document.getElementById('promo-stat-usage');
            const statDis = document.getElementById('promo-stat-discounts');
            const statBookings = document.getElementById('promo-stat-bookings');

            if (statUsage) statUsage.textContent = totalUsage;
            if (statDis) statDis.textContent = `₱${totalDiscounts.toLocaleString()}`;
            if (statBookings) statBookings.textContent = totalUsage;

            await this.loadAuditLogs();

        } catch (err) {
            console.error("PromoManager err:", err);
        }
    },

    renderPromosTable(promos) {
        const tbody = document.getElementById('promos-tbody');
        if (!tbody) return;

        if (promos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px;">No promos found.</td></tr>';
            return;
        }

        tbody.innerHTML = promos.map(p => {
            let rewardText = p.promo_reward_type;
            if (p.promo_reward_type === 'fixed_discount') rewardText = `₱${p.discount_value} Off`;
            if (p.promo_reward_type === 'percentage_discount') rewardText = `${p.discount_value}% Off`;
            if (p.promo_reward_type === 'buy_x_get_y') rewardText = `Buy ${p.buy_quantity} Get ${p.free_quantity} (${p.target_type})`;

            const typeLabel = p.promo_reward_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

            const maxUses = p.max_total_uses || '∞';
            const uses = p.uses_count || 0;
            let usagePct = 0;
            if (p.max_total_uses) {
                usagePct = Math.min(100, Math.round((uses / p.max_total_uses) * 100));
            }

            const status = p.active ?
                (p.is_blacklisted ? '<span class="badge" style="background:#fef2f2; color:#b91c1c;">Blacklisted</span>' : '<span class="badge badge-green">Active</span>')
                : '<span class="badge" style="background:#f1f5f9; color:#64748b;">Inactive</span>';

            const campName = p.campaign_name || 'Standard Campaign';

            return `
                <tr>
                    <td><span class="badge badge-purple" style="font-size:0.8rem; letter-spacing:0.05em;">${p.code}</span></td>
                    <td>
                        <div style="font-weight:700; color:var(--text);">${campName}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${rewardText}</div>
                    </td>
                    <td style="color:var(--text-muted);">${typeLabel}</td>
                    <td>
                        <div style="font-weight:800; font-size:1rem;">${uses} <span style="color:var(--text-muted); font-size:0.8rem; font-weight:500;">/ ${maxUses}</span></div>
                        <div style="height:4px; background:var(--border); border-radius:2px; margin-top:6px; width:60px; overflow:hidden;">
                            <div style="height:100%; width:${usagePct}%; background:${p.max_total_uses ? 'var(--primary)' : '#cbd5e1'};"></div>
                        </div>
                    </td>
                    <td>${status}</td>
                    <td style="display:flex; gap:8px;">
                        <button class="icon-button" style="width:32px; height:32px; border:none;" onclick="window.PromoManager.editPromo('${p.id}')">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button class="icon-button" style="width:32px; height:32px; border:none;" onclick="window.PromoManager.duplicatePromo('${p.id}')">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>
                        <button class="icon-button" style="width:32px; height:32px; border:none; color:${p.active ? '#ef4444' : '#10b981'};" onclick="window.PromoManager.togglePromoStatus('${p.id}', ${!p.active})">
                             ${p.active ? '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' : '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async loadAuditLogs() {
        const tbody = document.getElementById('promo-audit-tbody');
        if (!tbody) return;

        const { data, error } = await this.db.from('promo_audit_logs')
            .select('*, promo_codes(code)')
            .order('timestamp', { ascending: false })
            .limit(10);

        if (error || !data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No logs found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(log => `
            <tr>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td>${log.promo_codes ? log.promo_codes.code : log.promo_code_id}</td>
                <td><span style="background:#e5e7eb; padding:2px 6px; border-radius:4px;">${log.action}</span></td>
                <td>${log.notes || '-'}</td>
            </tr>
        `).join('');
    },

    async logAction(promoId, action, notes) {
        try {
            await this.db.from('promo_audit_logs').insert([{
                promo_code_id: promoId,
                action: action,
                admin_user: 'Super Admin',
                notes: notes
            }]);
            this.loadAuditLogs();
        } catch (e) { console.error("Audit log failed:", e); }
    },

    async togglePromoStatus(id, newStatus) {
        try {
            await this.db.from('promo_codes').update({ active: newStatus }).eq('id', id);
            await this.logAction(id, newStatus ? 'activated' : 'deactivated', `Admin manually ${newStatus ? 'activated' : 'paused'} promo code.`);
            this.loadDashboard();
        } catch (e) {
            alert("Error toggling promo status");
        }
    },

    async duplicatePromo(id) {
        try {
            const { data, error } = await this.db.from('promo_codes').select('*').eq('id', id).single();
            if (error) throw error;

            delete data.id;
            delete data.created_at;
            delete data.updated_at;
            data.code = `${data.code}_COPY_${Math.floor(Math.random() * 1000)}`;
            data.active = false;
            data.uses_count = 0;

            const { data: newPromo, error: insErr } = await this.db.from('promo_codes').insert([data]).select().single();
            if (insErr) throw insErr;

            await this.logAction(newPromo.id, 'created', `Duplicated from previous code.`);
            this.loadDashboard();
            alert(`Duplicated successfully as ${data.code}`);
        } catch (e) {
            alert("Error duplicating: " + e.message);
        }
    },

    createPromoModal() {
        const modalHtml = `
            <div id="promo-modal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
                <div style="background:white; padding:30px; border-radius:12px; width:600px; max-height:90vh; overflow-y:auto;">
                    <h2 id="promo-modal-title">Create Promo Campaign</h2>
                    <form id="promo-form">
                        <input type="hidden" id="promo-id">
                        
                        <div style="display:flex; gap:10px; margin-bottom:15px;">
                            <div style="flex:1;">
                                <label style="display:block; font-weight:bold; margin-bottom:5px;">Code*</label>
                                <input type="text" id="promo-code" required style="width:100%; padding:8px;" placeholder="e.g. SUMMER2026">
                            </div>
                            <div style="flex:1;">
                                <label style="display:block; font-weight:bold; margin-bottom:5px;">Campaign Name</label>
                                <input type="text" id="promo-campaign" style="width:100%; padding:8px;" placeholder="e.g. Influencer Launch">
                            </div>
                        </div>

                        <div style="display:flex; gap:10px; margin-bottom:15px;">
                            <div style="flex:1;">
                                <label style="display:block; font-weight:bold; margin-bottom:5px;">Reward Type*</label>
                                <select id="promo-reward-type" onchange="window.PromoManager.toggleRewardFields()" style="width:100%; padding:8px;">
                                    <option value="fixed_discount">Fixed Discount (₱)</option>
                                    <option value="percentage_discount">Percentage Discount (%)</option>
                                    <option value="buy_x_get_y">Buy X Get Y Free</option>
                                </select>
                            </div>
                            <div style="flex:1;" id="field-discount-val">
                                <label style="display:block; font-weight:bold; margin-bottom:5px;">Discount Value*</label>
                                <input type="number" id="promo-discount-val" style="width:100%; padding:8px;" value="0">
                            </div>
                        </div>

                        <!-- Buy X Get Y Config -->
                        <div id="field-bgy" style="display:none; gap:10px; margin-bottom:15px; background:#f3f4f6; padding:10px; border-radius:8px;">
                            <div style="flex:1;"><label>Buy Qty</label><input type="number" id="promo-buy-qty" value="1" style="width:100%; padding:6px;"></div>
                            <div style="flex:1;"><label>Get Qty</label><input type="number" id="promo-free-qty" value="1" style="width:100%; padding:6px;"></div>
                            <div style="flex:1;"><label>Target</label>
                                <select id="promo-target-type" style="width:100%; padding:6px;">
                                    <option value="ticket">Ticket</option>
                                    <option value="time_extension">Time Add-on</option>
                                    <option value="add_on">Physical Add-on</option>
                                </select>
                            </div>
                        </div>

                        <!-- Birthday Promo Config -->
                        <h4>Birthday Promo Settings</h4>
                        <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; background:#FFFBEB; border:1px solid #FCD34D; border-radius:8px; padding:10px;">
                            <div style="flex:1; min-width:120px;">
                                <label style="font-size:0.8rem; display:block; color:#92400E;">Enable Birthday Promo?</label>
                                <input type="checkbox" id="promo-is-birthday" style="margin-top:8px;" onchange="window.PromoManager.toggleBirthdayFields()">
                            </div>
                            <div style="flex:2; min-width:200px;" id="bday-rule-field">
                                <label style="font-size:0.8rem; display:block; color:#92400E;">Validation Rule</label>
                                <select id="promo-bday-rule" style="width:100%; padding:6px; margin-top:4px;">
                                    <option value="actual_day">Actual Birthday Only</option>
                                    <option value="birthday_week">Birthday Week (± 3 days)</option>
                                    <option value="birthday_month">Birthday Month</option>
                                </select>
                            </div>
                            <div style="flex:1; min-width:120px;" id="bday-comp-field">
                                <label style="font-size:0.8rem; display:block; color:#92400E;">Required Companions</label>
                                <input type="number" id="promo-bday-companions" value="0" min="0" style="width:100%; padding:6px; margin-top:4px;">
                            </div>
                        </div>

                        <!-- Abuse Protection -->
                        <h4>Abuse Protection & Limits</h4>
                        <div style="display:flex; gap:10px; margin-bottom:15px;">
                            <div style="flex:1;"><label style="font-size:0.8rem;">Max Total Uses</label><input type="number" id="promo-max-uses" placeholder="Unlimited" style="width:100%; padding:6px;"></div>
                            <div style="flex:1;"><label style="font-size:0.8rem;">Min Spend (₱)</label><input type="number" id="promo-min-spend" placeholder="0" style="width:100%; padding:6px;"></div>
                            <div style="flex:1;">
                                <label style="font-size:0.8rem; display:block;">Blacklisted?</label>
                                <input type="checkbox" id="promo-blacklisted" style="margin-top:10px;">
                            </div>
                        </div>

                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                            <button type="button" class="btn-primary" style="background:#9ca3af;" onclick="document.getElementById('promo-modal').style.display='none'">Cancel</button>
                            <button type="submit" class="btn-primary">Save Promo</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('promo-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            this.savePromo();
        });
    },

    toggleRewardFields() {
        const type = document.getElementById('promo-reward-type').value;
        if (type === 'buy_x_get_y') {
            document.getElementById('field-discount-val').style.display = 'none';
            document.getElementById('field-bgy').style.display = 'flex';
        } else {
            document.getElementById('field-discount-val').style.display = 'block';
            document.getElementById('field-bgy').style.display = 'none';
        }
    },

    toggleBirthdayFields() {
        const isBday = document.getElementById('promo-is-birthday').checked;
        document.getElementById('bday-rule-field').style.opacity = isBday ? '1' : '0.5';
        document.getElementById('bday-comp-field').style.opacity = isBday ? '1' : '0.5';
        document.getElementById('promo-bday-rule').disabled = !isBday;
        document.getElementById('promo-bday-companions').disabled = !isBday;
    },

    openPromoModal() {
        document.getElementById('promo-id').value = '';
        document.getElementById('promo-code').value = '';
        document.getElementById('promo-campaign').value = '';
        document.getElementById('promo-reward-type').value = 'fixed_discount';
        document.getElementById('promo-discount-val').value = '0';
        document.getElementById('promo-buy-qty').value = '1';
        document.getElementById('promo-free-qty').value = '1';
        document.getElementById('promo-max-uses').value = '';
        document.getElementById('promo-min-spend').value = '';
        document.getElementById('promo-blacklisted').checked = false;

        document.getElementById('promo-is-birthday').checked = false;
        document.getElementById('promo-bday-rule').value = 'actual_day';
        document.getElementById('promo-bday-companions').value = '0';

        this.toggleRewardFields();
        this.toggleBirthdayFields();

        document.getElementById('promo-modal-title').textContent = 'Create Promo Campaign';
        document.getElementById('promo-modal').style.display = 'flex';
    },

    async editPromo(id) {
        try {
            const { data, error } = await this.db.from('promo_codes').select('*').eq('id', id).single();
            if (error) throw error;

            document.getElementById('promo-id').value = data.id;
            document.getElementById('promo-code').value = data.code;
            document.getElementById('promo-campaign').value = data.campaign_name || '';
            document.getElementById('promo-reward-type').value = data.promo_reward_type;
            document.getElementById('promo-discount-val').value = data.discount_value || 0;
            document.getElementById('promo-buy-qty').value = data.buy_quantity || 1;
            document.getElementById('promo-free-qty').value = data.free_quantity || 1;
            document.getElementById('promo-target-type').value = data.target_type || 'ticket';
            document.getElementById('promo-max-uses').value = data.max_total_uses || '';
            document.getElementById('promo-min-spend').value = data.minimum_spend_amount || '';
            document.getElementById('promo-blacklisted').checked = data.is_blacklisted || false;

            this.toggleRewardFields();

            document.getElementById('promo-is-birthday').checked = data.is_birthday_promo || false;
            document.getElementById('promo-bday-rule').value = data.birthday_promo_rule || 'actual_day';
            document.getElementById('promo-bday-companions').value = data.requires_companions || 0;
            this.toggleBirthdayFields();

            document.getElementById('promo-modal-title').textContent = 'Edit Promo Campaign';
            document.getElementById('promo-modal').style.display = 'flex';
        } catch (e) {
            alert("Error loading promo");
        }
    },

    async savePromo() {
        const id = document.getElementById('promo-id').value;
        const payload = {
            code: document.getElementById('promo-code').value.toUpperCase(),
            campaign_name: document.getElementById('promo-campaign').value,
            promo_reward_type: document.getElementById('promo-reward-type').value,
            discount_value: Number(document.getElementById('promo-discount-val').value),
            buy_quantity: Number(document.getElementById('promo-buy-qty').value),
            free_quantity: Number(document.getElementById('promo-free-qty').value),
            target_type: document.getElementById('promo-target-type').value,
            max_total_uses: document.getElementById('promo-max-uses').value ? Number(document.getElementById('promo-max-uses').value) : null,
            minimum_spend_amount: document.getElementById('promo-min-spend').value ? Number(document.getElementById('promo-min-spend').value) : null,
            is_blacklisted: document.getElementById('promo-blacklisted').checked,
            is_birthday_promo: document.getElementById('promo-is-birthday').checked,
            birthday_promo_rule: document.getElementById('promo-is-birthday').checked ? document.getElementById('promo-bday-rule').value : null,
            requires_companions: document.getElementById('promo-is-birthday').checked ? Number(document.getElementById('promo-bday-companions').value) : 0,
            active: true // Default to active on save/create unless blacklisted handled separately
        };

        try {
            let logAction = 'updated';
            if (id) {
                await this.db.from('promo_codes').update(payload).eq('id', id);
            } else {
                const { data, error } = await this.db.from('promo_codes').insert([payload]).select().single();
                if (error) throw error;
                logAction = 'created';
                payload.id = data.id;
            }

            await this.logAction(id || payload.id, logAction, `Admin ${logAction} campaign ${payload.campaign_name || payload.code}`);

            document.getElementById('promo-modal').style.display = 'none';
            this.loadDashboard();

        } catch (e) {
            console.error("Save promo error:", e);
            alert("Error saving: " + e.message);
        }
    }
};
