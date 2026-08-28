const dns = require('dns');
const ipaddr = require('ipaddr.js');

/**
 * Validates the basic syntax of the URL and enforces HTTP/HTTPS.
 * Throws an Error if invalid.
 */
const validateUrlSyntax = (urlString) => {
  const parsed = new URL(urlString);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }
  return parsed;
};

/**
 * Checks if a parsed IP address belongs to a safe, public unicast range.
 * Throws an Error if the IP is in a blocked range.
 */
const validateIpAddress = (ipString) => {
  if (ipString === '0.0.0.0' || ipString === '::') {
    throw new Error('Blocked IP address: ' + ipString);
  }

  const ip = ipaddr.parse(ipString);
  const range = ip.range();

  const blockedRanges = [
    'private',
    'loopback',
    'linkLocal',
    'broadcast',
    'carrierGradeNat',
    'multicast',
    'unspecified',
    'reserved'
  ];

  if (blockedRanges.includes(range)) {
    throw new Error(`Blocked IP range: ${range}`);
  }

  return true;
};

/**
 * Early validation of a hostname before DNS resolution.
 * Rejects obvious bad hostnames like localhost, while optionally allowing host.docker.internal.
 */
const validateHostname = (hostname) => {
  // Allow host.docker.internal ONLY if not in production
  if (hostname === 'host.docker.internal' && process.env.NODE_ENV !== 'production') {
    return true;
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Blocked hostname: localhost');
  }

  // If the hostname is an IPv6 with brackets, strip them
  let cleanHostname = hostname;
  if (cleanHostname.startsWith('[') && cleanHostname.endsWith(']')) {
    cleanHostname = cleanHostname.slice(1, -1);
  }

  // If the hostname is an IP itself, validate it directly
  if (ipaddr.isValid(cleanHostname)) {
    validateIpAddress(cleanHostname);
  }

  return true;
};

/**
 * Custom DNS lookup function that forces SSRF validation on the resolved IP.
 * Used by http.Agent and https.Agent to prevent DNS rebinding.
 */
const safeLookup = (hostname, options, callback) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err);

    try {
      // Allow host.docker.internal ONLY if not in production
      if (hostname === 'host.docker.internal' && process.env.NODE_ENV !== 'production') {
        return callback(null, address, family);
      }

      // Check the resolved IP(s) to prevent DNS Rebinding
      let addressesToValidate = [];
      if (Array.isArray(address)) {
        // Node's dns.lookup returns an array of objects like { address: '...', family: 4 } when options.all is true
        addressesToValidate = address.map(a => typeof a === 'object' ? a.address : a);
      } else {
        addressesToValidate = [address];
      }

      for (const addr of addressesToValidate) {
        validateIpAddress(addr);
      }
      
      callback(null, address, family);
    } catch (e) {
      // Log the specific details internally for debugging, but don't leak them externally
      console.error(`[SSRF Validator] Blocked DNS resolution for ${hostname}: ${e.message}`);
      // Return a generic error to prevent exposing internal network topologies via the API/DB
      callback(new Error('SSRF Prevention: Destination resolved to a blocked or invalid IP address.'));
    }
  });
};

/**
 * Creates an http.Agent or https.Agent configured with safeLookup.
 */
const createSafeAgent = (AgentClass) => {
  return new AgentClass({
    lookup: safeLookup,
    keepAlive: false // Avoid caching connections to a potentially re-bound IP
  });
};

module.exports = {
  validateUrlSyntax,
  validateIpAddress,
  validateHostname,
  safeLookup,
  createSafeAgent
};
