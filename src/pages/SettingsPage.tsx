import { useStore } from '../data/store';
import { AUDIENCE_LABEL, LOST_REASONS, RULES, SOURCES } from '../lib/stages';
import { OwnerDot } from '../components/ui';

export default function SettingsPage() {
  const { data, resetSampleData } = useStore();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Admins can edit these once login is switched on</div>
          <h1 className="page-title">Settings</h1>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Team</h2>
            <span className="card-note">Sample names. Your real team is added in phase 3</span>
          </div>
          <div className="list">
            {data.team.map((m) => (
              <div className="list-row" key={m.id}>
                <OwnerDot id={m.id} />
                <div className="grow">
                  <div className="title">{m.name}</div>
                  <div className="meta">{m.email}</div>
                </div>
                <span className="tag plain">{m.role === 'admin' ? 'Admin' : 'Member'}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Connections</h2>
          </div>
          <div className="list">
            <div className="list-row">
              <div className="grow">
                <div className="title">HubSpot</div>
                <div className="meta">Read-only hourly import of contacts, form submissions and deals. Phase 5</div>
              </div>
              <span className="flag warn">Not connected</span>
            </div>
            <div className="list-row">
              <div className="grow">
                <div className="title">Mailchimp</div>
                <div className="meta">Read-only hourly import of signups, EDM opens and clicks. Phase 6</div>
              </div>
              <span className="flag warn">Not connected</span>
            </div>
          </div>
          <p className="small muted">
            The dashboard never sends emails and never changes anything in HubSpot or Mailchimp.
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Event types</h2>
            <span className="card-note">Pricing TBC</span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Event type</th>
                  <th>Usual audience</th>
                </tr>
              </thead>
              <tbody>
                {data.eventTypes.map((e) => (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td>{AUDIENCE_LABEL[e.defaultAudience]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Rules</h2>
          </div>
          <dl className="facts">
            <div>
              <dt>Follow-up after</dt>
              <dd>{RULES.followUpDays} days with no contact</dd>
            </div>
            <div>
              <dt>First reply target</dt>
              <dd>Within {RULES.replyWithinHours} hours</dd>
            </div>
            <div>
              <dt>Proposal target</dt>
              <dd>Within {RULES.proposalWithinHours} hours of the tour</dd>
            </div>
            <div>
              <dt>Altar Room capacity</dt>
              <dd>{RULES.altarRoomCapacity} guests</dd>
            </div>
            <div>
              <dt>Sources</dt>
              <dd>{SOURCES.map((s) => s.label).join(', ')}</dd>
            </div>
            <div>
              <dt>Lost reasons</dt>
              <dd>{LOST_REASONS.map((s) => s.label).join(', ')}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Sample data</h2>
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>
          Put the 60 sample contacts back the way they started. Anything you've added or moved in this browser is
          cleared.
        </p>
        <button className="btn" onClick={resetSampleData}>
          Reset sample data
        </button>
      </section>
    </div>
  );
}
