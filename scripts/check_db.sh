cd backend
npm exec tsx -- -e 'import { ensureDb } from "./src/db.ts"; (async () => { const db
  = await ensureDb(); console.log(JSON.stringify({ students: db.students.length,
  matches: db.matches.length, surveys: db.surveys.length, inviteCodes:
  db.inviteCodes.length, verificationCodes: db.verificationCodes.length }, null,
  2)); })();'