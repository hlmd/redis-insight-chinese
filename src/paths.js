import { readdirSync, statSync } from "fs";
import { join } from "path";

export function toPosix(p) {
  return p.replace(/\\/g, "/");
}

export function walkFileTree(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFileTree(full));
    else out.push(full);
  }
  return out;
}
