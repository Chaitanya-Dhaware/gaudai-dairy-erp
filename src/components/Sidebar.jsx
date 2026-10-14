import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { LanguageToggle } from './LanguageToggle';
import gaudaiLogo from '../assets/gaudai-logo.png';
import { 
  Home, 
  Droplet, 
  Users, 
  Receipt, 
  PieChart, 
  Settings, 
  LogOut,
  ShieldCheck
} from 'lucide-react';

export function Sidebar() {
  const { t } = useTranslation();
  const { activeWorkspace, setWorkspace, user, logout } = useAppStore();

  const navigation = [
    { id: 'dashboard', name: t('nav.collection').split(' ')[0] === 'संकलन' ? 'डॅशबोर्ड' : 'Dashboard', icon: Home },
    { id: 'collection', name: t('nav.collection'), icon: Droplet },
    { id: 'customers', name: t('nav.customers'), icon: Users },
    { id: 'expenses', name: t('nav.expenses'), icon: Receipt },
    { id: 'accounts', name: t('nav.accounts'), icon: PieChart },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="hidden lg:flex flex-col w-60 h-screen bg-white border-r border-black/[0.08] fixed left-0 top-0 z-30">
      {/* Brand Header */}
      <div className="flex items-center justify-center px-5 py-4 border-b border-black/[0.08]">
        <div className="w-24 flex-shrink-0">
          <img src={gaudaiLogo} alt="गौदाई" className="w-full h-auto object-contain" />
        </div>
      </div>

      {/* User Status Bar */}
      {user && (
        <div className="px-5 py-3 border-b border-black/[0.05] bg-primary/5 flex items-center justify-between gap-2">
          <div className="overflow-hidden">
            <p className="text-caption font-semibold text-primary truncate">{user.name}</p>
            <p className="text-micro text-textSecondary capitalize mt-0.5">{user.role}</p>
          </div>
          <LanguageToggle />
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeWorkspace === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setWorkspace(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-caption transition-all ${
                isActive 
                  ? 'bg-primary/10 text-primary font-semibold border-l-[3px] border-primary pl-3' 
                  : 'font-medium text-textSecondary hover:bg-black/[0.03] hover:text-textPrimary'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-textSecondary'}`} />
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}

        {(user?.role === 'superadmin' || user?.role === 'admin') && (
          <div className="pt-2">
            <button
              onClick={() => setWorkspace('superadmin')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-caption transition-all ${
                activeWorkspace === 'superadmin' 
                  ? 'bg-primary/10 text-primary font-bold border-l-[3px] border-primary pl-3' 
                  : 'font-semibold text-textPrimary hover:bg-black/[0.03]'
              }`}
            >
              <ShieldCheck className={`w-4.5 h-4.5 flex-shrink-0 ${activeWorkspace === 'superadmin' ? 'text-primary' : 'text-primary'}`} />
              <span className="truncate">Super Admin</span>
              <span className="ml-auto text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                PRO
              </span>
            </button>
          </div>
        )}
      </nav>

      {/* Footer Controls */}
      <div className="p-4 border-t border-black/[0.08] space-y-1">
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <button
            onClick={() => setWorkspace('settings')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-caption transition-all ${
              activeWorkspace === 'settings' 
                ? 'bg-primary/10 text-primary font-semibold border-l-[3px] border-primary pl-3' 
                : 'font-medium text-textSecondary hover:bg-black/[0.03] hover:text-textPrimary'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>{t('nav.settings')}</span>
          </button>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium text-danger hover:bg-danger/5 transition-all"
        >
          <LogOut className="w-5 h-5 text-danger" />
          <span>{t('nav.logout')}</span>
        </button>
      </div>
    </aside>
  );
}
export default Sidebar;
