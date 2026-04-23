import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  other: {
    "Cache-Control": "no-store, must-revalidate",
  },
};

export default function CotizarLayout({ children }: { children: ReactNode }) {
  return children;
}
