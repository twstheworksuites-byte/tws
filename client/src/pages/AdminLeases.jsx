import { useEffect, useState } from "react";
import { CalendarRange, Eye, Mail, Phone, Users, X } from "lucide-react";
import { api, dt } from "../api";
import { Empty, Loading } from "../components/Layout";
import { useApp } from "../context";

const pretty = (value) => value?.replaceAll("_", " ") || "Not specified";
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
    : "Not specified";

export default function AdminLeases() {
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(null);
  const { toast, operationsVersion } = useApp();

  const load = () =>
    api("/enquiries")
      .then((result) =>
        setItems(
          (result.items || []).filter((item) => item.workspaceType === "lease"),
        ),
      )
      .catch((error) => toast(error.message, "error"));

  useEffect(() => {
    load();
  }, [operationsVersion]);

  async function updateStatus(status) {
    try {
      const result = await api(`/enquiries/${selected._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSelected((current) => ({ ...current, ...result.item }));
      await load();
      toast("Lease request updated");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  const newCount = items?.filter((item) => item.status === "new").length || 0;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">TWS · Lease requests</p>
          <h1>Leases</h1>
          <p>
            Review the requirements customers submitted from the booking page.
          </p>
        </div>
      </header>
      <div className="metric-grid lease-request-metrics">
        <article className="metric orange">
          <CalendarRange />
          <span>Lease requests</span>
          <strong>{items?.length || 0}</strong>
          <small>all requests</small>
        </article>
        <article className="metric teal">
          <Users />
          <span>New requests</span>
          <strong>{newCount}</strong>
          <small>waiting for follow-up</small>
        </article>
      </div>
      <section className="business-panel lease-request-panel">
        <header>
          <div>
            <h2>Customer lease requests</h2>
            <p>Select View to see every detail supplied by the customer.</p>
          </div>
        </header>
        {items === null ? (
          <Loading />
        ) : items.length ? (
          <div className="lease-request-list">
            {items.map((item) => (
              <article key={item._id}>
                <div>
                  <span className={`enquiry-status ${item.status}`}>
                    {item.status}
                  </span>
                  <strong>{item.name}</strong>
                  <small>{item.company || item.email}</small>
                </div>
                <div>
                  <strong>
                    {item.leaseDetails?.workspaceName ||
                      "Workspace not specified"}
                  </strong>
                  <small>
                    {item.leaseDetails?.durationMonths || "—"} months ·{" "}
                    {item.leaseDetails?.occupantCount || item.seats || "—"}{" "}
                    occupants
                  </small>
                </div>
                <div>
                  <strong>{date(item.preferredDate)}</strong>
                  <small>Expected move-in</small>
                </div>
                <button
                  className="enquiry-view"
                  onClick={() => setSelected(item)}
                >
                  <Eye /> View
                </button>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            icon={CalendarRange}
            title="No lease requests yet"
            copy="Requests submitted from the public booking page will appear here."
          />
        )}
      </section>
      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelected(null)
          }
        >
          <section className="admin-modal enquiry-detail-modal lease-request-modal">
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close lease request"
            >
              <X />
            </button>
            <p className="eyebrow">Lease request</p>
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
                <span>Company</span>
                <strong>{selected.company || "Not specified"}</strong>
              </div>
              <div>
                <span>Workspace</span>
                <strong>
                  {selected.leaseDetails?.workspaceName || "Not specified"}
                </strong>
              </div>
              <div>
                <span>Lease term</span>
                <strong>
                  {selected.leaseDetails?.durationMonths || "—"} months
                </strong>
              </div>
              <div>
                <span>Expected move-in</span>
                <strong>{date(selected.preferredDate)}</strong>
              </div>
              <div>
                <span>Occupants</span>
                <strong>
                  {selected.leaseDetails?.occupantCount ||
                    selected.seats ||
                    "Not specified"}
                </strong>
              </div>
              <div>
                <span>Payment preference</span>
                <strong>
                  {pretty(selected.leaseDetails?.paymentFrequency)}
                </strong>
              </div>
              <div>
                <span>Purpose</span>
                <strong>{pretty(selected.leaseDetails?.purpose)}</strong>
              </div>
              <div>
                <span>Expected end date</span>
                <strong>
                  {selected.leaseDetails?.endDateLabel || "Not specified"}
                </strong>
              </div>
              <div className="full">
                <span>Occupant names</span>
                <strong>
                  {selected.leaseDetails?.occupantNames || "Not specified"}
                </strong>
              </div>
              <div className="full">
                <span>Customer message</span>
                <strong>{selected.message || "No additional message."}</strong>
              </div>
            </div>
            <label className="enquiry-modal-status">
              Follow-up status
              <select
                value={selected.status}
                onChange={(event) => updateStatus(event.target.value)}
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
