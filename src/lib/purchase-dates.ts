export function purchaseBusinessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(now);
  const value = (name:string) => parts.find(p=>p.type===name)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function purchaseFormDateError(purchaseDate:string, expected:string, options:{editId?:string;originalExpectedDeliveryDate?:string;poStatus?:string}={}, now=new Date()):string {
  if (!expected) return 'Expected Delivery date is required.';
  const date = new Date(`${expected}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expected) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==expected) return 'Enter a valid Expected Delivery date.';
  const unchangedHistorical = options.editId && options.poStatus !== 'DRAFT' && expected === options.originalExpectedDeliveryDate;
  if (!unchangedHistorical && (expected < purchaseBusinessDate(now) || expected < purchaseDate)) return 'Expected Delivery must be today or a future date and cannot be before Purchase Date.';
  if (!options.editId && purchaseDate !== purchaseBusinessDate(now)) return 'Purchase Date must be the current date in Asia/Kolkata. Refresh the form.';
  return '';
}
