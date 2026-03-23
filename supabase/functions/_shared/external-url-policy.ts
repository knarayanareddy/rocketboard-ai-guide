/**
 * External URL Policy Module
 * 
 * This module provides centralized validation for external URLs used in Edge Functions
 * to prevent SSRF (Server-Side Request Forgery).
 */

export interface URLPolicy {
  allowedHosts?: string[];
  allowedHostSuffixes?: string[];
  allowSubdomains?: boolean;
  allowHttp?: boolean;
  allowHttps?: boolean;
  allowAnyHost?: boolean;
  allowedPorts?: number[];
  disallowPrivateIPs?: boolean;
}

const DEFAULT_POLICY: URLPolicy = {
  allowHttps: true,
  allowHttp: false,
  allowAnyHost: false,
  disallowPrivateIPs: true,
  allowedPorts: [80, 443],
};

// Reserved/Private IP ranges (IPv4)
const PRIVATE_CIDR_V4 = [
  "10.0.0.0/8",           // Private-Use
  "172.16.0.0/12",        // Private-Use
  "192.168.0.0/16",       // Private-Use
  "127.0.0.0/8",          // Loopback
  "169.254.0.0/16",       // Link-Local
  "0.0.0.0/8",            // "This" Network
  "100.64.0.0/10",        // Shared Address Space
  "192.0.0.0/24",         // IETF Protocol Assignments
  "192.0.2.0/24",         // TEST-NET-1
  "198.18.0.0/15",        // Network Interconnect Device Benchmark Testing
  "198.51.100.0/24",      // TEST-NET-2
  "203.0.113.0/24",       // TEST-NET-3
  "224.0.0.0/4",          // Multicast
  "240.0.0.0/4",          // Reserved for Future Use
];

const PRIVATE_CIDR_V6 = [
  "::1/128",              // Loopback
  "fc00::/7",             // Unique Local Address
  "fe80::/10",            // Link-Local Address
  "::/128",               // Unspecified Address
];

/**
 * Checks if a string is a raw IP literal (IPv4 or IPv6)
 */
function isIPLiteral(hostname: string): boolean {
  // Simple check for IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return true;
  // Simple check for IPv6 (contains : and maybe [])
  if (hostname.includes(":") || (hostname.startsWith("[") && hostname.endsWith("]"))) return true;
  return false;
}

/**
 * Validates and normalizes an external URL based on security policies.
 * Throws an Error if the URL violates the policy.
 */
export function parseAndValidateExternalUrl(input: string, customPolicy: Partial<URLPolicy> = {}): string {
  const policy = { ...DEFAULT_POLICY, ...customPolicy };
  
  if (!input) throw new Error("Invalid URL: input is empty");

  let url: URL;
  try {
    url = new URL(input);
  } catch (_e) {
    throw new Error("Invalid URL: malformed structure");
  }

  // 1. Protocol Check
  const proto = url.protocol.toLowerCase();
  if (proto === "https:") {
    if (!policy.allowHttps) throw new Error("URL policy violation: https not allowed");
  } else if (proto === "http:") {
    if (!policy.allowHttp) throw new Error("URL policy violation: http not allowed. Https is required.");
  } else {
    throw new Error(`URL policy violation: unsupported protocol "${proto}"`);
  }

  // 2. Credentials Check (reject user:pass@host)
  if (url.username || url.password) {
    throw new Error("URL policy violation: embedded credentials not allowed");
  }

  const hostname = url.hostname.toLowerCase();

  // 3. Port Check
  const port = url.port ? parseInt(url.port) : (proto === "https:" ? 443 : 80);
  if (policy.allowedPorts && !policy.allowedPorts.includes(port)) {
    throw new Error(`URL policy violation: port ${port} is not in the allowlist`);
  }

  // 4. IP Literal Check
  if (isIPLiteral(hostname)) {
    // We strictly forbid raw IP literals by default to prevent bypasses and scanning
    // unless the policy explicitly allows any host (which usually shouldn't happen for IPs)
    if (!policy.allowAnyHost) {
      throw new Error("URL policy violation: raw IP literals are not allowed. Use a domain name.");
    }
    
    // Even if any host is allowed, we still check private ranges
    if (policy.disallowPrivateIPs) {
      // Note: Full CIDR validation would require a library or complex regex.
      // For this implementation, we block common local/private literals.
      const blocked = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254"];
      if (blocked.includes(hostname)) {
        throw new Error("URL policy violation: access to internal/reserved network is forbidden");
      }
    }
  }

  // 5. Hostname Policy Check
  if (!policy.allowAnyHost) {
    let allowed = false;
    
    // Exact match
    if (policy.allowedHosts?.map(h => h.toLowerCase()).includes(hostname)) {
      allowed = true;
    }
    
    // Suffix match (e.g., .atlassian.net)
    if (!allowed && policy.allowedHostSuffixes) {
      for (const suffix of policy.allowedHostSuffixes) {
        const s = suffix.toLowerCase();
        // and ensure it's a true domain suffix (boundary check)
        if (hostname.endsWith(s.startsWith(".") ? s : "." + s)) {
          allowed = true;
          break;
        }
      }
    }

    if (!allowed) {
      throw new Error(`URL policy violation: host "${hostname}" is not in the allowlist`);
    }
  }

  // 6. Final security check for localhost/private strings in hostname
  if (policy.disallowPrivateIPs) {
    const privatePatterns = [/localhost/i, /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./, /169\.254/];
    if (privatePatterns.some(p => p.test(hostname))) {
       throw new Error("URL policy violation: link-local or private network access forbidden");
    }
  }

  // Return canonical string
  return url.toString();
}

/**
 * A secure fetch wrapper that handles redirects manually and validates 
 * each redirect Location against the SSRF policy before following it.
 * This prevents attackers from bypassing host checks by returning 302s to internal IPs.
 */
export async function safeFetch(url: string, init: RequestInit = {}, customPolicy: Partial<URLPolicy> = {}): Promise<Response> {
  let currentUrl = parseAndValidateExternalUrl(url, customPolicy);
  let attempts = 0;
  const maxRedirects = 5;

  while (attempts < maxRedirects) {
    attempts++;
    const response = await fetch(currentUrl, { ...init, redirect: "manual" });
    
    // Intercept redirects (301, 302, 303, 307, 308)
    if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
      const location = response.headers.get("location")!;
      // Resolve relative redirects against the current URL
      const nextUrl = new URL(location, currentUrl).toString();
      
      // CRITICAL: Validate the new redirect target against the SSRF policy
      currentUrl = parseAndValidateExternalUrl(nextUrl, customPolicy);
    } else {
      return response;
    }
  }
  
  throw new Error(`safeFetch: Too many redirects (max ${maxRedirects})`);
}
