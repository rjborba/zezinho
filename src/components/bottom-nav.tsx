"use client";

import Link from "next/link";
import { Boxes, CalendarDays, Home, PackagePlus, Pill } from "lucide-react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Início", icon: Home },
  { href: "/itens", label: "Itens", icon: Boxes },
  { href: "/medicamentos", label: "Medicamentos", icon: Pill },
  { href: "/entradas", label: "Entrada", icon: PackagePlus },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="bottom-bar">
      <div className="bottom-bar-content">
        <nav className="bottom-nav" aria-label="Navegação principal">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                prefetch
                className={isActive ? "is-active" : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon aria-hidden="true" size={22} strokeWidth={isActive ? 2.4 : 2} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="bottom-bar-action">
          <Link className="bottom-agenda" href="/agenda" scroll={false} aria-haspopup="dialog">
            <CalendarDays aria-hidden="true" size={22} />
            <span>Ver agenda</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
