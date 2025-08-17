import React from 'react';
import { Menu, Bell } from 'lucide-react';

interface MobileNavbarV2Props {
  isMenuOpen: boolean;
  setIsMenuOpen: (isOpen: boolean) => void;
  title: string;
}

const MobileNavbarV2: React.FC<MobileNavbarV2Props> = ({ isMenuOpen, setIsMenuOpen, title }) => {
  return (
    <header className="mobile-navbar-v2">
      <button 
        className="navbar-menu-btn"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Menu"
      >
        <Menu size={24} />
      </button>
      
      <div className="navbar-brand">
        <h1 className="navbar-title-v2">{title}</h1>
      </div>
      
      <button className="navbar-notification-btn" aria-label="Notifications">
        <Bell size={22} />
        <span className="notification-badge">3</span>
      </button>
    </header>
  );
};

export default MobileNavbarV2;