(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const fields = {
    price: $("property-price"),
    priceRange: $("price-range"),
    apr: $("apr"),
    aprRange: $("apr-range"),
    down: $("down-payment"),
    downRange: $("down-range"),
    years: $("years"),
    yearsRange: $("years-range")
  };

  const euro = new Intl.NumberFormat("bg-BG", {
    style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0
  });
  const euroExact = new Intl.NumberFormat("bg-BG", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const number = new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 1 });
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function parseField(input, fallback, min, max) {
    const raw = String(input.value).trim().replace(",", ".");
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) return fallback;
    return clamp(value, min, max);
  }

  function paymentFor(principal, annualRate, months) {
    if (principal <= 0 || months <= 0) return 0;
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return principal / months;
    const factor = Math.pow(1 + monthlyRate, months);
    return principal * (monthlyRate * factor) / (factor - 1);
  }

  function setRangeProgress(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;
    input.style.setProperty("--range-progress", `${progress}%`);
  }

  function syncRange(range, field, digits = 0) {
    range.value = String(clamp(Number(field.value), Number(range.min), Number(range.max)));
    setRangeProgress(range);
    if (digits > 0) field.value = Number(field.value).toFixed(digits);
  }

  function readInputs() {
    const price = parseField(fields.price, 250000, 1000, 100000000);
    const apr = parseField(fields.apr, 2.8, 0, 30);
    const downPct = parseField(fields.down, 20, 0, 99);
    const years = Math.round(parseField(fields.years, 30, 1, 40));
    fields.price.value = String(price);
    fields.apr.value = String(apr);
    fields.down.value = String(downPct);
    fields.years.value = String(years);
    syncRange(fields.priceRange, fields.price);
    syncRange(fields.aprRange, fields.apr);
    syncRange(fields.downRange, fields.down);
    syncRange(fields.yearsRange, fields.years);

    const downPayment = price * downPct / 100;
    const loan = price - downPayment;
    const months = years * 12;
    const monthly = paymentFor(loan, apr, months);
    const totalPaid = monthly * months;
    const totalInterest = Math.max(0, totalPaid - loan);
    return { price, apr, downPct, years, downPayment, loan, months, monthly, totalPaid, totalInterest };
  }

  function render() {
    const d = readInputs();
    $("monthly-payment").innerHTML = `${euro.format(d.monthly).replace(" ", " ")}<span class="amount-decimal">${decimalPart(d.monthly)}</span>`;
    $("down-payment-amount").textContent = euro.format(d.downPayment);
    $("down-payment-percent").textContent = `${number.format(d.downPct)}% от цената`;
    $("loan-amount").textContent = euro.format(d.loan);
    $("total-interest").textContent = euro.format(d.totalInterest);
    $("total-paid").textContent = euro.format(d.totalPaid);
    $("summary-price").textContent = euro.format(d.price);
    $("equity-bar").style.width = `${d.downPct}%`;
    $("loan-bar").style.width = `${100 - d.downPct}%`;
    $("legend-equity").textContent = `${number.format(d.downPct)}%`;
    $("legend-loan").textContent = `${number.format(100 - d.downPct)}%`;
    $("breakdown-total").textContent = euro.format(d.totalPaid);
    $("breakdown-principal").textContent = euro.format(d.loan);
    $("breakdown-interest").textContent = euro.format(d.totalInterest);
    const principalShare = d.totalPaid > 0 ? d.loan / d.totalPaid * 100 : 0;
    $("principal-segment").style.width = `${principalShare}%`;
    $("interest-segment").style.width = `${100 - principalShare}%`;
    $("first-payment").textContent = euro.format(d.monthly);
    $("last-payment").textContent = euro.format(d.monthly);
    $("payment-count").textContent = `${d.months} месечни вноски общо`;
    $("year").textContent = new Date().getFullYear();
    return d;
  }

  function decimalPart(value) {
    const cents = Math.round((value + Number.EPSILON) * 100) % 100;
    return `,${String(cents).padStart(2, "0")}`;
  }

  // Text inputs update the result as the user types; sliders mirror their paired field.
  [fields.price, fields.apr, fields.down, fields.years].forEach((field) => {
    field.addEventListener("input", render);
    field.addEventListener("change", render);
  });
  [
    [fields.priceRange, fields.price],
    [fields.aprRange, fields.apr],
    [fields.downRange, fields.down],
    [fields.yearsRange, fields.years]
  ].forEach(([range, field]) => {
    range.addEventListener("input", () => {
      field.value = range.value;
      render();
    });
  });

  $("years-minus").addEventListener("click", () => {
    fields.years.value = String(clamp(Number(fields.years.value || 30) - 1, 1, 40));
    render();
  });
  $("years-plus").addEventListener("click", () => {
    fields.years.value = String(clamp(Number(fields.years.value || 30) + 1, 1, 40));
    render();
  });

  $("mortgage-form").addEventListener("submit", (event) => event.preventDefault());

  $("download-summary").addEventListener("click", () => {
    const d = render();
    const rows = [
      ["ИПОТЕЧЕН КАЛКУЛАТОР — ОБОБЩЕНИЕ", ""],
      ["Дата на изчисление", new Date().toLocaleDateString("bg-BG")],
      ["Цена на имота", euroExact.format(d.price)],
      ["Годишен процент (въведен)", `${number.format(d.apr)}%`],
      ["Самоучастие", `${number.format(d.downPct)}%`],
      ["Сума на самоучастието", euroExact.format(d.downPayment)],
      ["Размер на кредита", euroExact.format(d.loan)],
      ["Срок", `${d.years} години (${d.months} месеца)`],
      ["Ориентировъчна месечна вноска", euroExact.format(d.monthly)],
      ["Общо лихви за срока", euroExact.format(d.totalInterest)],
      ["Общо плащания към банката", euroExact.format(d.totalPaid)],
      ["", ""],
      ["Забележка", "Ориентировъчна симулация, не е оферта от банка. Не включва такси, застраховки и разходи по сделката."]
    ];
    const csv = "\uFEFF" + rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ipotechen-kredit-obobshtenie.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  render();
})();
