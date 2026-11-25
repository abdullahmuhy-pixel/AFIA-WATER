/**
 * AFIA Water & Beverages: order book in Google Sheets.
 * Standalone version: create a new project at script.google.com, paste this in, run setup() once,
 * then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * It writes to the "AFIA Orders" spreadsheet below.
 *
 * Prices below are what customers are charged: the website's prices are only for display.
 * Keep them in step with the products list in index.html.
 */

const SHEET_ID = '17_6QfCZskwsArJ8c7IgUq4VewrJ27okI8w2GjOLyxKs';
function book() { return SpreadsheetApp.openById(SHEET_ID); }

const CATALOGUE = {
  col50: { name: 'Column 50cl', live: true,  packs: [['Single', 1, 1200], ['Box of 6', 6, 6900], ['Box of 12', 12, 13200], ['Case of 24', 24, 25200]] },
  adi33: { name: 'Adire 33cl',  live: true,  packs: [['Single', 1, 900], ['Box of 6', 6, 5100], ['Box of 12', 12, 9900], ['Case of 24', 24, 18900]] },
  peb75: { name: 'Pebble 75cl', live: false, packs: [['Single', 1, 1800], ['Box of 6', 6, 10200], ['Box of 12', 12, 19800], ['Case of 24', 24, 38400]] },
  lag33: { name: 'Lagoon Sparkling 33cl', live: false, packs: [['Single', 1, 1100], ['Box of 6', 6, 6300], ['Box of 12', 12, 12300], ['Case of 24', 24, 24000]] },
  lag75: { name: 'Lagoon Sparkling 75cl', live: false, packs: [['Single', 1, 2200], ['Box of 6', 6, 12600], ['Box of 12', 12, 24600], ['Case of 24', 24, 48000]] },
  omi:   { name: 'OMI Daily sachet (20 × 50cl per bag)', live: true,
           packs: [['10 bags', 10, 5500], ['50 bags', 50, 24000], ['100 bags', 100, 45000], ['200 bags · distributor', 200, 86000]] },
  // AYO drink mixes (1 part AYO + 5 parts water)
  ayo_zobo: { name: 'AYO Zobo', live: true, packs: [['1 litre bottle', 1, 2800], ['Carton of 6 × 1 litre', 6, 15600], ['5 litre Party Pack', 1, 12500]] },
  ayo_chapman: { name: 'AYO Chapman', live: true, packs: [['1 litre bottle', 1, 2800], ['Carton of 6 × 1 litre', 6, 15600], ['5 litre Party Pack', 1, 12500]] },
  ayo_orange: { name: 'AYO Orange', live: true, packs: [['1 litre bottle', 1, 2800], ['Carton of 6 × 1 litre', 6, 15600], ['5 litre Party Pack', 1, 12500]] },
  ayo_pineapple: { name: 'AYO Pineapple', live: true, packs: [['1 litre bottle', 1, 2800], ['Carton of 6 × 1 litre', 6, 15600], ['5 litre Party Pack', 1, 12500]] },
  ayo_ginger: { name: 'AYO Ginger-Lemon', live: true, packs: [['1 litre bottle', 1, 2800], ['Carton of 6 × 1 litre', 6, 15600], ['5 litre Party Pack', 1, 12500]] }
};

const ZONES = [
  ['Lekki, VI, Ikoyi', 2500],
  ['Ajah, Sangotedo, Ibeju-Lekki', 3500],
  ['Ikeja, Yaba, Surulere, Gbagada, Maryland', 3000],
  ['Ikorodu, Alimosho, Festac, Badagry road', 4500],
  ['Pickup from factory', 0]
];

const FREE_DELIVERY_FROM = 50000;   // naira
const SACHET_FREE_BAGS = 100;       // free delivery from this many sachet bags
const EMAIL_NEW_ORDERS = true;      // email the sheet owner for each new order or enquiry

const DATE_FMT = 'd mmm yyyy, h:mm am/pm';

const ORDER_STATUSES = ['New', 'Confirmed', 'Paid', 'Out for delivery', 'Delivered', 'Cancelled'];
const ENQUIRY_STATUSES = ['New', 'Contacted', 'Quoted', 'Won', 'Lost'];

const SHEETS = {
  orders:    { name: 'Orders', head: ['Order code', 'Placed', 'Status', 'Customer', 'Phone', 'Address', 'Area', 'Delivery date', 'Items', 'Subtotal (₦)', 'Delivery (₦)', 'Total (₦)', 'Staff notes'] },
  items:     { name: 'Order items', head: ['Order code', 'Placed', 'Product', 'Pack', 'Units per pack', 'Unit price (₦)', 'Quantity', 'Line total (₦)'] },
  enquiries: { name: 'Enquiries', head: ['Received', 'Type', 'Name', 'Phone', 'Details', 'Status', 'Staff notes'] }
};

