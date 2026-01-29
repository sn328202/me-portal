import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { GiSecretBook, GiScrollUnfurled, GiCardRandom, GiClockwork, GiGears, GiCookingPot, GiOpenTreasureChest, GiBookshelf, GiWorld, GiCompass } from 'react-icons/gi';
import './AppShell.css';

const AppShell = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: GiSecretBook, label: 'Dashboard' },
    { path: '/atlas', icon: GiWorld, label: 'The Atlas' },
    { path: '/daydream', icon: GiCompass, label: 'The Daydream' },
    { path: '/larder', icon: GiCookingPot, label: 'The Larder' },
    { path: '/treasury', icon: GiOpenTreasureChest, label: 'The Treasury' },
    { path: '/study', icon: GiSecretBook, label: 'The Study' },
    { path: '/library', icon: GiBookshelf, label: 'The Library' },
    { path: '/learning', icon: GiScrollUnfurled, label: 'Learning' },
    { path: '/play', icon: GiCardRandom, label: 'Play' },
    { path: '/systems', icon: GiClockwork, label: 'Systems' },
    { path: '/settings', icon: GiGears, label: 'Settings' },
  ];

  return (
    <div className="app-shell">
      <nav className="sidebar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            aria-label={item.label}
          >
            <item.icon size={28} />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default AppShell;
