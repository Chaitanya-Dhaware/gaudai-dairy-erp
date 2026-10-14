/**
 * SAFarmers.jsx — Super Admin Farmer Management (full CRUD + search + export)
 */
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { updateFarmer, softDeleteFarmer } from '../../utils/superAdminService';
import { invalidateCache } from '../../utils/cache';
import {
  ConfirmDialog, DataTable, RecordDrawer, SearchBar,
  SASectionHeader, StatusBadge, FormField, Input, Select, exportToCSV
} from '../../components/superadmin/SAComponents';
import { Plus, RefreshCw, Download, Edit2, Trash2, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MILK_TYPES = ['Cow', 'Buffalo', 'Mixed'];

export default function SAFarmers() {
  const { user: currentUser, farmers, registerFarmer, deleteFarmer, loadAllData } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', address: '', milk_type: 'Cow', current_due: 0, active: true });
  const [formErrors, setFormErrors] = useState({});

  const filtered = farmers.filter(f => {
    const matchSearch = !search || [f.name, f.farmer_id, f.mobile, f.address].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? f.active !== false : f.active === false);
    return matchSearch && matchStatus;
  });

  const openEdit = (f) => {
    setEditing(f);
    setForm({ name: f.name || '', mobile: f.mobile || '', address: f.address || '', milk_type: f.milk_type || 'Cow', current_due: f.current_due || 0, active: f.active !== false });
    setFormErrors({});
    setViewing(null);
    setDrawerOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', mobile: '', address: '', milk_type: 'Cow', current_due: 0, active: true });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openView = (f) => { setViewing(f); setEditing(null); setDrawerOpen(true); };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (editing) {
        const { active: _active, current_due: _due, ...safeUpdates } = form;
        const res = await updateFarmer(editing.farmer_id, { ...safeUpdates, active: form.active }, currentUser.uid, currentUser.role);
        if (res.success) {
          toast.success('Farmer updated!');
          await loadAllData();
          setDrawerOpen(false);
        } else {
          toast.error(res.error || 'Update failed');
        }
      } else {
        const ok = await registerFarmer(form);
        if (ok) setDrawerOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (f) => {
    setConfirm({
      title: 'Delete Farmer',
      message: `This will move "${f.name}" (${f.farmer_id}) to the trash. All associated collection records will remain but the farmer profile will be hidden.`,
      danger: true,
      confirmText: 'Move to Trash',
      requireReason: true,
      action: async (reason) => {
        setBusy(true);
        const res = await softDeleteFarmer(f.farmer_id, reason, currentUser.uid, currentUser.role);
        if (res.success) {
          toast.success('Farmer moved to trash!');
          await loadAllData();
        } else {
          toast.error(res.error || 'Delete failed');
        }
        setBusy(false);
        setConfirm(null);
      }
    });
  };

  const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const columns = [
    { key: 'farmer_id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'milk_type', label: 'Type' },
    { key: 'current_due', label: 'Due', render: (v) => <span className={parseFloat(v) > 0 ? 'text-danger font-bold' : 'text-primary font-bold'}>{fmt(v)}</span> },
    { key: 'active', label: 'Status', render: (v) => <StatusBadge status={v !== false ? 'Active' : 'Inactive'} /> },
    {
      key: '_actions', label: 'Actions', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => openView(row)} className="p-1.5 rounded-lg hover:bg-black/5 transition-all" title="View"><Eye className="w-3.5 h-3.5 text-textSecondary" /></button>
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-all" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => handleDelete(row)} className="p-1.5 rounded-lg hover:bg-danger/10 hover:text-danger transition-all" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5">
      <SASectionHeader
        title="Farmer Management"
        subtitle={`${farmers.length} total · ${farmers.filter(f => f.active !== false).length} active`}
        actions={
          <>
            <button onClick={() => exportToCSV(farmers, 'farmers_export.csv')} className="flex items-center gap-1.5 px-3 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold text-textSecondary hover:border-primary/40 hover:text-primary transition-all">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button onClick={openCreate} className="cta-pill bg-primary text-white"><Plus className="w-3.5 h-3.5" /> Add Farmer</button>
          </>
        }
      />

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]"><SearchBar value={search} onChange={setSearch} placeholder="Search by name, ID, mobile..." /></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-black/[0.08] rounded-xl px-3 py-2 text-caption text-textSecondary focus:outline-none focus:border-primary">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <DataTable columns={columns} data={filtered} onRowClick={openView} emptyMessage="No farmers found" />

      {/* View drawer */}
      <RecordDrawer open={drawerOpen && !!viewing && !editing} title={`Farmer: ${viewing?.name}`} onClose={() => { setDrawerOpen(false); setViewing(null); }}>
        {viewing && (
          <div className="space-y-4">
            {[
              ['Farmer ID', viewing.farmer_id],
              ['Name', viewing.name],
              ['Mobile', viewing.mobile || '—'],
              ['Address', viewing.address || '—'],
              ['Milk Type', viewing.milk_type || '—'],
              ['Current Due', fmt(viewing.current_due)],
              ['Status', viewing.active !== false ? 'Active' : 'Inactive'],
              ['Registered', viewing.created_at ? new Date(viewing.created_at).toLocaleDateString() : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-start border-b border-black/[0.05] pb-3 last:border-0">
                <span className="label">{label}</span>
                <span className="text-caption font-semibold text-textPrimary text-right max-w-[60%]">{value}</span>
              </div>
            ))}
            <button onClick={() => openEdit(viewing)} className="w-full py-2.5 bg-primary hover:bg-primary-light text-white rounded-xl text-caption font-bold transition-all">
              Edit this Farmer
            </button>
          </div>
        )}
      </RecordDrawer>

      {/* Edit/Create drawer */}
      <RecordDrawer open={drawerOpen && (!!editing || (!editing && !viewing))} title={editing ? `Edit: ${editing?.name}` : 'Register New Farmer'} onClose={() => setDrawerOpen(false)}>
        <div className="space-y-4">
          <FormField label="Full Name" required error={formErrors.name}>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ramesh Patil" />
          </FormField>
          <FormField label="Mobile Number">
            <Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="e.g. 9876543210" type="tel" />
          </FormField>
          <FormField label="Village / Address">
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g. Hingoli, Maharashtra" />
          </FormField>
          <FormField label="Milk Type">
            <Select value={form.milk_type} onChange={e => setForm(f => ({ ...f, milk_type: e.target.value }))}>
              {MILK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </FormField>
          {editing && (
            <FormField label="Account Status">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-primary" />
                <span className="text-caption font-medium">Active</span>
              </label>
            </FormField>
          )}
          <div className="flex gap-3 pt-4 border-t border-black/[0.06]">
            <button onClick={() => setDrawerOpen(false)} className="flex-1 py-2.5 border border-black/[0.08] rounded-xl text-caption font-semibold text-textSecondary hover:bg-black/5 transition-all">Cancel</button>
            <button onClick={handleSave} disabled={busy} className="flex-1 py-2.5 bg-primary hover:bg-primary-light text-white rounded-xl text-caption font-bold transition-all disabled:opacity-50">
              {busy ? 'Saving...' : (editing ? 'Save Changes' : 'Register Farmer')}
            </button>
          </div>
        </div>
      </RecordDrawer>

      {confirm && (
        <ConfirmDialog open={true} title={confirm.title} message={confirm.message} danger={confirm.danger} confirmText={confirm.confirmText} requireReason={confirm.requireReason} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}
