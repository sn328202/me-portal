/**
 * Fixture tests for the Treasury product extractor.
 *
 * The price parser is the part worth pinning: a wrong number here becomes a
 * wrong price in her Treasury and a bogus point on the price history chart.
 * Both separator conventions matter — "1.299,00" is 1299, not 1.299.
 */
import { parseProductHtml, parsePrice } from '../api/_link.js';

let failed = 0;
const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
};

console.log('\nparsePrice():');
check('plain number', parsePrice(129), 129);
check('dollar string', parsePrice('$129.00'), 129);
check('thousands separator', parsePrice('$1,299.00'), 1299);
check('european convention', parsePrice('1.299,00 €'), 1299);
check('currency code prefix', parsePrice('USD 89.95'), 89.95);
check('bare decimal string', parsePrice('44.50'), 44.5);
check('free is not missing', parsePrice('0.00'), 0);
check('junk is null, not zero', parsePrice('Sold out'), null);
check('undefined is null', parsePrice(undefined), null);

const page = (ld, extraMeta = '') => `<html><head><title>Shop</title>
${extraMeta}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head><body></body></html>`;

console.log('\nparseProductHtml() — schema.org Product:');
{
    const p = parseProductHtml(page({
        '@context': 'https://schema.org', '@type': 'Product',
        name: 'Buono Pour Over Kettle &mdash; Matte Black',
        description: 'A gooseneck kettle for precise pouring.',
        image: ['https://cdn.example.com/kettle.jpg'],
        brand: { '@type': 'Brand', name: 'Hario' },
        offers: { '@type': 'Offer', price: '64.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    }), 'https://example.com/kettle');
    check('decoded name', p.title, 'Buono Pour Over Kettle — Matte Black');
    check('price', p.price_amount, 64);
    check('currency', p.price_currency, 'USD');
    check('brand from structured data', p.brand, 'Hario');
    check('image from array', p.image_url, 'https://cdn.example.com/kettle.jpg');
    check('in stock', p.in_stock, true);
    check('flagged as structured', p.structured, true);
    check('reports what it found', p.found, ['name', 'price', 'image', 'description']);
}

console.log('\nparseProductHtml() — AggregateOffer inside @graph:');
{
    const p = parseProductHtml(page({
        '@graph': [
            { '@type': 'WebPage' },
            { '@type': ['Product'], name: 'Linen Duvet',
              offers: { '@type': 'AggregateOffer', lowPrice: '189', highPrice: '249', priceCurrency: 'GBP' } },
        ],
    }), 'https://shop.example.co.uk/duvet');
    check('takes the low price', p.price_amount, 189);
    check('currency', p.price_currency, 'GBP');
    check('availability unknown stays null', p.in_stock, null);
}

console.log('\nparseProductHtml() — meta-tag fallback, no JSON-LD:');
{
    const html = `<html><head><title>Fallback</title>
      <meta property="og:title" content="Wool Throw Blanket" />
      <meta property="og:image" content="https://cdn.example.com/throw.jpg" />
      <meta property="og:description" content="Lambswool, made in Scotland." />
      <meta property="product:price:amount" content="120.00" />
      <meta property="product:price:currency" content="USD" />
      <meta property="og:site_name" content="Some Shop" />
      </head><body></body></html>`;
    const p = parseProductHtml(html, 'https://someshop.example.com/throw');
    check('title from og', p.title, 'Wool Throw Blanket');
    check('price from meta', p.price_amount, 120);
    check('brand falls back to site name', p.brand, 'Some Shop');
    check('flagged as unstructured', p.structured, false);
    check('but still usable', p.usable, true);
    check('and the name is real', p.title_fallback, false);
}
{
    // A bot-challenge page: parses fine, says nothing.
    const p = parseProductHtml('<html><head><title>Access Denied</title></head><body></body></html>', 'https://www.lecreuset.com/pot');
    check('one weak field is not enough to be usable', p.usable, false);
}

console.log('\nparseProductHtml() — brand tidying:');
{
    const p = parseProductHtml('<html><head><meta property="og:site_name" content="hario-usa" /></head><body></body></html>', 'https://www.hario-usa.com/products/kettle');
    check('regional suffix dropped from site name', p.brand, 'Hario');
}
{
    const p = parseProductHtml('<html><head></head><body></body></html>', 'https://www.everlane.com/products/tank');
    check('domain becomes a brand name', p.brand, 'Everlane');
}
{
    const p = parseProductHtml('<html><head><meta property="product:brand" content="Le Creuset" /></head><body></body></html>', 'https://shop.example.com/pot');
    check('explicit brand meta wins over domain', p.brand, 'Le Creuset');
}
{
    const p = parseProductHtml('<html><head><meta property="og:site_name" content="The Container Store" /></head><body></body></html>', 'https://example.com/x');
    check('a real name with spaces is left alone', p.brand, 'The Container Store');
}

console.log('\nparseProductHtml() — nothing useful:');
{
    const p = parseProductHtml('<html><head></head><body>hello</body></html>', 'https://www.example.com/x');
    check('falls back to hostname', p.title, 'www.example.com');
    check('but says the name is a fallback', p.title_fallback, true);
    check('and that the page was unusable', p.usable, false);
    check('brand strips www', p.brand, 'Example');
    check('no price invented', p.price_amount, null);
    check('and no currency either', p.price_currency, null);
}

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
