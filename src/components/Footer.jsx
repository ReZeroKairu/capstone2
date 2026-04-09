import React from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer
      className="
    bg-red-800 text-white py-4 px-6 sm:px-12
    w-full mt-auto
    fixed bottom-0 left-0 z-20
    md:static
    pb-16 md:pb-4
  "
    >
      {/* Main text */}
      <p className="text-xs sm:text-sm md:text-base text-center">
        © 2024 PubTrack - Liceo de Cagayan University. All rights reserved.
      </p>

      {/* Links */}
      <div className="mt-3 flex flex-wrap justify-center items-center gap-2 sm:gap-4 text-xs sm:text-sm">
        <Link 
          to="/privacy" 
          className="hover:underline text-white hover:text-yellow-300 transition-colors"
        >
          Privacy Policy
        </Link>
        <Link 
          to="/terms" 
          className="hover:underline text-white hover:text-yellow-300 transition-colors"
        >
          Terms of Service
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
