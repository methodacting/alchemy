# Porkbun

The Porkbun provider allows you to register and manage domain names and DNS records using the Porkbun API.

[Official Porkbun Website](https://porkbun.com/)

## Resources

- [Domain](./domain.md) - Register and manage domain settings.
- [DNSRecord](./dns-record.md) - Manage individual DNS records.

## Example Usage

```ts
import { Domain, DNSRecord } from "alchemy/porkbun";

// Manage an existing domain
const domain = await Domain("main", {
  domain: "example.com",
  adopt: true,
  autoRenew: true
});

// Create a DNS record
await DNSRecord("web-ip", {
  domain,
  name: "www",
  type: "A",
  content: "1.2.3.4"
});
```
