'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Map, Layers, Users, RotateCw, Activity, Menu, X } from 'lucide-react';

const navItems = [
  { href: '/',         label: 'Map',      Icon: Map },
  { href: '/paddocks', label: 'Paddocks', Icon: Layers },
  { href: '/herds',    label: 'Herds',    Icon: Users },
  { href: '/grazing',  label: 'Grazing',  Icon: RotateCw },
  { href: '/activity', label: 'Activity', Icon: Activity },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle — hidden when drawer is open so the sidebar's own close (X) takes over */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{ left: 'calc(0.875rem + env(safe-area-inset-left))' }}
          className="md:hidden fixed top-3.5 z-[1100] w-8 h-8 flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.10] border border-white/10 rounded-lg text-white/60 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>
      )}

      {/* Mobile backdrop — above the map's z-1000 floating controls */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[1900]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — must sit above map search/Walk buttons (z-1000..1500) */}
      <aside
        className={`
          fixed md:static z-[2000] md:z-auto h-full flex flex-col
          bg-zinc-950 border-r border-white/10
          transition-transform duration-200 ease-out
          w-64 shrink-0
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/[0.05]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm font-semibold text-white/90 tracking-tight">PastureMap</h1>
              <p className="text-xs text-white/30 mt-0.5">Grazing Rotation Planner</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="md:hidden text-white/30 hover:text-white/60 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 space-y-0.5">
          {navItems.map(({ href, label, Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
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

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/[0.05]">
          <p className="text-xs text-white/25 font-medium">McCormick Ranch</p>
        </div>
      </aside>
    </>
  );
}
