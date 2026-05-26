import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { LanguageToggle } from './LanguageToggle';
import { 
  Home, 
  Droplet, 
  Users, 
  Receipt, 
  PieChart, 
  Settings, 
  LogOut 
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
      <div className="flex items-center space-x-3 px-5 py-5 border-b border-black/[0.08]">
        <div className="w-28 flex-shrink-0">
          <img src="/src/assets/gaudai-logo.png" alt="गौदाई" className="w-full h-auto object-contain" />
        </div>
      </div>

      {/* User Status Bar */}
      {user && (
        <div className="px-6 py-3 border-b border-black/[0.04] bg-primary/5 flex items-center justify-between">
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-primary truncate">{user.name}</p>
            <p className="text-[10px] text-textSecondary capitalize">{user.role}</p>
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
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-primary/10 text-primary border-l-4 border-primary pl-3' 
                  : 'text-textSecondary hover:bg-black/[0.02] hover:text-textPrimary'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-textSecondary'}`} />
              <span className="truncate">{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Controls */}
      <div className="p-4 border-t border-black/[0.08] space-y-1">
        {user?.role === 'admin' && (
          <button
            onClick={() => setWorkspace('settings')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              activeWorkspace === 'settings' 
                ? 'bg-primary/10 text-primary border-l-4 border-primary pl-3' 
                : 'text-textSecondary hover:bg-black/[0.02] hover:text-textPrimary'
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
