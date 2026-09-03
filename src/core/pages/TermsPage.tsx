import { Prose } from "./Prose";

export function TermsPage() {
  return (
    <Prose title="Terms" intro="Short, because the rules already say most of it.">
      <p><strong>The wall.</strong> Anything you ask for that ships becomes part of an open-source website under the MIT license, with your GitHub handle on the commit. Don't ask for anything you don't have the right to put there.</p>
      <p><strong>Patron bids.</strong> A bid authorizes a hold on your card for the amount you enter. If your bid is the highest when the auction closes at midnight Eastern Time, it is captured and you receive the slot for that day. All other holds are released. Won bids are not refundable. We may remove a listing that breaks the rules; a removed winning bid is not refunded.</p>
      <p><strong>Accounts.</strong> You sign in with GitHub. Trust levels, rate limits, and bans are at our discretion and exist to keep the wall usable for everyone.</p>
      <p><strong>No warranty.</strong> The site can change at any moment; that's the point. It's provided as is, and we're not liable for what strangers build on it.</p>
      <p><strong>Contact.</strong> hello@anyone.build</p>
    </Prose>
  );
}
