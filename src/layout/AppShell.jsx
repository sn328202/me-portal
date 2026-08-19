import React from 'react';
import { NavLink } from 'react-router-dom';
import { GiSecretBook, GiScrollUnfurled, GiCardRandom, GiClockwork, GiGears, GiCookingPot, GiOpenTreasureChest, GiBookshelf, GiWorld, GiCompass, GiDesk } from 'react-icons/gi';
import './AppShell.css';

const AppShell = ({ children }) => {
  // Dashboard and The Study both used GiSecretBook, so two of the eleven
  // destinations were literally the same glyph in a collapsed rail.
  // The Study gets the desk.
  const navItems = [
    { path: '/', icon: GiSecretBook, label: 'Dashboard' },
    { path: '/atlas', icon: GiWorld, label: 'The Atlas' },
    { path: '/daydream', icon: GiCompass, label: 'The Daydream' },
    { path: '/larder', icon: GiCookingPot, label: 'The Larder' },
    { path: '/treasury', icon: GiOpenTreasureChest, label: 'The Treasury' },
    { path: '/study', icon: GiDesk, label: 'The Study' },
    { path: '/library', icon: GiBookshelf, label: 'The Library' },
    { path: '/learning', icon: GiScrollUnfurled, label: 'Learning' },
    { path: '/play', icon: GiCardRandom, label: 'Play' },
    { path: '/systems', icon: GiClockwork, label: 'Systems' },
    { path: '/settings', icon: GiGears, label: 'Settings' },
  ];

  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Rooms">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={item.label}
          >
            <span className="nav-glyph" aria-hidden="true">
              <item.icon size={24} />
            </span>
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
