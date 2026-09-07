/**
 * Rasterises public/icon.svg into the PNG sizes browsers and iOS want for
 * home-screen install. Run: npm run build:icons
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PUBLIC = path.join(process.cwd(), "public");
const TARGETS = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

async function main() {
  const svg = await readFile(path.join(PUBLIC, "icon.svg"));
  for (const t of TARGETS) {
    const png = await sharp(svg, { density: 384 })
      .resize(t.size, t.size)
      .png()
      .toBuffer();
    await writeFile(path.join(PUBLIC, t.file), png);
    console.log(`wrote public/${t.file} (${t.size}px, ${png.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
