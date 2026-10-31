export function purchaseReturnTotals(data:any) {
  const goods = Number(data.taxableValue ?? data.refundAmount ?? 0);
  const gst = Number(data.taxAmount ?? ((data.cgst ?? 0) + (data.sgst ?? 0) + (data.igst ?? 0)));
  return { goods, gst, credit: Math.round((goods+gst)*100)/100 };
}
