const controls = {
  demandSlope: document.getElementById("demandSlope"),
  supplySlope: document.getElementById("supplySlope"),
  policyPrice: document.getElementById("policyPrice"),
  policyType: document.querySelectorAll('input[name="policyType"]'),
  shadeAreas: document.querySelectorAll('input[name="shadeArea"]'),
};

const labels = {
  demandSlope: document.getElementById("demandSlopeValue"),
  supplySlope: document.getElementById("supplySlopeValue"),
  policyPrice: document.getElementById("policyPriceValue"),
  policyLabel: document.getElementById("policyLabel"),
  scenarioTitle: document.getElementById("scenarioTitle"),
  scenarioNote: document.getElementById("scenarioNote"),
  csValue: document.getElementById("csValue"),
  psValue: document.getElementById("psValue"),
  grValue: document.getElementById("grValue"),
  geValue: document.getElementById("geValue"),
  dwlValue: document.getElementById("dwlValue"),
};

const svg = document.getElementById("marketGraph");
const DEMAND_INTERCEPT = 48;
const SUPPLY_INTERCEPT = 0;
const CHART_DOMAIN = {
  qMax: 12,
  pMax: 60,
  qStep: 2,
  pStep: 10,
};

const colors = {
  cs: "csFill",
  ps: "psFill",
  gr: "grFill",
  ge: "geFill",
  dwl: "dwlFill",
};

const policySettings = {
  ceiling: {
    title: "Precio máximo",
    label: "Precio máximo",
    min: 10,
    max: 50,
    step: 1,
    defaultValue: 20,
  },
  floor: {
    title: "Precio mínimo",
    label: "Precio mínimo",
    min: 10,
    max: 50,
    step: 1,
    defaultValue: 28,
  },
  tax: {
    title: "Impuesto",
    label: "Impuesto por unidad",
    min: 0,
    max: 24,
    step: 2,
    defaultValue: 4,
  },
  subsidy: {
    title: "Subsidio",
    label: "Subsidio por unidad",
    min: 0,
    max: 24,
    step: 2,
    defaultValue: 4,
  },
};

function numberFormat(value) {
  const rounded = Math.round(Number(value) * 100) / 100;
  if (Number.isInteger(rounded)) return rounded.toString();
  return rounded.toFixed(2).replace(/0$/, "");
}

function tickFormat(value) {
  if (Math.abs(value) >= 100) return Math.round(value).toString();
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function valueFormat(value) {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.abs(value) < 0.005 ? 0 : value;
  return Number.isInteger(Math.round(rounded * 100) / 100)
    ? Math.round(rounded).toString()
    : rounded.toFixed(2);
}

function niceStep(maxValue, targetTicks = 5) {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 1;
  const roughStep = maxValue / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function niceAxis(maxValue, targetTicks = 5) {
  const step = niceStep(maxValue, targetTicks);
  const max = step * Math.ceil(maxValue / step);
  return { max, step };
}

function getPolicyType() {
  return [...controls.policyType].find((input) => input.checked).value;
}

function getVisibleAreas() {
  return Object.fromEntries(
    [...controls.shadeAreas].map((input) => [input.value, input.checked]),
  );
}

function demandPrice(q, b) {
  return DEMAND_INTERCEPT + b * q;
}

function supplyPrice(q, d) {
  return SUPPLY_INTERCEPT + d * q;
}

function quantityDemanded(price, b) {
  if (b === 0) return price <= DEMAND_INTERCEPT ? Number.POSITIVE_INFINITY : 0;
  return Math.max(0, (price - DEMAND_INTERCEPT) / b);
}

function quantitySupplied(price, d) {
  if (price < SUPPLY_INTERCEPT) return 0;
  if (d === 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, (price - SUPPLY_INTERCEPT) / d);
}

function getState() {
  const b = Number(controls.demandSlope.value);
  const d = Number(controls.supplySlope.value);
  const policyValue = Number(controls.policyPrice.value);
  const policyType = getPolicyType();
  const hasFiniteEquilibrium = d - b > 0;
  const interceptGap = DEMAND_INTERCEPT - SUPPLY_INTERCEPT;
  const qe = hasFiniteEquilibrium ? interceptGap / (d - b) : null;
  const pe = hasFiniteEquilibrium ? supplyPrice(qe, d) : null;
  const isCeiling = policyType === "ceiling";
  const isFloor = policyType === "floor";
  const isTax = policyType === "tax";
  const isSubsidy = policyType === "subsidy";
  const denominator = d - b;
  let buyerPrice = pe;
  let sellerPrice = pe;
  let tradedQ = qe;
  let binding = false;

  if (hasFiniteEquilibrium && isCeiling) {
    binding = policyValue < pe;
    tradedQ = binding ? quantitySupplied(policyValue, d) : qe;
    buyerPrice = binding ? policyValue : pe;
    sellerPrice = buyerPrice;
  }

  if (hasFiniteEquilibrium && isFloor) {
    binding = policyValue > pe;
    tradedQ = binding ? quantityDemanded(policyValue, b) : qe;
    buyerPrice = binding ? policyValue : pe;
    sellerPrice = buyerPrice;
  }

  if (hasFiniteEquilibrium && isTax) {
    binding = policyValue > 0;
    tradedQ = Math.max(0, (interceptGap - policyValue) / denominator);
    buyerPrice = demandPrice(tradedQ, b);
    sellerPrice = supplyPrice(tradedQ, d);
  }

  if (hasFiniteEquilibrium && isSubsidy) {
    binding = policyValue > 0;
    tradedQ = Math.max(0, (interceptGap + policyValue) / denominator);
    buyerPrice = demandPrice(tradedQ, b);
    sellerPrice = supplyPrice(tradedQ, d);
  }

  tradedQ = Number.isFinite(tradedQ) ? Math.max(0, tradedQ) : 0;

  return {
    b,
    d,
    policyValue,
    policyType,
    hasFiniteEquilibrium,
    qe,
    pe,
    binding,
    tradedQ,
    buyerPrice,
    sellerPrice,
  };
}

function pathFromPoints(points, xScale, yScale) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.q)} ${yScale(point.p)}`)
    .join(" ");
}

function polygon(points, xScale, yScale, className) {
  if (points.length < 3) return "";
  return `<polygon class="${className}" points="${points
    .map((point) => `${xScale(point.q)},${yScale(point.p)}`)
    .join(" ")}"></polygon>`;
}

