const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- Price matrix based on earlier specs ---------- */
const PRICE_MATRIX = {
  Bus: {
    providers: ['Easy Coach', 'Guardian'],
    classes: {
      Regular: 1500,
      Premium: 2500
    }
  },
  Flight: {
    providers: ['Qatar Airways', 'Kenya Airways'],
    classes: {
      Economy: 25000,
      Business: 45000,
      'First Class': 70000
    }
  },
  Train: {
    providers: ['SGR', 'Electric Train'],
    classes: {
      Economy: 1000,
      Business: 2000,
      'First Class': 3500
    }
  }
};

/* ---------- TicketRenderer (reduced/adjusted version from previous implementation) ---------- */
const TicketRenderer = (function () {
  let container = null;
  let currentData = null;
  let qrInstance = null;

  const formatDate = iso => {
    if (!iso) return 'TBA';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const computeDuration = (startIso, endIso) => {
    if (!startIso || !endIso) return '';
    const mins = Math.round((new Date(endIso) - new Date(startIso)) / (1000 * 60));
    if (isNaN(mins) || mins <= 0) return '';
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${h}h ${m}m`;
  };
  const fmtKES = n => (n == null || isNaN(n)) ? 'KES N/A' : new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0}).format(n);

  function buildHtml(data) {
    const depart = formatDate(data.departDateTime);
    const arrive = data.arriveDateTime ? formatDate(data.arriveDateTime) : 'TBA';
    const duration = data.duration || computeDuration(data.departDateTime, data.arriveDateTime) || 'TBA';
    const total = data.total ?? ((data.price || 0) + (data.taxes || 0));
    const logo = data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo" loading="lazy">` : `<svg width="86" height="28" viewBox="0 0 300 68" role="img" aria-hidden="true"><text x="0" y="20" font-size="18" font-weight="700" fill="var(--text)">Harmony</text><text x="100" y="20" font-size="14" fill="var(--accent)">Travels</text></svg>`;

    const provider = data.provider || 'Provider';
    const transportType = data.transportType || 'Transport';
    const classOrSeat = data.classOrSeat || 'Class / Seat';
    const origin = (data.route && data.route.origin) ? data.route.origin : 'Origin';
    const destination = (data.route && data.route.destination) ? data.route.destination : 'Destination';
    const distance = (data.distanceKm) ? `${data.distanceKm} km` : '—';

    return `
      <div class="ticket-left" role="article" aria-label="Ticket stub">
        <div class="ticket-logo">${logo}<div class="brand-title">Harmony Travels</div></div>
        <div class="small-muted">Booking</div>
        <div style="font-weight:800;margin-top:6px">${data.bookingId || 'HT-TBA'}</div>
        <div class="small-muted" style="margin-top:6px">Passenger</div>
        <div style="font-weight:700">${data.passengerName || 'Passenger Name'}</div>

        <div style="margin-top:8px" class="small-muted">Contact</div>
        <div class="small-muted">${data.contactPhone || ''}<br>${data.contactEmail || ''}</div>

        <div class="qr-wrap" id="ticket-qr-container" aria-hidden="false"></div>

        <div style="margin-top:8px" class="small-muted">Route</div>
        <div style="font-weight:700">${origin} → ${destination}</div>

        <div class="small-muted" style="margin-top:6px">Distance</div>
        <div class="small-muted">${distance}</div>
      </div>

      <div class="ticket-right">
        <div class="row">
          <div>
            <div class="small-muted">Trip</div>
            <div style="font-weight:900;font-size:1.15rem">${transportType} — ${provider}</div>
            <div class="badge-type">${classOrSeat}</div>
          </div>
          <div style="text-align:right">
            <div class="small-muted">Status</div>
            <div style="font-weight:800;color:var(--accent)">CONFIRMED</div>
          </div>
        </div>

        <div class="details-grid" aria-hidden="false">
          <div class="detail-item">
            <div class="detail-label">Depart</div>
            <div class="detail-value">${depart}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Arrive</div>
            <div class="detail-value">${arrive}</div>
          </div>

          <div class="detail-item">
            <div class="detail-label">Duration</div>
            <div class="detail-value">${duration}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Seat / Class</div>
            <div class="detail-value">${classOrSeat}</div>
          </div>

          <div class="detail-item">
            <div class="detail-label">Price</div>
            <div class="detail-value">${fmtKES(data.price)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Taxes</div>
            <div class="detail-value">${fmtKES(data.taxes || 0)}</div>
          </div>
        </div>

        <div class="price-box">
          <div class="small-muted">Total (Incl. taxes)</div>
          <div class="total">${fmtKES(total)}</div>
        </div>

        <div class="notes">
          <strong>Notes:</strong> ${data.additionalNotes || 'Please bring your ID. Baggage rules apply.'}
          ${ data.mapLink ? `<div style="margin-top:8px"><a href="${data.mapLink}" target="_blank" rel="noopener" class="small-muted">Open route in Google Maps</a></div>` : '' }
        </div>

        <div class="row" style="margin-top:8px">
          <div class="small-muted">Issued by Harmony Travels</div>
          <div class="small-muted">Ref: ${data.bookingId || '—'}</div>
        </div>
      </div>
    `;
  }

  function renderQR(qrPayload) {
    const el = document.getElementById('ticket-qr-container');
    if (!el) return;
    el.innerHTML = '';
    try {
      qrInstance = new QRCode(el, {
        text: qrPayload || window.location.href,
        width: 110,
        height: 110,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    } catch (err) {
      console.warn('QR generation failed', err);
    }
  }

  async function captureToCanvas(elem) {
    if (!elem) throw new Error('Element required');
    if (!window.html2canvas) throw new Error('html2canvas missing');
    const opts = { backgroundColor: null, scale: 2, useCORS: true, logging: false, allowTaint: false };
    return await html2canvas(elem, opts);
  }

  async function downloadPNG() {
    try {
      const elem = document.getElementById('ticketContainer');
      const canvas = await captureToCanvas(elem);
      const url = canvas.toDataURL('image/png', 1.0);
      const a = document.createElement('a');
      a.href = url;
      const id = currentData.bookingId ? currentData.bookingId.replace(/\s+/g,'_') : 'ticket';
      a.download = `HarmonyTravels_Ticket_${id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('PNG downloaded');
    } catch (err) {
      console.error(err);
      alert('PNG generation failed.');
    }
  }

  async function downloadPDF() {
    if (!window.jspdf && !window.jspdf.jsPDF) {
      alert('jsPDF missing');
      return;
    }
    try {
      const elem = document.getElementById('ticketContainer');
      const canvas = await captureToCanvas(elem);
      const imgData = canvas.toDataURL('image/png', 1.0);
      const { jsPDF } = window.jspdf || window.jspdf || window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      let w = pageWidth;
      let h = (imgProps.height / imgProps.width) * w;
      if (h > pageHeight) { h = pageHeight; w = (imgProps.width / imgProps.height) * h; }
      const x = (pageWidth - w) / 2;
      const y = (pageHeight - h) / 2;
      pdf.addImage(imgData, 'PNG', x, y, w, h, undefined, 'FAST');
      const id = currentData.bookingId ? currentData.bookingId.replace(/\s+/g,'_') : 'ticket';
      pdf.save(`HarmonyTravels_Ticket_${id}.pdf`);
      showToast('PDF downloaded');
    } catch (err) {
      console.error(err);
      alert('PDF generation failed.');
    }
  }

  function printTicket() {
    if (!container) return window.print();
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return alert('Popup blocked');
    const html = `
      <html>
        <head>
          <title>Print Ticket</title>
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
          <style>${printCss()}</style>
        </head>
        <body>${container.outerHTML}</body>
      </html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(()=> { w.focus(); w.print(); }, 600);
  }
  function printCss(){ return `body{font-family:Montserrat,Arial;margin:24px} .ticket-card{max-width:100%;}`; }

  async function copyBookingId() {
    const id = currentData && currentData.bookingId ? currentData.bookingId : '';
    if (!id) return showToast('No booking ID');
    try { await navigator.clipboard.writeText(id); showToast('Booking ID copied'); } catch(e){ showToast('Copy failed'); }
  }

  function showToast(msg, ms=1600) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer); t._timer = setTimeout(()=> t.classList.remove('show'), ms);
  }

  function init(selector, data) {
    container = (typeof selector === 'string') ? document.querySelector(selector) : selector;
    if (!container) throw new Error('Container not found');
    currentData = data || {};
    container.innerHTML = buildHtml(currentData);
    renderQR(currentData.qrPayload || `Booking:${currentData.bookingId || 'TBA'}`);
    container.setAttribute('tabindex','-1');
  }

  return { init, downloadPDF, downloadPNG, printTicket, copyBookingId, _renderQR: renderQR };
})();

/* ---------- Booking form wiring ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const transportEl = document.getElementById('transport');
  const providerEl = document.getElementById('provider');
  const classEl = document.getElementById('travelClass');
  const priceDisplay = document.getElementById('priceDisplay');
  const estimateBtn = document.getElementById('estimateBtn');
  const bookingForm = document.getElementById('bookingForm');
  const ticketContainer = document.getElementById('ticketContainer');

  // populate provider/class based on transport
  function populateOptions(transport) {
    providerEl.innerHTML = '';
    classEl.innerHTML = '';
    const spec = PRICE_MATRIX[transport];
    if (!spec) return;
    spec.providers.forEach(p => providerEl.appendChild(new Option(p, p)));
    Object.keys(spec.classes).forEach(cls => classEl.appendChild(new Option(cls, cls)));
    updatePrice(); // update price display
  }

  // compute price based on selections
  function getPrice() {
    const transport = transportEl.value;
    const cls = classEl.value;
    if (!transport || !cls) return 0;
    const spec = PRICE_MATRIX[transport];
    if (!spec) return 0;
    return spec.classes[cls] || 0;
  }

  function updatePrice() {
    const price = getPrice();
    priceDisplay.textContent = price ? new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:0}).format(price) : 'KES 0';
  }

  // initial populate
  populateOptions(transportEl.value);

  transportEl.addEventListener('change', () => populateOptions(transportEl.value));
  classEl.addEventListener('change', updatePrice);
  providerEl.addEventListener('change', updatePrice);
  estimateBtn.addEventListener('click', updatePrice);

  // reset form
  document.getElementById('resetBtn').addEventListener('click', () => {
    bookingForm.reset();
    populateOptions(transportEl.value);
    updatePrice();
    ticketContainer.innerHTML = ''; // clear preview
  });

  // On submit -> validate, create ticketData, render ticket (simulate booking)
  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // simple validation
    const passengerName = document.getElementById('passengerName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const transport = transportEl.value;
    const provider = providerEl.value;
    const travelClass = classEl.value;
    const origin = document.getElementById('origin').value || 'Nairobi';
    const destination = document.getElementById('destination').value || 'TBA';
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!passengerName || !phone || !email || !startDate) {
      alert('Please fill required fields (name, phone, email, depart date).');
      return;
    }
    // create booking id
    const now = new Date();
    const bookingId = `HT-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${now.getTime().toString().slice(-6)}`;

    const price = getPrice();
    const taxes = Math.round(price * 0.05); // example tax 5%
    const total = price + taxes;

    // build ticket payload
    const ticketData = {
      bookingId,
      passengerName,
      contactPhone: phone,
      contactEmail: email,
      transportType: transport,
      provider,
      classOrSeat: travelClass,
      route: { origin, destination },
      departDateTime: new Date(startDate).toISOString(),
      arriveDateTime: endDate ? new Date(endDate).toISOString() : '',
      duration: '',
      distanceKm: undefined,
      price,
      taxes,
      total,
      additionalNotes: `Auto-generated ticket. Please arrive on time.`,
      mapLink: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`,
      qrPayload: `https://harmonytravels.example/verify/${bookingId}`,
      logoUrl: ''
    };

    // render the ticket
    TicketRenderer.init('#ticketContainer', ticketData);

    // scroll to ticket preview
    document.getElementById('ticketContainer').scrollIntoView({ behavior:'smooth', block:'center' });

    // Hook action buttons to TicketRenderer
    document.getElementById('downloadPdfBtn').onclick = () => TicketRenderer.downloadPDF();
    document.getElementById('downloadPngBtn').onclick = () => TicketRenderer.downloadPNG();
    document.getElementById('printBtn').onclick = () => TicketRenderer.printTicket();
    document.getElementById('copyBookingBtn').onclick = () => TicketRenderer.copyBookingId();

    // show confirmation toast
    const t = document.getElementById('toast');
    t.textContent = `Booking ${bookingId} created — ticket ready`; t.classList.add('show');
    setTimeout(()=> t.classList.remove('show'), 1800);

    // Optionally simulate saving to server: here we just keep in sessionStorage for demo
    try { sessionStorage.setItem(`booking_${bookingId}`, JSON.stringify(ticketData)); } catch(e){}

  });

});