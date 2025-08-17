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
      <div className="relative flex-1 w-full">
        <img
          src="/pubtracklogo.png"
          alt="PubTrack Logo"
          className="
            h-[300px] md:h-[280px] lg:h-[300px] 
            absolute bottom-[100px] right-[200px] 
            max-sm:static max-sm:mx-auto max-sm:mt-40 max-sm:h-[350px]
          "
        />
      </div>
    </div>
  );
}

export default Home;
