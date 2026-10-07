// name: [label, factor to the category's base unit]. Temperature is special-cased (base = kelvin).
const L = (o) => o;
export const CATS = {
  length: L({
    m: ['metre (m)', 1],
    km: ['kilometre (km)', 1e3],
    cm: ['centimetre (cm)', 1e-2],
    mm: ['millimetre (mm)', 1e-3],
    mi: ['mile (mi)', 1609.344],
    yd: ['yard (yd)', 0.9144],
    ft: ['foot (ft)', 0.3048],
    in: ['inch (in)', 0.0254],
    nmi: ['nautical mile', 1852],
  }),
  mass: L({
    kg: ['kilogram (kg)', 1],
    g: ['gram (g)', 1e-3],
    mg: ['milligram (mg)', 1e-6],
    t: ['tonne (t)', 1e3],
    lb: ['pound (lb)', 0.45359237],
    oz: ['ounce (oz)', 0.028349523125],
    st: ['stone (st)', 6.35029318],
  }),
  temperature: { c: ['celsius (°C)', [1, 273.15]], f: ['fahrenheit (°F)', [5 / 9, (459.67 * 5) / 9]], k: ['kelvin (K)', [1, 0]] }, // kelvin = x*a + b
  volume: L({
    l: ['litre (L)', 1],
    ml: ['millilitre (mL)', 1e-3],
    m3: ['cubic metre (m³)', 1e3],
    tsp: ['teaspoon (US)', 0.00492892159375],
    tbsp: ['tablespoon (US)', 0.01478676478125],
    floz: ['fluid ounce (US)', 0.0295735295625],
    cup: ['cup (US)', 0.2365882365],
    pt: ['pint (US)', 0.473176473],
    qt: ['quart (US)', 0.946352946],
    gal: ['gallon (US)', 3.785411784],
    ukgal: ['gallon (UK)', 4.54609],
  }),
  area: L({
    m2: ['square metre (m²)', 1],
    km2: ['square kilometre (km²)', 1e6],
    cm2: ['square centimetre (cm²)', 1e-4],
    ha: ['hectare (ha)', 1e4],
    ac: ['acre', 4046.8564224],
    ft2: ['square foot (ft²)', 0.09290304],
    in2: ['square inch (in²)', 0.00064516],
    mi2: ['square mile (mi²)', 2589988.110336],
  }),
  speed: L({
    ms: ['metre/second (m/s)', 1],
    kmh: ['kilometre/hour (km/h)', 1 / 3.6],
    mph: ['mile/hour (mph)', 0.44704],
    kn: ['knot (kn)', 1852 / 3600],
    fps: ['foot/second (ft/s)', 0.3048],
  }),
  data: L({
    B: ['byte (B)', 1],
    bit: ['bit', 0.125],
    kB: ['kilobyte (kB, 1000)', 1e3],
    MB: ['megabyte (MB)', 1e6],
    GB: ['gigabyte (GB)', 1e9],
    TB: ['terabyte (TB)', 1e12],
    PB: ['petabyte (PB)', 1e15],
    KiB: ['kibibyte (KiB, 1024)', 1024],
    MiB: ['mebibyte (MiB)', 1024 ** 2],
    GiB: ['gibibyte (GiB)', 1024 ** 3],
    TiB: ['tebibyte (TiB)', 1024 ** 4],
    PiB: ['pebibyte (PiB)', 1024 ** 5],
  }),
  time: L({
    s: ['second (s)', 1],
    ms: ['millisecond (ms)', 1e-3],
    min: ['minute (min)', 60],
    h: ['hour (h)', 3600],
    d: ['day (d)', 86400],
    wk: ['week (wk)', 604800],
    yr: ['year (365.25 d)', 31557600],
  }),
};

/** Convert a number between two units of one category. */
export function convert(cat, from, to, x) {
  const u = CATS[cat];
  if (cat === 'temperature') {
    const [a, b] = u[from][1],
      [c, d] = u[to][1];
    return (x * a + b - d) / c;
  }
  return (x * u[from][1]) / u[to][1];
}

/** Display a number: up to 10 significant digits, plain notation unless huge or tiny. */
export function show(n) {
  if (!Number.isFinite(n)) return '';
  const r = +n.toPrecision(10);
  return Math.abs(r) >= 1e15 || (r !== 0 && Math.abs(r) < 1e-6) ? r.toExponential() : String(r);
}

/** Parse user input: trims, drops spaces/underscores, "1,000.5" -> 1000.5, "2,5" -> 2.5. Returns null unless finite. */
export function parseNum(s) {
  let t = String(s).trim().replace(/[\s_]/g, '');
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) t = t.replace(/,/g, '');
  else if (/^-?\d{1,3}(,\d{3})+$/.test(t))
    t = t.replace(/,/g, ''); // "1,000" / "12,345,678" read as thousands
  else t = t.replace(',', '.');
  const n = Number(t);
  return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) && Number.isFinite(n) ? n : null;
}

const SYM = { floz: 'fl oz', gal: 'gal (US)', ukgal: 'gal (UK)', yr: 'yr', tsp: 'tsp', tbsp: 'tbsp', cup: 'cup', pt: 'pt', qt: 'qt' };
/** Short symbol for a unit, e.g. 'km', 'm/s', '°C'. */
export function sym(cat, u) {
  if (SYM[u]) return SYM[u];
  const m = /\(([^),]+)/.exec(CATS[cat][u][0]);
  return m && !/\s/.test(m[1]) ? m[1] : u;
}
