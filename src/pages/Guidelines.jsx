import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

const sections = [
  {
    title: "SUBMISSION OF MANUSCRIPT",
    content:
      "• Manuscripts currently under consideration by another journal or publisher should not be submitted. The author/s must state upon submission that the work has not been submitted or published elsewhere. The author/s must submit a duly signed Mandatory Copyright Transfer.",
  },
  {
    title: "ARTICLE PROCESSING CHARGE",
    content:
      "• Information about charges goes here. Provide details about any fees related to submission, review, or publication.",
  },
  {
    title: "MANUSCRIPT PREPARATION",
    content:
      "• Instructions for preparing your manuscript go here. This includes formatting, citation style, figures, and language requirements.",
  },
];

const Guidelines = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleSection = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow w-full px-12 mt-32 pb-10">
        <div className="text-4xl font-bold text-[#7a0f0f] mb-12">
          Guidelines for Submission
        </div>

        {sections.map((section, index) => {
          const isOpen = openIndex === index;

          return (
            <div key={index} className="mb-6">
              <div
                onClick={() => toggleSection(index)}
                className={`w-full flex items-center border-l-4 ${
                  isOpen ? "border-[#FFD700]" : "border-[#7a0f0f]"
                } pl-4 py-3 cursor-pointer font-semibold text-lg bg-white hover:bg-gray-50 transition`}
              >
                <span>{section.title}</span>
                <ChevronDown
                  className={`ml-auto transition-transform duration-300 ${
                    isOpen ? "rotate-180 text-[#FFD700]" : ""
                  }`}
                />
              </div>

              {/* Animated dropdown */}
              <div
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  isOpen
                    ? "max-h-[500px] opacity-100 py-4"
                    : "max-h-0 opacity-0 py-0"
                }`}
              >
                <div className="text-gray-800 text-base border border-[#FFD700] rounded-md px-6 py-4 leading-relaxed">
                  {section.content}
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default Guidelines;
