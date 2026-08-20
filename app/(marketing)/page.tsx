import Link from "next/link";
import { Shot } from "@/components/marketing/shot";

/* Small shared pieces. Kept local because they are page furniture, not product
   components, and pulling them into components/ui would blur that line. */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11.5px] font-medium uppercase tracking-[1.7px] text-accent">
      {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="max-w-[20ch] text-balance font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-extrabold leading-[1.06] tracking-[-1.4px]">
      {children}
    </h2>
  );
}

function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 max-w-[54ch] text-[17px] leading-relaxed text-text-muted">
      {children}
    </p>
  );
}

function Tile({ hue, glyph }: { hue: string; glyph: string }) {
  return (
    <span
      className="mb-3 grid h-9 w-9 place-items-center rounded-[11px] text-[15px]"
      style={{
        backgroundColor: `var(--h-${hue}-bg)`,
        color: `var(--h-${hue})`,
      }}
    >
      {glyph}
    </span>
  );
}

const SCATTER = [
  ["Gmail", "the brief"],
  ["Figma", "the boards"],
  ["Drive", "the references"],
  ["Dropbox", "the cut"],
  ["WeTransfer", "the delivery"],
  ["Sheets", "the budget"],
  ["Notes", "the shot list"],
  ["WhatsApp", "the change"],
  ["A reply-all thread", "the approval"],
  ["FreshBooks", "the invoice"],
  ["Hero_FINAL_v3.mov", "the file"],
];

const MODULES = [
  ["purple", "◉", "Storyboards", "Ordered frames, scene and sound per frame"],
  ["blue", "▣", "Shot list", "Size, type and movement, per shot"],
  ["amber", "●", "Call sheets", "Built on the sheet, sent per person, confirmations tracked"],
  ["green", "▲", "Crew and gear", "Roster by department, with agreed day rates"],
  ["indigo", "■", "Budget", "Bid against actual, with the invoices behind each line"],
  ["red", "◆", "Documents", "Permits, insurance and specs, filed from the email they arrived in"],
];

