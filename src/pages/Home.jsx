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
      <img
        src="/pubtracklogo.png"
        alt="PubTrack Logo"
        className="
    h-[300px] sm:h-[280px] md:h-[350px] lg:h-[420px] 
    absolute bottom-[50px] right-[70px] 
    max-sm:static max-sm:mx-auto max-sm:mt-40 max-sm:h-[250px]
  "
      />
    </div>
  );
}

export default Home;
