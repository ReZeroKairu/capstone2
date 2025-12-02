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
    h-[350px] sm:h-[350px] md:h-[450px] lg:h-[500px]
    absolute bottom-[100px] right-[120px] transition-all duration-300
    max-sm:relative max-sm:h-[350px] max-sm:ml-36 max-sm:z-10
  "
/>
      </div>
    </div>
  );
}

export default Home;
