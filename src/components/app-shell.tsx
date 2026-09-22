import type { ReactNode } from "react";
import Image from "next/image";

import { BottomNav } from "@/components/bottom-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="brand-banner">
          <div className="brand-portrait">
            <Image
              src="/zezinho-logo.png"
              alt=""
              width={96}
              height={96}
              priority
              aria-hidden="true"
            />
          </div>
          <strong>Zezinho</strong>
        </div>
      </header>
      <main className="page-content">{children}</main>
      <BottomNav />
    </div>
  );
}
