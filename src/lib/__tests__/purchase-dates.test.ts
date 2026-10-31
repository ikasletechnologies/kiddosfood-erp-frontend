import { describe, expect, it } from 'vitest';
import { purchaseBusinessDate, purchaseFormDateError } from '../purchase-dates';
const now=new Date('2026-10-31T10:00:00Z');
describe('Purchase dates in Asia/Kolkata',()=>{
 it('uses the business calendar at the UTC/IST date boundary',()=>{expect(purchaseBusinessDate(new Date('2026-10-30T18:29:59Z'))).toBe('2026-10-30');expect(purchaseBusinessDate(new Date('2026-10-30T18:30:00Z'))).toBe('2026-10-31');});
 it('requires delivery and rejects past or malformed dates',()=>{for(const day of ['','2026-10-30','2026-02-30'])expect(purchaseFormDateError('2026-10-31',day,{},now)).not.toBe('');});
 it('accepts today and future dates',()=>{for(const day of ['2026-10-31','2026-11-01','2026-11-05'])expect(purchaseFormDateError('2026-10-31',day,{},now)).toBe('');});
 it('preserves an unchanged historic delivery but rejects a newly entered past date',()=>{const options={editId:'old',originalExpectedDeliveryDate:'2020-01-03',poStatus:'APPROVED'};expect(purchaseFormDateError('2020-01-02','2020-01-03',options,now)).toBe('');expect(purchaseFormDateError('2020-01-02','2020-01-04',options,now)).not.toBe('');});
 it('requires completing old drafts to choose today or future',()=>{expect(purchaseFormDateError('2020-01-02','2020-01-03',{editId:'old',originalExpectedDeliveryDate:'2020-01-03',poStatus:'DRAFT'},now)).not.toBe('');});
});
