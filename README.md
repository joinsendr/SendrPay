# Sendr Pay

A standalone cross-border payment wallet prototype — pay local merchants abroad using a USDC-denominated wallet. This is a **frontend-only UI prototype**: no backend, no blockchain integration, no real payment processing. All data is mock data.

Live at [sendrpay.sendr.cash](https://sendrpay.sendr.cash).

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- lucide-react icons

## Development

```bash
npm install
npm run dev
```

## Build & deploy

```bash
npm run build   # tsc -b && vite build
npm run deploy  # build + sync to S3 + CloudFront invalidation
```

Hosted on AWS S3 + CloudFront, same pattern as [sendr.cash](https://sendr.cash).