export default function MarketingHome() {
  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
          style={{
            background:
              "radial-gradient(1100px 520px at 78% 0%, oklch(0.976 0.023 78), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-[1180px] px-6 pb-4 pt-16 md:pt-24">
          <h1 className="max-w-[15ch] text-balance font-display text-[clamp(2.5rem,6.4vw,4.6rem)] font-extrabold leading-[1.02] tracking-[-2.4px]">
            One home for the whole job
          </h1>
          <p className="mt-6 max-w-[52ch] text-[clamp(1.0625rem,1.7vw,1.3125rem)] leading-[1.5]">
            The brief, the boards, the cuts, the client feedback, the call sheet
            and the budget. In one place, built around how a commercial job
            actually runs.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="rounded-[11px] bg-accent px-6 py-3.5 font-display text-[15px] font-bold text-accent-fg shadow-md transition hover:opacity-90"
            >
              Start free
            </Link>
            <a
              href="#how"
              className="rounded-[11px] border border-border-strong bg-surface px-6 py-3.5 font-display text-[15px] font-bold transition hover:bg-surface-2"
            >
              See how it works
            </a>
          </div>

          <p className="mt-5 text-[13px] text-text-faint">
            Built by a working commercial studio, on live jobs.
          </p>

          <div className="mt-14 md:mt-16">
            <Shot
              src="/marketing/shots/project-hub.png"
              alt="A project in Studio Flows, everything on one surface"
              width={1600}
              height={1000}
              priority
              className="shadow-lg"
            />
          </div>
        </div>
      </section>

      {/* ---------------- the problem ---------------- */}
      <section className="mx-auto max-w-[1180px] px-6 py-20 md:py-28">
        <Eyebrow>The problem</Eyebrow>
        <H2>A job lives in eleven places</H2>
        <Lede>And not one of them knows about the other ten.</Lede>

        <ul className="mt-9 flex flex-wrap gap-2.5">
          {SCATTER.map(([app, what]) => (
            <li
              key={app}
              className="flex items-baseline gap-2 rounded-[10px] border border-border bg-surface px-3.5 py-2.5 shadow-sm"
            >
              <span className="text-sm font-medium">{app}</span>
              <span className="text-[12.5px] text-text-faint">{what}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 grid gap-8 border-t border-border pt-9 md:grid-cols-3">
          <div>
            <h3 className="mb-1.5 font-display text-[15px] font-bold">
              The approval nobody can find
            </h3>
            <p className="text-sm text-text-muted">
              The client said yes in a reply to a forwarded thread. On Thursday,
              when it matters, nobody can produce it.
            </p>
          </div>
          <div>
            <h3 className="mb-1.5 font-display text-[15px] font-bold">
              The version that went out anyway
            </h3>
            <p className="text-sm text-text-muted">
              v3 was approved. v2 was the one in the folder with the shortest
              filename, and that is the one that shipped.
            </p>
          </div>
          <div>
            <h3 className="mb-1.5 font-display text-[15px] font-bold">
              The balance that aged quietly
            </h3>
            <p className="text-sm text-text-muted">
              The deposit landed, the balance did not, and nothing in the pile
              was watching for it.
            </p>
          </div>
        </div>

        <p className="mt-9 max-w-[58ch] text-[17px] leading-relaxed text-text-muted">
          None of this is a discipline problem. Producers are the most organised
          people on a job. It is a{" "}
          <strong className="font-medium text-text">filing</strong> problem, and
          filing is what software is for.
        </p>
      </section>

      {/* ---------------- client review ---------------- */}
      <section id="review" className="border-y border-border bg-surface-2">
        <div className="mx-auto max-w-[1180px] px-6 py-20 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <Eyebrow>Client review</Eyebrow>
              <H2>Send a link. Your client needs no login.</H2>
              <Lede>
                No account, no seat to buy for someone who will use it twice.
                They open the link and they are looking at the cut.
              </Lede>
              <ul className="mt-7 grid gap-3">
                {[
                  "Comments land on the frame, at the timecode, with markup drawn on it.",
                  "Approve or request changes in the same place, recorded with a name and a time.",
                  "Every round is kept, so the third conversation can see the first one.",
                ].map((line) => (
                  <li
                    key={line}
                    className="relative pl-5 text-[15px] text-text-muted"
                  >
                    <span className="absolute left-0 top-[9px] h-[2px] w-2.5 rounded bg-border-strong" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <Shot
              src="/marketing/shots/client-review-portal.png"
              alt="The client review portal, comments pinned at a timecode"
              width={1600}
              height={1000}
              className="shadow-lg"
            />
          </div>
        </div>
      </section>

      {/* ---------------- versions ---------------- */}
      <section className="mx-auto max-w-[1180px] px-6 py-20 md:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <Shot
            src="/marketing/shots/project-review.png"
            alt="Review and approvals, grouped by state"
            width={1600}
            height={1000}
            className="shadow-lg lg:order-1"
          />
          <div className="lg:order-2">
            <Eyebrow>Versions</Eyebrow>
            <H2>One asset. Every version. One thread.</H2>
            <Lede>
              A new cut is not a new file with a longer name. It is the next
              version of the thing you were already talking about, carrying its
              own history of who said what.
            </Lede>
            <p className="mt-5 max-w-[52ch] text-[15px] text-text-muted">
              The file called{" "}
              <strong className="font-medium text-text">
                Hero_FINAL_v3_ACTUAL.mov
              </strong>{" "}
              stops existing, because it was only ever a workaround for software
              that could not hold a history.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- the rest of the job ---------------- */}
      <section id="how" className="border-y border-border bg-surface-2">
        <div className="mx-auto max-w-[1180px] px-6 py-20 md:py-28">
          <Eyebrow>The rest of the job</Eyebrow>
          <H2>Everything after the brief, and everything after the shoot</H2>
          <Lede>
            Most tools stop at the creative. A job does not, and neither does
            the paperwork it leaves behind.
          </Lede>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(([hue, glyph, name, detail]) => (
              <div
                key={name}
                className="rounded-[13px] border border-border bg-surface p-5"
              >
                <Tile hue={hue} glyph={glyph} />
                <h3 className="text-[15px] font-medium">{name}</h3>
                <p className="mt-1 text-[13px] leading-snug text-text-faint">
                  {detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <h3 className="max-w-[18ch] text-balance font-display text-[26px] font-extrabold leading-tight tracking-[-0.9px]">
                A vendor invoice arrives by email
              </h3>
              <p className="mt-4 max-w-[50ch] text-[15px] leading-relaxed text-text-muted">
                One click files it as a cost against the right budget line,
                reads the amount off the PDF, and flags it if it does not match
                the day rate you agreed. Deposits and balances are tracked
                separately, because they are paid separately.
              </p>
            </div>
            <Shot
              src="/marketing/shots/project-budget.png"
              alt="Budget, bid against actual, with the cost ledger"
              width={1600}
              height={1000}
              className="shadow-lg"
            />
          </div>
        </div>
      </section>

      {/* ---------------- connections ---------------- */}
      <section className="mx-auto max-w-[1180px] px-6 py-20 md:py-28">
        <Eyebrow>Connections</Eyebrow>
        <H2>Organise, do not replace</H2>
        <Lede>
          Nobody is going to abandon Figma because a project tool asked them to.
          Studio Flows reaches into where the work already lives and files it
          against the job.
        </Lede>

        <ul className="mt-8 flex flex-wrap gap-2.5">
          {[
            ["Gmail", "threads, replies, attachments"],
            ["Google Drive", "browse and import"],
            ["Figma", "frames as assets"],
            ["Slack", "channels"],
            ["Google Chat", "spaces"],
            ["Calendar", "two way"],
          ].map(([name, detail]) => (
            <li
              key={name}
              className="rounded-pill border border-border bg-surface px-4 py-2 text-sm font-medium"
            >
              {name}{" "}
              <span className="font-normal text-[12.5px] text-text-faint">
                {detail}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-[58ch] text-[15px] text-text-muted">
          The test for any connection is simple: it has to remove a tool switch
          that happens on every job. Anything else is a logo on a page.
        </p>
      </section>

      {/* ---------------- where AI sits ---------------- */}
      <section className="border-y border-border bg-surface-2">
        <div className="mx-auto max-w-[1180px] px-6 py-20 md:py-28">
          <div className="max-w-[62ch]">
            <Eyebrow>Where AI sits</Eyebrow>
            <H2>It proposes. You commit.</H2>
            <Lede>
              Ask in your own words and it reads the studio and comes back with
              a card, not a change. Nothing is written until you press Create.
            </Lede>
            <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed text-text-muted">
              That is not caution for its own sake. A model that files a cost
              unattended will eventually file the wrong one, and a financial
              record you did not agree to is worse than no record. The same rule
              holds everywhere it appears: it drafts the client update, it reads
              the invoice, it rewrites the reply. You send it.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- why it exists ---------------- */}
      <section id="why" className="mx-auto max-w-[1180px] px-6 py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <Eyebrow>Why it exists</Eyebrow>
            <H2>Every feature came from something that went wrong</H2>
          </div>
          <div className="max-w-[54ch] space-y-5 text-[16px] leading-relaxed text-text-muted">
            <p>
              Studio Flows is built by a working commercial studio operator, and
              used on live jobs before it is shown to anyone.
            </p>
            <p>
              There is no roadmap workshop behind it. The backlog is a list of
              things that got in the way last week: an approval that could not
              be found, an invoice that arrived as a photograph, a crew rate a
              freelancer should never have been able to see. When a job runs
              clean, nothing gets built. That is the rule, and it is why the
              product does not sprawl.
            </p>
            <p>
              It is also why the interface is warm rather than white. On cold
              white the software is the brightest thing on screen and the work
              has to fight it. That matters when the work is the thing being
              judged.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- close ---------------- */}
      <section className="relative overflow-hidden border-t border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 460px at 20% 100%, oklch(0.976 0.024 76), transparent 68%)",
          }}
        />
        <div className="relative mx-auto max-w-[1180px] px-6 py-24 md:py-32">
          <h2 className="max-w-[16ch] text-balance font-display text-[clamp(2rem,5vw,3.4rem)] font-extrabold leading-[1.02] tracking-[-1.8px]">
            Run a real job through it
          </h2>
          <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed">
            Not a trial account you poke at for ten minutes. One job, brief to
            delivery, with your real client and your real deadline. That is the
            only test that tells either of us anything.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="rounded-[11px] bg-accent px-6 py-3.5 font-display text-[15px] font-bold text-accent-fg shadow-md transition hover:opacity-90"
            >
              Start free
            </Link>
            <Link
              href="/login"
              className="rounded-[11px] border border-border-strong bg-surface px-6 py-3.5 font-display text-[15px] font-bold transition hover:bg-surface-2"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
