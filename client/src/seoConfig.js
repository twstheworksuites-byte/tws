export const SITE_URL = 'https://www.theworksuites.co.in';
export const SITE_NAME = 'The Work Suites';
export const SITE_ALTERNATE_NAMES = ['TWS', 'TWS · The Work Suites', 'theworksuites.co.in'];
export const DEFAULT_IMAGE = `${SITE_URL}/images/tws-foyer-01.webp`;
export const LOGO_URL = `${SITE_URL}/images/tws-navbar-logo.svg`;

export const indexablePages = {
  '/': {
    label: 'Home',
    schemaType: 'WebPage',
    title: 'Office Workspaces in Bangalore | TWS — The Work Suites',
    description: 'TWS — The Work Suites offers flexi desks, dedicated desks, private cabins, meeting and conference rooms on Bannerghatta Main Road, Bengaluru.'
  },
  '/about': {
    label: 'About',
    schemaType: 'AboutPage',
    title: 'About TWS — The Work Suites | Bangalore Workspace',
    description: 'Meet TWS, a professional office workspace for individuals, teams and businesses in Kothnur, Kalena Agrahara, South Bengaluru.'
  },
  '/workspaces': {
    label: 'Workspaces',
    schemaType: 'CollectionPage',
    title: 'Office Workspaces in Bangalore | Prices | TWS',
    description: 'Explore TWS flexi desks, dedicated desks, private cabins, a meeting room and a conference room on Bannerghatta Main Road, Bengaluru.'
  },
  '/seating-plans': {
    label: 'Seating Plans',
    schemaType: 'CollectionPage',
    title: 'Office Workspace Seating Plans in Bangalore | TWS',
    description: 'Review the single-floor TWS office workspace and choose a desk, private cabin, meeting room or conference room for your team in Bengaluru.'
  },
  '/amenities': {
    label: 'Amenities',
    schemaType: 'CollectionPage',
    title: 'Office Workspace Amenities in Bangalore | TWS',
    description: 'TWS office workspace amenities include high-speed internet, 24/7 power backup, phone booths, pantry, coffee, printing and lift access.'
  },
  '/gallery': {
    label: 'Gallery',
    schemaType: 'CollectionPage',
    title: 'Office Workspace Gallery in Bangalore | TWS',
    description: 'See the TWS reception, private cabins, meeting spaces, phone booths, print station, pantry and shared office areas in Bengaluru.'
  },
  '/contact': {
    label: 'Contact',
    schemaType: 'ContactPage',
    title: 'Contact TWS Workspace on Bannerghatta Road, Bangalore',
    description: 'Contact The Work Suites on Bannerghatta Main Road in Gottigere, beside Carmel Academy ICSE School, Bengaluru 560083.'
  },
  '/faq': {
    label: 'FAQs',
    schemaType: 'FAQPage',
    title: 'Office Workspace FAQs | TWS Bangalore',
    description: 'Find answers about TWS office workspace bookings, cancellations, GST, refunds, private cabins, meeting rooms and team reservations.'
  },
  '/privacy': {
    label: 'Privacy Policy',
    schemaType: 'WebPage',
    title: 'Privacy Policy | TWS — The Work Suites',
    description: 'How TWS handles account, contact, billing and workspace booking information for authentication, reservations and support.'
  },
  '/terms': {
    label: 'Booking Terms',
    schemaType: 'WebPage',
    title: 'Workspace Booking Terms | TWS — The Work Suites',
    description: 'The TWS operating rules for office workspace reservations, cancellations, payments and acceptable workspace use.'
  }
};

export const faqEntities = [
  ['How does booking work?', 'Choose a workspace and time, sign in, and confirm your booking. Online payment is currently disabled, so TWS opens a prepared WhatsApp message and the office team contacts you to complete payment.'],
  ['Can I cancel?', 'Cancellation requests are accepted until 48 hours before the booking starts and are reviewed by the TWS office team.'],
  ['Are prices inclusive of GST?', 'The booking summary shows the workspace price and applicable GST separately before you confirm.'],
  ['How are refunds handled?', 'When a cancellation is approved, any amount already paid directly to TWS is handled by the office team and the booking status is updated in your account.'],
  ['Can teams book private spaces?', 'Yes. Private cabins, the meeting room and the conference room support team reservations.']
];

const workspaceServices = [
  ['Flexi Desk', 'Flexible shared seating with an available desk assigned by TWS staff.'],
  ['Dedicated Desk', 'A specific desk with access during the assigned day or night shift.'],
  ['Private Cabin', 'Private 3, 4, 6, 8 and 12-seater cabin options with 24/7 access.'],
  ['Meeting Room', 'One meeting room with capacity for up to 10 people.'],
  ['Conference Room', 'A conference room for approximately 20–25 people.']
];

const business = {
  '@type': ['LocalBusiness', 'Organization'],
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  alternateName: SITE_ALTERNATE_NAMES,
  url: `${SITE_URL}/`,
  description: indexablePages['/'].description,
  logo: { '@type': 'ImageObject', url: LOGO_URL },
  image: { '@type': 'ImageObject', url: DEFAULT_IMAGE, width: 1800, height: 1013 },
  email: 'info@theworksuites.co.in',
  telephone: '+91 77788 86839',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Bannerghatta Main Road, Gottigere, Beside Carmel Academy ICSE School, Kothnur, Kalena Agrahara',
    addressLocality: 'Bengaluru',
    addressRegion: 'Karnataka',
    postalCode: '560083',
    addressCountry: 'IN'
  },
  areaServed: { '@type': 'City', name: 'Bengaluru', alternateName: 'Bangalore' },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'TWS Office Workspaces',
    itemListElement: workspaceServices.map(([name, description]) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name, description, areaServed: 'Bengaluru' }
    }))
  }
};

export function structuredData(page, canonical, pathname) {
  const webPage = {
    '@type': page.schemaType || 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: page.title,
    description: page.description,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#organization` },
    primaryImageOfPage: { '@type': 'ImageObject', url: DEFAULT_IMAGE, width: 1800, height: 1013 },
    inLanguage: 'en-IN'
  };

  if (pathname === '/faq') {
    webPage.mainEntity = faqEntities.map(([name, text]) => ({
      '@type': 'Question',
      name,
      acceptedAnswer: { '@type': 'Answer', text }
    }));
  }

  if (pathname === '/workspaces') {
    webPage.mainEntity = {
      '@type': 'ItemList',
      name: 'TWS Office Workspaces in Bangalore',
      itemListElement: workspaceServices.map(([name, description], index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: { '@type': 'Service', name, description, provider: { '@id': `${SITE_URL}/#organization` }, areaServed: 'Bengaluru' }
      }))
    };
  }

  const graph = [
    business,
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      alternateName: SITE_ALTERNATE_NAMES,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en-IN'
    },
    webPage
  ];

  if (pathname !== '/') {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: page.label, item: canonical }
      ]
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
