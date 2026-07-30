import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service | Studio Flows" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>Last updated: 30 July 2026</p>
      <p>
        These terms govern your use of Studio Flows (&ldquo;the Service&rdquo;).
        Studio Flows is an independent product operated by its developer as a
        sole proprietorship; no company has been incorporated at this time. By
        creating an account or using the Service you agree to these terms.
      </p>

      <h2>This is a free, early-access beta</h2>
      <p>
        The Service is in an invited beta and is provided free of charge. That
        has three consequences worth stating plainly:
      </p>
      <ul>
        <li>
          Features will change, and parts of the Service may be added, altered,
          or removed without notice.
        </li>
        <li>
          Interruptions, defects, and data loss are possible.{" "}
          <strong>
            Do not use the Service as the only place your important information
            exists.
          </strong>{" "}
          Keep your own copies of anything you cannot afford to lose.
        </li>
        <li>
          There is no fee today. If the Service becomes paid, you will be told
          before that applies to you, and you will be free to stop using it.
        </li>
      </ul>

      <h2>Your account</h2>
      <p>
        You are responsible for your account, for keeping your credentials
        secure, and for the activity of team members and collaborators you
        invite. You must provide accurate information and be authorized to bind
        your studio to these terms.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use the Service to break the law or infringe others&rsquo; rights.</li>
        <li>Do not upload content you do not have the rights to store or share.</li>
        <li>Do not attempt to disrupt, reverse engineer, or gain unauthorized access to the Service.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You retain ownership of the content you upload and create. You grant us
        the limited rights needed to host, process, and display that content in
        order to operate the Service for you (including generating optional AI
        summaries and drafts at your request). We do not use your content to
        train any model, and we do not sell it. When you create a public share
        or review link, you are responsible for who you share it with.
      </p>
      <p>
        You are responsible for having the right to upload material belonging to
        your own clients, and for meeting any confidentiality obligations you
        owe them.
      </p>

      <h2>Connected services</h2>
      <p>
        The Service can connect to third-party tools (Google, Slack, Figma, and
        others) at your direction. Your use of those tools remains subject to
        their own terms, and we are not responsible for them. The Privacy Policy
        lists the providers involved in running the Service itself.
      </p>

      <h2>Disclaimers and liability</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;, without warranties of any kind, express or implied. To
        the fullest extent permitted by law, we are not liable for indirect,
        incidental, or consequential damages, or for loss of data or profits
        arising from your use of the Service. Because the Service is provided
        free of charge, our total liability to you is limited to the amount you
        have paid for it, which is nothing.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate
        access for violations of these terms, or end the beta entirely. If the
        beta ends, you will be given reasonable notice and an opportunity to
        retrieve your data. You may request an export or deletion of your data
        at any time, as described in the Privacy Policy.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Material changes will be communicated through
        the Service or by email. Continued use after an update means you accept
        the revised terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href="mailto:studioflows1@gmail.com">studioflows1@gmail.com</a>.
      </p>
      <p>
        Studio Flows is operated from the United States. Because this is a free
        pre-release beta run by an individual rather than an incorporated
        company, these terms do not name a governing jurisdiction or a dispute
        resolution process. A full agreement will be provided before the Service
        is offered commercially.
      </p>
    </>
  );
}