function line(x1, y1, x2, y2, className) {
  return `<line class="${className}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`;
}

function text(x, y, content, className, extra = "") {
  return `<text class="${className}" x="${x}" y="${y}" ${extra}>${content}</text>`;
}

function getChartDomain(state) {
  return CHART_DOMAIN;
}

function calculateAreaValues(state) {
  if (!state.hasFiniteEquilibrium) {
    return { cs: null, ps: null, gr: null, ge: null, dwl: null };
  }

  const eqQ = state.qe || 0;
  const eqP = state.pe || 0;
  const qSurplus = state.binding ? state.tradedQ : eqQ;
  const buyerPrice = state.binding ? state.buyerPrice : eqP;
  const sellerPrice = state.binding ? state.sellerPrice : eqP;
  const demandAtTrade = demandPrice(qSurplus, state.b);
  const supplyAtTrade = supplyPrice(qSurplus, state.d);
  const cs = Math.max(0, ((DEMAND_INTERCEPT - buyerPrice) + (demandAtTrade - buyerPrice)) * qSurplus * 0.5);
  const ps = Math.max(0, ((sellerPrice - SUPPLY_INTERCEPT) + (sellerPrice - supplyAtTrade)) * qSurplus * 0.5);
  const isTax = state.policyType === "tax";
  const isSubsidy = state.policyType === "subsidy";
  const gr = state.binding && isTax ? Math.max(0, (buyerPrice - sellerPrice) * qSurplus) : null;
  const ge = state.binding && isSubsidy ? Math.max(0, (sellerPrice - buyerPrice) * qSurplus) : null;
  let dwl = null;

  if (state.binding && qSurplus < eqQ) {
    dwl = Math.max(0, (demandPrice(qSurplus, state.b) - supplyPrice(qSurplus, state.d)) * (eqQ - qSurplus) * 0.5);
  }
  if (state.binding && isSubsidy && qSurplus > eqQ) {
    dwl = Math.max(0, (supplyPrice(qSurplus, state.d) - demandPrice(qSurplus, state.b)) * (qSurplus - eqQ) * 0.5);
  }

  return { cs, ps, gr, ge, dwl };
}

