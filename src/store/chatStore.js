/**
 * Chat Store — Zustand state management for the Gaudai AI Chat Assistant.
 * Manages conversation history, UI state, pending confirmations, and AI processing.
 */

import { create } from 'zustand';
import { processConversation, processOCRImage, processExcelFile, executeAction, generateLocalReport } from '../utils/gaudaiAI';
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
  pendingAction: null,     // Action awaiting user confirmation
  hasUnread: false,        // Unread notification indicator

  // ─── UI Actions ────────────────────────────────────────────────

  toggleChat: () => {
    const current = get().isOpen;
    set({ isOpen: !current, hasUnread: false });
  },

  openChat: () => set({ isOpen: true, hasUnread: false }),

  closeChat: () => set({ isOpen: false }),

  clearChat: () => set({
    messages: [],
    pendingAction: null,
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

      // Process through Gemini AI
      const result = await processConversation(recentMessages, snapshot);

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
   * Send an image for OCR processing.
   */
  sendImage: async (file, task = '') => {
    if (!file || get().isProcessing) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'text/csv';

    // Create preview message
    const previewUrl = isExcel ? null : URL.createObjectURL(file);
    const userMsg = {
      id: msgId(),
      role: 'user',
      content: `${isExcel ? '📊' : '📷'} Uploaded: ${file.name}${task ? `\n\nTask: ${task}` : ''}`,
      timestamp: Date.now(),
      type: isExcel ? 'file' : 'image',
      imageUrl: previewUrl
    };

    set(state => ({
      messages: [...state.messages, userMsg],
      isProcessing: true,
      pendingAction: null
    }));

    try {
      const snapshot = getStoreSnapshot();
      let result;

      if (isExcel) {
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
        hasUnread: !state.isOpen
      }));
    } catch (error) {
      console.error('File processing error:', error);
      const errorMsg = {
        id: msgId(),
        role: 'assistant',
        content: `⚠️ Failed to process file: ${error.message}. Please try again.`,
        timestamp: Date.now(),
        type: 'error'
      };
      set(state => ({
        messages: [...state.messages, errorMsg],
        isProcessing: false
      }));
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
   * Trigger a suggested action (quick chip click).
   */
  triggerSuggestion: (suggestion) => {
    get().sendMessage(suggestion);
  }
}));

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────

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
