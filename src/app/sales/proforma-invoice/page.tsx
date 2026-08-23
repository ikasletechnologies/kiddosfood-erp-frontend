"use client";

import EstimationsPageClient from "../estimation/EstimationsPageClient";

// Proforma Invoice shares the same backend Quotation model, form, and list logic
// as Estimation — only the on-screen wording differs. Rendering it directly here
// (instead of redirecting to /sales/estimation) keeps the URL and page title
// consistent with the "Proforma Invoice" sidebar entry the user actually clicked.
export default function ProformaInvoicePage() {
  return <EstimationsPageClient documentType="PROFORMA" />;
}
