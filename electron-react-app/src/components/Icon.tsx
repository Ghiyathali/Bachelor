// #80: a few simple line icons, drawn inline so the app needs no icon library.
// They use currentColor, so they take the text colour around them (light and dark mode).
const paths = {
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .6 3.5 2.6 3.5 5" /></>,
  star: <path d="M12 3l2.8 5.8 6.2.8-4.5 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.8z" />,
  message: <path d="M4 5h16v11H9l-5 4z" />,
  circleCheck: <><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9.5 12.5l2 2 3-3.5" /></>,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  printer: <><path d="M7 8V3h10v5" /><rect x="3" y="8" width="18" height="9" rx="2" /><rect x="7" y="14" width="10" height="7" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  qrcode: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v.01M14 21h.01M17 21h4v-4" /></>,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />,
  megaphone: <path d="M3 10v4h3l7 4V6L6 10H3zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></>,
}

export type IconName = keyof typeof paths

export default function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      {paths[name]}
    </svg>
  )
}
