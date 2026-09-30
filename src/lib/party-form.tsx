// Shared validation + lookups for the Customer / Dealer / Vendor party forms
// (AddPartyModal, AddDealerModal). Format errors are pure functions of the
// current value — compute them during render instead of storing them in
// state, so an error disappears the moment the value becomes valid (storing
// them is what made the dealer form keep "must be 10 digits" / "invalid
// email" on perfectly valid input).

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "" when empty or valid. */
export function phoneFormatError(phone?: string | null): string {
  const v = (phone || "").trim();
  if (!v) return "";
  if (!/^\d+$/.test(v)) return "Contact number must contain digits only.";
  if (v.length !== 10) return `Contact number must be 10 digits (${v.length}/10).`;
  return "";
}

/** "" when empty or valid. */
export function emailFormatError(email?: string | null): string {
  const v = (email || "").trim();
  if (!v) return "";
  return EMAIL_RE.test(v) ? "" : "Please enter a valid email address.";
}

/** "" when empty or valid. Only complains once all 15 characters are typed. */
export function gstinFormatError(gstin?: string | null): string {
  const v = (gstin || "").trim().toUpperCase();
  if (!v) return "";
  if (v.length < 15) return "";
  return GSTIN_RE.test(v) ? "" : "Invalid GSTIN format (e.g. 33ABCDE1234F1Z5).";
}

// All States and Union Territories, using the same names as the GST state
// code table (backend INDIAN_GST_STATE_MAP), so state ↔ code lookups agree.
export const STATE_OPTIONS = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
];

const GSTIN_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Dadra and Nagar Haveli and Daman and Diu", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
const ALIASES: Record<string, string> = {
  orissa: "Odisha", pondicherry: "Puducherry", uttaranchal: "Uttarakhand", newdelhi: "Delhi", nctofdelhi: "Delhi",
  dadraandnagarhaveli: "Dadra and Nagar Haveli and Daman and Diu", damananddiu: "Dadra and Nagar Haveli and Daman and Diu",
  andamanandnicobar: "Andaman and Nicobar Islands",
};

/**
 * Map any spelling ("Jammu & Kashmir", "TAMIL NADU", "Orissa", "33 - Tamil Nadu")
 * to the dropdown's canonical name. Returns the input unchanged if unknown, so a
 * value is never silently dropped.
 */
export function matchState(raw?: string | null): string {
  const s = (raw || "").trim().replace(/^\d{2}\s*[-:]\s*/, "");
  if (!s) return "";
  const n = norm(s);
  return STATE_OPTIONS.find((o) => norm(o) === n) || ALIASES[n] || s;
}

export const stateFromGstin = (gstin?: string | null) => GSTIN_STATE_CODES[(gstin || "").slice(0, 2)] || "";

/** India Post PIN lookup → { state, district, city } or null. */
export async function lookupPincode(pin: string): Promise<{ state: string; district: string; city: string } | null> {
  if (!/^[1-9]\d{5}$/.test(pin)) return null;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();
    const po = data?.[0]?.Status === "Success" ? data[0].PostOffice?.[0] : null;
    if (!po) return null;
    return {
      state: matchState(po.State),
      district: po.District || "",
      city: po.Block && po.Block !== "NA" ? po.Block : po.Region || po.District || "",
    };
  } catch {
    return null;
  }
}

/** State dropdown that also keeps a legacy/unknown saved value visible. */
export function StateSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const current = matchState(value);
  const options = current && !STATE_OPTIONS.includes(current) ? [current, ...STATE_OPTIONS] : STATE_OPTIONS;
  return (
    <select value={current} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="" className="dark:bg-[#13151f]">Select State</option>
      {options.map((s) => (
        <option key={s} value={s} className="dark:bg-[#13151f]">{s}</option>
      ))}
    </select>
  );
}
