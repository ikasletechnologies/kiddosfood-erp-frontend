import { redirect } from "next/navigation";

// Was a non-functional empty-state stub — Profit & Loss (accounting/profit-loss)
// already implements this concept for real against actual data.
export default function IncomeStatementRedirect() {
  redirect("/accounting/profit-loss");
}
