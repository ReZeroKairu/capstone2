import React from "react";

const FilterButtons = ({ filter, setFilter, manuscripts }) => {
  const filters = [
    { label: "All", value: "all" },
    { label: "Assigning Peer Reviewer", value: "Assigning Peer Reviewer" },
    { label: "Peer Reviewer Assigned", value: "Peer Reviewer Assigned" },
    { label: "Peer Reviewer Reviewing", value: "Peer Reviewer Reviewing" },
    { label: "Back to Admin", value: "Back to Admin" },
    { label: "For Publication", value: "For Publication" },
    { label: "Rejected", value: "Rejected" },
  ];

  const countByFilter = (value) => {
    if (value === "all")
      return manuscripts.filter((m) => m.status !== "Pending").length;
    return manuscripts.filter((m) => m.status === value).length;
  };

  return (
    <div className="flex gap-2 mb-6 justify-center sm:justify-start flex-wrap">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => setFilter(f.value)}
          className={`px-3 py-1 rounded ${
            filter === f.value
              ? "bg-yellow-200 text-[#211B17] border border-[#7B2E19]"
              : "bg-white border border-gray-300"
          }`}
        >
          {f.label} ({countByFilter(f.value)})
        </button>
      ))}
    </div>
  );
};

export default FilterButtons;
