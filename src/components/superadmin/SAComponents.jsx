/**
 * Shared Super Admin UI Components
 * ConfirmDialog, DataTable, RecordDrawer, StatusBadge, SearchBar, ActionMenu
 */
import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, ChevronUp, ChevronDown, ChevronsUpDown, Search, MoreVertical, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

// ─── CONFIRM DIALOG ────────────────────────────────────────────────────────

export function ConfirmDialog({ open, title, message, confirmText = 'Confirm', danger = false, requireReason = false, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setReason(''); setBusy(false); } }, [open]);
  if (!open) return null;

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) return;
    setBusy(true);
    await onConfirm(reason);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-elevated w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-danger/10' : 'bg-accent/10'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-danger' : 'text-accent'}`} />
          </div>
          <div>
            <h3 className="text-subtitle font-bold text-textPrimary">{title}</h3>
            <p className="text-caption text-textSecondary mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        {requireReason && (
          <div>
            <label className="label mb-1.5 block">Reason (required)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Briefly describe why this action is being taken..."
              rows={3}
              className="w-full border border-black/10 rounded-xl px-3 py-2 text-caption resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onCancel} className="px-4 py-2 text-caption font-semibold text-textSecondary hover:bg-black/5 rounded-xl transition-all">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || (requireReason && !reason.trim())}
            className={`px-5 py-2 text-caption font-bold text-white rounded-xl transition-all disabled:opacity-50 ${danger ? 'bg-danger hover:bg-danger-light' : 'bg-primary hover:bg-primary-light'}`}
          >
            {busy ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SEARCH BAR ───────────────────────────────────────────────────────────

export function SearchBar({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 border border-black/[0.08] rounded-xl text-caption bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────

export function StatusBadge({ status }) {
  const map = {
    Paid: { icon: CheckCircle, cls: 'bg-primary/10 text-primary' },
    Active: { icon: CheckCircle, cls: 'bg-primary/10 text-primary' },
    Partial: { icon: AlertCircle, cls: 'bg-accent/10 text-accent' },
    Pending: { icon: Clock, cls: 'bg-black/10 text-textSecondary' },
    Inactive: { icon: XCircle, cls: 'bg-danger/10 text-danger' },
    superadmin: { icon: CheckCircle, cls: 'bg-primary/10 text-primary' },
    admin: { icon: CheckCircle, cls: 'bg-accent/10 text-accent' },
    staff: { icon: CheckCircle, cls: 'bg-black/10 text-textSecondary' },
    accountant: { icon: CheckCircle, cls: 'bg-primary/5 text-primary' },
  };
  const { icon: Icon, cls } = map[status] || { icon: AlertCircle, cls: 'bg-black/10 text-textSecondary' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-micro font-semibold ${cls}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

// ─── DATA TABLE ───────────────────────────────────────────────────────────

export function DataTable({ columns, data, onRowClick, emptyMessage = 'No records found', pageSize = 30 }) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [page, setPage] = useState(1);

  const sorted = [...data].sort((a, b) => {
    if (!sort.key) return 0;
    const va = a[sort.key] ?? '';
    const vb = b[sort.key] ?? '';
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key) => {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    setPage(1);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-black/[0.07]">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-background border-b border-black/[0.06]">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}
                  className={`px-4 py-3 text-left label whitespace-nowrap select-none ${col.sortable !== false ? 'cursor-pointer hover:text-primary' : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && (
                      sort.key === col.key
                        ? (sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                        : <ChevronsUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-caption text-textSecondary">{emptyMessage}</td></tr>
            ) : paged.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick && onRowClick(row)}
                className={`group transition-colors ${onRowClick ? 'cursor-pointer hover:bg-primary/[0.02]' : ''}`}
              >
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-caption">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-micro text-textSecondary">{sorted.length} records · Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-micro font-semibold border border-black/[0.08] rounded-lg disabled:opacity-40 hover:border-primary/40 transition-all">Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-micro font-semibold border border-black/[0.08] rounded-lg disabled:opacity-40 hover:border-primary/40 transition-all">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RECORD DRAWER ────────────────────────────────────────────────────────

export function RecordDrawer({ open, title, onClose, children }) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (open) {
      const handler = (e) => { if (!drawerRef.current?.contains(e.target)) onClose(); };
      setTimeout(() => document.addEventListener('mousedown', handler), 0);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/30 backdrop-blur-[2px]">
      <div ref={drawerRef} className="w-full max-w-xl bg-white h-full flex flex-col shadow-elevated overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.07]">
          <h3 className="text-subtitle font-bold text-primary">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 transition-all">
            <X className="w-5 h-5 text-textSecondary" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── FORM FIELD ───────────────────────────────────────────────────────────

export function FormField({ label, required, children, error }) {
  return (
    <div className="space-y-1.5">
      <label className="label">
        {label} {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-micro text-danger mt-1">{error}</p>}
    </div>
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full border border-black/[0.08] rounded-xl px-3 py-2.5 text-caption bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full border border-black/[0.08] rounded-xl px-3 py-2.5 text-caption bg-white focus:outline-none focus:border-primary transition-all ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full border border-black/[0.08] rounded-xl px-3 py-2.5 text-caption bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none ${className}`}
      {...props}
    />
  );
}

// ─── SA SECTION HEADER ────────────────────────────────────────────────────

export function SASectionHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h2 className="text-title font-bold text-textPrimary">{title}</h2>
        {subtitle && <p className="text-caption text-textSecondary mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────

export function StatCard({ label, value, icon: Icon, color = 'text-primary', bg = 'bg-primary/10', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-card border border-black/[0.07] shadow-card p-5 flex items-start gap-3.5 ${onClick ? 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all' : ''}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg} ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="label mb-1">{label}</p>
        <p className="stat-number text-textPrimary truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── EXPORT TO CSV ────────────────────────────────────────────────────────

export function exportToCSV(data, filename) {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const header = keys.join(',');
  const rows = data.map(row =>
    keys.map(k => {
      const v = row[k] ?? '';
      const str = String(v).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'export.csv';
  a.click();
  URL.revokeObjectURL(url);
}
