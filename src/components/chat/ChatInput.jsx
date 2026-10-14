import { useState, useRef, useCallback, useEffect } from 'react';
import { useChatStore } from '../../store/chatStore';
import { Send, Paperclip, Mic, MicOff, X, FileText, FileSpreadsheet, Image } from 'lucide-react';

/**
 * Accepted file types for all supported document formats.
 */
const ACCEPTED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.oasis.opendocument.spreadsheet'
];

const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'xlsx', 'xls', 'csv', 'ods'];
const MAX_FILE_SIZE_MB = 20;

/**
 * Return icon component and label for a given file.
 */
function getFileInfo(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) {
    return { icon: FileSpreadsheet, label: ext.toUpperCase(), color: '#16a34a' };
  }
  if (ext === 'pdf') {
    return { icon: FileText, label: 'PDF', color: '#dc2626' };
  }
  return { icon: Image, label: 'IMG', color: '#2563eb' };
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function validateFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const isAllowedExt = ACCEPTED_EXTENSIONS.includes(ext);
  if (!ACCEPTED_TYPES.includes(file.type) && !isAllowedExt) {
    return `"${file.name}" is not a supported file type (JPG, PNG, WebP, PDF, XLSX, XLS, CSV, ODS).`;
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `"${file.name}" is too large (max ${MAX_FILE_SIZE_MB} MB).`;
  }
  return null;
}

/**
 * ChatInput — Message input with multi-file upload, drag-and-drop, voice input, and send.
 */
export default function ChatInput() {
  const { sendMessage, sendFiles, isProcessing } = useChatStore();
  const [text, setText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const dragCounterRef = useRef(0);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(filePreviews).forEach(url => URL.revokeObjectURL(url));
    };
  }, [filePreviews]);

  // ─── Text Input ──────────────────────────────────────────────────

  const handleTextChange = (e) => {
    setText(e.target.value);
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

  // ─── File Management ─────────────────────────────────────────────

  const addFiles = useCallback((newFiles) => {
    const validFiles = [];
    const errors = [];

    for (const file of newFiles) {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    if (validFiles.length === 0) return;

    setSelectedFiles(prev => {
      // Deduplicate by name+size
      const existing = new Set(prev.map(f => `${f.name}_${f.size}`));
      const unique = validFiles.filter(f => !existing.has(`${f.name}_${f.size}`));
      return [...prev, ...unique];
    });

    // Generate image previews
    const newPreviews = {};
    for (const file of validFiles) {
      if (file.type.startsWith('image/')) {
        newPreviews[`${file.name}_${file.size}`] = URL.createObjectURL(file);
      }
    }
    if (Object.keys(newPreviews).length > 0) {
      setFilePreviews(prev => ({ ...prev, ...newPreviews }));
    }
  }, []);

  const removeFile = useCallback((index) => {
    setSelectedFiles(prev => {
      const file = prev[index];
      const key = `${file.name}_${file.size}`;
      setFilePreviews(p => {
        if (p[key]) URL.revokeObjectURL(p[key]);
        const next = { ...p };
        delete next[key];
        return next;
      });
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clearFiles = useCallback(() => {
    Object.values(filePreviews).forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setFilePreviews({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [filePreviews]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Drag & Drop ─────────────────────────────────────────────────

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    addFiles(files);
  };

  // ─── Send ────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (isProcessing) return;

    if (selectedFiles.length > 0) {
      await sendFiles(selectedFiles, text.trim());
      clearFiles();
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
  }, [text, selectedFiles, isProcessing, sendMessage, sendFiles, clearFiles]);

  // ─── Voice Input ─────────────────────────────────────────────────

  const toggleVoiceInput = () => {
    if (isRecording) stopRecording();
    else startRecording();
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
    recognition.lang = 'en-IN';

    recognition.onstart = () => setIsRecording(true);

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

    recognition.onend = () => setIsRecording(false);

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

  const hasVoiceSupport = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const canSend = (text.trim().length > 0 || selectedFiles.length > 0) && !isProcessing;

  return (
    <div
      className={`gaudai-input-area ${isDragOver ? 'drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ─── Drag Overlay ───────────────────────────────────────── */}
      {isDragOver && (
        <div className="gaudai-drop-overlay">
          <div className="gaudai-drop-overlay-inner">
            <Paperclip size={28} />
            <span>Drop files to upload</span>
            <p>PDF, XLSX, XLS, CSV, ODS, JPG, PNG, WebP</p>
          </div>
        </div>
      )}

      {/* ─── File Queue Strip ──────────────────────────────────── */}
      {selectedFiles.length > 0 && (
        <div className="gaudai-file-queue">
          <div className="gaudai-file-queue-scroll">
            {selectedFiles.map((file, index) => {
              const key = `${file.name}_${file.size}`;
              const preview = filePreviews[key];
              const { icon: FileIcon, label, color } = getFileInfo(file);
              return (
                <div key={key} className="gaudai-file-chip">
                  {preview ? (
                    <img src={preview} alt={file.name} className="gaudai-file-chip-img" />
                  ) : (
                    <div className="gaudai-file-chip-icon" style={{ color }}>
                      <FileIcon size={18} />
                      <span className="gaudai-file-chip-badge" style={{ background: color }}>{label}</span>
                    </div>
                  )}
                  <div className="gaudai-file-chip-info">
                    <div className="gaudai-file-chip-name" title={file.name}>{file.name}</div>
                    <div className="gaudai-file-chip-size">{formatFileSize(file.size)}</div>
                  </div>
                  <button
                    className="gaudai-file-chip-remove"
                    onClick={() => removeFile(index)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          {selectedFiles.length > 1 && (
            <div className="gaudai-file-queue-footer">
              <span>{selectedFiles.length} files selected</span>
              <button onClick={clearFiles} className="gaudai-file-queue-clear">Clear all</button>
            </div>
          )}
        </div>
      )}

      {/* ─── Input Row ─────────────────────────────────────────── */}
      <div className="gaudai-input-row">
        {/* File upload button */}
        <button
          className="gaudai-input-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Upload files (PDF, XLSX, CSV, ODS, images)"
          disabled={isProcessing}
        >
          <Paperclip size={18} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf,.pdf,.xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.oasis.opendocument.spreadsheet"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          multiple
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isProcessing
              ? 'AI is processing...'
              : selectedFiles.length > 0
              ? 'Add a task or question about these files...'
              : 'Type a message or drop files here...'
          }
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

      {/* ─── Supported formats hint ─────────────────────────────── */}
      {selectedFiles.length === 0 && !isProcessing && (
        <div className="gaudai-input-hint">
          Supports PDF, Excel (XLSX/XLS/ODS), CSV, and images · Drag & drop or click 📎
        </div>
      )}
    </div>
  );
}
