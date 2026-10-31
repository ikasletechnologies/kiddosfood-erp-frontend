import { describe, expect, it } from 'vitest';
import { purchaseReturnTotals } from '../purchase-return-totals';
describe('Saved purchase return tax display',()=>{
 it('preserves a zero snapshot independently of a master/default rate',()=>{expect(purchaseReturnTotals({refundAmount:100,taxableValue:100,taxAmount:0,cgst:2.5,sgst:2.5})).toEqual({goods:100,gst:0,credit:100});});
 it('includes the saved positive tax in total return credit',()=>{expect(purchaseReturnTotals({taxableValue:100,refundAmount:100,taxAmount:5})).toEqual({goods:100,gst:5,credit:105});});
 it('uses saved split tax only when the explicit snapshot is absent',()=>{expect(purchaseReturnTotals({refundAmount:100,taxAmount:null,cgst:2.5,sgst:2.5})).toEqual({goods:100,gst:5,credit:105});});
});
