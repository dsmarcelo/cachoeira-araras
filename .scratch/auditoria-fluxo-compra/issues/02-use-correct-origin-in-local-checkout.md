# 02: Use the correct origin in local checkout

**What to build:** Make the configuration of URLs used by checkout and webhook explicit and safe, keeping purchase and return on the same origin during local testing so that browser history remains available.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The webhook configuration accepts only a base URL without a path and fails with a clear message when receiving an invalid value.
- [ ] The development environment uses the correct base URL, without relying on silently discarding a configured path.
- [ ] The documented local flow keeps purchase and return on the same origin, including tunnel usage when necessary.
- [ ] Returning to an origin without local history continues using the existing recovery mechanism, without breaking the payment screen.
