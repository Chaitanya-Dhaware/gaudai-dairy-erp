import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  normalizeText,
  bulkImportCustomers
} from './bulkImportService.js';

describe('Bulk Customer Import Service', () => {
  describe('normalizePhoneNumber', () => {
    it('normalizes standard 10-digit Indian phone numbers', () => {
      const res = normalizePhoneNumber('9876543210');
      expect(res.phone).toBe('9876543210');
      expect(res.isValid).toBe(true);
      expect(res.isAmbiguous).toBe(false);
    });

    it('strips non-digit formatting characters', () => {
      const res = normalizePhoneNumber('(987) 654-3210');
      expect(res.phone).toBe('9876543210');
      expect(res.isValid).toBe(true);
    });

    it('strips leading 0 from 11-digit numbers', () => {
      const res = normalizePhoneNumber('09876543210');
      expect(res.phone).toBe('9876543210');
      expect(res.isValid).toBe(true);
      expect(res.isAmbiguous).toBe(false);
    });

    it('strips leading 91 from 12-digit numbers', () => {
      const res = normalizePhoneNumber('+919876543210');
      expect(res.phone).toBe('9876543210');
      expect(res.isValid).toBe(true);
      expect(res.isAmbiguous).toBe(false);
    });

    it('flags 11-digit numbers with typos as ambiguous while preserving digits', () => {
      // Like Sanchita Kirana (94218368056)
      const res = normalizePhoneNumber('94218368056');
      expect(res.phone).toBe('94218368056');
      expect(res.isValid).toBe(true);
      expect(res.isAmbiguous).toBe(true);
    });

    it('handles empty or missing phone numbers cleanly', () => {
      expect(normalizePhoneNumber('').isValid).toBe(false);
      expect(normalizePhoneNumber(null).isValid).toBe(false);
      expect(normalizePhoneNumber(undefined).isValid).toBe(false);
    });
  });

  describe('normalizeText', () => {
    it('replaces non-breaking spaces and excessive whitespace', () => {
      const raw = '  Aai\u00A0Hotel   Georai  ';
      expect(normalizeText(raw)).toBe('Aai Hotel Georai');
    });

    it('handles falsy values', () => {
      expect(normalizeText(null)).toBe('');
      expect(normalizeText(undefined)).toBe('');
    });
  });

  describe('bulkImportCustomers — Dry Run Preview & Validation', () => {
    it('detects in-file duplicates by phone number and name', async () => {
      const testRecords = [
        { shop_name: 'Aai Hotel', mobile: '9876543210', address: 'Bypass' },
        { shop_name: 'Aai Hotel', mobile: '9123456789', address: 'Station' }, // dup name
        { shop_name: 'Other Shop', mobile: '9876543210', address: 'Market' }, // dup phone
        { shop_name: 'Valid Shop 3', mobile: '9555443322', address: 'Town' }
      ];

      const preview = await bulkImportCustomers(testRecords, { dryRun: true });

      expect(preview.totalAttempted).toBe(4);
      expect(preview.createdCount).toBe(2); // Aai Hotel (first) + Valid Shop 3
      expect(preview.skippedCount).toBe(2); // 2 duplicates
      expect(preview.failedCount).toBe(0);

      const dupRecords = preview.records.filter(r => r.status === 'skipped_duplicate');
      expect(dupRecords.length).toBe(2);
      expect(dupRecords[0].reason).toContain('Duplicate');
    });

    it('fails records missing both shop name and owner name', async () => {
      const testRecords = [
        { shop_name: '', owner_name: '', mobile: '9876543210', address: 'Bypass' },
        { shop_name: 'Valid Shop', mobile: '9876543211', address: 'Bypass' }
      ];

      const preview = await bulkImportCustomers(testRecords, { dryRun: true });
      expect(preview.failedCount).toBe(1);
      expect(preview.createdCount).toBe(1);
      expect(preview.records[0].status).toBe('failed');
      expect(preview.records[0].reason).toContain('Missing shop name');
    });

    it('rejects unauthorized execution when dryRun is false and no valid user session exists', async () => {
      const testRecords = [
        { shop_name: 'Test Shop', mobile: '9876543210', address: 'Town' }
      ];

      const result = await bulkImportCustomers(testRecords, {
        dryRun: false,
        user: { role: 'viewer' } // unauthorized role
      });

      expect(result.success).toBe(false);
      expect(result.stage).toBe('authorization');
      expect(result.error).toContain('Unauthorized');
    });
  });
});
