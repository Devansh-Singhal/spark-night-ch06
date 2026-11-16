import { estimateSavings } from "./model.js";
import { simulatorUrl } from "./simulator.js";

for (const link of document.querySelectorAll("[data-simulator]")) {
  if (simulatorUrl) link.href = simulatorUrl;
}
document.querySelector("[data-launch-note]").hidden = Boolean(simulatorUrl);

const arcs = [[46, 114], [172, 240], [302, 370], [426, 494]];
const traces = {
  missing: {
    events: [arcs[0], arcs[1], arcs[3]],
    mark: 295,
    result: "Hold part 0184",
    reason: "3 of 4 arcs observed at cycle close",
    description: "Four arc events expected, three observed. The third expected arc is absent in this teaching trace.",
  },
  normal: {
    events: arcs,
    result: "Arc checks passed",
    reason: "4 of 4 arcs with expected durations",
    description: "All four expected arc events are observed at their expected durations in this teaching trace.",
  },
  short: {
    events: [arcs[0], arcs[1], [302, 326], arcs[3]],
    mark: 295,
    result: "Hold part 0184",
    reason: "4 arcs observed. Arc 03 ended early.",
    description: "All four arcs are observed. The third stops before the end of its expected window in this teaching trace.",
  },
};

const traceButtons = document.querySelectorAll("[data-trace]");
for (const button of traceButtons) {
  button.addEventListener("click", () => {
    const trace = traces[button.dataset.trace];
    const normal = button.dataset.trace === "normal";
    for (const option of traceButtons) option.setAttribute("aria-pressed", String(option === button));
    const segments = trace.events.map(([start, end]) => `H${start}V53H${end}V149`);
    document.getElementById("observed-line").setAttribute("d", `M17 149${segments.join("")}H543`);
    const marker = document.getElementById("trace-mark");
    marker.style.display = normal ? "none" : "";
    if (!normal) marker.setAttribute("x", trace.mark);
    document.getElementById("trace-description").textContent = trace.description;
    document.getElementById("station-result").dataset.normal = String(normal);
    document.getElementById("trace-result").textContent = trace.result;
    document.getElementById("trace-reason").textContent = trace.reason;
  });
}

const form = document.getElementById("calculator");
const inputs = [...form.querySelectorAll("input")];
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 8 });

function updateEstimate() {
  for (const input of inputs) input.setAttribute("aria-invalid", String(!input.validity.valid));
  const valid = inputs.every((input) => input.validity.valid);
  document.getElementById("input-message").hidden = valid;
  const savings = document.getElementById("savings");
  const formula = document.getElementById("formula");
  const sensitivity = document.getElementById("sensitivity");
  const basis = document.getElementById("sensitivity-basis");
  if (!valid) {
    savings.value = "—";
    formula.textContent = "Recheck the highlighted assumption.";
    sensitivity.textContent = "";
    basis.textContent = "";
    return;
  }
  const assumptions = Object.fromEntries(inputs.map((input) => [input.name, input.valueAsNumber]));
  const { volume, rate, cost, share } = assumptions;
  const { annual, low, high, lowShare, highShare } = estimateSavings(assumptions);
  savings.value = money.format(annual);
  formula.textContent = `${number.format(volume)} × ${number.format(rate)}% × ₹${number.format(cost)} × ${number.format(share)}%`;
  sensitivity.textContent = `${money.format(low)}–${money.format(high)}`;
  basis.textContent = ` at ${number.format(lowShare)}%–${number.format(highShare)}% avoided share`;
}

form.addEventListener("input", updateEstimate);
form.addEventListener("reset", () => requestAnimationFrame(updateEstimate));
form.addEventListener("submit", (event) => event.preventDefault());
updateEstimate();
