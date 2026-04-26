import { structuredScore } from "../backend/dist/matching/ranker.js";
import { buildContext, isEligibleForRound, isEligiblePair, poolFor } from "../backend/dist/matching/filter.js";
import { confirmSlot, recomputeSlotState } from "../backend/dist/workflow/slot.js";
import { canTransition, transition } from "../backend/dist/workflow/state-machine.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function student(overrides) {
  return {
    id: "user-a",
    fullName: "User A",
    email: "a@connect.hku.hk",
    universityId: "hku",
    yearOfStudy: "Year 3",
    major: "Computer Science",
    gender: "Prefer not to say",
    seeking: "Meaningful connection",
    bio: "Thoughtful coffee chats.",
    languages: ["English", "Cantonese"],
    interests: ["coffee", "hiking", "books"],
    vibeTags: ["curious", "warm", "funny"],
    dealBreakers: [],
    verificationStatus: "verified",
    joinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    optedIn: true,
    availability: ["Thu 6pm", "Fri 4pm"],
    profileComplete: true,
    crossUniOk: false,
    blockedUserIds: [],
    ...overrides,
  };
}

const a = student({ id: "a" });
const b = student({
  id: "b",
  fullName: "User B",
  email: "b@connect.hku.hk",
  interests: ["coffee", "film", "books"],
  vibeTags: ["curious", "calm"],
  availability: ["Fri 4pm", "Sat 2pm"],
});
const c = student({ id: "c", universityId: "cuhk", email: "c@link.cuhk.edu.hk" });

const emptyCtx = buildContext({ universities: [], students: [a, b, c], matches: [], verificationCodes: [], inviteCodes: [], surveys: [] });

assert(isEligibleForRound(a, emptyCtx), "verified complete opted-in user should be eligible");
assert(!isEligibleForRound({ ...a, optedIn: false }, emptyCtx), "opted-out user should not be eligible");
assert(isEligiblePair(a, b, emptyCtx).ok, "compatible pair should be eligible");
assert(!isEligiblePair({ ...a, blockedUserIds: ["b"] }, b, emptyCtx).ok, "blocked partner should be filtered");
assert(poolFor(a, [a, b, c]).every((x) => x.universityId === "hku"), "same-university pool should be enforced by default");
assert(poolFor({ ...a, crossUniOk: true }, [a, b, c]).length === 3, "cross-university pool should include all users when enabled");

const score = structuredScore(a, b);
assert(score.total > 55, `expected score above threshold, got ${score.total}`);
assert(score.overlap.includes("Fri 4pm"), "score should include overlapping availability");
assert(score.matchedTags.includes("coffee"), "score should include matched interests");

const match = {
  id: "m",
  createdAt: new Date().toISOString(),
  dropDate: new Date().toISOString(),
  userAId: "a",
  userBId: "b",
  score: 88,
  status: "mutual-accepted",
  reasonsForA: [],
  reasonsForB: [],
  posterHeadline: "",
  curatedDateTitle: "",
  curatedDateSpot: "",
  curatedDateTips: [],
  overlapSlots: [],
  feedback: [],
};

assert(canTransition("pending", "notified"), "pending should transition to notified");
assert(!canTransition("pending", "scheduled"), "pending should not transition directly to scheduled");

recomputeSlotState(match, a, b);
assert(match.status === "slot-proposing", `expected slot-proposing, got ${match.status}`);
assert(match.proposedSlots.includes("Fri 4pm"), "slot proposal should include overlapping slot");

const badSlot = confirmSlot(match, "Mon 9am");
assert(!badSlot.ok, "slot outside proposals should be rejected");

const goodSlot = confirmSlot(match, "Fri 4pm");
assert(goodSlot.ok, "proposed slot should be accepted");
assert(match.status === "slot-confirmed", `expected slot-confirmed, got ${match.status}`);

const moved = transition(match, "place-confirmed");
assert(moved.ok && match.status === "place-confirmed", "slot-confirmed should move to place-confirmed");

console.log("Backend logic tests passed.");
