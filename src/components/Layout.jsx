import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import Sidebar from './Sidebar';
import BottomBar from './BottomBar';
import LanguageToggle from './LanguageToggle';
import { Settings, LogOut, User } from 'lucide-react';
import toast from 'react-hot-toast';

export function Layout({ children }) {
  const { t } = useTranslation();
  const { activeWorkspace, setWorkspace, user, setUser } = useAppStore();

  const getWorkspaceTitle = () => {
    switch (activeWorkspace) {
      case 'dashboard':
        return t('app.name');
      case 'collection':
        return t('nav.collection');
      case 'customers':
        return t('nav.customers');
      case 'expenses':
        return t('nav.expenses');
      case 'accounts':
        return t('nav.accounts');
      case 'settings':
        return t('nav.settings');
      default:
        return '';
    }
  };

  const handleLogout = () => {
    setUser(null);
    toast.success('लॉगआउट यशस्वी / Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-background text-textPrimary flex">
      {/* Sidebar Navigation - Desktop */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:pl-60 pb-16 lg:pb-0 min-h-screen">
        
        {/* Header Bar */}
        <header className="h-16 bg-white border-b border-black/[0.08] flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
          {/* Left Title */}
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold text-primary font-head tracking-tight">
              {getWorkspaceTitle()}
            </h2>
            {activeWorkspace === 'dashboard' && (
              <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent border border-accent/20 bg-accent/5 rounded-full font-body uppercase">
                {t('app.tagline')}
              </span>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-4">
            {/* Global Language Toggle */}
            <LanguageToggle />

            {/* Quick Profile / Settings for Mobile */}
            {user && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs border border-primary/20">
                  <User className="w-4 h-4" />
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-textPrimary leading-none">{user.name}</p>
                  <p className="text-[10px] text-textSecondary capitalize mt-0.5">{user.role}</p>
                </div>
                
                {/* Mobile settings / logout icons */}
                <div className="lg:hidden flex items-center space-x-1">
                  {user.role === 'admin' && (
                    <button 
                      onClick={() => setWorkspace('settings')} 
                      className={`p-1.5 rounded-lg text-textSecondary hover:bg-black/[0.04] ${activeWorkspace === 'settings' ? 'text-primary bg-primary/10' : ''}`}
                    >
                      <Settings className="w-4.5 h-4.5" />
                    </button>
                  )}
                  <button 
                    onClick={handleLogout} 
                    className="p-1.5 rounded-lg text-danger hover:bg-danger/5"
                  >
                    <LogOut className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Bottom Navigation - Mobile */}
      <BottomBar />
    </div>
  );
}
export default Layout;
