import { existsSync, statSync } from "fs";
import { join, win32 } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

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
    const local = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
    const pf = process.env["ProgramFiles"] || "C:/Program Files";
    const names = ["Redis Insight", "RedisInsight", "redisinsight"];
    const dirs = [
      ...registryInstallDirs(),
      ...names.map((n) => join(local, "Programs", n)),
      ...names.map((n) => join(pf, n)),
    ];
    return [...new Set(dirs)].map((d) => join(d, "resources", "app.asar"));
  }
  if (platform === "darwin") {
    return [
      "/Applications/Redis Insight.app/Contents/Resources/app.asar",
      "/Applications/RedisInsight.app/Contents/Resources/app.asar",
      join(home, "Applications", "Redis Insight.app", "Contents", "Resources", "app.asar"),
    ];
  }
  return [
    "/opt/Redis Insight/resources/app.asar",
    "/opt/RedisInsight/resources/app.asar",
    "/usr/lib/redisinsight/resources/app.asar",
  ];
}

// 从 `reg query ... /s /f Redis` 的输出里提取安装目录。
// electron-builder 的 NSIS 安装器写入 DisplayIcon / UninstallString,自定义目录时 InstallLocation 常为空。
export function parseRegInstallDirs(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s+(InstallLocation|DisplayIcon|UninstallString)\s+REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if (m[1] === "InstallLocation") {
      v = v.replace(/^"|"$/g, "");
    } else {
      const q = /^"([^"]+)"/.exec(v);
      v = q ? q[1] : v.replace(/,\s*-?\d+$/, "").split(/\s+\//)[0];
      if (!/\.exe$/i.test(v)) continue;
      v = win32.dirname(v); // 注册表里只会是 Windows 路径,在任何平台上都按 Windows 规则解析
    }
    if (v && /redis/i.test(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

function registryInstallDirs() {
  const roots = [
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  ];
  const dirs = [];
  for (const root of roots) {
    try {
      // 先切到 UTF-8 代码页,避免中文安装路径在 GBK 控制台下乱码
      const text = execSync(`chcp 65001 >nul && reg query "${root}" /s /f Redis`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      });
      for (const d of parseRegInstallDirs(text)) if (!dirs.includes(d)) dirs.push(d);
    } catch {
      // 未找到匹配时 reg 返回非 0,忽略
    }
  }
  return dirs;
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
