import { iconBadge } from "./ui";

const ICONS: Record<string, string> = Object.assign(Object.create(null), {
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.4-2.4 2.7-2.9z"/>',
  droplet: '<path d="M12 3s6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10z"/>',
  flame: '<path d="M12 3c1.5 4 5 5.2 5 9a5 5 0 0 1-10 0c0-2.2 1.2-3.7 2.5-5.2.4 1.4 1.3 2.3 2.5 2.7C11.5 7.6 11 5.2 12 3z"/>',
  dumbbell: '<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21v-2a5.5 5.5 0 0 1 5.5-5.5h3A5.5 5.5 0 0 1 16 19v2"/><path d="M17 5.5a3 3 0 0 1 0 5.8M18 13.5a5 5 0 0 1 4 5v2.5"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 8.5 20 20M8.5 15.5 20 4"/>',
  sparkles: '<path d="m12 3 1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15zM5 3l.7 1.8L7.5 5.5 5.7 6.2 5 8l-.7-1.8L2.5 5.5l1.8-.7L5 3z"/>',
  shield: '<path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3z"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  "map-pin": '<path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="M6.5 3h3l1.5 4-2 1.5a13 13 0 0 0 6.5 6.5l1.5-2 4 1.5v3A2.5 2.5 0 0 1 18.5 21C10.5 21 3 13.5 3 5.5A2.5 2.5 0 0 1 5.5 3h1z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  leaf: '<path d="M20 4C12 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16z"/><path d="M4 21c3-6 7-9 12-11"/>',
  car: '<path d="m5 16-1-5 2-5h12l2 5-1 5M4 16h16v4h-3v-2H7v2H4v-4z"/><circle cx="7" cy="16" r="1"/><circle cx="17" cy="16" r="1"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/>',
  heart: '<path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3z"/>',
  camera: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
});

export function serviceIcon(name: string, title: string): string {
  const svg = ICONS[String(name ?? "").trim().toLowerCase()];
  if (!svg) return iconBadge(title, "service-icon");
  return `<span class="service-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${svg}</svg></span>`;
}
