'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Layers, Users, RotateCw, Activity } from 'lucide-react';
import { useRanch } from '@/components/auth/RanchProvider';

const navItems = [
  { href: '/',         label: 'Map',      Icon: Map },
  { href: '/paddocks', label: 'Paddocks', Icon: Layers },
  { href: '/herds',    label: 'Herds',    Icon: Users },
  { href: '/grazing',  label: 'Grazing',  Icon: RotateCw },
  { href: '/activity', label: 'Activity', Icon: Activity },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { activeRanch } = useRanch();

  return (
    <aside className="hidden md:flex z-[2000] h-full flex-col bg-zinc-950 border-r border-white/10 w-64 shrink-0">
      <div className="px-4 py-5 border-b border-white/[0.05]">
        <h1 className="text-sm font-semibold text-white/90 tracking-tight">PastureMap</h1>
        <p className="text-xs text-white/30 mt-0.5">Grazing Rotation Planner</p>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {navItems.map(({ href, label, Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/[0.05]">
        <p className="text-xs text-white/25 font-medium">{activeRanch?.ranchName ?? 'No ranch access'}</p>
      </div>
    </aside>
  );
}
