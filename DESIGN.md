# DESIGN.md — PastureMap

**App:** Grazing Rotation Manager for cattle ranchers  
**Stack:** Next.js 14 App Router · TypeScript · Tailwind · Mapbox GL JS · Supabase/PostGIS  
**Design philosophy:** Data-forward, dark-native, map-first. The satellite imagery is the canvas — every UI element is a guest on it. Never compete with the map.

---

## 1. Color Palette

### Background & Surface

| Token | Hex | Tailwind | Usage |
|---|---|---|---|
| Map canvas | — | — | Mapbox satellite-streets-v12 |
| Overlay base | `#18181b` @ 90% | `bg-zinc-900/90` | All floating panels, sidebar |
| Overlay hover | `#18181b` @ 95% | `bg-zinc-900/95` | Dropdown menus, elevated surfaces |
| Input fill | `#ffffff` @ 8% | `bg-white/[0.08]` | Input fields, ghost buttons |
| Input fill hover | `#ffffff` @ 12% | `bg-white/[0.12]` | Hovered inputs |
| Divider | `#ffffff` @ 5% | `border-white/[0.05]` | List item separators |
| Overlay border | `#ffffff` @ 10% | `border-white/10` | Panel/card borders |
| Focus border | `#ffffff` @ 25% | `border-white/25` | Active input ring |

> **Rule:** Never use `bg-white` or `bg-gray-*` on anything that floats over the map. All overlay backgrounds use zinc-900 with opacity or `bg-white/[0.08]` glass. Backdrop blur (`backdrop-blur-md`) is required on all panels over satellite imagery.

---

### Text

| Token | Hex | Tailwind | Usage |
|---|---|---|---|
| Primary text | `#ffffff` @ 90% | `text-white/90` | Headings, values |
| Body text | `#ffffff` @ 80% | `text-white/80` | Body copy, list items |
| Secondary text | `#ffffff` @ 60% | `text-white/60` | Descriptions, metadata |
| Label text | `#ffffff` @ 40% | `text-white/40` | Field labels, placeholders |
| Disabled text | `#ffffff` @ 25% | `text-white/25` | Disabled states |

---

### Accent Colors

| Name | Hex | Tailwind | Usage |
|---|---|---|---|
| **Amber** (primary CTA) | `#f59e0b` | `amber-500` | Save buttons, primary actions, herd markers on map |
| **Amber hover** | `#fbbf24` | `amber-400` | Button hover state |
| **Green** (active/grazing) | `#22c55e` | `green-500` | Grazing paddocks, active status badges |
| **Gray** (resting) | `#6b7280` | `gray-500` | Resting paddocks, inactive state |
| **Red** (danger/overdue) | `#ef4444` | `red-500` | Destructive actions, overdue grazing alerts |
| **Sky** (info) | `#38bdf8` | `sky-400` | Informational states, selected paddock highlight |

> **Amber rationale:** Warm, earthy, high-contrast against satellite green terrain. Reads as authoritative, not playful. Used exclusively for primary CTAs and herd markers — don't dilute it.

> **Green convention:** `green-500` on the map = "cattle are here right now." Don't use green for UI chrome — it will clash with paddock polygon fills.

---

### Map Polygon Colors (Mapbox layer fills)

| State | Fill | Fill Opacity | Border |
|---|---|---|---|
| Active / Grazing | `#22c55e` | 0.25 | `#22c55e` @ 1.0 |
| Resting | `#6b7280` | 0.20 | `#6b7280` @ 0.8 |
| Selected | `#38bdf8` | 0.30 | `#38bdf8` @ 1.0 |
| Drawing (in-progress) | `#f59e0b` | 0.20 | `#f59e0b` @ 1.0 |

---

## 2. Typography

**Typeface:** Inter Variable (system default via Tailwind). No display fonts — this is a data tool.

| Scale | Size | Weight | Tracking | Usage |
|---|---|---|---|---|
| Panel heading | `text-sm` (14px) | `font-semibold` (600) | `tracking-wide uppercase` | Panel/card titles ("New Paddock", "Herd Details") |
| Body | `text-sm` (14px) | `font-normal` (400) | — | List items, descriptions |
| Label | `text-xs` (12px) | `font-medium` (500) | — | Input labels, metadata keys |
| Badge | `text-xs` (12px) | `font-medium` (500) | — | Status badges, tags |
| Value/data | `text-sm` (14px) | `font-semibold` (600) | — | Acreage, animal count, days data |
| Map control | `text-xs` (12px) | `font-medium` (500) | `tracking-wide` | Map overlay labels |

