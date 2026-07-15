import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service | Studio Flows" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>Last updated: 15 July 2026</p>
      <p>
        These terms govern your use of Studio Flows (&ldquo;the Service&rdquo;,
        operated by <strong>[Studio legal name]</strong>). By creating an account
        or using the Service you agree to them.
      </p>

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
        summaries and drafts at your request). When you create a public share or
        review link, you are responsible for who you share it with.
      </p>

      <h2>Connected services</h2>
      <p>
        The Service can connect to third-party tools (Google, Slack, Figma, and
        others) at your direction. Your use of those tools remains subject to
        their own terms, and we are not responsible for them.
      </p>

      <h2>Beta software</h2>
      <p>
        The Service is provided during an early-access period. Features may
        change, and occasional interruptions or defects are possible. Keep your
        own copies of anything critical.
      </p>

      <h2>Disclaimers and liability</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any
        kind. To the fullest extent permitted by law, we are not liable for
        indirect, incidental, or consequential damages, or for loss of data or
        profits arising from your use of the Service.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate
        access for violations of these terms. On termination you may request an
        export of your data as described in the Privacy Policy.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Material changes will be communicated through
        the Service. Continued use after an update means you accept the revised
        terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href="mailto:[contact email]">[contact email]</a>. These terms are
        governed by the laws of <strong>[jurisdiction]</strong>.
      </p>
    </>
  );
}
