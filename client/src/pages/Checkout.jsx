import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, LockKeyhole, MapPin } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, money } from '../api';
import { useApp } from '../context';

let cashfreeLoader;
function loadCashfree() {
  if (window.Cashfree) return Promise.resolve(window.Cashfree);
  if (!cashfreeLoader) cashfreeLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload = () => window.Cashfree ? resolve(window.Cashfree) : reject(new Error('Cashfree checkout could not load.'));
    script.onerror = () => { script.remove(); reject(new Error('Cashfree checkout could not load. Please try again.')); };
    document.head.appendChild(script);
  }).catch(error => { cashfreeLoader = undefined; throw error; });
  return cashfreeLoader;
}

export default function Checkout() {
  const { booking, setBooking, user, toast } = useApp(), navigate = useNavigate();
  const [search] = useSearchParams(), returnBookingId = search.get('booking_id');
  const [seconds, setSeconds] = useState(0), [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState(null), [paymentError, setPaymentError] = useState('');
  const [pendingBookingId, setPendingBookingId] = useState(returnBookingId || booking.paymentBookingId || '');
  const [returnError, setReturnError] = useState('');
  const [details, setDetails] = useState({ name: user?.name || '', email: user?.email || '', mobile: user?.mobile || '', company: user?.company || '', gstin: user?.gstin || '' });
  const [couponCode, setCouponCode] = useState(''), [coupon, setCoupon] = useState(null), [couponBusy, setCouponBusy] = useState(false);

  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.floor((new Date(booking.expiresAt).getTime() - Date.now()) / 1000)) || 0);
    update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, [booking.expiresAt]);
  useEffect(() => { api('/payments/config').then(setPayment).catch(error => setPaymentError(error.message)); }, []);

  async function confirmPayment(id) {
    const result = await api(`/bookings/${id}/reconcile`, { method: 'POST' });
    if (!['confirmed', 'checked_in', 'completed'].includes(result.booking?.status)) throw new Error('Your booking is not confirmed. Contact TWS if you were charged.');
    setBooking({});
    toast('Payment verified — your workspace is booked');
    navigate(`/booking-confirmation/${id}`, { replace: true });
  }
  useEffect(() => {
    if (!returnBookingId) return;
    setBusy(true);
    confirmPayment(returnBookingId).catch(error => setReturnError(error.message)).finally(() => setBusy(false));
  }, [returnBookingId]);

  async function checkPayment() {
    setBusy(true); setReturnError('');
    try { await confirmPayment(pendingBookingId); }
    catch (error) { setReturnError(error.message); toast(error.message, 'error'); }
    finally { setBusy(false); }
  }
  if (returnBookingId) return <section className="confirmation"><div className="confirmation-card"><p className="eyebrow">Payment status</p><h1>{busy ? 'Checking your payment…' : 'Check your booking'}</h1><p role="status">{returnError || 'We are verifying your payment with Cashfree.'}</p><button className="btn btn-dark" disabled={busy} onClick={checkPayment}>Check payment status</button><Link className="text-button" to="/customer/bookings">View my bookings</Link></div></section>;
  if (!booking.hold) return <Navigate to="/book" replace />;
  const bookingSeats = booking.seats?.length ? booking.seats : booking.seat ? [booking.seat] : [];
  const quote = coupon?.quote || booking.quote;

  async function applyCoupon() {
    setCouponBusy(true);
    try { const result = await api('/bookings/coupon', { method: 'POST', body: JSON.stringify({ holdId: booking.hold._id, code: couponCode }) }); setCoupon(result); toast(`${result.coupon.code} applied`); }
    catch (error) { setCoupon(null); toast(error.message, 'error'); }
    finally { setCouponBusy(false); }
  }
  async function pay(event) {
    event.preventDefault(); setBusy(true);
    try {
      const Cashfree = payment?.provider === 'cashfree' ? await loadCashfree() : null;
      const checkout = await api('/bookings/checkout', { method: 'POST', body: JSON.stringify({ holdId: booking.hold._id, couponCode: coupon?.coupon.code, customer: details }) });
      const id = checkout.booking._id;
      if (checkout.paymentDisabled) {
        setBooking({});
        toast('Booked — TWS will contact you to complete payment');
        return navigate(`/booking-confirmation/${id}`, { replace: true, state: { officeWhatsappUrl: checkout.officeWhatsappUrl || checkout.whatsappUrl, customerWhatsappUrl: checkout.customerWhatsappUrl } });
      }
      setPendingBookingId(id);
      setBooking({ ...booking, paymentBookingId: id, quote: { base: checkout.booking.amount, tax: checkout.booking.tax, discount: checkout.booking.discount, total: checkout.booking.total } });
      setCoupon(null);
      if (checkout.paymentOrder.provider === 'mock') {
        await api(`/bookings/${id}/confirm-purchase`, { method: 'POST' });
        setBooking({}); toast('Test booking confirmed'); navigate(`/booking-confirmation/${id}`, { replace: true });
      } else if (checkout.paymentOrder.provider === 'cashfree') {
        if (!checkout.paymentOrder.paid) {
          const factory = Cashfree || await loadCashfree();
          const result = await factory({ mode: checkout.paymentOrder.mode }).checkout({ paymentSessionId: checkout.paymentOrder.paymentSessionId, redirectTarget: '_modal' });
          // A closed popup may still contain a completed payment. Verify on the server.
          if (result?.redirect) return;
        }
        await confirmPayment(id);
      } else throw new Error('Online payments are currently unavailable. Please contact TWS.');
    } catch (error) { toast(error.message, 'error'); }
    finally { setBusy(false); }
  }

  return <section className="checkout-page">
    <div className="checkout-top"><Link to="/book"><ArrowLeft /> Change selection</Link><span className={seconds < 120 ? 'urgent' : ''}><Clock3 /> Held for {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span></div>
    <div className="checkout-shell"><div><p className="eyebrow">Almost yours</p><h1>A few final<br /><em>details.</em></h1>
      <form id="checkout-form" onSubmit={pay} className="details-form"><div className="form-grid">
        <label>Full name<input required readOnly={!!pendingBookingId} value={details.name} onChange={event => setDetails({ ...details, name: event.target.value })} placeholder="Your name" /></label>
        <label>Mobile number<input required type="tel" readOnly={!!pendingBookingId} value={details.mobile} onChange={event => setDetails({ ...details, mobile: event.target.value })} placeholder="+91 98765 43210" /></label>
        <label>Email address<input required type="email" value={details.email} readOnly /></label>
        <label>Company <small>Optional</small><input readOnly={!!pendingBookingId} value={details.company} onChange={event => setDetails({ ...details, company: event.target.value })} placeholder="Company name" /></label>
        <label>GSTIN <small>Optional</small><input readOnly={!!pendingBookingId} value={details.gstin} onChange={event => setDetails({ ...details, gstin: event.target.value })} placeholder="For your tax invoice" /></label>
      </div><div className="payment-panel"><div><CheckCircle2 /><span>
        <strong>{payment?.provider === 'cashfree' ? 'Secure payment with Cashfree' : payment?.provider === 'mock' ? 'Test checkout' : 'Book now, pay with TWS'}</strong>
        <small>{paymentError || (payment?.provider === 'cashfree' ? payment.mode === 'production' ? 'Choose your payment method in Cashfree checkout.' : 'Sandbox mode — no real payment is collected.' : payment?.provider === 'mock' ? 'Development mode — no real payment is collected.' : payment ? 'Online payment is disabled. TWS will contact you to complete payment.' : 'Checking booking availability…')}</small>
      </span></div><p>{payment?.enabled?'Your booking is confirmed after payment verification.':'Your booking is recorded immediately and WhatsApp opens with the booking details for the TWS office.'}</p></div></form>
    </div><aside className="checkout-summary"><p className="eyebrow">Booking summary</p><h2>{booking.workspace?.name}</h2>
      <ul><li><MapPin />{booking.workspace?.zone || 'Bannerghatta Road, Bengaluru'}</li><li><CalendarDays />{booking.date} at {booking.start}</li>{bookingSeats.length > 0 && <li><LockKeyhole />{bookingSeats.length} seat{bookingSeats.length > 1 ? 's' : ''}: {bookingSeats.map(item => item.number).join(', ')}</li>}</ul>
      <div className="coupon-entry"><input disabled={busy || !!pendingBookingId} value={couponCode} onChange={event => { setCouponCode(event.target.value.toUpperCase()); setCoupon(null); }} placeholder="Offer code" /><button type="button" disabled={busy || !!pendingBookingId || couponBusy || couponCode.trim().length < 2} onClick={applyCoupon}>{couponBusy ? 'Checking…' : 'Apply'}</button></div>
      {coupon && <p className="coupon-success"><CheckCircle2 /> {coupon.coupon.code} · {coupon.coupon.name}</p>}
      <div className="price-lines"><span>Subtotal <b>{money(quote?.base)}</b></span>{quote?.discount > 0 && <span>Offer discount <b>− {money(quote.discount)}</b></span>}<span>GST <b>{money(quote?.tax)}</b></span><strong>Total <b>{money(quote?.total)}</b></strong></div>
      <button form="checkout-form" className="btn btn-accent btn-wide" disabled={busy || couponBusy || seconds <= 0 || !payment}>{seconds <= 0 ? 'Hold expired' : busy ? 'Confirming booking…' : !payment ? 'Checking…' : !payment.enabled ? 'Book now & open WhatsApp' : payment.provider === 'mock' ? 'Confirm test booking' : `Pay ${money(quote?.total)}`} <ArrowRight /></button>
      {pendingBookingId && <button type="button" className="text-button" disabled={busy} onClick={checkPayment}>Check payment status</button>}
      <small className="secure-line"><LockKeyhole />{payment?.provider === 'cashfree' ? 'Payments processed by Cashfree' : 'Online payment is currently disabled'}</small>
    </aside></div>
  </section>;
}
