import React from "react";

const Footer = () => {
  return (
    <footer className="bg-red-800 text-white py-4 px-6 sm:px-12 text-center mt-auto">
      <p>© 2024 PubTrack - Liceo de Cagayan University. All rights reserved.</p>

      {/* Optional links */}
      <div className="mt-2 flex justify-center flex-wrap gap-4 text-sm">
        <a href="/privacy" className="hover:underline">
          Privacy Policy
        </a>
        <a href="/terms" className="hover:underline">
          Terms of Service
        </a>
        <a href="/contact" className="hover:underline">
          Contact Us
        </a>
      </div>
    </footer>
  );
};

export default Footer;
