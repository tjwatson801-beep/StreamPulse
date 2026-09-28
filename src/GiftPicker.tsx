import { useState } from "react";
import { GiftOption } from "./types";
import { giftKey } from "./giftCatalog";

function GiftPicture({ gift }: { gift?: GiftOption }) {
  const [failedUrl, setFailedUrl] = useState("");
  return gift?.imageUrl?.startsWith("https://") && failedUrl !== gift.imageUrl
    ? <img className="sticker-picture" loading="lazy" src={gift.imageUrl} alt="" onError={() => setFailedUrl(gift.imageUrl || "")}/>
    : <span className="sticker-picture placeholder" aria-hidden="true">🎁</span>;
}

export default function GiftPicker({ options, value, used, onChange }: {
  options: GiftOption[]; value: string; used: string[]; onChange: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const selected = options.find(gift => giftKey(gift.name) === giftKey(value));
  const filtered = options.filter(gift => giftKey(gift.name).includes(giftKey(search)));
  return <details className="sticker-picker gift-picker" onKeyDown={event => {
    if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
  }}>
    <summary aria-label={selected ? `Gift: ${selected.name}` : "Choose gift"}><GiftPicture gift={selected}/><span>{selected?.name || "Choose gift"}</span><span aria-hidden="true">▾</span></summary>
    <div className="gift-menu">
      <input aria-label="Search gifts" placeholder="Search gifts…" value={search} onChange={event => setSearch(event.target.value)}/>
      <div className="sticker-options">{filtered.length ? filtered.map(gift => {
        const configured = used.some(name => giftKey(name) === giftKey(gift.name));
        return <button type="button" key={giftKey(gift.name)} disabled={configured} onClick={event => {
          onChange(gift.name); setSearch("");
          const details = event.currentTarget.closest("details");
          if (details) { details.open = false; details.querySelector("summary")?.focus(); }
        }}><GiftPicture gift={gift}/><span>{gift.name}{configured ? " · Already configured" : ""}</span>{giftKey(gift.name) === giftKey(value) && <span aria-hidden="true">✓</span>}</button>;
      }) : <p>No gifts match your search.</p>}</div>
    </div>
  </details>;
}

