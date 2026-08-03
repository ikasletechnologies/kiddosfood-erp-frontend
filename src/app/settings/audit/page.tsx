import { redirect } from "next/navigation";

// This was a second, independently-built audit log viewer hitting the same
// ActivityLog data as /audit/logs, but with a "module" filter that doesn't
// correspond to anything the backend actually supports, and field mappings
// (l.module, l.user.name) that don't match the real ActivityLog/User shape.
// /audit/logs is the correct, working implementation — folded into it here.
export default function AuditTrailRedirect() {
  redirect("/audit/logs");
}
