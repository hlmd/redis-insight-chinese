import { existsSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export function candidatesFor(install, platform) {
  if (install) {
    return [
      join(install, "resources", "app.asar"),
      join(install, "Contents", "Resources", "app.asar"),
      join(install, "app.asar"),
    ];
  }
  const home = homedir();
  if (platform === "win32") {
    return [
      join(process.env.LOCALAPPDATA || join(home, "AppData", "Local"), "Programs", "RedisInsight", "resources", "app.asar"),
      join(process.env["ProgramFiles"] || "C:/Program Files", "RedisInsight", "resources", "app.asar"),
    ];
  }
  if (platform === "darwin") {
    return [
      "/Applications/Redis Insight.app/Contents/Resources/app.asar",
      join(home, "Applications", "Redis Insight.app", "Contents", "Resources", "app.asar"),
    ];
  }
  return [
    "/opt/RedisInsight/resources/app.asar",
    "/usr/lib/redisinsight/resources/app.asar",
  ];
}

export function locateAsar(install, platform = process.platform) {
  if (install && existsSync(install) && statSync(install).isFile() && install.endsWith(".asar")) {
    return install;
  }
  for (const c of candidatesFor(install, platform)) {
    if (existsSync(c)) return c;
  }
  throw new Error(
    "找不到 app.asar。请用 --install 指定 RedisInsight 安装目录或直接指向 app.asar 文件。"
  );
}
