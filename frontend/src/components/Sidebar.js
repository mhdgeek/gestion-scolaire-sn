import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: '📊', label: 'Dashboard' },
    { path: '/eleves', icon: '👨‍🎓', label: 'Élèves' },
    { path: '/import-eleves', icon: '📥', label: 'Import Élèves' },
    { path: '/classes', icon: '🏫', label: 'Classes' },
    { path: '/notes', icon: '📝', label: 'Notes' },
  ];

  return (
    <div className="bg-green-800 w-64 min-h-screen shadow-lg">
      <div className="p-6">
        <h2 className="text-white text-xl font-bold">Gestion Scolaire</h2>
        <p className="text-yellow-400 text-sm">Sénégal</p>
      </div>
      
      <nav className="mt-8">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center px-6 py-3 text-white transition-colors duration-200 ${
              location.pathname === item.path
                ? 'bg-red-700 bg-opacity-20 border-r-4 border-yellow-400'
                : 'hover:bg-red-700 hover:bg-opacity-10'
            }`}
          >
            <span className="text-lg mr-3">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
