import React from "react";

function Home() {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: "url('/bg.jpg')" }}
      />

      {/* Logo */}
      <div className="max-sm:flex max-sm:flex-1 max-sm:items-center max-sm:justify-center">
        <img
          src="/pubtracklogo.png"
          alt="PubTrack Logo"
          className="
      h-[300px] sm:h-[280px] md:h-[350px] lg:h-[420px] 
      absolute bottom-[50px] right-[70px] 
      max-sm:relative max-sm:h-[300px] max-sm:ml-36 max-sm:z-10
    "
        />
      </div>
    </div>
  );
}

export default Home;
