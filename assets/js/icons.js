/* Icônes au trait (24×24, currentColor) */
window.ICONS = (() => {
  const svg = (body, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

  const cloudTop = 'M7 15.5h10.2a3.8 3.8 0 0 0 .5-7.57A5.6 5.6 0 0 0 6.9 6.6 4.5 4.5 0 0 0 7 15.5z';
  const smallCloud = 'M9.5 20.5h8.2a3.4 3.4 0 0 0 .4-6.78 5 5 0 0 0-9.4-1.3A4.1 4.1 0 0 0 9.5 20.5z';
  const cloudFull = 'M7 19h10.2a3.8 3.8 0 0 0 .5-7.57A5.6 5.6 0 0 0 6.9 10.1 4.5 4.5 0 0 0 7 19z';

  const P = {
    // navigation
    home: '<path d="M4 5.5h13a1.5 1.5 0 0 1 1.5 1.5v11.5a2 2 0 0 0 2-2V9"/><path d="M4 5.5v12A1.5 1.5 0 0 0 5.5 19h15"/><path d="M7.5 9h7M7.5 12.5h7M7.5 16h4"/>',
    flux: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M10.5 9.5l4 2.5-4 2.5z" fill="currentColor" stroke="none"/>',
    bookmark: '<path d="M7 3.5h10a1 1 0 0 1 1 1V20.5l-6-4-6 4V4.5a1 1 0 0 1 1-1z"/>',
    bookmarkFill: '<path d="M7 3.5h10a1 1 0 0 1 1 1V20.5l-6-4-6 4V4.5a1 1 0 0 1 1-1z" fill="currentColor"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    // actions
    share: '<path d="M12 3.5v12"/><path d="M8 7.5l4-4 4 4"/><path d="M6 11.5H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5s1.1-6 3.5-8.5z"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronUp: '<path d="M6 15l6-6 6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
    trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
    wind: '<path d="M3 9h10.5a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 13h15a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 17h6"/>',
    droplet: '<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z"/>',
    umbrella: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6.5a2 2 0 0 1-4 0"/><path d="M12 3v0"/>',
    sunrise: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0"/><path d="M12 3v6M9 6l3-3 3 3M4.5 12.5l1.2 1M19.5 12.5l-1.2 1"/>',
    sunset: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0"/><path d="M12 9V3M9 6l3 3 3-3M4.5 12.5l1.2 1M19.5 12.5l-1.2 1"/>',
    layers: '<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12l8.5 4.5 8.5-4.5"/><path d="M3.5 16l8.5 4.5 8.5-4.5"/>',
    // météo
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
    cloudSun: '<path d="M8.5 2.5v1.5M3.3 4.6l1 1M1.8 9.8h1.5M13.7 4.6l-1 1"/><path d="M5.2 12.6a3.6 3.6 0 0 1 6.4-4.3"/>' + `<path d="${smallCloud}"/>`,
    cloudMoon: '<path d="M11.8 8.4A4.4 4.4 0 0 1 6.4 3a4.4 4.4 0 1 0 5.4 5.4z"/>' + `<path d="${smallCloud}"/>`,
    cloud: `<path d="${cloudFull}"/>`,
    fog: `<path d="${cloudTop}"/><path d="M4 18.5h16M7 21.5h10"/>`,
    drizzle: `<path d="${cloudTop}"/><path d="M8 18.5v.5M12 19.5v.5M16 18.5v.5M10 21.5v.5M14 21.5v.5"/>`,
    rain: `<path d="${cloudTop}"/><path d="M8.5 18l-1 3M12.5 18l-1 3M16.5 18l-1 3"/>`,
    snow: `<path d="${cloudTop}"/><path d="M8 19h.01M12 18.5h.01M16 19h.01M10 21.5h.01M14 21.5h.01" stroke-width="2.6"/>`,
    storm: `<path d="${cloudTop}"/><path d="M12.5 16l-2.2 3.2h3.4l-2.2 3.3"/>`,
    // rubriques
    belgique: '<path d="M3.5 20.5h17M5 20.5v-9M9.5 20.5v-9M14.5 20.5v-9M19 20.5v-9M3 11.5h18L12 4z"/>',
    monde: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5s1.1-6 3.5-8.5z"/>',
    economie: '<rect x="3.5" y="7.5" width="17" height="12" rx="1.5"/><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17"/>',
    finance: '<path d="M3.5 19.5h17"/><path d="M5 15.5l4.5-4.5 3.5 3 6-6.5"/><path d="M15 7.5h4v4"/>',
    sante: '<path d="M12 20s-7.5-4.4-7.5-10a4.2 4.2 0 0 1 7.5-2.6A4.2 4.2 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/><path d="M7.5 11.5h2.5l1.3-2 1.6 4 1.3-2h2.3"/>',
    'faits-divers': '<path d="M12 3.5l7.5 3v5.3c0 4.4-3.2 7.6-7.5 8.7-4.3-1.1-7.5-4.3-7.5-8.7V6.5z"/><path d="M12 8.5v4M12 15.5h.01"/>',
    tech: '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
    sport: '<path d="M8 4.5h8v4.5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1.5A2.5 2.5 0 0 0 7.5 10H8M16 6h3v1.5a2.5 2.5 0 0 1-2.5 2.5H16M12 13v3.5M8.5 20h7M9.5 20l.8-3.5h3.4l.8 3.5"/>',
    culture: '<path d="M4 4.5h7v6a3.5 3.5 0 0 1-7 0z"/><path d="M13 9.5h7v6a3.5 3.5 0 0 1-7 0z"/><path d="M6 8h.01M9 8h.01M15 13h.01M18 13h.01M6 11.5c.8.6 1.7.6 2.5 0M15.5 17.5c.8-.6 1.7-.6 2.5 0"/>',
  };

  const icon = (name, extra) => svg(P[name] || P.layers, extra);
  return { icon };
})();
