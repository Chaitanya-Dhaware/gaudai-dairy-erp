/**
 * Chat Store — Zustand state management for the Gaudai AI Chat Assistant.
 * Manages conversation history, UI state, pending confirmations, and AI processing.
 */

import { create } from 'zustand';
import { processConversation, processOCRImage, processExcelFile, processPDFFile, executeAction, generateLocalReport, exportToExcel, exportToCSV } from '../utils/gaudaiAI';
import { useAppStore } from './appStore';

/**
 * Generate a unique message ID.
 */
function msgId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get a snapshot of the app store data for AI context.
 */
function getStoreSnapshot() {
  const state = useAppStore.getState();
  return {
    farmers: state.farmers,
    customers: state.customers,
    products: state.products,
    settings: state.settings,
    collections: state.collections,
    sales: state.sales,
    expenses: state.expenses,
    todaySummary: state.todaySummary,
    user: state.user
  };
}

export const useChatStore = create((set, get) => ({
  // ─── State ──────────────────────────────────────────────────────
  isOpen: false,
  messages: [],
  isProcessing: false,
  pendingAction: null,          // Action awaiting user confirmation
  pendingSpreadsheet: null,     // Active spreadsheet preview & column mapping data
  activeFileContext: null,      // Context of uploaded file for follow-up questions
  hasUnread: false,             // Unread notification indicator

  // ─── UI Actions ────────────────────────────────────────────────

  toggleChat: () => {
    const current = get().isOpen;
    set({ isOpen: !current, hasUnread: false });
  },

  openChat: () => set({ isOpen: true, hasUnread: false }),

  closeChat: () => set({ isOpen: false }),

  dismissPendingSpreadsheet: () => set({ pendingSpreadsheet: null }),

  addAssistantMessage: (content, type = 'message') => {
    const aiMsg = {
      id: msgId(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      type
    };
    set(state => ({
      messages: [...state.messages, aiMsg]
    }));
  },

  clearChat: () => set({
    messages: [],
    pendingAction: null,
    pendingSpreadsheet: null,
    activeFileContext: null,
    isProcessing: false
  }),

  // ─── Message Sending ──────────────────────────────────────────

  /**
   * Send a text message from the user.
   * Processes through AI engine and adds response.
   */
  sendMessage: async (text) => {
    if (!text.trim() || get().isProcessing) return;

    const userMsg = {
      id: msgId(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      type: 'text'
    };

    set(state => ({
      messages: [...state.messages, userMsg],
      isProcessing: true,
      pendingAction: null
    }));

    try {
      const snapshot = getStoreSnapshot();

      // Check for quick local report requests first
      const localReport = tryLocalReport(text, snapshot);
      if (localReport) {
        const aiMsg = {
          id: msgId(),
          role: 'assistant',
          content: localReport,
          timestamp: Date.now(),
          type: 'report'
        };
        set(state => ({
          messages: [...state.messages, aiMsg],
          isProcessing: false
        }));
        return;
      }

      // Build conversation history for context (last 10 messages)
      const recentMessages = [...get().messages].slice(-10).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.content
      }));

      // Process through Gemini AI (with active file context if present)
      const result = await processConversation(recentMessages, snapshot, get().activeFileContext);

      const aiMsg = {
        id: msgId(),
        role: 'assistant',
        content: result.message,
        timestamp: Date.now(),
        type: result.type,
        action: result.action || null
      };

      set(state => ({
        messages: [...state.messages, aiMsg],
        isProcessing: false,
        pendingAction: result.action || null,
        hasUnread: !state.isOpen
      }));
    } catch (error) {
      console.error('AI processing error:', error);
      const errorMsg = {
        id: msgId(),
        role: 'assistant',
        content: `⚠️ Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: Date.now(),
        type: 'error'
      };
      set(state => ({
        messages: [...state.messages, errorMsg],
        isProcessing: false
      }));
    }
  },

  /**
   * Send a file (image, PDF, or spreadsheet) for AI processing.
   * Routes to the appropriate processing pipeline based on file type.
   */
  sendImage: async (file, task = '') => {
    if (!file || get().isProcessing) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const isExcel = ['xlsx', 'xls', 'csv', 'ods'].includes(ext) ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'text/csv' ||
      file.type === 'application/vnd.oasis.opendocument.spreadsheet';
    const isPDF = ext === 'pdf' || file.type === 'application/pdf';

    // Create preview message
    const previewUrl = (!isExcel && !isPDF) ? URL.createObjectURL(file) : null;
    const fileIcon = isPDF ? '📄' : isExcel ? '📊' : '📷';
    const userMsg = {
      id: msgId(),
      role: 'user',
      content: `${fileIcon} Uploaded: **${file.name}** (${formatFileSize(file.size)})${task ? `\n\nTask: ${task}` : ''}`,
      timestamp: Date.now(),
      type: isPDF ? 'pdf' : isExcel ? 'file' : 'image',
      imageUrl: previewUrl,
      fileName: file.name,
      fileSize: file.size
    };

    set(state => ({
      messages: [...state.messages, userMsg],
      isProcessing: true,
      pendingAction: null
    }));

    try {
      const snapshot = getStoreSnapshot();
      let result;

      if (isPDF) {
        result = await processPDFFile(file, snapshot, task);
      } else if (isExcel) {
        result = await processExcelFile(file, snapshot, task);
      } else {
        // Convert file to base64 for OCR
        const base64 = await fileToBase64(file);
        const mimeType = file.type || 'image/jpeg';
        result = await processOCRImage(base64, mimeType, snapshot, task);
      }

      const aiMsg = {
        id: msgId(),
        role: 'assistant',
        content: result.message,
        timestamp: Date.now(),
        type: result.type,
        action: result.action || null,
        ocrData: result.data || null
      };

      set(state => ({
        messages: [...state.messages, aiMsg],
        isProcessing: false,
        pendingAction: result.action || null,
        pendingSpreadsheet: result.type === 'spreadsheet_preview' ? result.previewData : state.pendingSpreadsheet,
        activeFileContext: {
          fileName: file.name,
          fileType: isPDF ? 'pdf' : isExcel ? 'spreadsheet' : 'image',
          fileSize: file.size,
          contentSnippet: result.contentSnippet || result.message
        },
        hasUnread: !state.isOpen
      }));
    } catch (error) {
      console.error('File processing error:', error);
      const errorMsg = {
        id: msgId(),
        role: 'assistant',
        content: `⚠️ Failed to process **${file.name}**: ${error.message}. Please try again.`,
        timestamp: Date.now(),
        type: 'error'
      };
      set(state => ({
        messages: [...state.messages, errorMsg],
        isProcessing: false
      }));
    }
  },

  /**
   * Send multiple files sequentially, processing each one.
   * Files are queued and processed one at a time.
   */
  sendFiles: async (files, task = '') => {
    if (!files || files.length === 0 || get().isProcessing) return;

    for (const file of files) {
      await get().sendImage(file, task);
    }
  },

  /**
   * Download a report from the last assistant report message.
   * Exports to XLSX or CSV based on format parameter.
   */
  downloadReport: (format = 'xlsx') => {
    const messages = get().messages;
    // Find the last report message
    const reportMsg = [...messages].reverse().find(m => m.type === 'report' && m.role === 'assistant');
    if (!reportMsg) return;

    // Parse simple table from report content
    const lines = reportMsg.content.split('\n').filter(l => l.startsWith('|') && l.endsWith('|'));
    if (lines.length < 2) return;

    const headers = lines[0].split('|').filter(c => c.trim()).map(c => c.trim());
    const rows = lines.slice(2).map(line => {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim().replace(/\*\*/g, ''));
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] || ''; });
      return row;
    });

    if (rows.length === 0) return;

    const filename = `gaudai_report_${new Date().toLocaleDateString('en-CA')}`;
    if (format === 'csv') {
      exportToCSV(rows, filename);
    } else {
      exportToExcel(rows, filename);
    }
  },

  // ─── Action Confirmation ──────────────────────────────────────

  /**
   * Confirm and execute a pending action.
   */
  confirmAction: async () => {
    const action = get().pendingAction;
    if (!action) return;

    set({ isProcessing: true });

    try {
      const result = await executeAction(action, useAppStore);

      const resultMsg = {
        id: msgId(),
        role: 'assistant',
        content: result.message,
        timestamp: Date.now(),
        type: result.success ? 'success' : 'error'
      };

      set(state => ({
        messages: [...state.messages, resultMsg],
        isProcessing: false,
        pendingAction: null
      }));
    } catch (error) {
      console.error('Action execution error:', error);
      const errorMsg = {
        id: msgId(),
        role: 'assistant',
        content: `❌ Action failed: ${error.message}`,
        timestamp: Date.now(),
        type: 'error'
      };
      set(state => ({
        messages: [...state.messages, errorMsg],
        isProcessing: false,
        pendingAction: null
      }));
    }
  },

  /**
   * Reject/cancel a pending action.
   */
  rejectAction: () => {
    const cancelMsg = {
      id: msgId(),
      role: 'assistant',
      content: '🚫 Action cancelled. Is there anything else I can help with?',
      timestamp: Date.now(),
      type: 'text'
    };

    set(state => ({
      messages: [...state.messages, cancelMsg],
      pendingAction: null
    }));
  },

  /**
   * Update the pending action data (e.g. from inline edits in preview cards).
   */
  updatePendingActionData: (updatedData) => {
    set(state => {
      if (!state.pendingAction) return {};
      return {
        pendingAction: {
          ...state.pendingAction,
          data: {
            ...state.pendingAction.data,
            ...updatedData
          }
        }
      };
    });
  },

  /**
   * Trigger a suggested action (quick chip click).
   */
  triggerSuggestion: (suggestion) => {
    get().sendMessage(suggestion);
  }
}));

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────

/**
 * Format file size in human-readable form.
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Convert a File to base64 string (without data: prefix).
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove the data:*/*;base64, prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Try to handle the message with local report generation (no AI call needed).
 * Returns report string or null if this isn't a simple report request.
 */
function tryLocalReport(text, snapshot) {
  const lower = text.toLowerCase().trim();

  // Daily collection report
  if (
    (lower.includes('daily') && lower.includes('collection')) ||
    (lower.includes('today') && lower.includes('collection')) ||
    lower.includes('आजचे संकलन')
  ) {
    return generateLocalReport('daily_collection', snapshot);
  }

  // Daily sales report
  if (
    (lower.includes('daily') && lower.includes('sales')) ||
    (lower.includes('today') && lower.includes('sales'))
  ) {
    return generateLocalReport('daily_sales', snapshot);
  }

  // Daily expense report
  if (
    (lower.includes('daily') && lower.includes('expense')) ||
    (lower.includes('today') && lower.includes('expense')) ||
    lower.includes('आजचा खर्च')
  ) {
    return generateLocalReport('daily_expense', snapshot);
  }

  // Pending dues
  if (
    lower.includes('pending due') ||
    lower.includes('who owes') ||
    lower.includes('थकबाकी')
  ) {
    return generateLocalReport('pending_dues', snapshot);
  }

  // Profit and loss
  if (
    (lower.includes('profit') && lower.includes('loss')) ||
    lower.includes('p&l') ||
    lower.includes('नफा तोटा')
  ) {
    return generateLocalReport('profit_loss', snapshot);
  }

  return null;
}