> **Rule:** All panel titles use `uppercase tracking-wide font-semibold text-sm text-white/90`. This creates visual hierarchy without relying on size jumps that look heavy on a map.

---

## 3. Spacing & Layout

### Grid / Panels

- Sidebar width: `w-64` (256px) — fixed, left edge
- Map overlays: max `w-72` (288px)
- Panel padding: `p-5` (20px)
- Card gap between elements: `gap-3` (12px) default, `gap-2` (8px) for dense lists
- Overlay top offset: `top-4` (16px) — consistent across all map overlays
- Overlay left offset: `left-4` (16px) — stacks with sidebar when sidebar is open

### Overlay Placement Zones

```
┌─────────────────────────────────────────────────┐
│ [Search Bar]              [Mapbox Controls: ↑↓] │  ← top-4 row
│                                                  │
│                    SATELLITE MAP                 │
│                                                  │
│ [Paddock Panel / New Form]                       │  ← left-4, below search
│                                                  │
│                              [Draw Controls]     │  ← bottom-right, Mapbox default
└─────────────────────────────────────────────────┘
```

- Search bar: always `top-4 left-4`
- New Paddock form: `top-4 left-4` (replaces search when active, or offsets if both visible)
- Paddock panel: `top-4 left-4` or slides in from left — never overlap center map
- Mapbox zoom/bearing controls: bottom-right (default position, keep it there)
- Draw controls: right side, vertically centered — do not move

### Z-index Layers

| Layer | z-index | What's there |
|---|---|---|
| Map canvas | 0 | Mapbox |
| Map controls | 100 | Mapbox built-in controls |
| Overlay panels | 1000 | Search, forms, panels |
| Dialogs/modals | 1100 | MoveHerdDialog |
| Toasts | 1200 | Notifications |

---

## 4. Component Patterns

### Glass Card (base pattern for all panels)

```tsx
<div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-5">
```

Use `rounded-xl` (12px) — not `rounded-lg`. Larger radius looks more intentional on a map.

---

### Input Fields

```tsx
<div>
  <label className="block text-xs text-white/40 mb-1 font-medium">Label</label>
  <input
    className="
      w-full px-3 py-2 text-sm
      bg-white/[0.08] border border-white/10
      text-white placeholder-white/25
      rounded-lg
      focus:outline-none focus:border-white/25 focus:bg-white/[0.10]
      transition-all duration-150
    "
  />
</div>
```

> Labels always go **above** the input as a separate element — never use placeholder-only patterns for labeled fields.  
> Never float text inside an input field (the old "auto-calculated" overlay) — put metadata in the label row.

**Label + meta pattern:**
```tsx
<div className="flex items-center justify-between mb-1">
  <label className="text-xs text-white/40 font-medium">Acreage</label>
  <span className="text-xs text-amber-400/80 font-medium">auto-calculated</span>
</div>
```

---

### Buttons

**Primary (CTA):**
```tsx
<button className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-lg transition-colors duration-150">
  Save Paddock
</button>
```

**Secondary / Ghost:**
```tsx
<button className="px-4 py-2 text-sm font-medium bg-white/[0.08] hover:bg-white/[0.12] text-white/60 hover:text-white/80 border border-white/10 rounded-lg transition-all duration-150">
  Cancel
</button>
```

**Danger:**
```tsx
<button className="px-4 py-2 text-sm font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20 rounded-lg transition-all duration-150">
  Remove
</button>
```

> Never use `bg-green-*` for buttons — green is reserved for grazing state on the map. Amber is the sole CTA color.

---

### Status Badges

```tsx
// Active / Grazing
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/20">
  Grazing
</span>

// Resting
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/[0.08] text-white/50 border border-white/10">
  Resting
</span>

// Alert / Overdue
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/20">
  Overdue
</span>
```

---

### List Items (PaddockPanel, HerdCard rows)

```tsx
<li className="flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.04] cursor-pointer border-b border-white/[0.05] last:border-0 transition-colors duration-100">
  <span className="text-sm text-white/80 truncate">North Pasture</span>
  <StatusBadge />
</li>
```

---

### Dialogs (MoveHerdDialog)

```tsx
// Backdrop
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] flex items-center justify-center">
  {/* Modal */}
  <div className="bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
    ...
  </div>
</div>
```

Use `rounded-2xl` for dialogs (modal feels more substantial than inline panels).

---

## 5. Map UI Conventions

### Search Bar

- Always visible at `top-4 left-4`
- Use SVG icon (magnifying glass), never emoji
- Input: glass style — `bg-black/60 backdrop-blur-md text-white placeholder-white/40 border border-white/10`
- Dropdown results: `bg-zinc-900/95` — slightly more opaque than the input, feels layered
- Max width: `w-72` (288px) — keeps it from obscuring the map
- Hide when the New Paddock form is active to avoid crowding

