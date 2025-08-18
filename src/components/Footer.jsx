import React from "react";

const Footer = () => {
  return (
    <footer
      className="
        bg-red-800 text-white py-4 px-6 sm:px-12
        w-full mt-auto
        relative z-20
        fixed bottom-0 left-0
        md:static
        pb-16 md:pb-4   /* extra bottom padding on mobile, normal on desktop */
      "
    >
      {/* Main text */}
      <p className="text-xs sm:text-sm md:text-base text-center">
        © 2024 PubTrack - Liceo de Cagayan University. All rights reserved.
      </p>

      {/* Links */}
      <div className="mt-3 flex flex-wrap justify-center items-center gap-2 sm:gap-4 text-xs sm:text-sm">
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
