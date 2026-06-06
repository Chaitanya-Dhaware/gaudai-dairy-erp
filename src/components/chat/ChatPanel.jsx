import { useChatStore } from '../../store/chatStore';
import { Trash2, Minus } from 'lucide-react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import SuggestedActions from './SuggestedActions';

/**
 * ChatPanel — Main chat interface container.
 * Renders header, message area (or suggestions), and input.
 */
export default function ChatPanel() {
  const { messages, closeChat, clearChat } = useChatStore();
  const hasMessages = messages.length > 0;

  return (
    <div className="gaudai-chat-panel" id="gaudai-chat-panel">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="gaudai-chat-header">
        <div className="gaudai-chat-header-info">
          <div className="gaudai-chat-avatar">🐄</div>
          <div className="gaudai-chat-header-text">
            <h3>Gaudai AI</h3>
            <p>Smart Dairy Assistant</p>
          </div>
        </div>

        <div className="gaudai-chat-header-actions">
          {hasMessages && (
            <button
              onClick={clearChat}
              title="Clear chat"
              aria-label="Clear chat history"
            >
              <Trash2 size={15} />
            </button>
          )}
          <button
            onClick={closeChat}
            title="Minimize"
            aria-label="Minimize chat"
          >
            <Minus size={15} />
          </button>
        </div>
      </div>

      {/* ─── Message Area ───────────────────────────────────────── */}
      {hasMessages ? (
        <MessageList />
      ) : (
        <SuggestedActions />
      )}

      {/* ─── Input Area ─────────────────────────────────────────── */}
      <ChatInput />
    </div>
  );
}