function draw() {
  const state = getState();
  const settings = policySettings[state.policyType];
  const visibleAreas = getVisibleAreas();
  labels.demandSlope.value = numberFormat(state.b);
  labels.supplySlope.value = numberFormat(state.d);
  labels.policyPrice.value = numberFormat(state.policyValue);
  labels.policyLabel.textContent = settings.label;
  labels.scenarioTitle.textContent = settings.title;
  labels.scenarioNote.textContent = state.binding
    ? state.policyType === "subsidy"
      ? "El subsidio aumenta la cantidad transada y genera una pérdida de eficiencia social."
      : "La política reduce la cantidad transada y genera una pérdida de eficiencia social."
    : "La política no cambia el resultado actual del mercado.";
  const areaValues = calculateAreaValues(state);
  labels.csValue.value = valueFormat(areaValues.cs);
  labels.psValue.value = valueFormat(areaValues.ps);
  labels.grValue.value = valueFormat(areaValues.gr);
  labels.geValue.value = valueFormat(areaValues.ge);
  labels.dwlValue.value = valueFormat(areaValues.dwl);

  const bounds = svg.getBoundingClientRect();
  const width = Math.max(360, bounds.width || 800);
  const height = Math.max(360, bounds.height || 520);
  const margin = { top: 28, right: 34, bottom: 54, left: 66 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const { qMax, pMax, qStep, pStep } = getChartDomain(state);
  const xScale = (q) => margin.left + (q / qMax) * innerWidth;
  const yScale = (p) => margin.top + innerHeight - (Math.max(0, p) / pMax) * innerHeight;
  const demandEndQ = state.b < 0 ? Math.min(qMax, DEMAND_INTERCEPT / Math.abs(state.b)) : qMax;
  const demandEndP = demandPrice(demandEndQ, state.b);
  const supplyEndP = supplyPrice(qMax, state.d);
  const eqQ = state.qe || 0;
  const eqP = state.pe || 0;
  const tradedQ = Math.min(state.tradedQ, qMax);
  const buyerPrice = state.buyerPrice || eqP;
  const sellerPrice = state.sellerPrice || eqP;
  const isTax = state.policyType === "tax";
  const isSubsidy = state.policyType === "subsidy";
  const isPriceControl = state.policyType === "ceiling" || state.policyType === "floor";

  const layers = [];

  if (state.hasFiniteEquilibrium) {
    const qSurplus = state.binding ? tradedQ : eqQ;
    const demandAtTrade = demandPrice(qSurplus, state.b);
    const supplyAtTrade = supplyPrice(qSurplus, state.d);
    const csBottom = state.binding ? buyerPrice : eqP;
    const psTop = state.binding ? sellerPrice : eqP;

    if (visibleAreas.cs) {
      layers.push(
        polygon(
          [
            { q: 0, p: DEMAND_INTERCEPT },
            { q: qSurplus, p: demandAtTrade },
            { q: qSurplus, p: csBottom },
            { q: 0, p: csBottom },
          ],
          xScale,
          yScale,
          colors.cs,
        ),
      );
    }

    if (visibleAreas.ps) {
      layers.push(
        polygon(
          [
            { q: 0, p: psTop },
            { q: qSurplus, p: psTop },
            { q: qSurplus, p: supplyAtTrade },
            { q: 0, p: SUPPLY_INTERCEPT },
          ],
          xScale,
          yScale,
          colors.ps,
        ),
      );
    }

    if (visibleAreas.dwl && state.binding && tradedQ < eqQ) {
      layers.push(
        polygon(
          [
            { q: tradedQ, p: demandPrice(tradedQ, state.b) },
            { q: eqQ, p: eqP },
            { q: tradedQ, p: supplyPrice(tradedQ, state.d) },
          ],
          xScale,
          yScale,
          colors.dwl,
        ),
      );
    }

    if (visibleAreas.gr && state.binding && isTax) {
      layers.push(
        polygon(
          [
            { q: 0, p: buyerPrice },
            { q: qSurplus, p: buyerPrice },
            { q: qSurplus, p: sellerPrice },
            { q: 0, p: sellerPrice },
          ],
          xScale,
          yScale,
          colors.gr,
        ),
      );
    }

    if (visibleAreas.ge && state.binding && isSubsidy) {
      layers.push(
        polygon(
          [
            { q: 0, p: sellerPrice },
            { q: qSurplus, p: sellerPrice },
            { q: qSurplus, p: buyerPrice },
            { q: 0, p: buyerPrice },
          ],
          xScale,
          yScale,
          colors.ge,
        ),
      );
    }

    if (visibleAreas.dwl && state.binding && isSubsidy && tradedQ > eqQ) {
      layers.push(
        polygon(
          [
            { q: eqQ, p: eqP },
            { q: tradedQ, p: demandPrice(tradedQ, state.b) },
            { q: tradedQ, p: supplyPrice(tradedQ, state.d) },
          ],
          xScale,
          yScale,
          colors.dwl,
        ),
      );
    }
  }

  const grid = [];
  const ticks = [];
  for (let i = 1; i <= 4; i += 1) {
    const gx = margin.left + (innerWidth * i) / 5;
    const gy = margin.top + (innerHeight * i) / 5;
    grid.push(line(gx, margin.top, gx, margin.top + innerHeight, "grid"));
    grid.push(line(margin.left, gy, margin.left + innerWidth, gy, "grid"));
  }
  for (let qTick = 0; qTick <= qMax + qStep / 2; qTick += qStep) {
    const x = xScale(qTick);
    ticks.push(line(x, margin.top + innerHeight, x, margin.top + innerHeight + 6, "tick"));
    ticks.push(text(x, margin.top + innerHeight + 24, tickFormat(qTick), "tickLabel", 'text-anchor="middle"'));
  }
  for (let pTick = 0; pTick <= pMax + pStep / 2; pTick += pStep) {
    const y = yScale(pTick);
    ticks.push(line(margin.left - 6, y, margin.left, y, "tick"));
    ticks.push(text(margin.left - 12, y + 4, tickFormat(pTick), "tickLabel", 'text-anchor="end"'));
  }

  const demandPath = pathFromPoints(
    [
      { q: 0, p: DEMAND_INTERCEPT },
      { q: demandEndQ, p: demandEndP },
    ],
    xScale,
    yScale,
  );
  const supplyPath = pathFromPoints(
    [
      { q: 0, p: SUPPLY_INTERCEPT },
      { q: qMax, p: supplyEndP },
    ],
    xScale,
    yScale,
  );

  const guides = [];
  if (state.hasFiniteEquilibrium) {
    guides.push(line(xScale(eqQ), yScale(eqP), xScale(eqQ), yScale(0), "guide"));
    guides.push(line(xScale(0), yScale(eqP), xScale(eqQ), yScale(eqP), "guide"));
    guides.push(`<circle class="point" cx="${xScale(eqQ)}" cy="${yScale(eqP)}" r="4"></circle>`);
    guides.push(text(xScale(eqQ) + 8, yScale(eqP) - 8, "E", "label"));
  }
  if (state.binding) {
    guides.push(line(xScale(tradedQ), yScale(Math.max(buyerPrice, sellerPrice)), xScale(tradedQ), yScale(0), "guide"));
  }

  const policyLineMarkup = [];
  if (isPriceControl) {
    policyLineMarkup.push(line(margin.left, yScale(state.policyValue), margin.left + innerWidth, yScale(state.policyValue), "policyLine"));
  }
  if (state.binding && (isTax || isSubsidy)) {
    policyLineMarkup.push(line(margin.left, yScale(buyerPrice), xScale(tradedQ), yScale(buyerPrice), "policyLine"));
    policyLineMarkup.push(line(margin.left, yScale(sellerPrice), xScale(tradedQ), yScale(sellerPrice), "policyLineSecondary"));
  }

  const policyLabelP = isPriceControl ? state.policyValue : Math.max(buyerPrice, sellerPrice);
  const policyTextAnchor = policyLabelP > pMax * 0.86 ? "end" : "start";
  const policyTextX = policyTextAnchor === "end" ? margin.left + innerWidth - 8 : margin.left + 8;
  const policyLabel = {
    ceiling: "precio máximo",
    floor: "precio mínimo",
    tax: "impuesto",
    subsidy: "subsidio",
  }[state.policyType];

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
    <g>
      ${grid.join("")}
      ${layers.join("")}
      ${line(margin.left, margin.top, margin.left, margin.top + innerHeight, "axis")}
      ${line(margin.left, margin.top + innerHeight, margin.left + innerWidth, margin.top + innerHeight, "axis")}
      ${ticks.join("")}
      <path class="curveDemand" d="${demandPath}"></path>
      <path class="curveSupply" d="${supplyPath}"></path>
      ${policyLineMarkup.join("")}
      ${guides.join("")}
      ${text(margin.left + innerWidth + 12, margin.top + innerHeight + 4, "Q", "axisLabel")}
      ${text(margin.left - 10, margin.top - 12, "P", "axisLabel", 'text-anchor="end"')}
      ${text(xScale(demandEndQ) - 10, yScale(demandEndP) - 10, "D", "label", 'text-anchor="end"')}
      ${text(xScale(qMax) - 10, yScale(supplyEndP) - 10, "S", "label", 'text-anchor="end"')}
      ${text(policyTextX, yScale(policyLabelP) - 9, policyLabel, "softLabel", `text-anchor="${policyTextAnchor}"`)}
    </g>
  `;
}

function addListeners() {
  [controls.demandSlope, controls.supplySlope, controls.policyPrice].forEach((control) => {
    control.addEventListener("input", draw);
  });
  controls.shadeAreas.forEach((control) => {
    control.addEventListener("change", draw);
  });
  controls.policyType.forEach((control) => {
    control.addEventListener("change", () => {
      const settings = policySettings[getPolicyType()];
      controls.policyPrice.min = settings.min;
      controls.policyPrice.max = settings.max;
      controls.policyPrice.step = settings.step;
      controls.policyPrice.value = settings.defaultValue;
      draw();
    });
  });
}

addListeners();
draw();

new ResizeObserver(draw).observe(svg);
