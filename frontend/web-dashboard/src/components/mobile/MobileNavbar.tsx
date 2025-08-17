import React from 'react';

interface MobileNavbarProps {
  isMenuOpen: boolean;
  setIsMenuOpen: (isOpen: boolean) => void;
  title: string;
}

const MobileNavbar: React.FC<MobileNavbarProps> = ({ isMenuOpen, setIsMenuOpen, title }) => {
  return (
    <header className="mobile-navbar">
      <button 
        className="menu-button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="메뉴"
      >
        <span className="hamburger">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>
      
      <h1 className="navbar-title">{title}</h1>
      
      <button className="notification-button" aria-label="알림">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>
    </header>
  );
};

export default MobileNavbar;