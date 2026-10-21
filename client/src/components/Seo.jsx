import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_IMAGE, SITE_NAME, SITE_URL, indexablePages, structuredData } from '../seoConfig';

export { SITE_URL, indexablePages } from '../seoConfig';

const noindexPages = {
  '/home': ['Office Workspaces in Bangalore | TWS — The Work Suites', '/'],
  '/book': ['Book or Lease a Workspace | TWS', '/book'],
  '/checkout': ['Booking Checkout | TWS', '/checkout'],
  '/login': ['Customer Sign In | TWS', '/login'],
  '/register': ['Create a Customer Account | TWS', '/register'],
  '/forgot-password': ['Reset Your Password | TWS', '/forgot-password'],
  '/reset-password': ['Choose a New Password | TWS', '/reset-password'],
  '/admin/login': ['Admin Sign In | TWS', '/admin/login']
};

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

function setLanguageAlternate(url) {
  let element = document.head.querySelector('link[rel="alternate"][hreflang="en-IN"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'alternate';
    element.hreflang = 'en-IN';
    document.head.appendChild(element);
  }
  element.href = url;
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
    setLanguageAlternate(canonical);
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
    setMeta('meta[property="og:image:secure_url"]', { property: 'og:image:secure_url', content: DEFAULT_IMAGE });
    setMeta('meta[property="og:image:type"]', { property: 'og:image:type', content: 'image/webp' });
    setMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1800' });
    setMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '1013' });
    setMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: 'The Work Suites workspace in Bengaluru' });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: DEFAULT_IMAGE });
    setMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: 'The Work Suites office workspace in Bengaluru' });

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
