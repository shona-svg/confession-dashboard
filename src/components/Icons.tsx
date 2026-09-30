// Simple line icons in the brand's clean, flat style.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 11.5 12 5l8 6.5" />
    <path d="M6 10v9h12v-9" />
  </Base>
);
export const BoardIcon = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="4.5" width="5" height="15" rx="1.5" />
    <rect x="9.5" y="4.5" width="5" height="10" rx="1.5" />
    <rect x="15.5" y="4.5" width="5" height="12.5" rx="1.5" />
  </Base>
);
export const PeopleIcon = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
    <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17 14.4c1.9.5 3.1 2 3.5 4.6" />
  </Base>
);
export const CalendarIcon = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Base>
);
export const BellIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Base>
);
export const ChartIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 20h16" />
    <path d="M7 16v-5M12 16V7M17 16v-8" />
  </Base>
);
export const CogIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </Base>
);
export const PlusIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const PhoneIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z" />
  </Base>
);
export const NoteIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 3.5h9l3.5 3.5v13.5H6z" />
    <path d="M9 11h6M9 14.5h6M9 18h3.5" />
  </Base>
);
export const MailIcon = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </Base>
);
export const FormIcon = (p: P) => (
  <Base {...p}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Base>
);
export const BriefcaseIcon = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
    <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" />
  </Base>
);
export const StepIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 12h12M13 7l5 5-5 5" />
  </Base>
);
export const StarIcon = (p: P) => (
  <Base {...p}>
    <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" />
  </Base>
);
export const MenuIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);
export const CloseIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);
export const CursorIcon = (p: P) => (
  <Base {...p}>
    <path d="m6 4 12 7-5.5 1.5L10 18z" />
  </Base>
);
