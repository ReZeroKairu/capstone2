import React from "react";

function Home() {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: "url('/bg.jpg')" }}
      />

      {/* Logo manually placed inside magnifying glass */}
      <img
        src="/pubtracklogo.png"
        alt="PubTrack Logo"
        className="
          absolute
          h-[380px] sm:h-[420px] md:h-[480px] lg:h-[520px]  /* bigger */
          left-[70%] top-[50%]   /* higher */
          -translate-x-1/2 -translate-y-1/2
          z-10
        "
      />
    </div>
  );
}

export default Home;
