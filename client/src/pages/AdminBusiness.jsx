import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Eye,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { api, dt } from "../api";
import { Empty, Loading } from "../components/Layout";
import { useApp } from "../context";

const emptyForm = {
  title: "",
  message: "",
  delivery: "all_customers",
  recipientIds: [],
  status: "sent",
};
const typeLabel = (value) =>
  ({
    hot_desk: "Hot desk",
    dedicated_desk: "Dedicated desk",
    private_cabin: "Private cabin",
    meeting_room: "Meeting room",
    conference_room: "Conference room",
    phone_booth: "Phone booth",
    lease: "Monthly / yearly lease",
    not_sure: "Needs help choosing",
  })[value] || value;

export default function AdminBusiness() {
  const [view, setView] = useState("enquiries"),
    [items, setItems] = useState([]),
    [enquiries, setEnquiries] = useState([]),
    [selected, setSelected] = useState(null),
    [customers, setCustomers] = useState([]),
    [form, setForm] = useState(emptyForm),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [enquiryPage, setEnquiryPage] = useState(1),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    { toast, operationsVersion } = useApp();
  const load = () =>
    Promise.all([
      api("/admin/notifications"),
      api("/admin/users"),
      api("/enquiries"),
    ])
      .then(([noticeResult, userResult, enquiryResult]) => {
        setItems(noticeResult.items || []);
        setCustomers(
          (userResult.items || []).filter(
            (user) => user.role === "customer" && user.active,
          ),
        );
        setEnquiries(enquiryResult.items || []);
      })
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, [operationsVersion]);
  const shown = useMemo(
    () =>
      customers.filter((customer) =>
        `${customer.name || ""} ${customer.email}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [customers, search],
  );
  const pageCount = Math.max(1, Math.ceil(items.length / 5)),
    pageItems = items.slice(
      (Math.min(page, pageCount) - 1) * 5,
      Math.min(page, pageCount) * 5,
    ),
    enquiryPageCount = Math.max(1, Math.ceil(enquiries.length / 5)),
    enquiryItems = enquiries.slice(
      (Math.min(enquiryPage, enquiryPageCount) - 1) * 5,
      Math.min(enquiryPage, enquiryPageCount) * 5,
    );
  const toggle = (id) =>
    setForm((value) => ({
      ...value,
      recipientIds: value.recipientIds.includes(id)
        ? value.recipientIds.filter((item) => item !== id)
        : [...value.recipientIds, id],
    }));
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/admin/notifications", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setSearch("");
      await load();
      toast(form.status === "sent" ? "Notification sent" : "Draft saved");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function send(id) {
    try {
      await api(`/admin/notifications/${id}/send`, { method: "PATCH" });
      await load();
      toast("Notification sent");
    } catch (error) {
      toast(error.message, "error");
    }
  }
  async function remove(id) {
    try {
      await api(`/admin/notifications/${id}`, { method: "DELETE" });
      await load();
      toast("Draft removed");
    } catch (error) {
      toast(error.message, "error");
    }
  }
  async function updateEnquiry(id, status) {
    try {
      const result = await api(`/enquiries/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSelected((value) => (value ? { ...value, ...result.item } : value));
      await load();
      toast("Enquiry updated");
    } catch (error) {
      toast(error.message, "error");
    }
  }
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">TWS · Enquiry desk</p>
          <h1>Enquiries & messages</h1>
          <p>
            Open every website enquiry, review the complete details and track
            your follow-up.
          </p>
        </div>
      </header>
      <div className="business-tabs">
        <button
          className={view === "enquiries" ? "active" : ""}
          onClick={() => setView("enquiries")}
        >
          <MessageSquare /> Enquiries{" "}
          {enquiries.filter((item) => item.status === "new").length > 0 && (
            <b>{enquiries.filter((item) => item.status === "new").length}</b>
          )}
        </button>
        <button
          className={view === "notifications" ? "active" : ""}
          onClick={() => setView("notifications")}
        >
          <Bell /> Customer notifications
        </button>
      </div>
      {view === "enquiries" ? (
        <section className="business-panel enquiry-inbox">
          <header>
            <div>
              <h2>Enquiries</h2>
              <p>
                Name and phone number are shown here. Select View for all
                details.
              </p>
            </div>
          </header>
          {loading ? (
            <Loading />
          ) : enquiries.length ? (
            <>
              <div className="enquiry-table">
                <div className="enquiry-table-head">
                  <span>Name</span>
                  <span>Phone number</span>
                  <span>Received</span>
                  <span>Status</span>
                  <span />
                </div>
                {enquiryItems.map((item) => (
                  <div className="enquiry-table-row" key={item._id}>
                    <strong>{item.name}</strong>
                    <a href={`tel:${item.mobile}`}>{item.mobile}</a>
                    <span>{dt(item.createdAt)}</span>
                    <span className={`enquiry-status ${item.status}`}>
                      {item.status}
                    </span>
                    <button
                      className="enquiry-view"
                      onClick={() => setSelected(item)}
                    >
                      <Eye /> View
                    </button>
                  </div>
                ))}
              </div>
              {enquiryPageCount > 1 && (
                <Pagination
                  page={enquiryPage}
                  count={enquiryPageCount}
                  setPage={setEnquiryPage}
                />
              )}
            </>
          ) : (
            <Empty
              icon={MessageSquare}
              title="No enquiries yet"
              copy="New website enquiries will appear here."
            />
          )}
        </section>
      ) : (
        <>
          <section className="business-panel notification-manager">
            <header>
              <div>
                <h2>New notification</h2>
                <p>
                  Messages appear in the customer dashboard and notification
                  page.
                </p>
              </div>
            </header>
            <form className="business-form" onSubmit={submit}>
              <label>
                Who should receive it?
                <select
                  value={form.delivery}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      delivery: event.target.value,
                      recipientIds: [],
                    })
                  }
                >
                  <option value="all_customers">All customers</option>
                  <option value="selected_customers">Selected customers</option>
                </select>
              </label>
              <label>
                When to send
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  <option value="sent">Send now</option>
                  <option value="draft">Save for later</option>
                </select>
              </label>
              <label className="full">
                Title
                <input
                  required
                  minLength="2"
                  maxLength="100"
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder="Workspace update"
                />
              </label>
              <label className="full">
                Message
                <textarea
                  required
                  minLength="3"
                  maxLength="600"
                  value={form.message}
                  onChange={(event) =>
                    setForm({ ...form, message: event.target.value })
                  }
                  placeholder="Write a short, clear message."
                />
              </label>
              {form.delivery === "selected_customers" && (
                <div className="recipient-picker full">
                  <label className="recipient-search">
                    <Search />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search customer name or email"
                    />
                  </label>
                  <div className="recipient-actions">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          recipientIds: customers.map(
                            (customer) => customer._id,
                          ),
                        })
                      }
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, recipientIds: [] })}
                    >
                      Clear
                    </button>
                    <span>{form.recipientIds.length} selected</span>
                  </div>
                  <div className="recipient-list">
                    {shown.map((customer) => (
                      <label key={customer._id}>
                        <input
                          type="checkbox"
                          checked={form.recipientIds.includes(customer._id)}
                          onChange={() => toggle(customer._id)}
                        />
                        <span>
                          <strong>{customer.name || "Customer"}</strong>
                          <small>{customer.email}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <button
                className="btn btn-dark full"
                disabled={
                  busy ||
                  (form.delivery === "selected_customers" &&
                    !form.recipientIds.length)
                }
              >
                <Send />
                {busy
                  ? "Saving…"
                  : form.status === "sent"
                    ? "Send notification"
                    : "Save for later"}
              </button>
            </form>
          </section>
          <section className="business-panel notification-history">
            <header>
              <div>
                <h2>Sent messages</h2>
                <p>Customer messages and automatic booking updates.</p>
              </div>
            </header>
            {loading ? (
              <Loading />
            ) : items.length ? (
              <>
                <div className="compact-cards">
                  {pageItems.map((item) => (
                    <article key={item._id}>
                      <Bell />
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.message}</small>
                        <span>
                          {item.kind || "announcement"} ·{" "}
                          {item.recipients?.length
                            ? `${item.recipients.length} selected customer${item.recipients.length === 1 ? "" : "s"}`
                            : item.audience?.replaceAll("_", " ")}{" "}
                          · {item.status}
                        </span>
                      </div>
                      {item.status === "draft" && (
                        <>
                          <button
                            className="btn btn-dark"
                            onClick={() => send(item._id)}
                          >
                            Send
                          </button>
                          <button
                            className="icon-action danger"
                            onClick={() => remove(item._id)}
                            aria-label="Delete draft"
                          >
                            <Trash2 />
                          </button>
                        </>
                      )}
                    </article>
                  ))}
                </div>
                {pageCount > 1 && (
                  <Pagination page={page} count={pageCount} setPage={setPage} />
                )}
              </>
            ) : (
              <Empty icon={Bell} title="No notifications yet" />
            )}
          </section>
        </>
      )}
      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section className="admin-modal enquiry-detail-modal">
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close enquiry details"
            >
              <X />
            </button>
            <p className="eyebrow">Enquiry details</p>
            <h2>{selected.name}</h2>
            <p className="modal-copy">Received {dt(selected.createdAt)}</p>
            <div className="enquiry-detail-grid">
              <div>
                <span>Phone number</span>
                <a href={`tel:${selected.mobile}`}>
                  <Phone /> {selected.mobile}
                </a>
              </div>
              <div>
                <span>Email</span>
                <a href={`mailto:${selected.email}`}>
                  <Mail /> {selected.email}
                </a>
              </div>
              <div>
                <span>Workspace</span>
                <strong>
                  {selected.leaseDetails?.workspaceName ||
                    typeLabel(selected.workspaceType)}
                </strong>
              </div>
              <div>
                <span>Seats / occupants</span>
                <strong>
                  {selected.leaseDetails?.occupantCount ||
                    selected.seats ||
                    "Not specified"}
                </strong>
              </div>
              <div>
                <span>Company</span>
                <strong>{selected.company || "Not specified"}</strong>
              </div>
              <div>
                <span>Preferred start date</span>
                <strong>
                  {selected.preferredDate
                    ? new Date(selected.preferredDate).toLocaleDateString(
                        "en-IN",
                        { timeZone: "Asia/Kolkata" },
                      )
                    : "Not specified"}
                </strong>
              </div>
              {selected.leaseDetails && (
                <>
                  <div>
                    <span>Lease duration</span>
                    <strong>
                      {selected.leaseDetails.durationMonths} months
                    </strong>
                  </div>
                  <div>
                    <span>Payment preference</span>
                    <strong>
                      {selected.leaseDetails.paymentFrequency?.replaceAll(
                        "_",
                        " ",
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Purpose</span>
                    <strong>
                      {selected.leaseDetails.purpose?.replaceAll("_", " ")}
                    </strong>
                  </div>
                  <div>
                    <span>Occupant names</span>
                    <strong>
                      {selected.leaseDetails.occupantNames || "Not specified"}
                    </strong>
                  </div>
                </>
              )}
              <div className="full">
                <span>Message</span>
                <strong>{selected.message || "No message provided."}</strong>
              </div>
            </div>
            <label className="enquiry-modal-status">
              Follow-up status
              <select
                value={selected.status}
                onChange={(event) =>
                  updateEnquiry(selected._id, event.target.value)
                }
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </section>
        </div>
      )}
    </>
  );
}
function Pagination({ page, count, setPage }) {
  return (
    <div className="pagination">
      <button
        disabled={page <= 1}
        onClick={() => setPage((value) => value - 1)}
      >
        Previous
      </button>
      <span>
        Page {Math.min(page, count)} of {count}
      </span>
      <button
        disabled={page >= count}
        onClick={() => setPage((value) => value + 1)}
      >
        Next
      </button>
    </div>
  );
}
