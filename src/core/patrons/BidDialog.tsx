import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAction, useMutation } from "convex/react";
import { Minus, Plus, Upload, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useViewer } from "@/core/auth/useViewer";
import { cn } from "@/core/lib/cn";
import { friendlyError } from "@/core/lib/errors";

const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

type Props = { open: boolean; onClose: () => void; suggestedCents: number; minCents: number; slotDay: string };

export function BidDialog(props: Props) {
  return <AnimatePresence>{props.open ? <BidForm key="bid" {...props} /> : null}</AnimatePresence>;
}

function BidForm({ onClose, suggestedCents, minCents, slotDay }: Props) {
  const viewer = useViewer();
  const placeBid = useAction(api.payments.placeBid);
  const uploadUrl = useMutation(api.patrons.generateLogoUploadUrl);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [blurb, setBlurb] = useState("");
  const [amount, setAmount] = useState(suggestedCents);
  const [logoId, setLogoId] = useState<Id<"_storage"> | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickLogo(file: File) {
    setError(null);
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return setError("Logo must be PNG, JPG, WebP, or SVG.");
    if (file.size > 512 * 1024) return setError("Logo must be under 512 KB.");
    setBusy(true);
    try {
      const target = await uploadUrl({});
      const res = await fetch(target, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      setLogoId(storageId);
      setLogoPreview(URL.createObjectURL(file));
    } catch {
      setError("Upload failed. Try a smaller file.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setError(null);
    if (!viewer.signedIn) return viewer.signIn();
    setBusy(true);
    try {
      const { url: checkoutUrl } = await placeBid({ name, url: url || undefined, blurb: blurb || undefined, logoId: logoId ?? undefined, amountCents: amount });
      window.location.assign(checkoutUrl);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <>
      <motion.div className="fixed inset-0 z-[80] bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        role="dialog"
        aria-label="Bid for patron of the day"
        className="fixed inset-x-3 top-[8dvh] z-[81] mx-auto max-w-md overflow-hidden rounded-xl border border-line bg-card shadow-frame"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 480, damping: 40 }}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="placard smallcaps">Bid · slot for {slotDay}</p>
            <h3 className="font-display text-2xl">Put your name up top.</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-paper-2 hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-[92px] w-[92px] shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-dashed border-line-2 bg-paper-2 text-muted hover:border-accent hover:text-ink"
              aria-label="Upload logo"
            >
              {logoPreview ? <img src={logoPreview} alt="" className="h-full w-full object-cover" /> : (
                <>
                  <Upload size={18} />
                  <span className="placard">logo</span>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && void pickLogo(e.target.files[0])} aria-label="Logo file" />
            <div className="flex flex-1 flex-col gap-2">
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="Name or product" aria-label="Name" className="h-10 rounded-md border border-line bg-paper px-3 text-[14px] placeholder:text-muted focus:border-line-2" />
              <input value={url} onChange={(e) => setUrl(e.target.value.slice(0, 200))} placeholder="yoursite.com (optional)" aria-label="Website" className="h-10 rounded-md border border-line bg-paper px-3 text-[14px] placeholder:text-muted focus:border-line-2" />
            </div>
          </div>
          <input value={blurb} onChange={(e) => setBlurb(e.target.value.slice(0, 140))} placeholder="One line (optional)" aria-label="One line" className="h-10 rounded-md border border-line bg-paper px-3 text-[14px] placeholder:text-muted focus:border-line-2" />

          <div className="flex items-center justify-between rounded-md border border-line bg-paper px-3 py-2">
            <span className="text-[13px] text-ink-2">Your bid</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAmount((a) => Math.max(minCents, a - 100))} className="rounded-md border border-line p-1.5 hover:border-line-2" aria-label="One dollar less">
                <Minus size={14} />
              </button>
              <span className="font-display num w-24 text-center text-3xl">{usd(amount)}</span>
              <button type="button" onClick={() => setAmount((a) => Math.min(9_999_900, a + 100))} className="rounded-md border border-line p-1.5 hover:border-line-2" aria-label="One dollar more">
                <Plus size={14} />
              </button>
            </div>
          </div>
          <p className="placard">
            {amount >= suggestedCents ? "Leads right now." : `${usd(suggestedCents)} leads right now.`} We hold {usd(amount)} on your card. Only the winner is charged, at midnight ET.
          </p>
          {error ? <p className="rounded-md bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p> : null}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || name.trim().length < 2}
            className={cn("h-11 rounded-md bg-accent text-[15px] font-semibold text-accent-ink hover:brightness-95 disabled:opacity-40")}
          >
            {viewer.signedIn ? `Hold ${usd(amount)} and bid` : "Sign in with GitHub to bid"}
          </button>
        </div>
      </motion.div>
    </>
  );
}
