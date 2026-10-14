/**
 * SAUsers.jsx — Super Admin User & Access Management
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { loadAllUsers, createUser, updateUser, resetUserPassword } from '../../utils/superAdminService';
import {
  ConfirmDialog, DataTable, RecordDrawer, SearchBar,
  StatusBadge, SASectionHeader, FormField, Input, Select, exportToCSV
} from '../../components/superadmin/SAComponents';
import { Plus, RefreshCw, Download, Mail, ShieldCheck, Edit2, KeyRound, Ban, UserCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ROLES = ['superadmin', 'admin', 'accountant', 'staff'];

export default function SAUsers() {
  const { user: currentUser } = useAppStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create mode
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', email: '', role: 'staff', active: true });
  const [formErrors, setFormErrors] = useState({});

  const load = async () => {
    setLoading(true);
    const res = await loadAllUsers();
    if (res.success) setUsers(res.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    !search || [u.name, u.email, u.role].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', role: 'staff', active: true });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name || '', email: u.email || '', role: u.role || 'staff', active: u.active !== false });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format';
    if (!form.role) errs.role = 'Role is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setBusy(true);
    try {
      let res;
      if (editing) {
        res = await updateUser(editing.id || editing.uid, { name: form.name, role: form.role, active: form.active }, currentUser.uid, currentUser.role);
      } else {
        res = await createUser({ email: form.email, name: form.name, role: form.role }, currentUser.uid, currentUser.role);
      }
      if (res.success) {
        toast.success(editing ? 'User updated!' : 'User created! Password reset email sent.');
        setDrawerOpen(false);
        load();
      } else {
        toast.error(res.error || 'Operation failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivate = (u) => {
    setConfirm({
      title: u.active !== false ? 'Deactivate User' : 'Reactivate User',
      message: u.active !== false
        ? `${u.name} will lose access immediately upon next login check.`
        : `${u.name} will regain access with their existing role.`,
      danger: u.active !== false,
      confirmText: u.active !== false ? 'Deactivate' : 'Reactivate',
      requireReason: true,
      action: async (reason) => {
        const res = await updateUser(u.id || u.uid, { active: u.active === false, _reason: reason }, currentUser.uid, currentUser.role);
        if (res.success) { toast.success('User status updated!'); load(); }
        else toast.error(res.error || 'Failed');
        setConfirm(null);
      }
    });
  };

  const handlePasswordReset = async (u) => {
    setBusy(true);
    const res = await resetUserPassword(u.email, currentUser.uid, currentUser.role);
    if (res.success) toast.success(`Password reset email sent to ${u.email}`);
    else toast.error(res.error || 'Failed to send reset email');
    setBusy(false);
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (v) => <StatusBadge status={v} /> },
    { key: 'active', label: 'Status', render: (v) => <StatusBadge status={v !== false ? 'Active' : 'Inactive'} /> },
    { key: 'created_at', label: 'Created', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
    {
      key: '_actions', label: 'Actions', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-all" title="Edit">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handlePasswordReset(row)} className="p-1.5 rounded-lg hover:bg-accent/10 hover:text-accent transition-all" title="Send password reset">
            <KeyRound className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeactivate(row)}
            className={`p-1.5 rounded-lg transition-all ${row.active === false ? 'hover:bg-primary/10 hover:text-primary' : 'hover:bg-danger/10 hover:text-danger'}`}
            title={row.active === false ? 'Reactivate' : 'Deactivate'}
          >
            {row.active === false ? <UserCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5">
      <SASectionHeader
        title="User & Access Management"
        subtitle={`${users.length} registered users · ${users.filter(u => u.active !== false).length} active`}
        actions={
          <>
            <button onClick={() => exportToCSV(users, 'users_export.csv')} className="flex items-center gap-1.5 px-3 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold text-textSecondary hover:border-primary/40 hover:text-primary transition-all">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={load} className="p-2 border border-black/[0.08] rounded-xl text-textSecondary hover:text-primary transition-all" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={openCreate} className="cta-pill bg-primary text-white">
              <Plus className="w-3.5 h-3.5" /> New User
            </button>
          </>
        }
      />

      {/* Warning banner */}
      <div className="flex items-start gap-2.5 p-4 bg-accent/5 border border-accent/20 rounded-xl">
        <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
        <p className="text-caption text-textSecondary leading-relaxed">
          Creating a user sends them a password reset email so they set their own password. Role changes take effect on next login. The last active Super Admin cannot be deactivated or demoted.
        </p>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search by name, email, or role..." />

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-black/5 rounded-xl" />)}
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="No users found" />
      )}

      {/* Create / Edit Drawer */}
      <RecordDrawer
        open={drawerOpen}
        title={editing ? `Edit User: ${editing.name}` : 'Create New User'}
        onClose={() => setDrawerOpen(false)}
      >
        <div className="space-y-4">
          <FormField label="Full Name" required error={formErrors.name}>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Shankar Rao" />
          </FormField>
          <FormField label="Email Address" required error={formErrors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="staff@dairy.com"
              disabled={!!editing}
            />
            {editing && <p className="text-micro text-textSecondary mt-1">Email cannot be changed. Use password reset instead.</p>}
          </FormField>
          <FormField label="Role" required error={formErrors.role}>
            <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </Select>
          </FormField>
          {editing && (
            <FormField label="Account Status">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-caption font-medium text-textPrimary">Account Active</span>
                </label>
              </div>
            </FormField>
          )}

          <div className="pt-4 border-t border-black/[0.06] space-y-2">
            {!editing && (
              <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-xl">
                <Mail className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-micro text-textSecondary">A password setup email will be sent to this address automatically.</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setDrawerOpen(false)} className="flex-1 py-2.5 border border-black/[0.08] rounded-xl text-caption font-semibold text-textSecondary hover:bg-black/5 transition-all">
                Cancel
              </button>
              <button onClick={handleSave} disabled={busy} className="flex-1 py-2.5 bg-primary hover:bg-primary-light text-white rounded-xl text-caption font-bold transition-all disabled:opacity-50">
                {busy ? 'Saving...' : (editing ? 'Save Changes' : 'Create User')}
              </button>
            </div>
          </div>
        </div>
      </RecordDrawer>

      {/* Confirm Dialog */}
      {confirm && (
        <ConfirmDialog
          open={true}
          title={confirm.title}
          message={confirm.message}
          danger={confirm.danger}
          confirmText={confirm.confirmText}
          requireReason={confirm.requireReason}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
