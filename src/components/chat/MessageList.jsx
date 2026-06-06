import { useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import DataPreviewCard from './DataPreviewCard';
import ReportCard from './ReportCard';

/**
 * MessageList — Renders conversation messages with auto-scroll.
 * Handles different message types: text, action, report, OCR, success, error.
 */
export default function MessageList() {
  const { messages, isProcessing, pendingAction } = useChatStore();
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  return (
    <div className="gaudai-messages">
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Show pending action card */}
      {pendingAction && !isProcessing && (
        <div className="gaudai-msg assistant" style={{ maxWidth: '95%' }}>
          <div className="gaudai-msg-avatar">🐄</div>
          <div style={{ flex: 1 }}>
            <DataPreviewCard action={pendingAction} />
          </div>
        </div>
      )}

      {/* Typing indicator */}
      {isProcessing && (
        <div className="gaudai-typing">
          <div className="gaudai-typing-avatar">🐄</div>
          <div className="gaudai-typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

/**
 * Individual message bubble component.
 */
function MessageBubble({ message }) {
  const { role, content, type, imageUrl } = message;
  const isUser = role === 'user';

  const timeStr = new Date(message.timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Determine bubble CSS class based on message type
  const bubbleClass = type === 'success' ? 'success' : type === 'error' ? 'error' : '';

  return (
    <div className={`gaudai-msg ${isUser ? 'user' : 'assistant'}`}>
      <div className="gaudai-msg-avatar">
        {isUser ? '👤' : '🐄'}
      </div>
      <div>
        {/* Image preview for uploaded images */}
        {imageUrl && (
          <img src={imageUrl} alt="Upload" className="gaudai-msg-image" />
        )}

        {/* Report type: render with ReportCard */}
        {type === 'report' && !isUser ? (
          <ReportCard content={content} />
        ) : (
          <div className={`gaudai-msg-bubble ${bubbleClass}`}>
            <MessageContent text={content} />
          </div>
        )}

        <div className="gaudai-msg-time">{timeStr}</div>
      </div>
    </div>
  );
}

/**
 * Simple markdown-like text renderer.
 * Handles **bold**, line breaks, and basic formatting.
 */
function MessageContent({ text }) {
  if (!text) return null;

  // Split by line breaks
  const lines = text.split('\n');

  return (
    <>
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;

        // Parse inline bold (**text**)
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={i} style={{ margin: '0 0 2px' }}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j}>{part.slice(2, -2)}</strong>;
              }
              return <span key={j}>{part}</span>;
            })}
          </p>
        );
      })}
    </>
  );
}