/** Run once from the Apps Script editor to build the tabs. Safe to run again. */
function setup() {
  const ss = book();
  ss.setSpreadsheetTimeZone('Africa/Lagos');
  try { ss.setSpreadsheetLocale('en_NG'); } catch (e) { ss.setSpreadsheetLocale('en_GB'); }
  Object.keys(SHEETS).forEach(function (k) {
    const def = SHEETS[k];
    const sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.head.length).setValues([def.head]).setFontWeight('bold').setBackground('#0a3846').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  const orders = ss.getSheetByName(SHEETS.orders.name);
  statusDropdown(orders, 3, ORDER_STATUSES);
  orders.getRange('B2:B').setNumberFormat(DATE_FMT);
  orders.getRange('J2:L').setNumberFormat('#,##0');
  orders.setColumnWidth(6, 260); orders.setColumnWidth(9, 320);
  const rules = [
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('New').setBackground('#fde9c8').setRanges([orders.getRange('C2:C')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Delivered').setBackground('#d9f1e1').setRanges([orders.getRange('C2:C')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Cancelled').setBackground('#f6d8d8').setRanges([orders.getRange('C2:C')]).build()
  ];
  orders.setConditionalFormatRules(rules);
  const items = ss.getSheetByName(SHEETS.items.name);
  items.getRange('B2:B').setNumberFormat(DATE_FMT);
  items.getRange('F2:F').setNumberFormat('#,##0'); items.getRange('H2:H').setNumberFormat('#,##0');
  const enq = ss.getSheetByName(SHEETS.enquiries.name);
  statusDropdown(enq, 6, ENQUIRY_STATUSES);
  enq.getRange('A2:A').setNumberFormat(DATE_FMT);
  enq.setColumnWidth(5, 360);
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
}

function statusDropdown(sheet, col, list) {
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
  sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
}

function doGet() {
  return json({ ok: true, service: 'AFIA orders' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.website) return json({ ok: true });          // hidden spam-trap field was filled in
    if (body.action === 'order') return json(placeOrder(body));
    if (body.action === 'enquiry') return json(saveEnquiry(body));
    return json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function placeOrder(b) {
  const name = text(b.name, 2, 120, 'Name');
  const phone = text(b.phone, 7, 30, 'Phone');
  const address = text(b.address, 5, 500, 'Address');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.delivery_date || '')) ? b.delivery_date : 'Next available';
  const zone = ZONES[Number(b.zone)];
  if (!zone) throw new Error('Unknown delivery area');
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 30) throw new Error('Cart must have 1 to 30 lines');

  const lines = b.items.map(function (it) {
    const p = CATALOGUE[it.product_id];
    if (!p || !p.live) throw new Error('Product not available');
    const pack = p.packs[Number(it.pack_index)];
    const qty = Number(it.quantity);
    if (!pack || !Number.isInteger(qty) || qty < 1 || qty > 1000) throw new Error('Bad item');
    return { id: it.product_id, product: p.name, pack: pack[0], units: pack[1], price: pack[2], qty: qty, total: pack[2] * qty };
  });

  const subtotal = lines.reduce(function (s, l) { return s + l.total; }, 0);
  const bags = lines.filter(function (l) { return l.id === 'omi'; }).reduce(function (s, l) { return s + l.units * l.qty; }, 0);
  const fee = (subtotal >= FREE_DELIVERY_FROM || bags >= SACHET_FREE_BAGS) ? 0 : zone[1];
  const code = 'AF-' + Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  const now = new Date();
  const summary = lines.map(function (l) { return l.qty + ' × ' + l.product + ' · ' + l.pack; }).join('\n');

  const ss = book();
  const ordersSheet = ss.getSheetByName(SHEETS.orders.name);
  ordersSheet.appendRow([code, now, 'New', name, phone, address, zone[0], date, summary, subtotal, fee, subtotal + fee, '']);
  ordersSheet.getRange(ordersSheet.getLastRow(), 2).setNumberFormat(DATE_FMT);
  const itemsSheet = ss.getSheetByName(SHEETS.items.name);
  lines.forEach(function (l) {
    itemsSheet.appendRow([code, now, l.product, l.pack, l.units, l.price, l.qty, l.total]);
    itemsSheet.getRange(itemsSheet.getLastRow(), 2).setNumberFormat(DATE_FMT);
  });

  notify('New order ' + code + ' · ₦' + (subtotal + fee).toLocaleString(),
    summary + '\n\nTotal: ₦' + (subtotal + fee).toLocaleString() + '\n' + name + ' · ' + phone + '\n' + address + '\n' + zone[0] + ' · ' + date);
  return { ok: true, code: code, subtotal: subtotal, delivery_fee: fee, total: subtotal + fee };
}

function saveEnquiry(b) {
  const kind = b.kind === 'event' ? 'Event bottles' : b.kind === 'business' ? 'Business' : null;
  if (!kind) throw new Error('Unknown enquiry type');
  const name = text(b.name, 2, 120, 'Name');
  const phone = text(b.phone, 7, 30, 'Phone');
  const details = Object.keys(b.details || {}).slice(0, 12).map(function (k) {
    return safe(k).slice(0, 40) + ': ' + safe(b.details[k]).slice(0, 500);
  }).join('\n');
  const enq = book().getSheetByName(SHEETS.enquiries.name);
  enq.appendRow([new Date(), kind, name, phone, details, 'New', '']);
  enq.getRange(enq.getLastRow(), 1).setNumberFormat(DATE_FMT);
  notify('New enquiry: ' + kind + ' · ' + name, details + '\n\n' + name + ' · ' + phone);
  return { ok: true };
}

/** Trim, check length, and stop text being read as a spreadsheet formula. */
function text(v, min, max, label) {
  const s = safe(v);
  if (s.length < min || s.length > max) throw new Error(label + ' is missing or too long');
  return s;
}
function safe(v) {
  let s = String(v == null ? '' : v).trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function notify(subject, body) {
  if (!EMAIL_NEW_ORDERS) return;
  try {
    const to = Session.getEffectiveUser().getEmail();
    if (to) MailApp.sendEmail(to, subject, body + '\n\nOpen the sheet: ' + book().getUrl());
  } catch (err) { /* email is a convenience; the row is already saved */ }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
