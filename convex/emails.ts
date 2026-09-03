"use node";
import { Resend } from "resend";

/** Transactional email via Resend. Silent no-op when RESEND_API_KEY isn't set. */
export async function sendEmail(to: string, msg: { subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.RESEND_FROM ?? "anyone.build <patron@mail.anyone.build>";
  const resend = new Resend(key);
  await resend.emails.send({ from, to, subject: msg.subject, html: msg.html, text: msg.text }).catch((e) => console.error("resend", e));
}

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const site = () => process.env.SITE_URL ?? "https://anyone.build";

/** One design: black card, one orange number, one line, one button. */
function layout(o: { eyebrow: string; big: string; line: string; cta: string; href: string; foot: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f3efe6;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;color:#16140f">
<div style="max-width:520px;margin:32px auto;padding:0 16px">
  <div style="font:600 12px/1 'SF Mono',Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#7d7768;margin:0 0 12px">anyone.build</div>
  <div style="background:#16140f;color:#f3efe6;border-radius:14px;padding:28px 28px 24px">
    <div style="font:500 12px/1 'SF Mono',Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:#b9b2a2">${o.eyebrow}</div>
    <div style="font:800 64px/1 Helvetica Neue,Helvetica,Arial,sans-serif;letter-spacing:-.03em;color:#ff6a33;margin:14px 0 10px">${o.big}</div>
    <div style="font-size:17px;line-height:1.4">${o.line}</div>
    <a href="${o.href}" style="display:inline-block;margin-top:20px;background:#ff6a33;color:#14100c;text-decoration:none;font-weight:700;font-size:15px;padding:12px 18px;border-radius:8px">${o.cta}</a>
  </div>
  <p style="font-size:12px;color:#7d7768;margin:14px 4px 0">${o.foot}</p>
</div></body></html>`;
}

export function outbidEmail(i: { name: string; theirCents: number; newCents: number; slotDay: string }) {
  const take = usd(i.newCents + 100);
  return {
    subject: `You've been outbid. ${take} takes it back.`,
    html: layout({
      eyebrow: `Patron of the day · ${i.slotDay}`,
      big: usd(i.newCents),
      line: `Someone just went past your ${usd(i.theirCents)} for <strong>${i.name}</strong>. Nothing's charged: your hold is released at midnight ET unless you win.`,
      cta: `Bid ${take}`,
      href: `${site()}/leaderboard`,
      foot: "Only the highest bid at midnight ET is charged. Everyone else's hold is released automatically.",
    }),
    text: `You've been outbid on anyone.build. The high bid is now ${usd(i.newCents)}. ${take} takes it back: ${site()}/leaderboard`,
  };
}

export function wonEmail(i: { name: string; cents: number; slotDay: string }) {
  return {
    subject: `You're the patron of the day.`,
    html: layout({
      eyebrow: `Patron of the day · ${i.slotDay}`,
      big: "#1",
      line: `<strong>${i.name}</strong> is on the wall all day, in front of everyone rebuilding it. ${usd(i.cents)} was charged to your card.`,
      cta: "See it live",
      href: site(),
      foot: "Half of it funds the day's AI budget. Clicks are counted on the leaderboard.",
    }),
    text: `You won today's patron slot on anyone.build for ${usd(i.cents)}. ${site()}`,
  };
}

export function releasedEmail(i: { name: string; cents: number; slotDay: string; winningCents: number }) {
  return {
    subject: `Hold released. Today went for ${usd(i.winningCents)}.`,
    html: layout({
      eyebrow: `Patron of the day · ${i.slotDay}`,
      big: usd(i.winningCents),
      line: `That's what the slot went for. Your ${usd(i.cents)} hold for <strong>${i.name}</strong> was released; nothing was charged. Tomorrow's auction is open.`,
      cta: "Bid for tomorrow",
      href: `${site()}/leaderboard`,
      foot: "Holds show as pending on your statement and disappear within a few days.",
    }),
    text: `Your hold of ${usd(i.cents)} on anyone.build was released. Today's slot went for ${usd(i.winningCents)}. ${site()}/leaderboard`,
  };
}
