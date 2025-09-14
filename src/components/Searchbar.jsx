import React from "react";
import { FaSearch } from "react-icons/fa";

const SearchBar = ({ searchQuery, setSearchQuery, setCurrentPage }) => {
  return (
    <div className="relative mb-4 w-full max-w-xl mx-auto">
      <input
        type="text"
        placeholder="Search manuscripts"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setCurrentPage(1); // reset to first page on search
        }}
        className="w-full pl-10 pr-2 py-2 border-[3px] border-red-900 rounded text-base
               focus:outline-none focus:border-red-900 focus:ring-2 focus:ring-red-900"
      />
      <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-yellow-500" />
    </div>
  );
};

export default SearchBar;
