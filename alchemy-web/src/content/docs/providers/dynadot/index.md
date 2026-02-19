# Dynadot

The Dynadot provider allows you to register and manage domain names and DNS records using the Dynadot RESTful API V2.

[Official Dynadot Website](https://www.dynadot.com/)

## Resources

- [Domain](./domain.md) - Register and manage domain settings.
- [DNSRecord](./dns-record.md) - Manage individual DNS records.

## Example Usage

```ts
import { Domain, DNSRecord } from "alchemy/dynadot";

// Register a new domain in the sandbox
const domain = await Domain("main", {
  domainName: "example.com",
  duration: 1,
  sandbox: true
});

// Create a DNS record
await DNSRecord("web-ip", {
  domain,
  host: "www",
  type: "A",
  value: "1.2.3.4",
  sandbox: true
});
```
