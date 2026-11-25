# AFIA Water — website and online store

Premium purified water from Lagos, Nigeria, plus OMI Daily sachet water.

A single-page static site (`index.html`) with:

- Shop for the AFIA bottle family (Column 50cl, Adire 33cl, Pebble 75cl, Lagoon Sparkling 33cl/75cl)
- OMI Daily sachet water ordered by the bag, with bulk delivery
- Cart with Lagos delivery zones and free-delivery rules
- Checkout that sends the order as a WhatsApp message
- Custom event-bottle and hotel/wholesale request forms

## Deploy

Hosted on GitHub Pages from the `main` branch root. `.nojekyll` makes Pages serve the file as-is.

## Before going live

Replace the sample values in `index.html`:

- `WA` constant — your WhatsApp number in international format (e.g. `2348012345678`)
- Contact phone and email in the footer and cart
- Prices in the `products` array and delivery fees in `zones`
- Mineral analysis table — your laboratory results
- NAFDAC registration numbers once issued

Card payments (Paystack or Flutterwave) can be added once the site is on its own domain.
