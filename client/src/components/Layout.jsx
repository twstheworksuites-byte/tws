import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  Mail,
  MapPin,
  Menu,
  Phone,
  X,
} from "lucide-react";
import { useApp } from "../context";

const nav = [
  ["Home", "/"],
  ["Spaces & prices", "/workspaces"],
  ["Gallery", "/gallery"],
  ["Amenities", "/amenities"],
  ["Enquire", "/contact"],
];
export function BrandLogo({ className = "", navbar = false }) {
  return <img className={`brand-logo-image ${className}`.trim()} src={navbar ? "/images/tws-navbar-logo.svg" : "/images/tws-original-logo.svg"} alt="TWS — The Work Suites. Your space, your pace." />;
}
export function Logo({ light = false }) {
  return (
    <Link
      className={`logo ${light ? "logo-light" : ""}`}
      to="/"
      onClick={() => window.scrollTo(0, 0)}
      aria-label="TWS — The Work Suites"
    >
      <BrandLogo navbar />
    </Link>
  );
}
export function Header() {
  const [open, setOpen] = useState(false),
    location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search, location.hash]);
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const isActive = (to) => {
    const [pathWithSearch, hash] = to.split("#"),
      [path, search] = pathWithSearch.split("?");
    return (
      location.pathname === path &&
      (hash
        ? location.hash === `#${hash}`
        : search
          ? location.search === `?${search}`
          : !location.hash && !location.search)
    );
  };
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Logo />
        <nav
          id="public-navigation"
          className={open ? "nav-open" : ""}
          aria-label="Main navigation"
        >
          {nav.map(([label, to]) => (
            <Link
              className={isActive(to) ? "active" : ""}
              aria-current={isActive(to) ? "page" : undefined}
              key={label}
              to={to}
              onClick={() => { setOpen(false); window.scrollTo(0, 0); }}
            >
              {label}
            </Link>
          ))}
          <Link
            className="btn btn-dark nav-mobile-cta"
            to="/book"
            onClick={() => { setOpen(false); window.scrollTo(0, 0); }}
          >
            Book or lease <ArrowUpRight size={17} />
          </Link>
        </nav>
        <div className="nav-actions">
          <Link
            className="login-link"
            aria-label="Customer portal login"
            to="/login"
          >
            Login
          </Link>
          <Link className="btn btn-dark" to="/book">
            Book or lease <ArrowUpRight size={17} />
          </Link>
          <button
            type="button"
            className="menu-btn"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="public-navigation"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
export function Footer() {
  const address =
      "Bannerghatta Main Road, Gottigere, Beside Carmel Academy ICSE School, Kothnur, Kalena Agrahara, Bengaluru, Karnataka 560083",
    hours = import.meta.env.VITE_BUSINESS_HOURS,
    email = import.meta.env.VITE_BUSINESS_EMAIL,
    phone = import.meta.env.VITE_BUSINESS_PHONE || "+91 77788 86839";
  return (
    <footer id="contact" className="site-footer">
      <div className="footer-feature">
        <div className="footer-intro">
          <p>
            Private cabins and professional meeting spaces for individuals,
            teams and growing businesses in South Bengaluru.
          </p>
          <Link className="footer-book" to="/book">
            Find your workspace <ArrowUpRight />
          </Link>
        </div>
        <div className="footer-map">
          <iframe
            title="The Work Suites location on Google Maps"
            src="https://www.google.com/maps?q=Bannerghatta%20Main%20Road%20Gottigere%20Carmel%20Academy%20ICSE%20School%20Bengaluru%20560083&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a
            href="https://www.google.com/maps/search/?api=1&query=Bannerghatta+Main+Road+Gottigere+Carmel+Academy+ICSE+School+Kothnur+Kalena+Agrahara+Bengaluru+560083"
            target="_blank"
            rel="noreferrer"
          >
            <MapPin /> Open in Google Maps
          </a>
        </div>
      </div>
      <div className="footer-links">
        <div>
          <span>Explore</span>
          <Link to="/about">About us</Link>
          <Link to="/workspaces">Workspaces</Link>
          <Link to="/seating-plans">Seating plans</Link>
        </div>
        <div>
          <span>Experience</span>
          <Link to="/amenities">Amenities</Link>
          <Link to="/gallery">Gallery</Link>
          <Link to="/faq">FAQs</Link>
          <Link to="/contact">Contact</Link>
        </div>
        <div>
          <span>Visit</span>
          <p>
            {address}
            {hours ? (
              <>
                <br />
                {hours}
              </>
            ) : null}
          </p>
          <div className="footer-contacts">
            {phone ? (
              <a href={`tel:${phone.replace(/\s/g, "")}`}>
                <Phone />
                {phone}
              </a>
            ) : (
              <Link to="/contact">
                <Phone />
                Request a call
              </Link>
            )}
            {email ? (
              <a href={`mailto:${email}`}>
                <Mail />
                {email}
              </a>
            ) : (
              <Link to="/contact">
                <Mail />
                Send an enquiry
              </Link>
            )}
          </div>
        </div>
        <div>
          <span>Account</span>
          <Link to="/register">Create account</Link>
          <Link to="/login">Customer sign in</Link>
          <Link to="/admin/login">Admin portal</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 TWS · The Work Suites</span>
        <b>Powered by MERNPixel</b>
        <span>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </span>
      </div>
    </footer>
  );
}
export function PublicLayout() {
  const location = useLocation();
  const { user, authReady } = useApp();
  const bookingFlow =
    location.pathname === "/book" ||
      location.pathname === "/checkout" ||
      location.pathname.startsWith("/booking-confirmation/");
  const customerBookingFlow = bookingFlow && (!authReady || user?.role === "customer");
  return (
    <>
      {!customerBookingFlow && <Header />}
      <main>
        <PageMotion />
      </main>
      <Footer />
    </>
  );
}
export function PageMotion() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28 }}
      >
        <OutletProxy />
      </motion.div>
    </AnimatePresence>
  );
}
import { Outlet } from "react-router-dom";
function OutletProxy() {
  return <Outlet />;
}
export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toast-stack">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            className={`toast ${t.type}`}
            key={t.id}
            initial={{ opacity: 0, x: 30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <span />
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
export function Empty({
  icon: Icon = CalendarDays,
  title = "Nothing here yet",
  copy = "New activity will appear here.",
}) {
  return (
    <div className="empty">
      <Icon />
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}
export function Loading({ cards = 3 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: cards }).map((_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}
