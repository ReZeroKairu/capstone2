import React from "react";

const PaginationControls = ({
  currentPage,
  setCurrentPage,
  totalPages,
  manuscriptsPerPage,
  setManuscriptsPerPage,
}) => {
  const getPageNumbers = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= total; i++) {
      if (
        i === 1 ||
        i === total ||
        (i >= current - delta && i <= current + delta)
      ) {
        range.push(i);
      }
    }

    let prev = null;
    for (let num of range) {
      if (prev !== null) {
        if (num - prev === 2) rangeWithDots.push(prev + 1);
        else if (num - prev > 2) rangeWithDots.push("...");
      }
      rangeWithDots.push(num);
      prev = num;
    }

    return rangeWithDots;
  };

  return (
    <div className="mt-4 p-2 bg-yellow-400 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-2 rounded-sm">
      {/* Page Size Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold text-red-900">Page Size:</span>
        <select
          value={manuscriptsPerPage}
          onChange={(e) => {
            setManuscriptsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="border-2 border-red-800 bg-yellow-400 rounded-md text-red-900 font-bold text-sm"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>
      </div>

      {/* Page Buttons */}
      <div className="flex items-center flex-wrap gap-1 text-sm">
        <button
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className="px-3 py-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          First
        </button>
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Prev
        </button>

        {getPageNumbers(currentPage, totalPages).map((num, idx) =>
          num === "..." ? (
            <span key={`dots-${idx}`} className="px-3 py-1">
              ...
            </span>
          ) : (
            <button
              key={`page-${num}`}
              onClick={() => setCurrentPage(num)}
              className={`px-3 py-1 rounded-lg ${
                num === currentPage
                  ? "bg-red-900 text-white border border-red-900"
                  : "bg-yellow-400 text-red-900 border border-red-900"
              }`}
            >
              {num}
            </button>
          )
        )}

        <button
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages}
          className="px-3 py-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
        <button
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Last
        </button>
      </div>
    </div>
  );
};

export default PaginationControls;
