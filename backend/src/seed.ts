import { universities } from "./universities.js";
import type { Database, MatchRecord, StudentProfile } from "./types.js";

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function student(partial: Partial<StudentProfile> & Pick<StudentProfile, "id" | "fullName" | "email" | "universityId">): StudentProfile {
  return {
    yearOfStudy: "Year 3",
    major: "Computer Science",
    gender: "Prefer not to say",
    seeking: "Meaningful connection",
    bio: "I like thoughtful chats, good coffee, and campus walks after class.",
    languages: ["English", "Cantonese"],
    interests: ["coffee", "cantopop", "hiking", "photography"],
    vibeTags: ["thoughtful", "funny", "ambitious"],
    dealBreakers: ["ghosting"],
    verificationStatus: "verified",
    joinedAt: daysFromNow(-7),
    optedIn: true,
    availability: ["Thu 6pm", "Fri 4pm", "Sat 2pm"],
    profileComplete: true,
    ...partial
  };
}

export function makeSeedDatabase(): Database {
  const students: StudentProfile[] = [
    student({
      id: "demo-hku-alyssa",
      fullName: "Alyssa Chan",
      email: "alyssa@connect.hku.hk",
      universityId: "hku",
      major: "Law",
      yearOfStudy: "Year 4",
      interests: ["matcha", "museum dates", "books", "harbour walks"],
      vibeTags: ["calm", "witty", "curious"],
      bio: "Final-year HKU law student who likes low-pressure dates, bookstores, and people with a sense of humour."
    }),
    student({
      id: "demo-hku-daniel",
      fullName: "Daniel Wong",
      email: "daniel@connect.hku.hk",
      universityId: "hku",
      major: "Architecture",
      interests: ["design", "harbour walks", "coffee", "film photography"],
      vibeTags: ["creative", "warm", "observant"],
      bio: "Architecture student who notices the little things. Best date format: coffee plus a slow campus walk."
    }),
    student({
      id: "demo-cuhk-zoe",
      fullName: "Zoe Lau",
      email: "zoe@link.cuhk.edu.hk",
      universityId: "cuhk",
      major: "Psychology",
      interests: ["coffee", "psychology", "running", "cantopop"],
      vibeTags: ["empathetic", "playful", "grounded"],
      bio: "Into thoughtful conversation, emotional intelligence, and a great playlist."
    }),
    student({
      id: "demo-cuhk-ethan",
      fullName: "Ethan Ho",
      email: "ethan@link.cuhk.edu.hk",
      universityId: "cuhk",
      major: "Medicine",
      interests: ["fitness", "podcasts", "coffee", "sunset walks"],
      vibeTags: ["steady", "kind", "smart"],
      bio: "Med student who values punctuality, warmth, and someone who can laugh at bad jokes."
    }),
    student({
      id: "demo-hkust-mia",
      fullName: "Mia Cheng",
      email: "mia@connect.ust.hk",
      universityId: "hkust",
      major: "Business",
      interests: ["startups", "beach sunsets", "coffee", "travel plans"],
      vibeTags: ["direct", "energetic", "friendly"],
      bio: "UST business student. I like easy chemistry, clear communication, and scenic coffee spots."
    }),
    student({
      id: "demo-hkust-ryan",
      fullName: "Ryan Lee",
      email: "ryan@connect.ust.hk",
      universityId: "hkust",
      major: "Engineering",
      interests: ["coding", "coffee", "basketball", "night views"],
      vibeTags: ["loyal", "funny", "focused"],
      bio: "Engineering student who prefers one good conversation over endless texting."
    })
  ];

  const matches: MatchRecord[] = [
    {
      id: "demo-match-1",
      createdAt: new Date().toISOString(),
      dropDate: new Date().toISOString(),
      userAId: "demo-hku-alyssa",
      userBId: "demo-hku-daniel",
      score: 92,
      status: "scheduled",
      reasonsForA: [
        "Both of you like calm first dates with coffee and walking",
        "Shared interest in visual culture, architecture, and city spaces",
        "Similar pace: thoughtful, observant, low-drama energy"
      ],
      reasonsForB: [
        "You both prefer intentional dates over endless back-and-forth chat",
        "Alyssa values humour and design sensibility, which maps well to your profile",
        "Strong overlap on harbour walks, coffee, and reflective conversation"
      ],
      posterHeadline: "A campus coffee date with real conversation energy",
      curatedDateTitle: "Golden-hour walk + coffee",
      curatedDateSpot: "Main Library Café, HKU",
      curatedDateTips: [
        "Start with one thing you are each excited about this week",
        "Take a short campus loop after drinks",
        "Keep the first meet to 45-60 minutes"
      ],
      overlapSlots: ["Fri 4pm", "Sat 2pm"],
      confirmedSlot: "Fri 4pm",
      feedback: []
    }
  ];

  return {
    universities,
    students,
    matches,
    verificationCodes: []
  };
}
