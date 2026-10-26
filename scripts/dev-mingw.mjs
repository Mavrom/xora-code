// Runs `tauri dev` with the LLVM-MinGW toolchain instead of MSVC, for Windows
// machines without Visual Studio Build Tools.
//
// Needs: `rustup toolchain install stable-x86_64-pc-windows-gnullvm` and an
// unpacked llvm-mingw release (https://github.com/mstorsjo/llvm-mingw). Point
// XORA_LLVM_MINGW at its folder, or unpack it to %LOCALAPPDATA%\xora-toolchain.
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const toolchainRoot =
  process.env.XORA_LLVM_MINGW ?? join(process.env.LOCALAPPDATA ?? "", "xora-toolchain");

function findLlvmMingw(root) {
  if (existsSync(join(root, "bin", "x86_64-w64-mingw32-clang.exe"))) return root;
  if (!existsSync(root)) return null;
  const nested = readdirSync(root)
    .filter((name) => name.startsWith("llvm-mingw"))
    .map((name) => join(root, name))
    .find((dir) => existsSync(join(dir, "bin", "x86_64-w64-mingw32-clang.exe")));
  return nested ?? null;
}

const llvmMingw = findLlvmMingw(toolchainRoot);
if (!llvmMingw) {
  console.error(
    `llvm-mingw not found under ${toolchainRoot}.\n` +
      "Download a *-ucrt-x86_64.zip from https://github.com/mstorsjo/llvm-mingw/releases,\n" +
      "unpack it there (or set XORA_LLVM_MINGW), then run this again.",
  );
  process.exit(1);
}

const env = {
  ...process.env,
  PATH: `${join(llvmMingw, "bin")};${process.env.PATH ?? ""}`,
  RUSTUP_TOOLCHAIN: "stable-x86_64-pc-windows-gnullvm",
  // Separate from the MSVC target dir so the two toolchains never mix artifacts.
  CARGO_TARGET_DIR: resolve("src-tauri", "target", "gnullvm"),
};

const child = spawn("npx", ["tauri", "dev", ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 0));
