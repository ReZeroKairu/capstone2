import React from "react";

const journals = [
  {
    title: "JOURNAL OF MULTIDISCIPLINARY STUDIES",
    discipline: "Multidisciplinary Studies",
    publisher: "Misamis University",
    publisherLink: "https://mu.edu.ph",
    image: "journals/homepageImage_en_US.jpg",
    link: "https://asianscientificjournals.com/new/publication/index_php/jmds/",
  },
  {
    title: "LICEO JOURNAL OF HIGHER EDUCATION RESEARCH",
    discipline: "Multidisciplinary Studies",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "journals/ldcuj1.jpg",
    link: "https://asianscientificjournals.com/new/publication/",
  },
  {
    title: "ASIAN JOURNAL OF BIODIVERSITY",
    discipline: "Biodiversity; Ecology",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "journals/ldcuj2.jpg",
    link: "https://asianscientificjournals.com/new/publication/",
  },
  {
    title: "ASIAN JOURNAL OF HEALTH",
    discipline: "Health Sciences",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "journals/ldcuj3.jpg",
    link: "https://asianscientificjournals.com/new/publication/",
  },
  {
    title: "ASIAN JOURNAL OF BUSINESS AND GOVERNANCE",
    discipline: "Business Magement And Education; Technology",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "journals/ldcuj4.jpg",
    link: "https://asianscientificjournals.com/new/publication/",
  },
  {
    title:
      "SCHOOL OF GRADUATE STUDIES RESEARCH JOURNAL LICEO DE CAGAYAN UNIVERSITY",
    discipline: "Multidisciplinary Studies",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "journals/ldcuj5.jpg",
    link: "https://asianscientificjournals.com/new/publication/",
  },
  {
    title: "ADVANCING BUSINESS AND ACCOUNTANCY RESEARCH",
    discipline: "Business & Accountancy",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "journals/ldcuj6.jpg",
    link: "https://asianscientificjournals.com/new/publication/",
  },
  {
    title: "ADVANCING MANAGEMENT RESEARCH",
    discipline: "Management",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "journals/ldcuj7.jpg",
    link: "https://asianscientificjournals.com/new/publication/",
  },
  {
    title: "ADVANCING BIOLOGY RESEARCH",
    discipline: "Biology",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "journals/ldcuj8.jpg",
    link: "https://asianscientificjournals.com/new/publication/",
  },
  {
    title: "ADVANCING EDUCATION RESEARCH",
    discipline: "Education",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "journals/ldcuj9.jpg",
    link: "https://asianscientificjournals.com/new/publication/",
  },
  {
    title: "ADVANCING PSYCHOLOGY RESEARCH",
    discipline: "Physical Theraphy",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "journals/ldcuj11.jpg",
    link: "https://asianscientificjournals.com/new/publication/index_php/apsyr/",
  },
  {
    title: "ADVANCING PHYSICAL THERAPY RESEARCH",
    discipline: "EducationPsychology",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "journals/ldcuj10.jpg",
    link: "https://asianscientificjournals.com/new/publication/index_php/aptr/",
  },
];

const Journals = () => {
  return (
    <div className="min-h-screen w-full md:pt-20 flex flex-col px-4 sm:px-6 lg:px-24 py-8 bg-white">
      <h1 className="mt-16 text-2xl sm:text-3xl font-extrabold text-black mb-8 text-center sm:text-left">
        LIST OF JOURNALS
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {journals.map((journal, index) => (
          <a
            href={journal.link}
            key={index}
            className="bg-[#FFCD2B] border-2 border-transparent rounded-lg overflow-hidden shadow-md p-2 sm:p-3 flex flex-col items-center transition-all duration-300 hover:scale-105 hover:border-[#800000]"
          >
            <img
              src={journal.image}
              alt={journal.title}
              className="w-[120px] sm:w-[130px] h-[160px] sm:h-[180px] object-contain mb-2 sm:mb-3 border-2 sm:border-4 border-white"
            />
            <h2 className="text-xs sm:text-sm font-bold text-center mb-1">
              {journal.title}
            </h2>
            <p className="text-[9px] sm:text-xs text-center leading-snug">
              Discipline: {journal.discipline}
              <br />
              Publisher:{" "}
              <span
                onClick={() => window.open(journal.publisherLink, "_blank")}
                className="underline text-blue-800 hover:text-blue-600 cursor-pointer"
              >
                {journal.publisher}
              </span>
            </p>
          </a>
        ))}
      </div>

      <div className="mt-6 sm:mt-10 flex justify-center">
        <a
          href="https://asianscientificjournals.com/new/publication/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white px-6 sm:px-8 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-full hover:bg-gray-800 transition"
        >
          SEE MORE
        </a>
      </div>
    </div>
  );
};

export default Journals;
