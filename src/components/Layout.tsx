import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import logoWhite from '../../brand/confession-logo-white.svg';
import { useStore } from '../data/store';
import { BellIcon, BoardIcon, CalendarIcon, ChartIcon, CloseIcon, CogIcon, HomeIcon, MenuIcon, PeopleIcon } from './Icons';

export default function Layout() {
  const { insights, data, now, resetSampleData } = useStore();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    document.querySelector('.main')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const newLeads = [...insights.values()].filter((i) => i.isNew).length;
  const followUps = [...insights.values()].filter((i) => i.followUpDue || i.replyOverdue).length;
  const toursToday = data.tours.filter((t) => {
    const d = new Date(t.scheduledFor);
    return t.status === 'booked' && d.toDateString() === new Date(now).toDateString();
  }).length;

  const links = [
    { to: '/', label: 'Home', icon: HomeIcon, end: true, count: newLeads || undefined },
    { to: '/pipeline', label: 'Pipeline', icon: BoardIcon },
    { to: '/contacts', label: 'Contacts', icon: PeopleIcon },
    { to: '/tours', label: 'Tours', icon: CalendarIcon, count: toursToday || undefined },
    { to: '/follow-ups', label: 'Follow-ups', icon: BellIcon, count: followUps || undefined },
    { to: '/reports', label: 'Reports', icon: ChartIcon },
    { to: '/settings', label: 'Settings', icon: CogIcon },
  ];

  return (
    <div className="shell">
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <NavLink to="/" className="sidebar-logo" aria-label="Confession home">
              <img src={logoWhite} alt="Confession" />
            </NavLink>
            <span className="sidebar-sub">Functions &amp; events</span>
          </div>
          {open && (
            <button type="button" className="btn ghost" style={{ color: '#fff' }} onClick={() => setOpen(false)} aria-label="Close menu">
              <CloseIcon />
            </button>
          )}
        </div>
        <nav className="nav">
          {links.map(({ to, label, icon: Icon, end, count }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon />
              {label}
              {count ? <span className="count">{count}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">60 Marryatt Street, Port Adelaide</div>
      </aside>
      <div className="main">
        <div className="mobile-bar">
          <img src={logoWhite} alt="Confession" />
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu">
            <MenuIcon size={22} />
          </button>
        </div>
        <div className="sample-banner">
          <span>
            <strong>Sample data.</strong> These are made-up contacts for trying the design. Changes are saved in this
            browser only, and nothing is sent to HubSpot, Mailchimp or clients.
          </span>
          <button type="button" className="link-btn" onClick={resetSampleData}>
            Reset sample data
          </button>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
