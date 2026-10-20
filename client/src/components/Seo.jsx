import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_URL = 'https://theworksuites.co.in';
const SITE_NAME = 'TWS · The Work Suites';
const DEFAULT_IMAGE = `${SITE_URL}/images/tws-foyer-01.webp`;
const LOGO_URL = `${SITE_URL}/images/tws-navbar-logo.svg`;

export const indexablePages = {
  '/': {
    label: 'Home',
    title: 'TWS — Workspaces on Bannerghatta Main Road',
    description: 'Private cabins and professional meeting spaces on Bannerghatta Main Road, with clear booking choices and live availability.'
  },
  '/about': {
    label: 'About',
    title: 'About The Work Suites | TWS Bengaluru',
    description: 'A single-floor professional workspace for individuals, teams and businesses in Kothnur, Kalena Agrahara, Bengaluru.'
  },
  '/workspaces': {
    label: 'Workspaces',
    title: 'Workspaces and Prices | TWS Bengaluru',
    description: 'Choose a flexi desk, dedicated desk, private cabin, meeting room or conference room on the single TWS floor.'
  },
  '/seating-plans': {
    label: 'Seating Plans',
    title: 'Workspace Seating Plans | TWS Bengaluru',
    description: 'Review the single-floor TWS setup and choose a desk, private cabin, meeting room or conference room for your team.'
  },
  '/amenities': {
    label: 'Amenities',
    title: 'Workspace Amenities | TWS Bengaluru',
    description: 'TWS workspace amenities include high-speed internet, power backup, phone booths, pantry, coffee, printing and lift access.'
  },
  '/gallery': {
    label: 'Gallery',
    title: 'The Work Suites Gallery | TWS Bengaluru',
    description: 'See the reception, private cabins, meeting spaces, phone booths, print station, pantry and shared areas at TWS.'
  },
  '/contact': {
    label: 'Contact',
    title: 'Contact The Work Suites | TWS Bengaluru',
    description: 'Find TWS on Bannerghatta Main Road in Gottigere, beside Carmel Academy ICSE School, Bengaluru 560083.'
  },
  '/faq': {
    label: 'FAQs',
    title: 'Frequently Asked Questions | TWS Bengaluru',
    description: 'Clear answers about TWS workspace bookings, cancellations, GST, refunds and private space reservations.'
  },
  '/privacy': {
    label: 'Privacy Policy',
    title: 'Privacy Policy | TWS · The Work Suites',
    description: 'How TWS handles account, contact, billing and booking information for authentication, reservations and support.'
  },
  '/terms': {
    label: 'Booking Terms',
    title: 'Booking Terms | TWS · The Work Suites',
    description: 'The TWS operating rules for workspace reservations, cancellations, payments and acceptable workspace use.'
  }
};

const noindexPages = {
  '/home': ['TWS — Workspaces on Bannerghatta Main Road', '/'],
  '/book': ['Book or Lease a Workspace | TWS', '/book'],
  '/checkout': ['Booking Checkout | TWS', '/checkout'],
  '/login': ['Customer Sign In | TWS', '/login'],
  '/register': ['Create a Customer Account | TWS', '/register'],
  '/forgot-password': ['Reset Your Password | TWS', '/forgot-password'],
  '/reset-password': ['Choose a New Password | TWS', '/reset-password'],
  '/admin/login': ['Admin Sign In | TWS', '/admin/login']
};

const faqEntities = [
  ['How does booking work?', 'Choose a workspace and time, sign in, and confirm your booking. Online payment is currently disabled, so TWS opens a prepared WhatsApp message and the office team contacts you to complete payment.'],
  ['Can I cancel?', 'Cancellation requests are accepted until 48 hours before the booking starts and are reviewed by the TWS office team.'],
  ['Are prices inclusive of GST?', 'The booking summary shows the workspace price and applicable GST separately before you confirm.'],
  ['How are refunds handled?', 'When a cancellation is approved, any amount already paid directly to TWS is handled by the office team and the booking status is updated in your account.'],
  ['Can teams book private spaces?', 'Yes. Private cabins, the meeting room and the conference room support team reservations.']
];

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
}

function setCanonical(url) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = url;
}

function structuredData(page, canonical, pathname) {
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: LOGO_URL },
      email: 'info@theworksuites.co.in',
      telephone: '+91 77788 86839',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Bannerghatta Main Road, Gottigere, Beside Carmel Academy ICSE School, Kothnur, Kalena Agrahara',
        addressLocality: 'Bengaluru',
        addressRegion: 'Karnataka',
        postalCode: '560083',
        addressCountry: 'IN'
      }
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en-IN'
    },
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: page.title,
      description: page.description,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en-IN'
    }
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
  if (pathname === '/faq') {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: faqEntities.map(([name, text]) => ({
        '@type': 'Question',
        name,
        acceptedAnswer: { '@type': 'Answer', text }
      }))
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function noindexConfig(pathname) {
  if (noindexPages[pathname]) return noindexPages[pathname];
  if (pathname.startsWith('/booking-confirmation/')) return ['Booking Confirmation | TWS', pathname];
  if (pathname === '/customer' || pathname.startsWith('/customer/')) return ['Customer Portal | TWS', pathname];
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return ['Admin Portal | TWS', pathname];
  if (pathname === '/get-space' || pathname === '/lease') return ['Book or Lease a Workspace | TWS', '/book'];
  return ['Page Not Found | TWS', pathname];
}

export default function Seo() {
  const location = useLocation();
  useLayoutEffect(() => {
    const pathname = location.pathname !== '/' ? location.pathname.replace(/\/+$/, '') || '/' : '/';
    const page = indexablePages[pathname];
    const [fallbackTitle, fallbackCanonical] = page ? [] : noindexConfig(pathname);
    const title = page?.title || fallbackTitle;
    const description = page?.description || 'TWS · The Work Suites workspace booking and account page.';
    const canonicalPath = page ? pathname : fallbackCanonical;
    const canonical = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`;
    const robots = page
      ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
      : 'noindex,nofollow';

    document.title = title;
    document.documentElement.lang = 'en-IN';
    setCanonical(canonical);
    setMeta('meta[name="description"]', { name: 'description', content: description });
    setMeta('meta[name="robots"]', { name: 'robots', content: robots });
    setMeta('meta[name="googlebot"]', { name: 'googlebot', content: robots });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    setMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'en_IN' });
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    setMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: DEFAULT_IMAGE });
    setMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: 'The Work Suites workspace in Bengaluru' });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: DEFAULT_IMAGE });

    let script = document.head.querySelector('#tws-structured-data');
    if (page) {
      if (!script) {
        script = document.createElement('script');
        script.id = 'tws-structured-data';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(structuredData(page, canonical, pathname));
    } else if (script) {
      script.remove();
    }
  }, [location.pathname, location.search]);
  return null;
}
