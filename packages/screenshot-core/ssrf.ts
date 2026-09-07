import { SSRFBlockedError } from "./errors";

export const MAX_REDIRECTS = 5;

export type DnsResolver = (hostname: string) => Promise<string[]>;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }
  let num = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet < 0 || octet > 255) {
      return null;
    }
    num = num * 256 + octet;
  }
  return num >>> 0;
}

function inCidr(ipInt: number, cidrBase: string, prefix: number): boolean {
  const base = ipv4ToInt(cidrBase);
  if (base === null) {
    return false;
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (base & mask);
}

export function isPrivateIPv4(ip: string): boolean {
  const num = ipv4ToInt(ip);
  if (num === null) {
    return false;
  }
  return (
    inCidr(num, "10.0.0.0", 8) ||
    inCidr(num, "172.16.0.0", 12) ||
    inCidr(num, "192.168.0.0", 16) ||
    inCidr(num, "127.0.0.0", 8) ||
    inCidr(num, "169.254.0.0", 16) ||
    inCidr(num, "0.0.0.0", 8)
  );
}

const BLOCKED_V6 = new Set(["::1", "::", "::ffff:127.0.0.1"]);

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (BLOCKED_V6.has(lower)) {
    return true;
  }
  // Unique local fc00::/7
  if (lower.startsWith("fc") || lower.startsWith("fd")) {
    return true;
  }
  // Link-local fe80::/10
  if (/^fe[89ab]/i.test(lower)) {
    return true;
  }
  // IPv4-mapped private, e.g. ::ffff:10.0.0.1
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1] && isPrivateIPv4(mapped[1])) {
    return true;
  }
  return false;
}

export function isBlockedIP(ip: string): boolean {
  const trimmed = ip.trim().replace(/^\[|\]$/g, "");
  if (ipv4ToInt(trimmed) !== null) {
    return isPrivateIPv4(trimmed);
  }
  if (trimmed.includes(":")) {
    return isBlockedIPv6(trimmed);
  }
  return false;
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(lower)) {
    return true;
  }
  // Cloud metadata endpoints by name
  if (lower === "169.254.169.254") {
    return true;
  }
  return false;
}

export function validateUrlFormat(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SSRFBlockedError(`Invalid URL: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SSRFBlockedError("Only http:// and https:// URLs are allowed");
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new SSRFBlockedError(`Hostname is blocked: ${parsed.hostname}`);
  }
  // Literal IP in the URL — check synchronously
  if (isBlockedIP(parsed.hostname)) {
    throw new SSRFBlockedError(`IP address is blocked: ${parsed.hostname}`);
  }
  return parsed;
}

async function defaultResolver(hostname: string): Promise<string[]> {
  const dns = await import("node:dns/promises");
  const records = await dns.lookup(hostname, { all: true });
  return records.map((r) => r.address);
}

export async function assertSafeHostname(
  hostname: string,
  resolver: DnsResolver = defaultResolver,
): Promise<string[]> {
  if (isBlockedHostname(hostname)) {
    throw new SSRFBlockedError(`Hostname is blocked: ${hostname}`);
  }
  if (isBlockedIP(hostname)) {
    throw new SSRFBlockedError(`IP address is blocked: ${hostname}`);
  }
  let addresses: string[];
  try {
    addresses = await resolver(hostname);
  } catch {
    throw new SSRFBlockedError(`Could not resolve hostname: ${hostname}`);
  }
  if (addresses.length === 0) {
    throw new SSRFBlockedError(`Could not resolve hostname: ${hostname}`);
  }
  for (const addr of addresses) {
    if (isBlockedIP(addr)) {
      throw new SSRFBlockedError(
        `Hostname resolves to a blocked IP address: ${hostname}`,
      );
    }
  }
  return addresses;
}

export async function validateUrl(
  raw: string,
  resolver?: DnsResolver,
): Promise<URL> {
  const parsed = validateUrlFormat(raw);
  await assertSafeHostname(parsed.hostname, resolver);
  return parsed;
}

export function validateRedirectUrl(raw: string, hopCount: number): URL {
  if (hopCount >= MAX_REDIRECTS) {
    throw new SSRFBlockedError(`Too many redirects (max ${MAX_REDIRECTS})`);
  }
  return validateUrlFormat(raw);
}
