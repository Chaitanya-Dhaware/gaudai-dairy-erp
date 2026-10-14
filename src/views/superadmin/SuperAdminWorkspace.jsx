/**
 * SuperAdminWorkspace.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Control Center for Gaudai Dairy ERP Super Admin.
 * Seamless tab navigation across all 10 management modules,
 * live audit logging, security gating, and comprehensive oversight.
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import SADashboard from './SADashboard';
import SAUsers from './SAUsers';
import SAFarmers from './SAFarmers';
import SACollections from './SACollections';
import SACustomers from './SACustomers';
import SASales from './SASales';
import SAExpenses from './SAExpenses';
import SADatabase from './SADatabase';
import SASync from './SASync';
import SAAuditLog from './SAAuditLog';
import SASettings from './SASettings';
import {
  ShieldAlert, ShieldCheck, LayoutDashboard, Users, Droplet,
  Store, Receipt, Database, CloudSync, Activity, Settings, AlertOctagon
} from 'lucide-react';

const TABS = [
  { id: 'sa-dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'sa-users', label: 'Users & Access', icon: ShieldCheck },
  { id: 'sa-farmers', label: 'Farmers', icon: Droplet },
  { id: 'sa-collections', label: 'Collections', icon: Droplet },
  { id: 'sa-customers', label: 'Customers', icon: Store },
  { id: 'sa-sales', label: 'Sales & Invoices', icon: Receipt },
  { id: 'sa-expenses', label: 'Expenses', icon: Receipt },
  { id: 'sa-database', label: 'DB & Trash', icon: Database },
  { id: 'sa-sync', label: 'Sync Health', icon: CloudSync },
  { id: 'sa-audit', label: 'Audit Trail', icon: Activity },
  { id: 'sa-settings', label: 'Settings', icon: Settings },
];

export default function SuperAdminWorkspace() {
  const { user, activeTab, setTab } = useAppStore();
  const [currentTab, setCurrentTab] = useState(activeTab?.startsWith('sa-') ? activeTab : 'sa-dashboard');

  useEffect(() => {
    if (activeTab?.startsWith('sa-')) {
      setCurrentTab(activeTab);
    }
  }, [activeTab]);

  const handleNavigate = (tabId) => {
    setCurrentTab(tabId);
    setTab(tabId);
  };

  // Security Gate
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  if (!isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 text-danger flex items-center justify-center">
          <AlertOctagon className="w-8 h-8" />
        </div>
        <h2 className="text-title font-bold text-textPrimary">Access Restricted</h2>
        <p className="text-caption text-textSecondary max-w-md">
          The Super Admin Control Center requires elevated administrative privileges.
          Your current account role is <span className="font-semibold text-danger">{user?.role || 'unassigned'}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Super Admin Identity Banner */}
      <div className="bg-gradient-to-r from-primary to-primary-light rounded-2xl p-5 text-white shadow-elevated flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center flex-shrink-0 border border-white/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-subtitle font-bold tracking-tight">Super Admin Control Center</h1>
              <span className="px-2.5 py-0.5 rounded-pill text-micro font-bold bg-white/20 text-white uppercase tracking-wider backdrop-blur-xs">
                {user?.role === 'superadmin' ? 'Root Access' : 'Admin'}
              </span>
            </div>
            <p className="text-caption text-white/80 mt-0.5">
              Full CRUD management, audit logs, soft-delete restoration, and operational configurations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-black/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 text-micro">
          <span className="text-white/70">Session:</span>
          <span className="font-semibold text-white truncate max-w-[150px]">{user?.email || user?.name}</span>
        </div>
      </div>

      {/* Navigation Pills Bar */}
      <div className="bg-white rounded-2xl p-1.5 border border-black/[0.08] shadow-sm flex items-center gap-1 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleNavigate(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-caption font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-black/[0.04]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-textSecondary'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="min-h-[500px]">
        {currentTab === 'sa-dashboard' && <SADashboard onNavigate={handleNavigate} />}
        {currentTab === 'sa-users' && <SAUsers />}
        {currentTab === 'sa-farmers' && <SAFarmers />}
        {currentTab === 'sa-collections' && <SACollections />}
        {currentTab === 'sa-customers' && <SACustomers />}
        {currentTab === 'sa-sales' && <SASales />}
        {currentTab === 'sa-expenses' && <SAExpenses />}
        {currentTab === 'sa-database' && <SADatabase />}
        {currentTab === 'sa-sync' && <SASync />}
        {currentTab === 'sa-audit' && <SAAuditLog />}
        {currentTab === 'sa-settings' && <SASettings />}
      </div>
    </div>
  );
}
