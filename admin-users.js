// Admin User Management and RBAC logic (Phases 6.2, 6.3, 6.4)
window.AdminUsers = {
    db: null,
    roles: [],
    branches: [],
    assignments: {}, // raw admin_user_branches data mapping

    init(supabaseDb) {
        this.db = supabaseDb;

        // Set up search and filters
        const searchInput = document.getElementById('users-search');
        const roleFilter = document.getElementById('users-role-filter');
        const statusFilter = document.getElementById('users-status-filter');
        const buFilter = document.getElementById('users-bu-filter');

        [searchInput, roleFilter, statusFilter, buFilter].forEach(el => {
            el?.addEventListener('input', () => this.loadUsersDashboard());
        });

        // Initialize BU filter options
        this.populateBuFilter();
    },

    async populateBuFilter() {
        const buFilter = document.getElementById('users-bu-filter');
        if (!buFilter) return;

        const { data } = await this.db.from('business_units').select('id, name').order('name');
        if (data) {
            buFilter.innerHTML = '<option value="">All Business Units</option>' +
                data.map(bu => `<option value="${bu.id}">${bu.name}</option>`).join('');
        }
    },

    async loadUsersDashboard() {
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        // Don't show "Loading..." if we already have data (for a smoother filter experience)
        if (tbody.innerHTML === '') {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:40px;">Loading users...</td></tr>';
        }

        try {
            // Fetch foundational config tables
            const { data: rolesRes } = await this.db.from('roles').select('*');
            this.roles = rolesRes || [];

            const { data: buRes } = await this.db.from('business_units').select('id, name');
            this.branches = buRes || [];

            // Fetch Profiles with filtering
            let query = this.db.from('admin_profiles').select('*, roles(name), approver:approved_by(full_name)').order('created_at', { ascending: false });

            const search = document.getElementById('users-search')?.value.trim();
            const role = document.getElementById('users-role-filter')?.value;
            const status = document.getElementById('users-status-filter')?.value;
            const bu = document.getElementById('users-bu-filter')?.value;

            if (search) {
                query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
            }
            if (role) query = query.eq('role_id', role);
            if (status) query = query.eq('status', status);

            // Note: BU filtering on profiles requires a join or subquery since access is in mapping table
            // For now, we fetch all and filter in JS if BU is selected, or use a complex join
            const { data: profiles, error } = await query;
            if (error) throw error;

            // Fetch Branch Assignments
            const { data: branchPerms } = await this.db.from('admin_user_branches').select('*');
            this.assignments = {};
            (branchPerms || []).forEach(b => {
                if (!this.assignments[b.admin_id]) this.assignments[b.admin_id] = [];
                this.assignments[b.admin_id].push(b.business_unit_id);
            });

            let filteredProfiles = profiles || [];
            if (bu) {
                filteredProfiles = filteredProfiles.filter(p =>
                    p.access_all_business_units || (this.assignments[p.id] || []).includes(bu)
                );
            }

            this.renderUsers(filteredProfiles);

        } catch (e) {
            console.error("Error loading users:", e);
            tbody.innerHTML = `<tr><td colspan="10" style="color:red; text-align:center; padding:40px;">Failed to load profiles: ${e.message}</td></tr>`;
        }
    },

    renderUsers(profiles) {
        this.allUsersCache = profiles; // Keep for modal lookup
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        if (profiles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:40px;">No admin profiles found matching your filters.</td></tr>';
            return;
        }

        tbody.innerHTML = profiles.map(p => {
            const lastLogin = p.last_login_at ? new Date(p.last_login_at).toLocaleString() : 'Never';
            const createdAt = new Date(p.created_at).toLocaleDateString();
            const approvedBy = p.approver ? p.approver.full_name : (p.status === 'Active' ? 'System' : '-');
            const roleName = p.roles ? p.roles.name : (p.role_id ? 'Unlinked Role' : 'Unassigned');

            let statusBadge = '';
            if (p.status === 'Active') statusBadge = '<span class="badge badge-green">Active</span>';
            else if (p.status === 'Pending Approval') statusBadge = '<span class="badge" style="background:#fef3c7; color:#92400e;">Pending Approval</span>';
            else if (p.status === 'Suspended') statusBadge = '<span class="badge" style="background:#fee2e2; color:#991b1b;">Suspended</span>';
            else statusBadge = '<span class="badge" style="background:#f1f5f9; color:#475569;">Deactivated</span>';

            const buAccessDisplay = p.access_all_business_units
                ? '<span style="color:var(--primary); font-weight:700;">✨ All Units</span>'
                : `<div style="font-size:0.75rem;">${(this.assignments[p.id] || []).length} Units Assigned</div>`;

            return `
                <tr>
                    <td>
                        <div style="font-weight:700; color:var(--text);">${p.full_name}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${p.email}</div>
                    </td>
                    <td>
                        <div style="font-size:0.85rem; font-weight:500;">${p.mobile_number || '-'}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${p.job_title || 'No Title'}</div>
                    </td>
                    <td>
                        <div class="badge" style="background:#eff6ff; color:#1e40af; border:1px solid #dbeafe;">${roleName}</div>
                    </td>
                    <td>${buAccessDisplay}</td>
                    <td>${statusBadge}</td>
                    <td style="font-size:0.75rem; color:var(--text-muted);">
                        <div><strong>Last:</strong> ${lastLogin}</div>
                        <div><strong>Created:</strong> ${createdAt}</div>
                        <div><strong>Approved By:</strong> ${approvedBy}</div>
                    </td>
                    <td style="text-align:right;">
                        <button class="btn-primary" style="padding:8px 16px; font-size:0.8rem;" onclick="window.AdminUsers.openEditModal('${p.id}')">Edit Permissions</button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    openEditModal(userId) {
        const user = this.allUsersCache.find(u => u.id === userId);
        if (!user) return;

        document.getElementById('edit-user-title').textContent = 'Edit User Profile';
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('edit-user-name').value = user.full_name;
        document.getElementById('edit-user-email').value = user.email;
        document.getElementById('edit-user-email').readOnly = true;
        document.getElementById('edit-user-email').style.background = '#f8fafc';
        document.getElementById('edit-user-mobile').value = user.mobile_number || '';
        document.getElementById('edit-user-job').value = user.job_title || '';
        document.getElementById('edit-user-status').value = user.status;
        document.getElementById('edit-user-password-row').classList.add('hidden');
        document.getElementById('edit-user-password').required = false;

        // Role Picker
        const roleSelect = document.getElementById('edit-user-role');
        roleSelect.innerHTML = '<option value="">-- Unassigned --</option>' +
            this.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        roleSelect.value = user.role_id || '';

        // Access Type Radio
        const accessAll = document.getElementById('edit-user-access-all');
        const accessSelected = document.getElementById('edit-user-access-selected');
        const buPicker = document.getElementById('edit-user-bu-picker');

        if (user.access_all_business_units) {
            accessAll.checked = true;
            buPicker.classList.add('hidden');
        } else {
            accessSelected.checked = true;
            buPicker.classList.remove('hidden');
        }

        // BU Checkboxes
        const assignments = this.assignments[user.id] || [];
        buPicker.innerHTML = this.branches.map(b => `
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;">
                <input type="checkbox" class="edit-bu-chk" value="${b.id}" ${assignments.includes(b.id) ? 'checked' : ''}> ${b.name}
            </label>
        `).join('');

        // Toggles
        [accessAll, accessSelected].forEach(radio => {
            radio.onchange = () => {
                if (accessSelected.checked) buPicker.classList.remove('hidden');
                else buPicker.classList.add('hidden');
            };
        });

        document.getElementById('user-edit-modal').classList.remove('hidden');
    },

    openAddModal() {
        document.getElementById('edit-user-title').textContent = 'Add New User Account';
        document.getElementById('edit-user-id').value = '';
        document.getElementById('edit-user-name').value = '';
        document.getElementById('edit-user-email').value = '';
        document.getElementById('edit-user-email').readOnly = false;
        document.getElementById('edit-user-email').style.background = 'white';
        document.getElementById('edit-user-mobile').value = '';
        document.getElementById('edit-user-job').value = '';
        document.getElementById('edit-user-status').value = 'Active';
        document.getElementById('edit-user-password-row').classList.remove('hidden');
        document.getElementById('edit-user-password').value = '';
        document.getElementById('edit-user-password').required = true;

        const roleSelect = document.getElementById('edit-user-role');
        roleSelect.innerHTML = '<option value="">-- Unassigned --</option>' +
            this.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        roleSelect.value = '';

        document.getElementById('edit-user-access-all').checked = true;
        const buPicker = document.getElementById('edit-user-bu-picker');
        buPicker.classList.add('hidden');

        buPicker.innerHTML = this.branches.map(b => `
            <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; margin-bottom:5px; cursor:pointer;">
                <input type="checkbox" class="edit-bu-chk" value="${b.id}"> ${b.name}
            </label>
        `).join('');

        // Toggles for radio buttons
        const accessAll = document.getElementById('edit-user-access-all');
        const accessSelected = document.getElementById('edit-user-access-selected');
        [accessAll, accessSelected].forEach(radio => {
            radio.onchange = () => {
                if (accessSelected.checked) buPicker.classList.remove('hidden');
                else buPicker.classList.add('hidden');
            };
        });

        document.getElementById('user-edit-modal').classList.remove('hidden');
    },

    closeEditModal() {
        document.getElementById('user-edit-modal').classList.add('hidden');
    },

    async handleSaveUser(e) {
        e.preventDefault();
        const userId = document.getElementById('edit-user-id').value;
        const name = document.getElementById('edit-user-name').value;
        const email = document.getElementById('edit-user-email').value;
        const mobile = document.getElementById('edit-user-mobile').value;
        const job = document.getElementById('edit-user-job').value;
        const roleId = document.getElementById('edit-user-role').value;
        const status = document.getElementById('edit-user-status').value;
        const accessAll = document.getElementById('edit-user-access-all').checked;

        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
            let finalUserId = userId;

            // 1. Handle New User Creation via Auth
            if (!userId) {
                const password = document.getElementById('edit-user-password').value;
                if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");

                const { data: authData, error: authErr } = await this.db.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name,
                            mobile_number: mobile,
                            job_title: job
                        }
                    }
                });
                if (authErr) throw authErr;
                if (!authData.user) throw new Error("Could not create auth user.");
                finalUserId = authData.user.id;
            }

            // 2. Update Profile & Permissions
            const payload = {
                full_name: name,
                email: email,
                mobile_number: mobile,
                job_title: job,
                role_id: roleId || null,
                status: status,
                access_all_business_units: accessAll
            };

            // Capture approval metadata if marking Active
            if (status === 'Active') {
                const { data: current } = await this.db.auth.getUser();
                payload.approved_by = current?.user?.id;
                payload.approved_at = new Date().toISOString();
            }

            // UPSERT profile to ensure all fields (including role/status/access) are correctly set
            const { error: pErr } = await this.db.from('admin_profiles').upsert([{
                id: finalUserId,
                ...payload
            }]);
            if (pErr) throw pErr;

            // 3. Update BU Mappings
            await this.db.from('admin_user_branches').delete().eq('admin_id', finalUserId);

            if (!accessAll) {
                const selected = Array.from(document.querySelectorAll('.edit-bu-chk:checked')).map(c => c.value);
                if (selected.length > 0) {
                    const inserts = selected.map(bId => ({ admin_id: finalUserId, business_unit_id: bId }));
                    const { error: bErr } = await this.db.from('admin_user_branches').insert(inserts);
                    if (bErr) throw bErr;
                }
            }

            this.closeEditModal();
            this.loadUsersDashboard();
            alert(!userId ? "New user account created successfully!" : "User profile updated successfully.");

        } catch (err) {
            console.error(err);
            alert("Action failed: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};
