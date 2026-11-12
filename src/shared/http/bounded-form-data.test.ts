import { describe, expect, it } from "vitest";
import { readBoundedFormData } from "./bounded-form-data";

describe("multipart stream budget", () => {
  it("reads a bounded form and file without trusting a declared body length", async () => {
    const form = new FormData(); form.set("module", "implantations"); form.set("file", new File(["%PDF-test"], "proof.pdf"));
    const request = new Request("http://localhost/api/erp/evidence", { method: "POST", body: form });
    const parsed = await readBoundedFormData(request, 4096);
    expect(parsed.get("module")).toBe("implantations");
    expect(parsed.get("file")).toBeInstanceOf(File);
  });
  it("rejects actual oversized data even if Content-Length lies", async () => {
    const body = `--test\r\nContent-Disposition: form-data; name="file"; filename="proof.pdf"\r\n\r\n${"x".repeat(4096)}\r\n--test--\r\n`;
    const request = new Request("http://localhost/api/erp/evidence", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=test", "content-length": "1" }, body });
    await expect(readBoundedFormData(request, 1024)).rejects.toThrow(/limite/);
  });
  it("rejects oversized headers and non-multipart input before parsing", async () => {
    await expect(readBoundedFormData(new Request("http://localhost", { method: "POST", body: "hello" }), 100)).rejects.toThrow();
    const form = new FormData(); form.set("a", "b"); const request = new Request("http://localhost", { method: "POST", body: form }); request.headers.set("content-length", "10000");
    await expect(readBoundedFormData(request, 100)).rejects.toThrow();
  });
});
