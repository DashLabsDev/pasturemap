'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  {
    href: '/',
    label: 'Map',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3L1 6v11l6-3m0-11l6 3m-6-3v11m6-8l6-3v11l-6 3m0-11v11" />
      </svg>
    ),
  },
  {
    href: '/paddocks',
    label: 'Paddocks',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 4h16v12H2zM2 4l4 4M18 4l-4 4M2 16l4-4M18 16l-4-4M6 8h8" />
      </svg>
    ),
  },
  {
    href: '/herds',
    label: 'Herds',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
        <circle cx="7" cy="8" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="13" cy="8" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 16c0-2.5 2-4 5-4m6 0c3 0 5 1.5 5 4M7 12h6" />
      </svg>
    ),
  },
  {
    href: '/grazing',
    label: 'Grazing',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17c1-4 3-8 7-10m0 0c0-2 1-4 3-4-1 2-1 4 0 6m-3-2c1-2 3-3 5-3-1 1.5-2 3-1.5 5M10 7v10" />
      </svg>
    ),
  },
  {
    href: '/activity',
    label: 'Activity',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h3l2-6 4 12 2-6h3" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3.5 left-3.5 z-50 w-8 h-8 flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] rounded-lg text-white/60 transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 20 20" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static z-40 h-full flex flex-col
          bg-[#111312] border-r border-white/[0.06]
          transition-transform duration-200 ease-out
          w-52 shrink-0
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5 text-amber-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold text-white/90 tracking-tight">PastureMap</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-100
                  ${isActive
                    ? 'bg-white/[0.07] text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                  }
                `}
              >
                <span className={isActive ? 'text-amber-400' : 'text-white/30'}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/[0.05]">
          <p className="text-[11px] text-white/20 font-medium tracking-wide uppercase">McCormick Ranch</p>
        </div>
      </aside>
    </>
  );
}
