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
      <div className="fixed right-[120px] bottom-[120px] z-20 max-sm:relative max-sm:right-0 max-sm:bottom-0 max-sm:flex max-sm:justify-center max-sm:w-full">
        <img
          src="/pubtracklogo.png"
          alt="PubTrack Logo"
          className="h-[350px] sm:h-[350px] md:h-[450px] lg:h-[500px] max-sm:h-[350px] max-sm:ml-36"
        />
      </div>
    </div>
  );
}

export default Home;