### Overlay Panels

- All panels max `w-72` — never wider on mobile, never full-width on desktop
- Always `backdrop-blur-md` — no solid backgrounds over the map
- Close affordance: X icon in the header row (top-right of panel), not a bottom button
- Panels should not have scroll containers unless the content genuinely overflows — keep forms short

### Herd Markers

- Amber circle markers (`#f59e0b`) with animal count inside
- White text on amber, `font-semibold`, `text-xs`
- 32×32px hit target minimum
- On click: open HerdCard panel on left side

### Draw Mode

- While drawing a polygon: show a subtle instruction tooltip near the draw controls
- After polygon complete: immediately show New Paddock form
- Drawing fill: amber (`#f59e0b`) @ 20% — matches CTA color, signals "work in progress"

---

## 6. Sidebar Navigation

**Width:** `w-64` (256px)  
**Background:** `bg-zinc-950` (slightly darker than overlay panels — sidebar is structural, not floating)  
**Border:** `border-r border-white/10`

**Nav tabs (5):** Map · Paddocks · Herds · Grazing · Activity

```tsx
// Active tab
<button className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-white bg-white/[0.08] rounded-lg">
  <Icon className="w-4 h-4" />
  Paddocks
</button>

// Inactive tab
<button className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.04] rounded-lg transition-all duration-150">
  <Icon className="w-4 h-4" />
  Herds
</button>
```

**Tab icons:** Use Lucide icons — they're clean, consistent, thin-stroke. Match the professional data-tool aesthetic.

| Tab | Lucide Icon |
|---|---|
| Map | `<Map />` |
| Paddocks | `<Layers />` |
| Herds | `<Users />` |
| Grazing | `<RotateCw />` |
| Activity | `<Activity />` |

---

## 7. Icon Conventions

- **Library:** Lucide React exclusively — no Heroicons, no emojis as UI elements, no mixing
- **Size:** `w-4 h-4` (16px) for inline/button icons, `w-5 h-5` (20px) for standalone/nav icons
- **Color:** Always inherit from parent text color — use `currentColor` via Tailwind
- **Never:** Emoji in inputs, buttons, or labels. Emoji in map popups is acceptable as data (e.g., animal type indicators) but not UI chrome

---

## 8. Do's and Don'ts

### ✅ Do

- Use `backdrop-blur-md` on every panel that floats over the map
- Keep all overlay panels to `w-72` max — the map is the product, not the forms
- Label every input field above with `text-xs text-white/40` — no placeholder-only patterns
- Use amber exclusively for primary CTAs and herd markers
- Use green exclusively for "currently grazing" status — map polygons and badges
- Use Lucide icons — `w-4 h-4` in buttons, `w-5 h-5` in nav
- Test every UI element against the satellite map background — if it looks jarring, it is

### ❌ Don't

- `bg-white` on anything over the map — ever
- `bg-green-*` buttons — green is a semantic map color, not a CTA color
- Emoji in input placeholders (`🔍`) — use SVG icons
- Absolute-positioned text inside inputs (the "auto-calculated" overlay pattern) — use label rows
- `rounded-lg` on full modal dialogs — use `rounded-2xl`
- Mix focus ring colors — `focus:border-white/25` is the one pattern, not `focus:ring-green-500`
- Stack multiple overlay panels visible at the same time — one active panel at a time

---

## 9. Component File Conventions

Each UI region should be its own component:

| Component | File | Description |
|---|---|---|
| `MapSearchBar` | `components/MapSearchBar.tsx` | Search input + dropdown results |
| `NewPaddockForm` | `components/NewPaddockForm.tsx` | Post-draw paddock creation form |
| `PaddockPanel` | `components/PaddockPanel.tsx` | Paddock detail/list view |
| `HerdCard` | `components/HerdCard.tsx` | Individual herd summary |
| `GrazingSessionCard` | `components/GrazingSessionCard.tsx` | Session history row |
| `MoveHerdDialog` | `components/MoveHerdDialog.tsx` | Modal for moving herd to new paddock |
| `SidebarNav` | `components/SidebarNav.tsx` | Left sidebar tab navigation |
| `StatusBadge` | `components/StatusBadge.tsx` | Reusable Grazing/Resting/Overdue badge |

`MapView.tsx` orchestrates state and Mapbox — it should not contain inline JSX for any of the above. Keep it as a coordinator.

---

*Last updated: 2026-04-18 by Prism (Design Lead, Dash Labs)*
