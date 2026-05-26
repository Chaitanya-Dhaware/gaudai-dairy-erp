import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { 
  Home, 
  Droplet, 
  Users, 
  Receipt, 
  PieChart 
} from 'lucide-react';

export function BottomBar() {
  const { t } = useTranslation();
  const { activeWorkspace, setWorkspace } = useAppStore();

  const navigation = [
    { id: 'dashboard', name: t('nav.collection').split(' ')[0] === 'संकलन' ? 'डॅशबोर्ड' : 'Home', icon: Home },
    { id: 'collection', name: t('nav.collection').split(' ')[0] === 'संकलन' ? 'संकलन' : 'Col', icon: Droplet },
    { id: 'customers', name: t('nav.customers').split(' ')[0] === 'संकलन' ? 'ग्राहक' : 'Cust', icon: Users },
    { id: 'expenses', name: t('nav.expenses').split(' ')[0] === 'संकलन' ? 'खर्च' : 'Exp', icon: Receipt },
    { id: 'accounts', name: t('nav.accounts').split(' ')[0] === 'संकलन' ? 'हिशोब' : 'Acc', icon: PieChart },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-black/[0.08] flex items-center justify-around px-2 pb-safe z-30">
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = activeWorkspace === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setWorkspace(item.id)}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center space-y-1 transition-all ${
              isActive ? 'text-primary' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            <Icon className={`w-5.5 h-5.5 ${isActive ? 'text-primary' : 'text-textSecondary'}`} />
            <span className="text-[10px] font-medium leading-none tracking-tight truncate max-w-[64px]">
              {item.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
export default BottomBar;
