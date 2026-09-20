import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, FileSignature } from "lucide-react";
import { api } from "../api";

const indiaDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );

const initialForm = {
  workspaceId: "",
  durationMonths: 12,
  startDate: indiaDate(),
  occupantCount: 1,
  occupantNames: "",
  purpose: "company_office",
  paymentFrequency: "monthly",
  name: "",
  mobile: "",
  email: "",
  company: "",
  message: "",
  consent: false,
};

export default function LeaseBookingPanel({ workspaces = [] }) {
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const leaseSpaces = useMemo(
    () =>
      workspaces.filter(
        (item) => item.status === "active" && item.pricing?.monthly,
      ),
    [workspaces],
  );

  useEffect(() => {
    if (!form.workspaceId && leaseSpaces[0]) {
      setForm((current) => ({ ...current, workspaceId: leaseSpaces[0]._id }));
    }
  }, [form.workspaceId, leaseSpaces]);

  const workspace = leaseSpaces.find((item) => item._id === form.workspaceId);
  const endDate = useMemo(() => {
    if (!form.startDate) return "";
    const value = new Date(`${form.startDate}T12:00:00+05:30`);
    value.setMonth(value.getMonth() + Number(form.durationMonths || 0));
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(value);
  }, [form.startDate, form.durationMonths]);

  const set = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const leaseDetails = {
        workspaceId: form.workspaceId,
        workspaceName: workspace?.name || "",
        durationMonths: Number(form.durationMonths),
        startDate: form.startDate,
        endDate,
        paymentFrequency: form.paymentFrequency,
        occupantCount: Number(form.occupantCount),
        occupantNames: form.occupantNames,
        purpose: form.purpose,
      };
      await api("/enquiries", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          mobile: form.mobile,
          email: form.email,
          company: form.company,
          seats: Number(form.occupantCount),
          preferredDate: form.startDate,
          workspaceType: "lease",
          message: form.message,
          consent: form.consent,
          leaseDetails,
        }),
      });
      setSent(true);
      setForm(initialForm);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <section className="lease-inline-success">
        <Check />
        <p className="eyebrow">Lease request received</p>
        <h2>We have your requirement.</h2>
        <p>
          The TWS team will confirm availability, final costs and agreement
          terms with you.
        </p>
        <button className="btn btn-dark" onClick={() => setSent(false)}>
          Send another request
        </button>
      </section>
    );
  }

  return (
    <form className="lease-inline" onSubmit={submit}>
      <header>
        <div>
          <p className="eyebrow">Lease formalities</p>
          <h2>Plan your longer stay.</h2>
          <p>
            Select the space and term first. No customer account is required to
            submit.
          </p>
        </div>
        <FileSignature />
      </header>

      {error && <p className="lease-error">{error}</p>}

      <div className="lease-inline-layout request-only">
        <div className="lease-inline-fields">
          <label className="full">
            Workspace
            <select
              required
              name="workspaceId"
              value={form.workspaceId}
              onChange={set}
            >
              {leaseSpaces.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name} · {item.capacity || "capacity on request"} seats
                </option>
              ))}
            </select>
          </label>
          <label>
            Lease term
            <select
              name="durationMonths"
              value={form.durationMonths}
              onChange={set}
            >
              <option value="1">1 month</option>
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">1 year</option>
              <option value="24">2 years</option>
              <option value="36">3 years</option>
            </select>
          </label>
          <label>
            Expected move-in
            <input
              required
              type="date"
              min={indiaDate()}
              name="startDate"
              value={form.startDate}
              onChange={set}
            />
          </label>
          <label>
            Number of occupants
            <input
              required
              type="number"
              min="1"
              max="100"
              name="occupantCount"
              value={form.occupantCount}
              onChange={set}
            />
          </label>
          <label>
            Payment preference
            <select
              name="paymentFrequency"
              value={form.paymentFrequency}
              onChange={set}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half_yearly">Half-yearly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label>
            Purpose
            <select name="purpose" value={form.purpose} onChange={set}>
              <option value="company_office">Company office</option>
              <option value="branch_office">Branch office</option>
              <option value="startup_team">Startup team</option>
              <option value="commercial">Commercial</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Occupant names <small>Optional</small>
            <input
              name="occupantNames"
              value={form.occupantNames}
              onChange={set}
              placeholder="Separate names with commas"
            />
          </label>
          <label>
            Full name
            <input
              required
              name="name"
              value={form.name}
              onChange={set}
              autoComplete="name"
            />
          </label>
          <label>
            Phone number
            <input
              required
              name="mobile"
              value={form.mobile}
              onChange={set}
              autoComplete="tel"
              inputMode="tel"
            />
          </label>
          <label>
            Email address
            <input
              required
              type="email"
              name="email"
              value={form.email}
              onChange={set}
              autoComplete="email"
            />
          </label>
          <label>
            Company <small>Optional</small>
            <input name="company" value={form.company} onChange={set} />
          </label>
          <label className="full">
            Anything else? <small>Optional</small>
            <textarea
              name="message"
              value={form.message}
              onChange={set}
              maxLength="800"
              placeholder="Special access, facilities or other requirements"
            />
          </label>
        </div>
      </div>

      <label className="consent">
        <input
          required
          type="checkbox"
          name="consent"
          checked={form.consent}
          onChange={set}
        />
        <span>I agree to be contacted about this lease request.</span>
      </label>
      <button
        className="btn btn-accent lease-submit"
        disabled={busy || !leaseSpaces.length}
      >
        {busy ? "Submitting lease request…" : "Submit lease request"}{" "}
        <ArrowRight />
      </button>
    </form>
  );
}
