import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Info,
  LockKeyhole,
  MapPin,
  PhoneCall,
  RefreshCw,
  Users,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, money } from "../api";
import { useApp } from "../context";
import { SeatMap, StatusLegend } from "../components/SeatMap";
import { Loading } from "../components/Layout";
import LeaseBookingPanel from "../components/LeaseBookingPanel";

const labels = {
  hot_desk: "Hot desk",
  dedicated_desk: "Dedicated desk",
  private_cabin: "Private cabin",
  meeting_room: "Meeting room",
  conference_room: "Conference room",
  phone_booth: "Phone booth",
};
const indiaInputDate = (value) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const today = () => indiaInputDate(new Date());
const tomorrow = () => indiaInputDate(new Date(Date.now() + 86400000));
const validBookingDate = (value) =>
  value && value >= today() ? value : tomorrow();
const seatIdsOf = (value) =>
  (value?.seats?.length ? value.seats : value?.seat ? [value.seat] : []).filter(
    Boolean,
  );
const timeParts = (value) => {
  const [rawHour = "9", minute = "00"] = String(value || "09:00").split(":"),
    hour = Number(rawHour);
  return {
    hour: String(hour % 12 || 12).padStart(2, "0"),
    minute,
    period: hour >= 12 ? "PM" : "AM",
  };
};
const timeValue = ({ hour, minute, period }) => {
  let value = Number(hour) % 12;
  if (period === "PM") value += 12;
  return `${String(value).padStart(2, "0")}:${minute}`;
};
const displayTime = (value) => {
  const parts = timeParts(value);
  return `${Number(parts.hour)}:${parts.minute} ${parts.period}`;
};
const clockHours = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const clockMinutes = ["00", "15", "30", "45"];

