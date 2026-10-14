import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  isAnalyticalQuery,
  buildExcelAnalysisPrompt,
  buildPDFAnalysisPrompt,
  exportToExcel,
  exportToCSV,
  executeAction
} from './gaudaiAI';

describe('Spreadsheet & PDF Capabilities', () => {
  it('correctly identifies analytical queries vs import instructions', () => {
    // Analytical queries
    expect(isAnalyticalQuery('Summarize this Excel file')).toBe(true);
    expect(isAnalyticalQuery('Calculate the total milk collected by all farmers')).toBe(true);
    expect(isAnalyticalQuery('Find the farmer with the highest milk supply')).toBe(true);
    expect(isAnalyticalQuery('Find duplicate entries in this spreadsheet')).toBe(true);
    expect(isAnalyticalQuery('Identify rows where the milk quantity is missing')).toBe(true);
    expect(isAnalyticalQuery('Compare these two monthly collection reports')).toBe(true);
    expect(isAnalyticalQuery('Extract all invoices from this PDF')).toBe(true);
    expect(isAnalyticalQuery('Calculate total expenses from this Excel sheet')).toBe(true);
    expect(isAnalyticalQuery('Convert this PDF table into Excel')).toBe(true);

    // Import instructions
    expect(isAnalyticalQuery('Import these records into the ERP database')).toBe(false);
    expect(isAnalyticalQuery('Save to database')).toBe(false);
    expect(isAnalyticalQuery('Add to ERP')).toBe(false);
    expect(isAnalyticalQuery('')).toBe(false);
  });

  it('builds appropriate analysis prompts including registered entities', () => {
    const mockStore = {
      farmers: [{ farmer_id: 'F-101', name: 'Ramesh Patil' }],
      customers: [{ customer_id: 'C-201', shop_name: 'Shree Dairy' }]
    };

    const excelPrompt = buildExcelAnalysisPrompt(mockStore, 'Calculate total milk');
    expect(excelPrompt).toContain('Ramesh Patil');
    expect(excelPrompt).toContain('Shree Dairy');
    expect(excelPrompt).toContain('Calculate total milk');

    const pdfPrompt = buildPDFAnalysisPrompt(mockStore, 'Extract all invoices');
    expect(pdfPrompt).toContain('Extract all invoices');
    expect(pdfPrompt).toContain('Markdown table');
  });

  it('generates valid multi-sheet Excel files with XLSX', () => {
    const rows = [
      { 'Farmer Name': 'Ramesh Patil', 'Quantity': 25, 'Fat': 4.5, 'Total': 956.25 },
      { 'Farmer Name': 'Suresh Shinde', 'Quantity': 18, 'Fat': 4.2, 'Total': 642.60 }
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Morning Collection');

    const ws2 = XLSX.utils.json_to_sheet([{ 'Farmer Name': 'Ganesh More', 'Quantity': 30 }]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Evening Collection');

    expect(wb.SheetNames).toEqual(['Morning Collection', 'Evening Collection']);

    const readRows1 = XLSX.utils.sheet_to_json(wb.Sheets['Morning Collection']);
    expect(readRows1.length).toBe(2);
    expect(readRows1[0]['Farmer Name']).toBe('Ramesh Patil');

    const readRows2 = XLSX.utils.sheet_to_json(wb.Sheets['Evening Collection']);
    expect(readRows2.length).toBe(1);
    expect(readRows2[0]['Quantity']).toBe(30);
  });

  it('enforces role-based authorization in executeAction', async () => {
    // Unauthenticated user
    const mockUnauthStore = {
      getState: () => ({ user: null })
    };

    const res = await executeAction(
      { type: 'ADD_COLLECTION', data: { farmer_id: 'F-1', quantity: 10, fat: 4 } },
      mockUnauthStore
    );

    expect(res.success).toBe(false);
    expect(res.message).toContain('Unauthorized');
  });

  it('allows authorized roles to execute actions', async () => {
    const mockAuthStore = {
      getState: () => ({
        user: { role: 'admin' },
        settings: { baseRate: 8.5 },
        addMilkCollection: vi.fn().mockResolvedValue(true)
      })
    };

    const res = await executeAction(
      {
        type: 'ADD_COLLECTION',
        data: { farmer_id: 'F-1', farmer_name: 'Ramesh', quantity: 10, fat: 4 }
      },
      mockAuthStore
    );

    expect(res.success).toBe(true);
    expect(res.message).toContain('Milk collection saved');
  });
});
