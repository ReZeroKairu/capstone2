import React from "react";

const journals = [
  {
    title: "JOURNAL OF MULTIDISCIPLINARY STUDIES",
    discipline: "Multidisciplinary Studies",
    publisher: "Misamis University",
    publisherLink: "https://mu.edu.ph",
    image: "/journals/homepageImage_en_US.jpg",
    link: "https://asianscientificjournals.com/new/publication/index_php/jmds/",
  },
  {
    title: "LICEO JOURNAL OF HIGHER EDUCATION RESEARCH",
    discipline: "Multidisciplinary Studies",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "/journals/ldcuj1.jpg",
    link: "/journals/advancing-biology-research",
  },
  {
    title: "ASIAN JOURNAL OF BIODIVERSITY",
    discipline: "Biodiversity; Ecology",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "/journals/ldcuj2.jpg",
    link: "/journals/advancing-pharmacy-research",
  },
  {
    title: "ASIAN JOURNAL OF HEALTH",
    discipline: "Health Sciences",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "/journals/ldcuj3.jpg",
    link: "/journals/advancing-radiologic-technology-research",
  },
  {
    title: "ASIAN JOURNAL OF BUSINESS AND GOVERNANCE",
    discipline: "Business Magement And Education; Technology",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "/journals/ldcuj4.jpg",
    link: "/journals/asian-journal-of-medical-sciences",
  },
  {
    title:
      "SCHOOL OF GRADUATE STUDIES RESEARCH JOURNAL LICEO DE CAGAYAN UNIVERSITY",
    discipline: "Multidisciplinary Studies",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "/journals/ldcuj5.jpg",
    link: "/journals/international-journal-of-education",
  },
  {
    title: "ADVANCING BUSINESS AND ACCOUNTANCY RESEARCH",
    discipline: "Business & Accountancy",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "/journals/ldcuj6.jpg",
    link: "/journals/philippine-journal-of-law",
  },
  {
    title: "ADVANCING MANAGEMENT RESEARCH",
    discipline: "Management",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "/journals/ldcuj7.jpg",
    link: "/journals/innovations-in-technology-and-engineering",
  },
  {
    title: "ADVANCING BIOLOGY RESEARCH",
    discipline: "Biology",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "/journals/ldcuj8.jpg",
    link: "/journals/journal-of-nursing-research",
  },
  {
    title: "ADVANCING EDUCATION RESEARCH",
    discipline: "Education",
    publisher: "Liceo de Cagayan University",
    publisherLink: "https://liceo.edu.ph",
    image: "/journals/ldcuj9.jpg",
    link: "/journals/asian-journal-of-social-sciences",
  },
];

const Journals = () => {
  return (
    <div className="min-h-screen w-full flex flex-col px-6 py-12 bg-white">
      <h1 className="mt-20 text-3xl font-extrabold text-black mb-10">
        LIST OF JOURNALS
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-6">
        {journals.map((journal, index) => (
          <a
            href={journal.link}
            key={index}
            className="bg-[#FFCD2B] border-2 border-transparent rounded-xl overflow-hidden shadow-md p-4 flex flex-col items-center transition-all duration-300 hover:scale-105 hover:border-[#800000]"
          >
            <img
              src={journal.image}
              alt={journal.title}
              className="w-[160px] h-[210px] object-contain mb-3 border-4 border-white"
            />
            <h2 className="text-sm font-bold text-center mb-1">
              {journal.title}
            </h2>
            <p className="text-xs text-center leading-snug">
              Discipline: {journal.discipline}
              <br />
              Publisher:{" "}
              <a
                href={journal.publisherLink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-800 hover:text-blue-600"
              >
                {journal.publisher}
              </a>
            </p>
          </a>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <a
          href="https://asianscientificjournals.com/new/publication/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white px-8 py-2 text-sm font-semibold rounded-full hover:bg-gray-800 transition"
        >
          SEE MORE
        </a>
      </div>
    </div>
  );
};

export default Journals;
