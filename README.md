# AFIA Water — website and online store

Premium purified water from Lagos, Nigeria, plus OMI Daily sachet water.

A single-page static site (`index.html`) with:

- Shop for the AFIA bottle family (Column 50cl, Adire 33cl, Pebble 75cl, Lagoon Sparkling 33cl/75cl)
- OMI Daily sachet water ordered by the bag, with bulk delivery
- Cart with Lagos delivery zones and free-delivery rules
- Checkout that sends the order as a WhatsApp message
- Custom event-bottle and hotel/wholesale request forms

## Orders database (Supabase)

- `supabase/migrations/001_orders.sql` creates the catalogue, orders, order items, enquiries and staff tables, with row-level security. Customers can only place orders and enquiries through the `place_order` and `submit_enquiry` functions, which re-price every item from the database. Only emails in the `admins` table can read or update orders.
- `config.js` holds the project URL and publishable key. Left empty, the site still works and orders go by WhatsApp only.
- `admin.html` is the staff page: sign in, see new orders live, change status (new → confirmed → paid → out for delivery → delivered), add notes, and manage event and business enquiries.

To add a staff member: create their user in Supabase (Authentication → Users → Add user), then run
`insert into public.admins (email) values ('their@email.com');`

When you change prices, update both `product_packs` in the database and the `products` list in `index.html`. The database price is what gets charged.

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
