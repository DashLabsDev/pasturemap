'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/', label: 'Map', icon: '🗺️' },
  { href: '/paddocks', label: 'Paddocks', icon: '🏞️' },
  { href: '/herds', label: 'Herds', icon: '🐄' },
  { href: '/grazing', label: 'Grazing', icon: '🌿' },
  { href: '/activity', label: 'Activity', icon: '📋' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="md:hidden fixed top-3 left-3 z-50 bg-green-800 text-white p-2 rounded-lg shadow-lg"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {collapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Overlay for mobile */}
      {collapsed && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setCollapsed(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static z-40 h-full
          bg-green-900 text-white flex flex-col
          transition-transform duration-200
          ${collapsed ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          w-56 md:w-56 shrink-0
        `}
      >
        <div className="p-4 border-b border-green-700">
          <h1 className="text-xl font-bold tracking-tight">
            🐂 PastureMap
          </h1>
          <p className="text-green-300 text-xs mt-1">Grazing Rotation Planner</p>
        </div>

        <nav className="flex-1 py-2">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setCollapsed(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 text-sm font-medium
                  transition-colors
                  ${isActive
                    ? 'bg-green-700 text-white border-r-4 border-amber-400'
                    : 'text-green-200 hover:bg-green-800 hover:text-white'
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-green-700 text-xs text-green-400">
          McCormick Ranch
        </div>
      </aside>
    </>
  );
}
