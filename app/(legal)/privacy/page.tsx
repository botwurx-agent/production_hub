import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy | The Hub" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Last updated: 15 July 2026</p>
      <p>
        This policy explains what information The Hub (&ldquo;the Service&rdquo;,
        operated by <strong>[Studio legal name]</strong>) collects, how it is
        used, and the choices you have. It reflects how the product actually
        works today.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> Your email address and an
          encrypted password (handled by our authentication provider), and the
          studio name you set at signup.
        </li>
        <li>
          <strong>Content you create.</strong> Projects, clients and contacts,
          leads and deals, briefs, assets and file uploads, comments,
          approvals, call sheets, budgets, and related production records you
          enter or upload.
        </li>
        <li>
          <strong>Connected accounts.</strong> If you connect Google (Gmail,
          Calendar, Drive, Chat), Slack, or Figma, we store access tokens and
          the specific data you choose to link (for example an email thread or a
          file) so it can appear inside your projects. You can disconnect these
          at any time in Settings.
        </li>
        <li>
          <strong>Usage and technical data.</strong> Basic log and device data
          needed to operate and secure the Service.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To provide, maintain, and improve the Service.</li>
        <li>
          To operate features you invoke, including optional AI features that
          generate summaries and drafts from your project content.
        </li>
        <li>To secure the Service and prevent abuse.</li>
        <li>To communicate with you about your account.</li>
      </ul>

      <h2>How information is shared</h2>
      <p>
        We do not sell your personal information. Information is shared only
        with:
      </p>
      <ul>
        <li>
          <strong>Service providers</strong> that host and run the Service (our
          database, storage, and hosting providers), and any AI provider used to
          power optional AI features, acting on our instructions.
        </li>
        <li>
          <strong>People you choose.</strong> When you create a public share or
          review link (for a client review, a call sheet, or a document),
          anyone with that link can view the shared content. Team members and
          project collaborators you invite can access the projects you share
          with them.
        </li>
        <li>
          <strong>Legal requirements,</strong> when required by law or to
          protect rights and safety.
        </li>
      </ul>

      <h2>Data retention and deletion</h2>
      <p>
        We retain your data for as long as your account is active. You can
        request export or deletion of your studio&rsquo;s data by contacting
        us at <a href="mailto:[contact email]">[contact email]</a>.
      </p>

      <h2>Security</h2>
      <p>
        Access to studio data is restricted to members of that studio through
        row-level security, and file access is gated by signed, time-limited
        links. No system is perfectly secure, but we take reasonable measures to
        protect your information.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Disconnect any connected account in Settings at any time.</li>
        <li>Update or delete content you have created.</li>
        <li>Request account deletion or a data export.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email{" "}
        <a href="mailto:[contact email]">[contact email]</a>.
      </p>
    </>
  );
}
