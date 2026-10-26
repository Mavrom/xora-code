// `npm run tauri ...` entry. Runs the Tauri CLI as usual, except on Windows machines
// without the MSVC linker (Visual Studio Build Tools): there it switches to the
// LLVM-MinGW toolchain when one is available, so `npm run tauri dev` still works.
//
// `--mingw` (or `npm run dev:mingw`) forces the MinGW toolchain.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const forceMingw = args.includes("--mingw");
const cliArgs = args.filter((a) => a !== "--mingw");

/** True when an MSVC C++ toolset (with link.exe) is installed. */
function hasMsvc() {
  const roots = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles].filter(Boolean);
  for (const root of roots) {
    const vs = join(root, "Microsoft Visual Studio");
    if (!existsSync(vs)) continue;
    for (const year of readdirSync(vs)) {
      for (const edition of safeList(join(vs, year))) {
        const msvc = join(vs, year, edition, "VC", "Tools", "MSVC");
        for (const version of safeList(msvc)) {
          if (existsSync(join(msvc, version, "bin", "Hostx64", "x64", "link.exe"))) return true;
        }
      }
    }
  }
  return false;
}

function safeList(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function findLlvmMingw() {
  const root =
    process.env.XORA_LLVM_MINGW ?? join(process.env.LOCALAPPDATA ?? "", "xora-toolchain");
  const ok = (dir) => existsSync(join(dir, "bin", "x86_64-w64-mingw32-clang.exe"));
  if (ok(root)) return root;
  return (
    safeList(root)
      .filter((name) => name.startsWith("llvm-mingw"))
      .map((name) => join(root, name))
      .find(ok) ?? null
  );
}

let env = process.env;
const wantsMingw = process.platform === "win32" && (forceMingw || !hasMsvc());
if (wantsMingw) {
  const llvmMingw = findLlvmMingw();
  if (!llvmMingw) {
    if (forceMingw) {
      console.error(
        "llvm-mingw not found. Unpack a *-ucrt-x86_64.zip from\n" +
          "https://github.com/mstorsjo/llvm-mingw/releases to %LOCALAPPDATA%\\xora-toolchain\n" +
          "(or set XORA_LLVM_MINGW) and run `rustup toolchain install stable-x86_64-pc-windows-gnullvm`.",
      );
      process.exit(1);
    }
    // No fallback available: let the Tauri CLI report the missing MSVC linker itself.
  } else {
    console.log(`[xora] MSVC linker not used; building with LLVM-MinGW (${llvmMingw}).`);
    env = {
      ...process.env,
      PATH: `${join(llvmMingw, "bin")};${process.env.PATH ?? ""}`,
      RUSTUP_TOOLCHAIN: "stable-x86_64-pc-windows-gnullvm",
      // Separate from the MSVC target dir so the two toolchains never mix artifacts.
      CARGO_TARGET_DIR: resolve("src-tauri", "target", "gnullvm"),
    };
  }
}

const child = spawn("npx", ["--no-install", "tauri", ...cliArgs], {
  env,
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 0));