export default function Booking() {
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    { user: sessionUser, logout, toast, booking, setBooking } = useApp(),
    customer = sessionUser?.role === "customer",
    user = customer ? sessionUser : null;
  const mode = params.get("mode") === "lease" ? "lease" : "booking";
  const [workspaces, setWorkspaces] = useState([]),
    [workspaceId, setWorkspaceId] = useState(
      params.get("workspace") || booking.workspace?._id || "",
    ),
    [date, setDate] = useState(() => validBookingDate(booking.date)),
    [start, setStart] = useState(booking.start || "09:00"),
    [duration, setDuration] = useState(booking.duration || "daily"),
    [hours, setHours] = useState(booking.hours || 8),
    [availability, setAvailability] = useState(null),
    [selectedSeats, setSelectedSeats] = useState(() => seatIdsOf(booking)),
    [selectionHold, setSelectionHold] = useState(() =>
      booking.hold &&
      booking.expiresAt &&
      new Date(booking.expiresAt) > new Date()
        ? booking.hold
        : null,
    ),
    [quote, setQuote] = useState(null),
    [busy, setBusy] = useState(false),
    [locking, setLocking] = useState(false),
    [loadingSpaces, setLoadingSpaces] = useState(true),
    [loadError, setLoadError] = useState(""),
    [spaceRetry, setSpaceRetry] = useState(0),
    [refreshKey, setRefreshKey] = useState(0);
  const holdRef = useRef(selectionHold),
    preserveHoldRef = useRef(false);

  useEffect(() => {
    const refresh = () => setRefreshKey((key) => key + 1);
    window.addEventListener("tws:availability", refresh);
    return () => window.removeEventListener("tws:availability", refresh);
  }, []);
  useEffect(() => {
    holdRef.current = selectionHold;
  }, [selectionHold]);
  useEffect(() => {
    const release = () => {
      const active = holdRef.current;
      if (active && !preserveHoldRef.current) {
        holdRef.current = null;
        api(`/bookings/holds/${active._id}`, {
          method: "DELETE",
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", release);
    return () => {
      window.removeEventListener("beforeunload", release);
      release();
    };
  }, []);
  useEffect(() => {
    setLoadingSpaces(true);
    setLoadError("");
    api("/workspaces")
      .then((result) => {
        setWorkspaces(result.items || []);
        if (!workspaceId && result.items?.[0])
          setWorkspaceId(result.items[0]._id);
      })
      .catch((error) => {
        setWorkspaces([]);
        setLoadError(error.message);
        toast(error.message, "error");
      })
      .finally(() => setLoadingSpaces(false));
  }, [spaceRetry]);

  const workspace = workspaces.find((item) => item._id === workspaceId);
  const selectedTime = timeParts(start);
  const changeTime = (key, value) => {
    resetSelection();
    setStart(timeValue({ ...selectedTime, [key]: value }));
  };
  useEffect(() => {
    if (workspace && !workspace.allowedDurations.includes(duration))
      setDuration(workspace.allowedDurations[0]);
  }, [workspaceId, workspace, duration]);
  const period = useMemo(() => {
    const startAt = new Date(`${date}T${start}:00+05:30`),
      amounts = { hourly: hours, daily: 24, weekly: 168, monthly: 720 };
    return {
      startAt,
      endAt: new Date(startAt.getTime() + amounts[duration] * 3600000),
    };
  }, [date, start, duration, hours]);
  const availabilityByWorkspace = useMemo(
    () =>
      new Map(
        (availability?.workspaces || []).map((item) => [
          String(item._id),
          item.availability,
        ]),
      ),
    [availability],
  );
  const workspaceAvailability =
    availabilityByWorkspace.get(String(workspaceId)) || "available";
  const workspaceSeats = (availability?.seats || []).filter(
    (item) => String(item.workspace) === String(workspaceId),
  );
  const selectedIds = selectedSeats.map((item) => String(item._id));
  const selectedKey = selectedIds.join(",");
  const quantity = workspaceSeats.length
    ? Math.max(1, selectedSeats.length)
    : 1;
  const effectiveQuote = quote
    ? {
        base: quote.base * quantity,
        tax: quote.tax * quantity,
        discount: 0,
        total: quote.total * quantity,
      }
    : null;
  const hasRequiredSelection =
    Boolean(workspaceId) &&
    period.startAt.getTime() > Date.now() &&
    (!workspaceSeats.length || selectedSeats.length > 0);
  const canContinue =
    hasRequiredSelection &&
    (customer
      ? Boolean(quote) && workspaceAvailability === "available"
      : !availability || workspaceAvailability === "available");

  useEffect(() => {
    if (!customer || !selectionHold?._id || !selectedKey) return;
    const renew = setInterval(() => {
      api(`/bookings/holds/${selectionHold._id}`, {
        method: "PATCH",
        body: JSON.stringify({ seatIds: selectedKey.split(",") }),
      })
        .then((result) => {
          holdRef.current = result.hold;
          setSelectionHold(result.hold);
        })
        .catch(() => setRefreshKey((key) => key + 1));
    }, 4 * 60_000);
    return () => clearInterval(renew);
  }, [user?._id, selectionHold?._id, selectedKey]);

  useEffect(() => {
    if (!workspaceId || !workspace?.allowedDurations.includes(duration)) return;
    if (period.startAt.getTime() <= Date.now()) {
      setAvailability(null);
      setQuote(null);
      return;
    }
    Promise.all([
      api(
        `/workspaces/availability?startAt=${period.startAt.toISOString()}&endAt=${period.endAt.toISOString()}`,
      ),
      api("/bookings/quote", {
        method: "POST",
        body: JSON.stringify({
          workspaceId,
          startAt: period.startAt,
          endAt: period.endAt,
          durationType: duration,
        }),
      }),
    ])
      .then(([availabilityResult, quoteResult]) => {
        setAvailability(availabilityResult);
        setQuote(quoteResult.quote);
        const allowed = new Map(
          (availabilityResult.seats || [])
            .filter(
              (item) =>
                String(item.workspace) === String(workspaceId) &&
                (item.availability === "available" ||
                  (holdRef.current && item.availability === "held")),
            )
            .map((item) => [String(item._id), item]),
        );
        setSelectedSeats((current) =>
          current.map((item) => allowed.get(String(item._id))).filter(Boolean),
        );
      })
      .catch((error) => {
        setAvailability(null);
        setQuote(null);
        toast(error.message, "error");
      });
  }, [workspaceId, date, start, duration, hours, refreshKey]);

  async function releaseCurrentHold() {
    const active = holdRef.current;
    holdRef.current = null;
    setSelectionHold(null);
    if (active)
      await api(`/bookings/holds/${active._id}`, { method: "DELETE" }).catch(
        () => {},
      );
  }
  function resetSelection() {
    releaseCurrentHold();
    setSelectedSeats([]);
  }

  async function toggleSeat(seat) {
    if (locking) return;
    const exists = selectedSeats.some(
        (item) => String(item._id) === String(seat._id),
      ),
      next = exists
        ? selectedSeats.filter((item) => String(item._id) !== String(seat._id))
        : [...selectedSeats, seat];
    if (!customer) {
      setSelectedSeats(next);
      toast(
        exists
          ? `${seat.number} removed`
          : `${seat.number} selected. Customer sign-in will lock it.`,
      );
      return;
    }
    setLocking(true);
    try {
      if (!next.length) {
        await releaseCurrentHold();
        setSelectedSeats([]);
        toast(`${seat.number} released`);
        return;
      }
      const seatIds = next.map((item) => String(item._id));
      const result = holdRef.current
        ? await api(`/bookings/holds/${holdRef.current._id}`, {
            method: "PATCH",
            body: JSON.stringify({ seatIds }),
          })
        : await api("/bookings/holds", {
            method: "POST",
            body: JSON.stringify({
              workspaceId,
              seatIds,
              startAt: period.startAt,
              endAt: period.endAt,
              durationType: duration,
            }),
          });
      holdRef.current = result.hold;
      setSelectionHold(result.hold);
      setSelectedSeats(next);
      toast(
        exists
          ? `${seat.number} released`
          : `${seat.number} is now on hold for you`,
      );
    } catch (error) {
      toast(error.message, "error");
      setRefreshKey((key) => key + 1);
    } finally {
      setLocking(false);
    }
  }

  async function hold() {
    if (workspaceAvailability !== "available")
      return toast(
        "That space is no longer available for this time. Choose another one.",
        "error",
      );
    if (workspaceSeats.length && !selectedSeats.length)
      return toast("Select at least one available seat", "error");
    const draft = {
      workspace,
      seats: selectedSeats,
      seat: selectedSeats[0] || null,
      date,
      start,
      duration,
      hours,
      quote: effectiveQuote,
      pending: true,
    };
    if (!customer) {
      setBooking(draft);
      if (sessionUser?.role === "super_admin") logout();
      toast("Selection saved. Sign in as a customer to continue.");
      return navigate("/login", { state: { from: "/book?resume=1" } });
    }
    setBusy(true);
    try {
      const result = holdRef.current
        ? { hold: holdRef.current, expiresAt: holdRef.current.expiresAt }
        : await api("/bookings/holds", {
            method: "POST",
            body: JSON.stringify({
              workspaceId,
              seatIds: selectedIds,
              startAt: period.startAt,
              endAt: period.endAt,
              durationType: duration,
            }),
          });
      setBooking({
        ...draft,
        quote: result.hold.quote,
        hold: result.hold,
        expiresAt: result.expiresAt,
        pending: false,
      });
      toast(
        `${selectedSeats.length > 1 ? `${selectedSeats.length} seats` : selectedSeats[0]?.number || workspace.name} held for 10 minutes`,
      );
      preserveHoldRef.current = true;
      navigate("/checkout");
    } catch (error) {
      toast(error.message, "error");
      setAvailability(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="booking-page">
      <div className="booking-top">
        <Link to="/workspaces">
          <ArrowLeft /> Back to spaces
        </Link>
        <div className="stepper">
          <span className="active">
            <b>1</b>Select
          </span>
          <i />
          <span>
            <b>2</b>{mode === "lease" ? "Details" : "Account"}
          </span>
          <i />
          <span>
            <b>3</b>{mode === "lease" ? "Submit" : "Buy"}
          </span>
        </div>
        <span className="secure-note">
          <LockKeyhole /> Live seat protection
        </span>
      </div>
      <div className={`booking-shell ${mode === "lease" ? "lease-mode" : ""}`}>
        <div className="booking-main">
          <div className="booking-heading">
            <p className="eyebrow">Choose before signing in</p>
            <h1>
              Build your <em>workday.</em>
            </h1>
            <p>
              Choose a flexible booking or a longer lease. Both options start
              here.
            </p>
          </div>
          <div className="booking-mode-switch" aria-label="Choose booking type">
            <Link
              to="/book"
              className={mode === "booking" ? "active" : ""}
              aria-current={mode === "booking" ? "page" : undefined}
            >
              <CalendarDays />
              <span>
                <strong>Normal booking</strong>
                <small>Hourly, daily or monthly</small>
              </span>
            </Link>
            <Link
              to="/book?mode=lease"
              className={mode === "lease" ? "active" : ""}
              aria-current={mode === "lease" ? "page" : undefined}
            >
              <PhoneCall />
              <span>
                <strong>Monthly or yearly lease</strong>
                <small>Costs, term and formalities in this page</small>
              </span>
              <ArrowRight />
            </Link>
          </div>
          {mode === "lease" ? (
            <LeaseBookingPanel workspaces={workspaces} />
          ) : (
            <>
          <div className="booking-block">
            <span className="block-number">01</span>
            <div>
              <h2>Choose your space</h2>
              {loadingSpaces ? (
                <Loading cards={3} />
              ) : loadError ? (
                <div className="load-error compact">
                  <RefreshCw />
                  <h3>Workspaces could not load</h3>
                  <p>{loadError}</p>
                  <button
                    className="btn btn-dark"
                    onClick={() => setSpaceRetry((value) => value + 1)}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="type-options">
                  {workspaces.map((item) => {
                    const state =
                        availabilityByWorkspace.get(String(item._id)) ||
                        "available",
                      capacity =
                        item.type === "meeting_room"
                          ? "Capacity on request"
                          : item.type === "conference_room"
                            ? "22 + 1 seats"
                            : `${item.capacity} seats`;
                    return (
                      <button
                        key={item._id}
                        onClick={() => {
                          if (workspaceId !== item._id) resetSelection();
                          setWorkspaceId(item._id);
                        }}
                        disabled={
                          state !== "available" && workspaceId !== item._id
                        }
                        className={`${workspaceId === item._id ? "active " : ""}availability-${state}`}
                      >
                        <span>
                          {labels[item.type]}{" "}
                          <em className={`space-state ${state}`}>{state}</em>
                        </span>
                        <small>
                          {item.name} · {capacity}
                        </small>
                        <b>
                          from{" "}
                          {money(
                            Math.min(
                              ...Object.values(item.pricing).filter(Boolean),
                            ),
                          )}
                        </b>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="booking-block">
            <span className="block-number">02</span>
            <div>
              <h2>When are you coming?</h2>
              <div className="date-fields">
                <label>
                  <span>Date</span>
                  <div>
                    <CalendarDays />
                    <input
                      type="date"
                      min={today()}
                      value={date}
                      onChange={(event) => {
                        resetSelection();
                        setDate(validBookingDate(event.target.value));
                      }}
                    />
                  </div>
                </label>
                <label>
                  <span>Start time</span>
                  <div className="time-selects">
                    <Clock3 />
                    <select
                      aria-label="Start hour"
                      value={selectedTime.hour}
                      onChange={(event) =>
                        changeTime("hour", event.target.value)
                      }
                    >
                      {clockHours.map((value) => (
                        <option key={value} value={value}>
                          {Number(value)}
                        </option>
                      ))}
                    </select>
                    <b>:</b>
                    <select
                      aria-label="Start minutes"
                      value={selectedTime.minute}
                      onChange={(event) =>
                        changeTime("minute", event.target.value)
                      }
                    >
                      {clockMinutes.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                    <select
                      aria-label="AM or PM"
                      value={selectedTime.period}
                      onChange={(event) =>
                        changeTime("period", event.target.value)
                      }
                    >
                      <option>AM</option>
                      <option>PM</option>
                    </select>
                  </div>
                </label>
                <label>
                  <span>Plan</span>
                  <select
                    value={duration}
                    onChange={(event) => {
                      resetSelection();
                      setDuration(event.target.value);
                    }}
                  >
                    {workspace?.allowedDurations?.map((value) => (
                      <option value={value} key={value}>
                        {value[0].toUpperCase() + value.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                {duration === "hourly" && (
                  <label>
                    <span>Hours</span>
                    <select
                      value={hours}
                      onChange={(event) => {
                        resetSelection();
                        setHours(Number(event.target.value));
                      }}
                    >
                      {[1, 2, 3, 4, 6, 8].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {period.startAt.getTime() <= Date.now() && (
                <p className="date-warning">
                  Choose a future time. Past dates and times cannot be booked.
                </p>
              )}
            </div>
          </div>
          {workspaceSeats.length > 0 && (
            <div className="booking-block">
              <span className="block-number">03</span>
              <div className="map-wrap">
                <div className="map-heading">
                  <div>
                    <h2>Select one or more seats</h2>
                    <p>
                      {
                        workspaceSeats.filter(
                          (item) => item.availability === "available",
                        ).length
                      }{" "}
                      free · {selectedSeats.length} selected
                      {locking
                        ? " · locking…"
                        : selectionHold
                          ? " · on hold for you"
                          : ""}
                    </p>
                  </div>
                  <StatusLegend />
                </div>
                <SeatMap
                  seats={workspaceSeats}
                  selected={selectedIds}
                  onSelect={toggleSeat}
                />
              </div>
            </div>
          )}
            </>
          )}
        </div>
        {mode === "booking" && <aside className="booking-summary">
          <div className="summary-image">
            <img src={workspace?.image || "/images/tws-foyer-01.webp"} alt="" />
            <span>LIVE AVAILABILITY</span>
          </div>
          <p className="eyebrow">Your selection</p>
          <h2>{workspace?.name || "Choose a workspace"}</h2>
          <span className={`summary-availability ${workspaceAvailability}`}>
            {workspaceAvailability} for selected time
          </span>
          <ul>
            <li>
              <MapPin />
              {workspace?.zone || "Bannerghatta Main Road, Bengaluru"}
            </li>
            <li>
              <CalendarDays />
              {new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "long",
                timeZone: "Asia/Kolkata",
              })}
            </li>
            <li>
              <Clock3 />
              {displayTime(start)} IST · {duration}
              {duration === "hourly" ? ` · ${hours}h` : ""}
            </li>
            {selectedSeats.length > 0 && (
              <li>
                <Users />
                {selectedSeats.length} seat{selectedSeats.length > 1 ? "s" : ""}
                : {selectedSeats.map((item) => item.number).join(", ")}
              </li>
            )}
          </ul>
          <div className="price-lines">
            <span>
              Workspace{quantity > 1 ? ` × ${quantity}` : ""}{" "}
              <b>{money(effectiveQuote?.base)}</b>
            </span>
            <span>
              GST (18%) <b>{money(effectiveQuote?.tax)}</b>
            </span>
            <strong>
              Total <b>{money(effectiveQuote?.total)}</b>
            </strong>
          </div>
          <button
            onClick={hold}
            disabled={busy || locking || !canContinue}
            className="btn btn-accent btn-wide"
          >
            {busy || locking
              ? "Securing your selection…"
              : period.startAt.getTime() <= Date.now()
                ? "Choose a future time"
                : workspaceAvailability !== "available"
                  ? "Choose an available space"
                  : user
                    ? "Continue to buy"
                    : "Continue to customer login"}{" "}
            <ArrowRight />
          </button>
          <p className="summary-help">
            <Info />{" "}
            {user
              ? selectionHold
                ? "Selected seats stay on hold while this booking page is open."
                : "Choose a seat to lock it immediately."
              : "Select first, then sign in as a customer to lock your seats before buying."}
          </p>
        </aside>}
      </div>
    </section>
  );
}
