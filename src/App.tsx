import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/',       label: 'Повне дерево', end: true },
  { to: '/shemet', label: 'Шемети' },
];

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Family Tree</h1>
        <nav style={{ display: 'flex', gap: 8 }}>
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                padding: '4px 12px',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: isActive ? 700 : 400,
                background: isActive ? '#1e293b' : 'transparent',
                color: isActive ? '#f8fafc' : '#475569',
                border: '1px solid #cbd5e1',
                fontSize: 13,
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
