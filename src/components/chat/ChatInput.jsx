import { useState, useRef, useCallback } from 'react';
import { useChatStore } from '../../store/chatStore';
import { Send, Image, Mic, MicOff, X } from 'lucide-react';

/**
 * ChatInput — Message input with file upload, voice input, and send functionality.
 */
export default function ChatInput() {
  const { sendMessage, sendImage, isProcessing } = useChatStore();
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // ─── Text Input Handling ──────────────────────────────────────

  const handleTextChange = (e) => {
    setText(e.target.value);
    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── File Upload ──────────────────────────────────────────────

  const clearFile = useCallback(() => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [filePreview]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowed = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    const ext = file.name.split('.').pop().toLowerCase();
    const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'xlsx', 'xls', 'csv'].includes(ext);

    if (!allowed.includes(file.type) && !isAllowedExt) {
      alert('Please upload JPG, PNG, WebP, PDF, XLSX, XLS, or CSV files only.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum 10MB allowed.');
      return;
    }

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  };

  // ─── Send Message ──────────────────────────────────────────────

  const handleSend = useCallback(() => {
    if (isProcessing) return;

    if (selectedFile) {
      sendImage(selectedFile, text);
      clearFile();
      setText('');
      return;
    }

    if (text.trim()) {
      sendMessage(text.trim());
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [text, selectedFile, isProcessing, sendMessage, sendImage, clearFile]);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // ─── Voice Input (Web Speech API) ─────────────────────────────

  const toggleVoiceInput = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // English (India) — also picks up Hindi/Marathi words

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      setText(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  // ─── Voice support check ──────────────────────────────────────
  const hasVoiceSupport = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const canSend = (text.trim().length > 0 || selectedFile) && !isProcessing;

  return (
    <div className="gaudai-input-area">
      {/* File preview strip */}
      {selectedFile && (
        <div className="gaudai-file-preview">
          {filePreview ? (
            <img src={filePreview} alt="Preview" />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: 6,
              background: '#F3F4F6', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 18
            }}>
              {selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls') || selectedFile.name.endsWith('.csv') ? '📊' : '📄'}
            </div>
          )}
          <div className="file-info">
            <div className="name">{selectedFile.name}</div>
            <div className="size">{formatFileSize(selectedFile.size)}</div>
          </div>
          <button className="remove-btn" onClick={clearFile}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="gaudai-input-row">
        {/* File upload button */}
        <button
          className="gaudai-input-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Upload image or document"
          disabled={isProcessing}
        >
          <Image size={18} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf,.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={isProcessing ? 'AI is thinking...' : 'Type a message or upload an image...'}
          rows={1}
          disabled={isProcessing}
        />

        {/* Voice input button */}
        {hasVoiceSupport && (
          <button
            className={`gaudai-input-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleVoiceInput}
            title={isRecording ? 'Stop recording' : 'Voice input'}
            disabled={isProcessing}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}

        {/* Send button */}
        <button
          className={`gaudai-input-btn ${canSend ? 'send' : ''}`}
          onClick={handleSend}
          disabled={!canSend}
          title="Send message"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
