import React, { useState } from 'react';
import { HashLink } from 'react-router-hash-link';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="navbar">
      <div className="logo">JoyTech Solutions</div>
      
      {/* Hamburger Button */}
      <div className="hamburger" onClick={toggleMenu}>
        ☰
      </div>

      {/* Menu Links */}
      <ul className={`nav-links ${isOpen ? 'active' : ''}`}>
        <li><HashLink smooth to="/#home" onClick={closeMenu}>Home</HashLink></li>
        <li><HashLink smooth to="/#services" onClick={closeMenu}>Services</HashLink></li>
        <li><HashLink smooth to="/#projects" onClick={closeMenu}>Projects</HashLink></li>
      </ul>
    </nav>
  );
};

export default Navbar;
