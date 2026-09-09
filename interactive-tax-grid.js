const W = 240;
const H = 240;
const margin = { left: 34, right: 18, top: 24, bottom: 34 };
const x0 = margin.left;
const x1 = W - margin.right;
const y0 = H - margin.bottom;
const y1 = margin.top;
const TAX = 18;

function x(q) {
  return x0 + q * (x1 - x0) / 100;
}

function y(p) {
  return y0 - p * (y0 - y1) / 100;
}

function points(values) {
  return values.map((pt) => pt.join(",")).join(" ");
}

function path(values) {
  return `M ${values.map((pt) => pt.join(" ")).join(" L ")}`;
}

function demandP(type, q) {
  if (type === "downward") return 92 - 0.72 * q;
  if (type === "elastic") return 58;
  return null;
}

function supplyP(type, q) {
  if (type === "upward") return 16 + 0.72 * q;
  if (type === "elastic") return 42;
  return null;
}

function supplyTaxP(type, q, tax) {
  const base = supplyP(type, q);
  return base === null ? null : base + tax;
}

function equilibrium(demand, supply) {
  if (demand === "downward" && supply === "upward") return { q: 52.78, p: 54 };
  if (demand === "inelastic" && supply === "upward") return { q: 52, p: supplyP(supply, 52) };
  if (demand === "inelastic" && supply === "elastic") return { q: 52, p: 42 };
  if (demand === "downward" && supply === "inelastic") return { q: 58, p: demandP(demand, 58) };
  if (demand === "downward" && supply === "elastic") return { q: (92 - 42) / 0.72, p: 42 };
  if (demand === "elastic" && supply === "inelastic") return { q: 58, p: 58 };
  if (demand === "elastic" && supply === "upward") return { q: (58 - 16) / 0.72, p: 58 };
  return { q: 50, p: 50 };
}

function baseCS(demand, eq) {
  if (demand === "downward") {
    return [[x(0), y(demandP(demand, 0))], [x(eq.q), y(eq.p)], [x(0), y(eq.p)]];
  }
  if (demand === "inelastic") {
    return [[x(0), y(98)], [x(eq.q), y(98)], [x(eq.q), y(eq.p)], [x(0), y(eq.p)]];
  }
  return null;
}

function basePS(supply, eq) {
  if (supply === "upward") {
    return [[x(0), y(eq.p)], [x(eq.q), y(eq.p)], [x(0), y(supplyP(supply, 0))]];
  }
  if (supply === "inelastic") {
    return [[x(0), y(eq.p)], [x(eq.q), y(eq.p)], [x(eq.q), y(2)], [x(0), y(2)]];
  }
  return null;
}

function taxOutcome(demand, supply, oldEq) {
  if (demand === "inelastic" && supply === "upward") {
    return {
      q: oldEq.q,
      oldQ: oldEq.q,
      consumerPrice: oldEq.p + TAX,
      producerPrice: oldEq.p,
      zeroDwl: true
    };
  }

  if (demand === "elastic" && supply === "upward") {
    const consumerPrice = demandP("elastic", 0);
    const producerPrice = consumerPrice - TAX;
    return {
      q: (producerPrice - 16) / 0.72,
      oldQ: oldEq.q,
      consumerPrice,
      producerPrice,
      zeroDwl: false
    };
  }

  return null;
}

function taxCS(demand, taxEq) {
  if (demand === "inelastic") {
    return [[x(0), y(98)], [x(taxEq.q), y(98)], [x(taxEq.q), y(taxEq.consumerPrice)], [x(0), y(taxEq.consumerPrice)]];
  }
  return null;
}

function taxPS(taxEq) {
  return [[x(0), y(taxEq.producerPrice)], [x(taxEq.q), y(taxEq.producerPrice)], [x(0), y(supplyP("upward", 0))]];
}

function revenue(taxEq) {
  return [[x(0), y(taxEq.consumerPrice)], [x(taxEq.q), y(taxEq.consumerPrice)], [x(taxEq.q), y(taxEq.producerPrice)], [x(0), y(taxEq.producerPrice)]];
}

function dwl(taxEq) {
  if (taxEq.zeroDwl) return null;
  return [[x(taxEq.q), y(taxEq.consumerPrice)], [x(taxEq.oldQ), y(taxEq.consumerPrice)], [x(taxEq.q), y(taxEq.producerPrice)]];
}

function demandPath(type) {
  if (type === "downward") return path([[x(0), y(demandP(type, 0))], [x(100), y(demandP(type, 100))]]);
  if (type === "elastic") return path([[x(0), y(58)], [x(100), y(58)]]);
  return path([[x(52), y(98)], [x(52), y(2)]]);
}

function supplyPath(type) {
  if (type === "upward") return path([[x(0), y(supplyP(type, 0))], [x(100), y(supplyP(type, 100))]]);
  if (type === "elastic") return path([[x(0), y(42)], [x(100), y(42)]]);
  return path([[x(58), y(98)], [x(58), y(2)]]);
}

function taxSupplyPath() {
  const qMax = Math.min(100, (98 - TAX - 16) / 0.72);
  return path([[x(0), y(supplyTaxP("upward", 0, TAX))], [x(qMax), y(supplyTaxP("upward", qMax, TAX))]]);
}

