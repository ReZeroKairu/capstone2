import React from "react";

function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-full relative">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: "url('/bg.jpg')" }}
      />
      <div className="relative flex flex-col items-center justify-center h-full bg-black bg-opacity-5">
        <img
          src="/pubtracklogo.png"
          alt="PubTrack Logo"
          className="h-[450px] sm:h-[350px] md:h-[400px] lg:h-[450px]"
        />
      </div>
    </div>
  );
}

export default Home;
