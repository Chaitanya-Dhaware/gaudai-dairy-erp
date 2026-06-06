import { useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import { MessageCircle, X } from 'lucide-react';
import ChatPanel from './ChatPanel';
import './GaudaiChat.css';

/**
 * GaudaiChat — Root floating chat widget component.
 * Renders the FAB (floating action button) and expandable chat panel.
 * 
 * Positioned fixed at bottom-right on desktop, with full-screen on mobile.
 * Should be rendered globally in App.jsx outside the Layout.
 */
export default function GaudaiChat() {
  const { isOpen, toggleChat, hasUnread } = useChatStore();

  useEffect(() => {
    console.log('GaudaiChat component mounted successfully. isOpen:', isOpen);
  }, [isOpen]);

  return (
    <>
      {/* Chat Panel */}
      {isOpen && <ChatPanel />}

      {/* Floating Action Button */}
      <button
        className={`gaudai-fab ${isOpen ? 'is-open' : ''}`}
        onClick={toggleChat}
        aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
        id="gaudai-ai-fab"
        style={{ border: '2px solid red' }} // temporary border to debug visibility
      >
        {isOpen ? (
          <X size={28} strokeWidth={2.5} />
        ) : (
          <MessageCircle size={28} strokeWidth={2} />
        )}

        {/* Unread badge */}
        {!isOpen && hasUnread && (
          <div className="gaudai-fab-badge" />
        )}
      </button>
    </>
  );
}
