"use client";

import Link from "next/link";
import { Boxes, Home, PackagePlus } from "lucide-react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Início", icon: Home },
  { href: "/itens", label: "Itens", icon: Boxes },
  { href: "/entradas", label: "Entrada", icon: PackagePlus },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div>
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={isActive ? "is-active" : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon aria-hidden="true" size={22} strokeWidth={isActive ? 2.4 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