function labelPositions(demand, supply) {
  const d = demand === "downward" ? [x(84), y(demandP(demand, 84)) - 7] :
    demand === "elastic" ? [x(88), y(58) - 8] : [x(52) + 6, y(91)];
  const s = supply === "upward" ? [x(84), y(supplyP(supply, 84)) - 8] :
    supply === "elastic" ? [x(86), y(42) - 8] : [x(58) + 6, y(91)];
  return { d, s };
}

function polygonMarkup(poly, className) {
  return poly ? `<polygon points="${points(poly)}" class="${className}"></polygon>` : "";
}

function chartMarkup(demand, supply, mode) {
  const eq = equilibrium(demand, supply);
  const labels = labelPositions(demand, supply);
  const isTax = mode === "tax";
  const taxEq = isTax ? taxOutcome(demand, supply, eq) : null;
  const qShown = taxEq ? taxEq.q : eq.q;
  const pConsumer = taxEq ? taxEq.consumerPrice : eq.p;
  const pProducer = taxEq ? taxEq.producerPrice : eq.p;
  const cs = taxEq ? taxCS(demand, taxEq) : baseCS(demand, eq);
  const ps = taxEq ? taxPS(taxEq) : basePS(supply, eq);
  const gov = taxEq ? revenue(taxEq) : null;
  const loss = taxEq ? dwl(taxEq) : null;
  const taxNoteX = taxEq && taxEq.zeroDwl ? x(qShown) + 16 : x((taxEq?.q ?? 0) + ((taxEq?.oldQ ?? 0) - (taxEq?.q ?? 0)) * 0.58);
  const taxNoteY = taxEq && taxEq.zeroDwl ? y((pConsumer + pProducer) / 2) + 4 : y(pConsumer) + 18;

  return `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${isTax ? "Tax case" : "Base case"}">
      <rect width="${W}" height="${H}" fill="transparent"></rect>
      <line class="axis" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}"></line>
      <line class="axis" x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}"></line>
      <text class="axis-title" x="${x1 - 6}" y="${H - 13}">Q</text>
      <text class="axis-title" x="13" y="${y1 + 7}">P</text>
      ${polygonMarkup(cs, "surplus-cs")}
      ${polygonMarkup(ps, "surplus-ps")}
      ${polygonMarkup(gov, "revenue")}
      ${polygonMarkup(loss, "dwl")}
      <path class="demand-line" d="${demandPath(demand)}"></path>
      <path class="supply-line" d="${supplyPath(supply)}"></path>
      ${isTax ? `<path class="supply-line tax-shift" d="${taxSupplyPath()}"></path>` : ""}
      <line class="guide" x1="${x(qShown)}" y1="${y(pConsumer)}" x2="${x(qShown)}" y2="${y0}"></line>
      <line class="guide" x1="${x0}" y1="${y(pConsumer)}" x2="${x(qShown)}" y2="${y(pConsumer)}"></line>
      ${isTax ? `<line class="guide" x1="${x0}" y1="${y(pProducer)}" x2="${x(qShown)}" y2="${y(pProducer)}"></line>` : ""}
      <circle class="point" cx="${x(qShown)}" cy="${y(pConsumer)}" r="3.8"></circle>
      ${isTax ? `<circle class="open-point" cx="${x(qShown)}" cy="${y(pProducer)}" r="3"></circle>` : ""}
      <text class="point-label" x="${x(qShown) + 6}" y="${y(pConsumer) - 6}">E</text>
      <text class="curve-label d-label" x="${labels.d[0]}" y="${labels.d[1]}">D</text>
      <text class="curve-label s-label" x="${labels.s[0]}" y="${labels.s[1]}">S</text>
      ${isTax ? `<text class="curve-label s-label" x="${x(68)}" y="${y(supplyTaxP("upward", 68, TAX)) - 8}">S+t</text>
      <text class="tax-note" x="${x0 + 4}" y="${y(pConsumer) - 6}">Pc</text>
      <text class="tax-note" x="${x0 + 4}" y="${y(pProducer) + 13}">Ps</text>
      ${taxEq.zeroDwl ? `<line x1="${x(qShown) + 9}" y1="${y(pConsumer)}" x2="${x(qShown) + 9}" y2="${y(pProducer)}" stroke="var(--dwl)" stroke-width="4" stroke-linecap="round"></line>` : ""}
      <text class="tax-note" x="${taxNoteX}" y="${taxNoteY}">${taxEq.zeroDwl ? "DWL = 0" : "DWL"}</text>` : ""}
    </svg>
  `;
}

function render() {
  document.querySelectorAll(".chart").forEach((cell) => {
    cell.innerHTML = chartMarkup(cell.dataset.demand, cell.dataset.supply, "base");
  });

  document.querySelectorAll(".flip-card").forEach((card) => {
    const front = card.querySelector(".front");
    const back = card.querySelector(".back");
    front.innerHTML = chartMarkup(card.dataset.demand, card.dataset.supply, "base");
    back.innerHTML = chartMarkup(card.dataset.demand, card.dataset.supply, "tax");
    card.addEventListener("click", () => {
      const active = !card.classList.contains("is-flipped");
      card.classList.toggle("is-flipped", active);
      card.setAttribute("aria-pressed", String(active));
    });
  });
}

render();
