"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CentralWarehouseRedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/warehouse/manage"); }, [router]);
  return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
}
