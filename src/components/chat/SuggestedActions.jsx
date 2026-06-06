import { useChatStore } from '../../store/chatStore';

const SUGGESTIONS = [
  { icon: '📸', label: 'Scan Collection Sheet', prompt: 'I want to scan a handwritten collection sheet' },
  { icon: '🥛', label: 'Add Collection', prompt: 'Add milk collection entry' },
  { icon: '📊', label: "Today's Summary", prompt: "Show today's collection summary" },
  { icon: '💰', label: 'Pending Dues', prompt: 'Which farmers and customers have pending dues?' },
  { icon: '📋', label: 'Daily Report', prompt: 'Generate daily collection report' },
  { icon: '➕', label: 'Add Expense', prompt: 'Add a new expense' },
  { icon: '🧾', label: 'Sales Report', prompt: 'Show daily sales report' },
  { icon: '📈', label: 'Profit & Loss', prompt: 'Generate profit and loss report' }
];

export default function SuggestedActions() {
  const { triggerSuggestion } = useChatStore();

  return (
    <div className="gaudai-suggestions">
      <div className="gaudai-suggestions-welcome">
        <div className="icon">🐄</div>
        <h4>Gaudai AI Assistant</h4>
        <p>
          Your smart dairy business partner. Ask me anything or pick a quick action below.
        </p>
      </div>

      <div className="gaudai-suggestions-grid">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            className="gaudai-suggestion-chip"
            onClick={() => triggerSuggestion(s.prompt)}
          >
            <span className="chip-icon">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
