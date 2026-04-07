"use client";

import { useRouter } from "next/navigation";
import ActionToday from "./ActionToday";
import LeadsTable from "./LeadsTable";

export default function DashboardClient({ leads }: { leads: any[] }) {
  const router = useRouter();

  return (
    <>
      <ActionToday leads={leads} onLeadClick={(id) => router.push(`/agentes/dashboard/${id}`)} />
      <LeadsTable leads={leads} />
    </>
  );
}
