"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import WelcomeStep from "./components/WelcomeStep";
import CreateHqStep from "./components/CreateHqStep";
import CreateWarehouseStep from "./components/CreateWarehouseStep";
import CompleteStep from "./components/CompleteStep";

export type SetupStep = "welcome" | "hq" | "warehouse" | "complete";

export interface CreatedHq {
  id: string;
  name: string;
}

export interface CreatedWarehouse {
  id: string;
  name: string;
  code?: string | null;
}

export default function SetupWizardPage() {
  const { setupStatus, refreshSetupStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (setupStatus?.initialized) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [step, setStep] = useState<SetupStep>("welcome");
  const [hq, setHq] = useState<CreatedHq | null>(setupStatus?.hq ?? null);
  const [warehouse, setWarehouse] = useState<CreatedWarehouse | null>(null);

  const hqAlreadyConfigured = !!setupStatus?.hqConfigured;

  const handleGetStarted = () => {
    setStep(hqAlreadyConfigured ? "warehouse" : "hq");
  };

  const handleHqCreated = (created: CreatedHq) => {
    setHq(created);
    setStep("warehouse");
  };

  const handleWarehouseCreated = (created: CreatedWarehouse) => {
    setWarehouse(created);
    setStep("complete");
  };

  const handleFinish = async () => {
    await refreshSetupStatus();
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {step === "welcome" && (
          <WelcomeStep hqConfigured={hqAlreadyConfigured} onGetStarted={handleGetStarted} />
        )}
        {step === "hq" && <CreateHqStep onCreated={handleHqCreated} />}
        {step === "warehouse" && hq && (
          <CreateWarehouseStep 
            hq={hq} 
            nextWarehouseCode={setupStatus?.nextWarehouseCode}
            onCreated={handleWarehouseCreated} 
          />
        )}
        {step === "complete" && hq && warehouse && (
          <CompleteStep hq={hq} warehouse={warehouse} onFinish={handleFinish} />
        )}
      </div>
    </div>
  );
}
