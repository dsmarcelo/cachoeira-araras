import { randomBytes, scryptSync } from "node:crypto";

function printUsage() {
  console.error('Usage: pnpm password:hash -- "<password>"');
  console.error("Use the generated hash for ADMIN_PASSWORD_HASH or EMPLOYEE_PASSWORD_HASH.");
}

const args = process.argv.slice(2);
const passwordParts = args[0] === "--" ? args.slice(1) : args;
const password = passwordParts.join(" ");

if (!password) {
  printUsage();
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const derivedKey = scryptSync(password, salt, 64).toString("hex");

console.log(`scrypt$${salt}$${derivedKey}`);
