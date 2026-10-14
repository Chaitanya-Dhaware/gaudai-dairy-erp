/**
 * SACustomers.jsx — Super Admin Customer Management (full CRUD + search + export)
 */
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { updateCustomerSA, softDeleteCustomer } from '../../utils/superAdminService';
import {
  ConfirmDialog, DataTable, RecordDrawer, SearchBar,
  SASectionHeader, StatusBadge, FormField, Input, Select, exportToCSV
} from '../../components/superadmin/SAComponents';
import { Plus, RefreshCw, Download, Edit2, Trash2, Eye, Store, Phone, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SACustomers() {
  const { user: currentUser, customers, addCustomer, loadAllData } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    business_name: '',
    mobile: '',
    address: '',
    current_due: 0,
    active: true
  });
  const [formErrors, setFormErrors] = useState({});

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search || [c.name, c.customer_id, c.business_name, c.mobile, c.address].some(v => v?.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'dues'
        ? (c.current_due || 0) > 0
        : statusFilter === 'active'
          ? c.active !== false
          : c.active === false;
    return matchSearch && matchStatus;
  });

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || '',
      business_name: c.business_name || '',
      mobile: c.mobile || '',
      address: c.address || '',
      current_due: c.current_due || 0,
      active: c.active !== false
    });
    setFormErrors({});
    setViewing(null);
    setDrawerOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      business_name: '',
      mobile: '',
      address: '',
      current_due: 0,
      active: true
    });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openView = (c) => {
    setViewing(c);
    setEditing(null);
    setDrawerOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Customer name is required';
    if (!form.mobile.trim()) errs.mobile = 'Mobile number is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (editing) {
        const res = await updateCustomerSA(
          editing.customer_id,
          {
            name: form.name.trim(),
            business_name: form.business_name.trim(),
            mobile: form.mobile.trim(),
            address: form.address.trim(),
            current_due: parseFloat(form.current_due) || 0,
            active: form.active
          },
          currentUser.uid,
          currentUser.role
        );
        if (res.success) {
          toast.success('Customer updated successfully!');
          await loadAllData();
          setDrawerOpen(false);
        } else {
          toast.error(res.error || 'Failed to update customer');
        }
      } else {
        const ok = await addCustomer({
          name: form.name.trim(),
          businessName: form.business_name.trim(),
          mobile: form.mobile.trim(),
          address: form.address.trim()
        });
        if (ok) {
          toast.success('Customer registered successfully!');
          await loadAllData();
          setDrawerOpen(false);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (c) => {
    setConfirm({
      title: 'Move Customer to Trash',
      message: `Are you sure you want to delete "${c.name}" (${c.customer_id})? Past invoices and sales records will remain linked, but this customer profile will be moved to Trash.`,
      danger: true,
      confirmText: 'Move to Trash',
      requireReason: true,
      action: async (reason) => {
        setBusy(true);
        const res = await softDeleteCustomer(c.customer_id, reason, currentUser.uid, currentUser.role);
        if (res.success) {
          toast.success('Customer moved to trash');
          await loadAllData();
        } else {
          toast.error(res.error || 'Delete failed');
        }
        setBusy(false);
        setConfirm(null);
      }
    });
  };

  const columns = [
    { key: 'customer_id', label: 'ID', render: (v) => <span className="font-mono text-micro font-bold text-primary">{v || '—'}</span> },
    {
      key: 'name',
      label: 'Customer',
      render: (_, r) => (
        <div>
          <p className="font-semibold text-textPrimary leading-snug">{r.name}</p>
          {r.business_name && (
            <p className="text-micro text-textSecondary flex items-center gap-1 mt-0.5">
              <Store className="w-3 h-3 text-textSecondary/70" />
              {r.business_name}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'mobile',
      label: 'Mobile',
      render: (v) => v ? (
        <span className="font-mono text-micro text-textSecondary flex items-center gap-1">
          <Phone className="w-3 h-3 text-textSecondary/70" />
          {v}
        </span>
      ) : '—'
    },
    {
      key: 'current_due',
      label: 'Current Due',
      render: (v) => (
        <span className={`font-mono font-bold text-caption ${(v || 0) > 0 ? 'text-danger' : 'text-primary'}`}>
          ₹{(v || 0).toLocaleString('en-IN')}
        </span>
      )
    },
    {
      key: 'active',
      label: 'Status',
      render: (v) => <StatusBadge status={v !== false ? 'Active' : 'Inactive'} />
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, r) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => openView(r)}
            className="p-1.5 rounded-lg hover:bg-black/5 text-textSecondary hover:text-textPrimary transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
            title="Edit Customer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(r)}
            className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors"
            title="Delete Customer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <SASectionHeader
        title="Customer Master Control"
        subtitle={`Total registered customers: ${customers.length} · Showing ${filtered.length}`}
        actions={
          <>
            <button
              onClick={() => loadAllData()}
              className="px-3.5 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold hover:bg-black/[0.02] flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-textSecondary" />
              Refresh
            </button>
            <button
              onClick={() => exportToCSV(customers, 'customers-export.csv')}
              className="px-3.5 py-2 border border-black/[0.08] rounded-xl text-caption font-semibold hover:bg-black/[0.02] flex items-center gap-1.5 transition-all"
            >
              <Download className="w-4 h-4 text-textSecondary" />
              Export CSV
            </button>
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-xl text-caption font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          </>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-black/[0.07] shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name, ID, business, mobile..." />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-micro font-semibold uppercase text-textSecondary">Filter:</span>
          {['all', 'active', 'dues', 'inactive'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-micro font-bold capitalize transition-all ${
                statusFilter === f
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-black/[0.04] text-textSecondary hover:text-textPrimary hover:bg-black/[0.07]'
              }`}
            >
              {f === 'dues' ? 'Pending Dues' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl p-4 border border-black/[0.07] shadow-card">
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={openView}
          emptyMessage="No customers found matching your criteria."
        />
      </div>

      {/* Drawer: View or Edit */}
      <RecordDrawer
        open={drawerOpen}
        title={viewing ? 'Customer Details' : (editing ? 'Edit Customer Profile' : 'New Customer Registration')}
        onClose={() => setDrawerOpen(false)}
      >
        {viewing ? (
          <div className="space-y-5">
            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex items-center justify-between">
              <div>
                <h4 className="text-title font-bold text-textPrimary">{viewing.name}</h4>
                <p className="text-caption text-textSecondary mt-0.5 font-mono">{viewing.customer_id}</p>
              </div>
              <StatusBadge status={viewing.active !== false ? 'Active' : 'Inactive'} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background rounded-xl p-3 border border-black/[0.05]">
                <p className="label">Business Name</p>
                <p className="text-caption font-semibold mt-1">{viewing.business_name || '—'}</p>
              </div>
              <div className="bg-background rounded-xl p-3 border border-black/[0.05]">
                <p className="label">Contact Mobile</p>
                <p className="text-caption font-semibold font-mono mt-1">{viewing.mobile || '—'}</p>
              </div>
              <div className="col-span-2 bg-background rounded-xl p-3 border border-black/[0.05]">
                <p className="label">Address</p>
                <p className="text-caption font-medium mt-1">{viewing.address || '—'}</p>
              </div>
              <div className="col-span-2 bg-danger/5 rounded-xl p-4 border border-danger/10 flex items-center justify-between">
                <div>
                  <p className="label text-danger">Outstanding Balance</p>
                  <p className="stat-number text-danger mt-1">₹{(viewing.current_due || 0).toLocaleString('en-IN')}</p>
                </div>
                <button
                  onClick={() => openEdit(viewing)}
                  className="px-4 py-2 bg-white border border-danger/20 text-danger hover:bg-danger/10 text-caption font-bold rounded-xl transition-all"
                >
                  Adjust Balance
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-black/[0.07]">
              <button
                onClick={() => openEdit(viewing)}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-caption font-bold hover:bg-primary-light transition-all flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </button>
              <button
                onClick={() => { setDrawerOpen(false); handleDelete(viewing); }}
                className="px-4 py-2.5 bg-danger/10 text-danger rounded-xl text-caption font-bold hover:bg-danger/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FormField label="Customer Full Name" required error={formErrors.name}>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ramesh Kulkarni"
              />
            </FormField>

            <FormField label="Business / Hotel / Store Name">
              <Input
                value={form.business_name}
                onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                placeholder="e.g. Shri Krishna Dairy & Sweets"
              />
            </FormField>

            <FormField label="Mobile Number" required error={formErrors.mobile}>
              <Input
                type="tel"
                value={form.mobile}
                onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                placeholder="10-digit mobile number"
              />
            </FormField>

            <FormField label="Address / Delivery Location">
              <Input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Shop number, street, landmark"
              />
            </FormField>

            {editing && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/[0.07]">
                <FormField label="Current Due (₹)">
                  <Input
                    type="number"
                    value={form.current_due}
                    onChange={e => setForm(f => ({ ...f, current_due: e.target.value }))}
                  />
                </FormField>
                <FormField label="Status">
                  <Select
                    value={form.active ? 'active' : 'inactive'}
                    onChange={e => setForm(f => ({ ...f, active: e.target.value === 'active' }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </FormField>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-black/[0.07]">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2.5 text-caption font-semibold text-textSecondary hover:bg-black/5 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                className="px-6 py-2.5 bg-primary text-white rounded-xl text-caption font-bold hover:bg-primary-light transition-all disabled:opacity-50"
              >
                {busy ? 'Saving...' : (editing ? 'Update Customer' : 'Create Customer')}
              </button>
            </div>
          </div>
        )}
      </RecordDrawer>

      {/* Confirm Dialog */}
      {confirm && (
        <ConfirmDialog
          open={!!confirm}
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
