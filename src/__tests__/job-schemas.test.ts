import { describe, it, expect } from 'vitest';
import {
  stockAlertPayloadSchema,
  notificationPayloadSchema,
  paymentPollPayloadSchema,
  dailyReportPayloadSchema,
  parseJobPayload,
} from '@/infrastructure/jobs/schemas';

const STORE_ID = '0123456789abcdef0123456789abcdef';

describe('Job Payload Schemas', () => {
  describe('stockAlertPayloadSchema', () => {
    it('should accept valid payload', () => {
      const result = stockAlertPayloadSchema.safeParse({
        storeId: STORE_ID,
        productName: 'Coca Cola 600ml',
        currentStock: 3,
        minStock: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing productName', () => {
      const result = stockAlertPayloadSchema.safeParse({
        currentStock: 3,
        minStock: 10,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative stock', () => {
      const result = stockAlertPayloadSchema.safeParse({
        storeId: STORE_ID,
        productName: 'Test',
        currentStock: -1,
        minStock: 10,
      });
      expect(result.success).toBe(false);
    });

    it('should sanitize HTML in productName', () => {
      const result = stockAlertPayloadSchema.safeParse({
        storeId: STORE_ID,
        productName: '<script>alert("xss")</script>',
        currentStock: 3,
        minStock: 10,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.productName).not.toContain('<script>');
      }
    });
  });

  describe('notificationPayloadSchema', () => {
    it('should accept valid message', () => {
      const result = notificationPayloadSchema.safeParse({ storeId: STORE_ID, message: 'Test notification' });
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const result = notificationPayloadSchema.safeParse({ storeId: STORE_ID, message: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing message', () => {
      const result = notificationPayloadSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('paymentPollPayloadSchema', () => {
    it('should accept valid conekta payload', () => {
      const result = paymentPollPayloadSchema.safeParse({
        storeId: STORE_ID,
        chargeId: 'ch-123-abc',
        provider: 'conekta',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid stripe payload', () => {
      const result = paymentPollPayloadSchema.safeParse({
        storeId: STORE_ID,
        chargeId: 'pi_stripe_123',
        provider: 'stripe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid provider', () => {
      const result = paymentPollPayloadSchema.safeParse({
        storeId: STORE_ID,
        chargeId: 'ch-123',
        provider: 'paypal',
      });
      expect(result.success).toBe(false);
    });

    it('should reject chargeId with special characters', () => {
      const result = paymentPollPayloadSchema.safeParse({
        storeId: STORE_ID,
        chargeId: 'ch-123; DROP TABLE',
        provider: 'stripe',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty chargeId', () => {
      const result = paymentPollPayloadSchema.safeParse({
        storeId: STORE_ID,
        chargeId: '',
        provider: 'clip',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('dailyReportPayloadSchema', () => {
    it('should accept empty payload', () => {
      const result = dailyReportPayloadSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept undefined payload', () => {
      const result = dailyReportPayloadSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it('should accept valid date override', () => {
      const result = dailyReportPayloadSchema.safeParse({ date: '2026-04-04' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = dailyReportPayloadSchema.safeParse({ date: '04/04/2026' });
      expect(result.success).toBe(false);
    });
  });

  describe('parseJobPayload', () => {
    it('should parse valid JSON', () => {
      const result = parseJobPayload(
        notificationPayloadSchema,
        `{"storeId":"${STORE_ID}","message":"hello"}`,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe('hello');
      }
    });

    it('should handle empty body', () => {
      const result = parseJobPayload(dailyReportPayloadSchema, '');
      expect(result.success).toBe(true);
    });

    it('should return error for invalid JSON', () => {
      const result = parseJobPayload(notificationPayloadSchema, 'not-json');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('JSON');
      }
    });

    it('should return error for schema mismatch', () => {
      const result = parseJobPayload(stockAlertPayloadSchema, '{"wrong": "field"}');
      expect(result.success).toBe(false);
    });
  });
});
