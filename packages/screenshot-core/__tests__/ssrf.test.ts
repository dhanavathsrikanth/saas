import { describe, expect, it } from "vitest";
import {
  assertSafeHostname,
  isBlockedHostname,
  isBlockedIP,
  isPrivateIPv4,
  MAX_REDIRECTS,
  validateRedirectUrl,
  validateUrl,
  validateUrlFormat,
} from "../ssrf";
import { SSRFBlockedError } from "../errors";

const allowAll: (host: string) => Promise<string[]> = async () => ["93.184.216.34"];

describe("IPv4 private detection", () => {
  it.each([
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "127.0.0.1",
    "169.254.169.254",
    "0.0.0.0",
  ])("marks %s as private", (ip) => {
    expect(isPrivateIPv4(ip)).toBe(true);
    expect(isBlockedIP(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "142.250.80.46"])(
    "marks %s as public",
    (ip) => {
      expect(isPrivateIPv4(ip)).toBe(false);
      expect(isBlockedIP(ip)).toBe(false);
    },
  );
});

describe("IPv6 blocking", () => {
  it.each(["::1", "::", "fc00::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])(
    "blocks %s",
    (ip) => {
      expect(isBlockedIP(ip)).toBe(true);
    },
  );

  it("allows a public IPv6 address", () => {
    expect(isBlockedIP("2606:4700:4700::1111")).toBe(false);
  });
});

describe("hostname blocking", () => {
  it("blocks localhost", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(() => validateUrlFormat("http://localhost:3000")).toThrow(SSRFBlockedError);
  });

  it("blocks the cloud metadata IP", () => {
    expect(() => validateUrlFormat("http://169.254.169.254/latest/meta-data/")).toThrow(
      SSRFBlockedError,
    );
  });

  it("allows public URLs", () => {
    expect(() => validateUrlFormat("https://example.com")).not.toThrow();
  });

  it("rejects non-http protocols", () => {
    expect(() => validateUrlFormat("ftp://example.com/file")).toThrow(SSRFBlockedError);
    expect(() => validateUrlFormat("file:///etc/passwd")).toThrow(SSRFBlockedError);
  });
});

describe("DNS resolution guard", () => {
  it("passes when the resolver returns public IPs", async () => {
    const addrs = await assertSafeHostname("example.com", allowAll);
    expect(addrs).toEqual(["93.184.216.34"]);
  });

  it("blocks when DNS resolves to a private IP (rebind)", async () => {
    await expect(
      assertSafeHostname("evil.example.com", async () => ["10.0.0.5"]),
    ).rejects.toThrow(SSRFBlockedError);
  });

  it("blocks when DNS resolves to the metadata IP", async () => {
    await expect(
      assertSafeHostname("evil.example.com", async () => ["169.254.169.254"]),
    ).rejects.toThrow(SSRFBlockedError);
  });

  it("blocks unresolvable hostnames", async () => {
    await expect(
      assertSafeHostname(
        "nonexistent.invalid",
        async () => {
          throw new Error("ENOTFOUND");
        },
      ),
    ).rejects.toThrow(SSRFBlockedError);
  });

  it("validateUrl combines format + DNS checks", async () => {
    const parsed = await validateUrl("https://example.com/page", allowAll);
    expect(parsed.hostname).toBe("example.com");
    await expect(validateUrl("http://10.1.2.3/admin", allowAll)).rejects.toThrow(
      SSRFBlockedError,
    );
  });
});

describe("redirect hop validation", () => {
  it("allows hops under the limit", () => {
    expect(() => validateRedirectUrl("https://example.com/a", 0)).not.toThrow();
    expect(() => validateRedirectUrl("https://example.com/a", MAX_REDIRECTS - 1)).not.toThrow();
  });

  it("blocks hops at the limit", () => {
    expect(() => validateRedirectUrl("https://example.com/a", MAX_REDIRECTS)).toThrow(
      SSRFBlockedError,
    );
  });

  it("re-validates each hop for SSRF", () => {
    expect(() => validateRedirectUrl("http://169.254.169.254/", 0)).toThrow(
      SSRFBlockedError,
    );
  });
});
