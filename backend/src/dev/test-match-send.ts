import "dotenv/config";
import { ensureDb, saveDb, saveStudent } from "../db.js";
import { notify } from "../notify/index.js";
import type { StudentProfile, MatchRecord } from "../types.js";

async function main() {
  console.log("Starting test-match-send script...");
  const db = await ensureDb();

  const email = "shiwenwang@connect.hku.hk";
  let studentShiwen = db.students.find(s => s.email.toLowerCase() === email.toLowerCase());

  if (!studentShiwen) {
    studentShiwen = {
      id: "shiwen-wang-test",
      fullName: "Shiwen Wang",
      email,
      universityId: "hku",
      yearOfStudy: "Year 3",
      major: "Data Science",
      gender: "Female",
      seeking: "Meaningful connection",
      bio: "Hi! I am testing the beautified email formatting for DopaMine matches.",
      languages: ["English", "Cantonese", "Mandarin"],
      interests: ["coffee", "books", "museums", "photography"],
      vibeTags: ["thoughtful", "curious", "warm"],
      dealBreakers: [],
      verificationStatus: "verified",
      joinedAt: new Date().toISOString(),
      optedIn: true,
      availability: ["Fri 4pm", "Sat 2pm"],
      profileComplete: true,
      crossUniOk: true,
      blockedUserIds: [],
      onboardingStage: "complete",
      preferredLocale: "zh-HK", // Default fallback if new
    };
    db.students.push(studentShiwen);
    console.log("Created test student profile for Shiwen Wang (defaulting to zh-HK).");
  } else {
    console.log(`Found existing student profile for Shiwen Wang. Preferred locale in DB: ${studentShiwen.preferredLocale}`);
    // Force preferredLocale to zh-CN as requested
    studentShiwen.preferredLocale = "zh-CN";
    studentShiwen.profileComplete = true;
    await saveStudent(studentShiwen);
    console.log("Forced preferredLocale to zh-CN and updated student profile in DB.");
  }

  // Find a partner (Daniel Wong, from demo data)
  const partner = db.students.find(s => s.id === "demo-hku-daniel") || db.students.find(s => s.id !== studentShiwen!.id);
  if (!partner) {
    throw new Error("Could not find any other student in the database to match with.");
  }
  console.log(`Matching Shiwen Wang with partner: ${partner.fullName} (${partner.id})`);

  // Create a match record if it doesn't exist
  let match = db.matches.find(m => 
    (m.userAId === studentShiwen!.id && m.userBId === partner.id) ||
    (m.userBId === studentShiwen!.id && m.userAId === partner.id)
  );

  if (!match) {
    match = {
      id: "test-match-shiwen",
      createdAt: new Date().toISOString(),
      dropDate: new Date().toISOString(),
      userAId: studentShiwen.id,
      userBId: partner.id,
      score: 95,
      status: "pending",
      reasonsForA: [
        "You both share a passion for coffee, art exhibitions, and photography.",
        "Both of you prefer slow campus walks and relaxed weekend vibes.",
        "Strong compatibility based on your warm, curious, and thoughtful personalities."
      ],
      reasonsForB: [
        "Shiwen's interest in museums and book dates fits your design and art aesthetic.",
        "Complementary communication styles: she is thoughtful and you are observant.",
        "High availability overlap on Friday afternoon and Saturday."
      ],
      posterHeadline: "Campus coffee & photo walk",
      curatedDateTitle: "Coffee & Campus walk",
      curatedDateSpot: "Main Library Cafe, HKU",
      curatedDateTips: ["Talk about your favorite photography spots", "Take a stroll near the Lily Pond"],
      overlapSlots: ["Fri 4pm", "Sat 2pm"],
      feedback: []
    };
    db.matches.push(match);
    console.log("Created test match record in pending state.");
  } else {
    console.log(`Found existing match record (${match.id}), reusing it.`);
    // Reset status to pending so we can drop it
    match.status = "pending";
  }

  // Save the database
  await saveDb(db);
  console.log("Saved database changes.");

  // Send the email drop notification
  console.log(`Triggering match_drop notification to ${studentShiwen.email}...`);
  const result = await notify(studentShiwen, "match_drop", { match, partner });

  console.log("\n-------------------------------------------");
  console.log(`Notification Result: ok=${result.ok}`);
  console.log("-------------------------------------------");

  if (result.ok) {
    console.log("Email sent successfully!");
  } else {
    console.log("Email failed to send. Please check Resend API key or provider status.");
  }
}

main().catch(console.error);
