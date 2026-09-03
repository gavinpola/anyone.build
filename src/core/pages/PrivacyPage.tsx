import { Prose } from "./Prose";

export function PrivacyPage() {
  return (
    <Prose title="Privacy" intro="We keep almost nothing.">
      <p><strong>Visitors.</strong> No cookies, no fingerprinting, no IP addresses stored. We count page views with a random id that lives in your tab and dies with it.</p>
      <p><strong>Signed-in builders.</strong> From GitHub we keep your handle, avatar, account age, and public repo count (to set your trust level), plus the email GitHub gives us for sign-in. Your requests and the code they produce are public by design.</p>
      <p><strong>Patrons.</strong> Card details go to Stripe; we never see them. We keep the name, link, logo, and email you enter, and we email you about your bid.</p>
      <p><strong>Deletion.</strong> Email hello@anyone.build and we'll remove your account data. Commits already merged are public history and stay.</p>
    </Prose>
  );
}
