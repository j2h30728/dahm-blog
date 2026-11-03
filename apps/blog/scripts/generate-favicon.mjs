import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../../packages/content-sync/package.json", import.meta.url));
const sharp = require("sharp");
const source = fileURLToPath(new URL("../assets/favicon/hamster.png", import.meta.url));
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map((size) => sharp(source).resize(size, size).png({ compressionLevel: 9 }).toBuffer()));
const directory = Buffer.alloc(6 + 16 * frames.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile(new URL("../public/favicon.ico", import.meta.url), Buffer.concat([directory, ...frames]));
await sharp(source).resize(64, 64).png({ compressionLevel: 9 })
  .toFile(fileURLToPath(new URL("../public/favicon.png", import.meta.url)));
console.log("햄스터 파비콘 ICO 16/32/48px와 PNG 64px 생성 완료");
