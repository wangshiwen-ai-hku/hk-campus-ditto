import type { University } from "./types.js";

export const universities: University[] = [
  {
    id: "hku",
    name: "The University of Hong Kong",
    shortName: "HKU",
    domains: ["hku.hk", "connect.hku.hk"],
    campuses: ["Pok Fu Lam"],
    safeSpots: ["Main Library Café", "Sun Yat-sen Place", "Composite Building Coffee Corner"]
  },
  {
    id: "cuhk",
    name: "The Chinese University of Hong Kong",
    shortName: "CUHK",
    domains: ["link.cuhk.edu.hk", "cuhk.edu.hk"],
    campuses: ["Sha Tin"],
    safeSpots: ["Yasumoto Terrace", "Lake Ad Excellentiam", "United College Coffee Corner"]
  },
  {
    id: "hkust",
    name: "The Hong Kong University of Science and Technology",
    shortName: "HKUST",
    domains: ["connect.ust.hk", "ust.hk"],
    campuses: ["Clear Water Bay"],
    safeSpots: ["Academic Concourse", "Seafront Piazza", "Shaw Auditorium Café"]
  },
  {
    id: "polyu",
    name: "The Hong Kong Polytechnic University",
    shortName: "PolyU",
    domains: ["connect.polyu.hk", "polyu.edu.hk"],
    campuses: ["Hung Hom"],
    safeSpots: ["VA Terrace", "Innovation Tower Plaza", "Campus Café"]
  },
  {
    id: "cityu",
    name: "City University of Hong Kong",
    shortName: "CityUHK",
    domains: ["cityu.edu.hk"],
    campuses: ["Kowloon Tong"],
    safeSpots: ["Festival Walk Bridge", "Yeung Kin Man Courtyard", "Creative Media Centre Lounge"]
  },
  {
    id: "hkbu",
    name: "Hong Kong Baptist University",
    shortName: "HKBU",
    domains: ["hkbu.edu.hk"],
    campuses: ["Kowloon Tong"],
    safeSpots: ["AAB Courtyard", "Visual Arts Deck", "Baptist University Road Café"]
  },
  {
    id: "lingnan",
    name: "Lingnan University",
    shortName: "Lingnan",
    domains: ["ln.edu.hk"],
    campuses: ["Tuen Mun"],
    safeSpots: ["New Academic Block Atrium", "Student Commons", "Campus Coffee Point"]
  },
  {
    id: "eduhk",
    name: "The Education University of Hong Kong",
    shortName: "EdUHK",
    domains: ["eduhk.hk", "eduhk.edu.hk"],
    campuses: ["Tai Po"],
    safeSpots: ["Central Plaza", "Library Café", "Tai Po Lookout Garden"]
  }
];
