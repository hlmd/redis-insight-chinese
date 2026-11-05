import { extractAll, createPackageWithOptions, getRawHeader } from "@electron/asar";

function walkHeader(node, path, cb) {
  if (node.files) {
    for (const [k, v] of Object.entries(node.files)) walkHeader(v, path + "/" + k, cb);
  } else if (node.unpacked) {
    cb(path);
  }
}

export function unpackedSet(asarPath) {
  const { header } = getRawHeader(asarPath);
  const out = [];
  walkHeader(header, "", (p) => out.push(p));
  return out.sort();
}

export function deriveUnpackDir(asarPath) {
  const { header } = getRawHeader(asarPath);
  const pkgs = new Set();
  walkHeader(header, "", (p) => {
    const m = p.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
    if (m) pkgs.add(m[1]);
  });
  if (pkgs.size === 0) return null;
  return `**/node_modules/{${[...pkgs].join(",")}}`;
}

export function extractAsar(srcAsar, destDir) {
  extractAll(srcAsar, destDir);
}

export async function packAsar(srcDir, outAsar, unpackDir) {
  await createPackageWithOptions(srcDir, outAsar, unpackDir ? { unpackDir } : {});
}
