/** Composition shortcuts only; all messages use the existing chat send flow. */
export const FRANCHISE_QUICK_QUESTIONS = [
  {
    id: "request-stock", label: "📦 Request Stock",
    message: "Hello HQ, I need additional stock for my franchise. Please help me with stock availability and ordering.",
  },
  {
    id: "account-statement", label: "📊 Account Statement",
    message: "Hello HQ, please share my franchise account statement, including outstanding balances and payment details.",
  },
  {
    id: "order-status", label: "🚚 Order Status",
    message: "Hello HQ, I would like an update on my recent franchise order. Please share the current status and expected delivery date.",
  },
] as const;
