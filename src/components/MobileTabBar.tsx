'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Layers, Users, RotateCw, Activity } from 'lucide-react';

const tabs = [
  { href: '/',         label: 'Map',      Icon: Map },
  { href: '/paddocks', label: 'Paddocks', Icon: Layers },
  { href: '/herds',    label: 'Herds',    Icon: Users },
  { href: '/grazing',  label: 'Grazing',  Icon: RotateCw },
  { href: '/activity', label: 'Activity', Icon: Activity },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden shrink-0 bg-zinc-950/95 backdrop-blur border-t border-white/10 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ href, label, Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium tracking-tight transition-colors ${
              isActive ? 'text-white' : 'text-white/50 active:text-white/80'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.25]' : ''}`} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
