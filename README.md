# AFIA Water & Beverages — website and online store

AFIA premium purified water, OMI Daily sachet water and AYO non-alcoholic drink mixes, from Lagos, Nigeria.

A single-page static site (`index.html`) with:

- Shop for the AFIA bottle family (Column 50cl, Adire 33cl, Pebble 75cl, Lagoon Sparkling 33cl/75cl)
- OMI Daily sachet water ordered by the bag, with bulk delivery
- Cart with Lagos delivery zones and free-delivery rules
- Checkout that sends the order as a WhatsApp message
- Custom event-bottle and hotel/wholesale request forms

## Orders (Google Sheets)

Orders and enquiries from the website are written to a Google Sheet by a small Google Apps Script web app.

- `google-apps-script/Code.gs`: a standalone script tied to the AFIA Orders sheet by its ID. Create a project at script.google.com, paste it in, run `setup()` once, then deploy it as a web app (Execute as: Me, Who has access: Anyone).
- `config.js`: paste the web app URL (ends in `/exec`) as `sheetsUrl`. Left empty, the site still works and orders go by WhatsApp only.
- The sheet gets three tabs: **Orders** (one row per order, Status dropdown: New → Confirmed → Paid → Out for delivery → Delivered / Cancelled), **Order items** (one row per line) and **Enquiries** (event and business requests).
- The sheet owner gets an email for every new order and enquiry.
- Prices in `Code.gs` are what customers are charged. When you change prices, change them in `Code.gs` and in the `products` list in `index.html`, then redeploy the script (Deploy → Manage deployments → Edit → New version).

`supabase/` holds a ready-made Postgres version of the order database for when the business moves to a paid database.

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
