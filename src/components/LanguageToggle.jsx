import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const isMarathi = i18n.language === 'mr';

  const toggle = () => {
    const next = isMarathi ? 'en' : 'mr';
    i18n.changeLanguage(next);
    document.documentElement.className = `lang-${next}`;
    document.documentElement.lang = next;
  };

  return (
    <button 
      onClick={toggle} 
      className="flex items-center space-x-1.5 px-3 py-1.5 border border-primary/10 hover:border-primary/30 text-primary text-sm font-medium rounded-full bg-primary/5 hover:bg-primary/10 transition-all duration-200"
      style={{ fontFamily: isMarathi ? 'Noto Sans Devanagari, sans-serif' : 'DM Sans, sans-serif' }}
      title={isMarathi ? 'Switch to English' : 'मराठीमध्ये बदला'}
      id="language-toggle-btn"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-primary">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9s2.015-9 4.5-9m0 0a9.003 9.003 0 0 1 8.716 6.747M12 3a9.003 9.003 0 0 0-8.716 6.747M3 9h18M3 15h18" />
      </svg>
      <span>{isMarathi ? 'English' : 'मराठी'}</span>
    </button>
  );
}
export default LanguageToggle;
