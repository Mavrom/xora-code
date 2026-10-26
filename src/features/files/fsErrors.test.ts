import { describe, expect, it } from "vitest";
import { describeFsError, parseFsError } from "./fsErrors";

describe("parseFsError", () => {
  it("splits a coded message into code and OS text", () => {
    expect(parseFsError("[not_found] Sistem belirtilen dosyayı bulamıyor. (os error 2)")).toEqual({
      code: "not_found",
      detail: "Sistem belirtilen dosyayı bulamıyor. (os error 2)",
    });
  });

  it("treats unknown codes and plain text as unknown", () => {
    expect(parseFsError("[weird] x").code).toBe("unknown");
    expect(parseFsError("disk full")).toEqual({ code: "unknown", detail: "disk full" });
    expect(parseFsError(new Error("[binary] stream did not contain valid UTF-8")).code).toBe(
      "binary",
    );
  });
});

describe("describeFsError", () => {
  it("explains known failures in Turkish", () => {
    expect(describeFsError("[not_found] os error 2")).toMatch(/bulunamadı/);
    expect(describeFsError("[binary] invalid utf-8")).toMatch(/ikili/);
    expect(describeFsError("[permission_denied] os error 5")).toBe("Erişim izni yok.");
  });

  it("passes other errors through unchanged", () => {
    expect(describeFsError("permission denied")).toBe("permission denied");
  });
});
