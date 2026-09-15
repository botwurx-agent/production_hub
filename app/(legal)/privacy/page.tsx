import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy | Studio Flows" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Last updated: 15 September 2026</p>
      <p>
        This policy explains what information Studio Flows (&ldquo;the
        Service&rdquo;) collects, how it is used, and the choices you have.
        Studio Flows is an independent product operated by its developer as a
        sole proprietorship; no company has been incorporated at this time. This
        policy reflects how the product actually works today.
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
          approvals, call sheets, budgets, agreements, documents, and related
          production records you enter or upload.
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
          needed to operate and secure the Service, including error reports when
          something goes wrong.
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

      <h2>AI features, and what leaves the Service</h2>
      <p>
        Several features are powered by a third-party AI provider: the project
        summary, the client update and outreach drafts, the composer&rsquo;s
        polish button, invoice and document reading, and the in-app assistant.
      </p>
      <p>
        These run only when you invoke them. When you do, the relevant project
        content is sent to the AI provider so it can produce an answer. Under
        that provider&rsquo;s API terms, content sent this way is not used to
        train their models. If you would rather no content left the Service,
        simply do not use those features; nothing runs on its own in the
        background.
      </p>

      <h2>Google user data</h2>
      <p>
        Studio Flows&rsquo; use and transfer of information received from Google
        APIs to any other app will adhere to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>
      <p>
        If you connect Google, we ask for the following access and use it only
        to run the features named beside it:
      </p>
      <ul>
        <li>
          <strong>Gmail, read.</strong> To show a conversation you have linked
          to a project inside that project, so a job&rsquo;s correspondence sits
          with its brief, assets and approvals. We read a thread only because
          you linked it.
        </li>
        <li>
          <strong>Gmail, send.</strong> To send the reply you have written and
          pressed Send on. Nothing is ever sent on your behalf automatically.
        </li>
        <li>
          <strong>Drive, read.</strong> To let you browse your Drive and import
          a file into a project, and to attach a file you pick to an email you
          are writing. We read a file only when you choose it.
        </li>
        <li>
          <strong>Calendar, events.</strong> To show your events on the
          dashboard, and to create or delete the ones you make in the app.
        </li>
        <li>
          <strong>Chat.</strong> To show messages in a space you have linked to
          a project, and to post the message you write.
        </li>
      </ul>
      <p>
        We do not use Google user data for advertising, and we do not sell it.
        We do not use it to develop, improve or train any generalized AI or
        machine learning model, ours or anyone else&rsquo;s. No person at Studio
        Flows reads your Google data except where you have explicitly asked us
        to (for example to investigate a problem you reported), where it is
        necessary for security, or where the law requires it.
      </p>

      <h3>Google data and the AI features</h3>
      <p>
        Two of the optional AI features can send Google data to our AI provider,
        and only at the moment you press the button that runs them:
      </p>
      <ul>
        <li>
          The <strong>project summary</strong> fetches the Gmail threads you
          have linked to that project when you generate it, and includes a short
          gist of them, so the summary can say where the conversation stands.
        </li>
        <li>
          <strong>Reading an emailed invoice or document</strong> sends that
          attachment, so its amounts and dates can be filled into a form for you
          to check before you save anything.
        </li>
      </ul>
      <p>
        This is inference only. The content is sent so the provider can produce
        an answer, and under that provider&rsquo;s API terms it is not used to
        train their models. If you would rather no Google content left the
        Service, do not use those two features; neither runs on its own.
      </p>

      <h3>Keeping and removing Google data</h3>
      <p>
        We store the access tokens for your connection, and for a linked
        conversation the identifier and subject needed to find it again. Message
        bodies and Drive files are read live and are not copied into our
        database, except where you deliberately import one (an attachment filed
        as a project document, or a Drive file imported as an asset), which then
        lives in your project until you delete it. Disconnecting Google in
        Settings, Connections deletes the stored tokens. You can also revoke our
        access directly from your{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noreferrer"
        >
          Google account permissions
        </a>
        .
      </p>

      <h2>Who processes your data</h2>
      <p>
        We do not sell your personal information. The Service runs on the
        following providers, acting on our instructions:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong>, for the database, file storage, and
          authentication.
        </li>
        <li>
          <strong>Vercel</strong>, for hosting and application delivery.
        </li>
        <li>
          <strong>OpenAI</strong>, for the AI features described above.
        </li>
        <li>
          <strong>Resend</strong>, for transactional email such as invitations
          and review requests.
        </li>
        <li>
          <strong>Sentry</strong>, for error reporting.
        </li>
      </ul>
      <p>
        Separately, and only if you choose to connect them, Google, Slack, and
        Figma receive requests on your behalf to read or send the specific
        content you link.
      </p>

      <h2>Where your data is stored</h2>
      <p>
        Data is stored in the United States. If you are located elsewhere, using
        the Service involves transferring your information there.
      </p>

      <h2>Sharing you control</h2>
      <p>
        When you create a public share or review link (for a client review, a
        call sheet, or a document), anyone with that link can view the shared
        content without signing in. Those links can be revoked in the app. Team
        members and project collaborators you invite can access the projects you
        share with them. Information may also be disclosed where required by law
        or to protect rights and safety.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        We retain your data for as long as your account is active. There is no
        self-service delete button during the beta. Email{" "}
        <a href="mailto:studioflows1@gmail.com">studioflows1@gmail.com</a> and
        your studio&rsquo;s data, including uploaded files, will be exported or
        permanently deleted within 30 days of the request.
      </p>

      <h2>Security</h2>
      <p>
        Access to studio data is restricted to members of that studio through
        database row-level security, and file access is gated by signed,
        time-limited links. Passwords are handled by our authentication provider
        and are never visible to us.
      </p>
      <p>
        No system is perfectly secure, and this is early-access software. Please
        keep your own copies of anything critical rather than relying on the
        Service as the only place it exists.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Disconnect any connected account in Settings at any time.</li>
        <li>Update or delete content you have created.</li>
        <li>Revoke any share or review link you have issued.</li>
        <li>Request account deletion or a data export by email.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email{" "}
        <a href="mailto:studioflows1@gmail.com">studioflows1@gmail.com</a>.
      </p>
    </>
  );
}
