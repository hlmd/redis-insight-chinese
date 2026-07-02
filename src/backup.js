// src/backup.js
import { cpSync, existsSync, rmSync } from "fs";

export function ensureBackup(asarPath) {
  const bakAsar = asarPath + ".bak";
  const srcUnpacked = asarPath + ".unpacked";
  const bakUnpacked = asarPath + ".bak.unpacked";
  if (!existsSync(bakAsar)) {
    cpSync(asarPath, bakAsar);
    if (existsSync(srcUnpacked)) cpSync(srcUnpacked, bakUnpacked, { recursive: true });
  }
  return { bakAsar, bakUnpacked: existsSync(bakUnpacked) ? bakUnpacked : null };
}

export function restore(asarPath) {
  const bakAsar = asarPath + ".bak";
  const bakUnpacked = asarPath + ".bak.unpacked";
  const dstUnpacked = asarPath + ".unpacked";
  if (!existsSync(bakAsar)) throw new Error("未找到备份 " + bakAsar + "，无法还原");
  cpSync(bakAsar, asarPath);
  if (existsSync(bakUnpacked)) {
    rmSync(dstUnpacked, { recursive: true, force: true });
    cpSync(bakUnpacked, dstUnpacked, { recursive: true });
  }
}
