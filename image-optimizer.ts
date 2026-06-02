import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const inputDir = "public/images/novas";
const outputDir = "public/images/novas";

const outputWidth = 768;
const allowedExtensions = [".png", ".jpg", ".jpeg"];

await fs.mkdir(outputDir, { recursive: true });

const entries = await fs.readdir(inputDir, { withFileTypes: true });

for (const entry of entries) {
  if (!entry.isFile()) continue;

  const ext = path.extname(entry.name).toLowerCase();
  if (!allowedExtensions.includes(ext)) continue;

  const input = path.join(inputDir, entry.name);
  const name = path.parse(entry.name).name;

  console.log(`Optimizing ${entry.name}...`);

  await sharp(input)
    .resize({ width: outputWidth, withoutEnlargement: true })
    .avif({ quality: 55, effort: 3 })
    .toFile(path.join(outputDir, `${name}.avif`));
}
