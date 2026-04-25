import { resetDb } from "./db.js";

const db = await resetDb();
console.log(`Seeded ${db.students.length} students and ${db.matches.length} match(es).`);
