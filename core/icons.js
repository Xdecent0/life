// One icon set for every app.
//
// The sprite used to be pasted into the page that needed it, which meant a
// second app either duplicated it or quietly lost half the glyphs. It is a
// string here and injected once at boot: no build step, no copy to drift.

const SPRITE = `<g id="i-list" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M5 6h14M5 12h14M5 18h9"/></g>
    <g id="i-stock" fill="none" stroke-width="1.6" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M5 11h14M9.5 6.5v2"/></g>
    <g id="i-recipes" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M7 4v7a5 5 0 0 0 10 0V4"/><path d="M12 16v4"/></g>
    <g id="i-menu" fill="none" stroke-width="1.6" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></g>
    <g id="i-store" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M4 9h16l-1.5 11h-13z"/><path d="M4 9l2-4h12l2 4"/></g>
    <g id="i-track" fill="none" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5l3 2"/></g>
    <g id="i-receipts" fill="none" stroke-width="1.6" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6M9 13h6"/></g>
    <!-- A body between the hub and the teeth, or eight ticks around a dot read
         as a sun rather than a cog. -->
    <g id="i-settings" fill="none" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.6"/><path d="M12 5V2.6M12 19v2.4M5 12H2.6M19 12h2.4M7.05 7.05L5.3 5.3M16.95 16.95l1.75 1.75M16.95 7.05l1.75-1.75M7.05 16.95L5.3 18.7"/></g>
    <g id="i-check" fill="none" stroke-width="2.4" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7"/></g>
    <g id="i-search" fill="none" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></g>
    <g id="i-share" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4"/><path d="M8.5 7.5L12 4l3.5 3.5"/><path d="M6 12v7h12v-7"/></g>
    <g id="i-plus" fill="none" stroke-width="1.7" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></g>
    <g id="i-back" fill="none" stroke-width="1.8" stroke-linecap="round"><path d="M14 6l-6 6 6 6"/></g>
    <!-- A tray with a lip, not an envelope: what lands here is notes waiting to
         be sorted, and an envelope would promise mail. -->
    <g id="i-inbox" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l2.2-7h11.6L20 13v5H4z"/><path d="M4 13h4l1 2h6l1-2h4"/></g>
    <g id="i-chev-right" fill="none" stroke-width="1.9" stroke-linecap="round"><path d="M9.5 5.5l6.5 6.5-6.5 6.5"/></g>
    <g id="i-chev-down" fill="none" stroke-width="1.9" stroke-linecap="round"><path d="M5.5 9.5l6.5 6.5 6.5-6.5"/></g>
    <g id="i-close" fill="none" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></g>
    <g id="i-camera" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></g>
    <g id="i-freezer" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M12 3v18M4 7.5l16 9M20 7.5l-16 9"/></g>
    <g id="i-shelf" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18M8 6v6M15 12v6"/></g>
    <g id="i-veg" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M6 10h12l-1.4 9.5H7.4z"/><path d="M9 10c0-3 1.4-5.5 3-5.5S15 7 15 10"/></g>
    <g id="i-carton" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M5 8h11l3 4v4H5z"/><path d="M5 12h14"/></g>
    <g id="i-sync" fill="none" stroke-width="1.7" stroke-linecap="round"><path d="M20 11a8 8 0 0 0-13.7-5.3L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 13.7 5.3L20 16"/><path d="M20 20v-4h-4"/></g>
    <g id="i-trash" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M7 4h10l-1 16H8z"/><path d="M7.6 9h8.8"/></g>
    <g id="i-eggs" fill="none" stroke-width="1.6" stroke-linecap="round"><ellipse cx="12" cy="13.5" rx="5.5" ry="7"/></g>
    <g id="i-meat" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M6 15c0-4 2.7-7 6-7s6 3 6 7z"/><path d="M5 18h14"/></g>`;

export function mountIcons(doc = document) {
  if (doc.getElementById("life-icons")) return;

  const host = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  host.id = "life-icons";
  host.setAttribute("width", "0");
  host.setAttribute("height", "0");
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("focusable", "false");
  host.style.position = "absolute";
  host.innerHTML = `<defs>${SPRITE}</defs>`;
  doc.body.prepend(host);
}
