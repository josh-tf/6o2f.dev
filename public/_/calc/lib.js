// Expression parser: recursive descent, no eval. Precedence low->high: + -, * / %, unary -, ^ (right assoc).
const snap = (f) => (x) => {
  const r = f(x);
  return Math.abs(r) < 1e-15 ? 0 : r;
}; // sin(pi) is 0, not 1.2e-16
const FN = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: snap(Math.sin),
  cos: snap(Math.cos),
  tan: snap(Math.tan),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  min: Math.min,
  max: Math.max,
};
const CONST = { pi: Math.PI, e: Math.E };

function tokens(src) {
  const out = [],
    re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([a-z_]\w*)|(.))/giy;
  let m;
  src = src.replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/−/g, '-');
  while (re.lastIndex < src.length && (m = re.exec(src))) {
    if (m[1] !== undefined) out.push({ t: 'n', v: parseFloat(m[1]) });
    else if (m[2]) out.push({ t: 'i', v: m[2].toLowerCase() });
    else if (m[3] && /[-+*/%^(),]/.test(m[3])) out.push({ t: m[3] });
    else if (m[3]) throw new Error(`Unexpected "${m[3]}"`);
  }
  return out;
}

/** Evaluate an expression string. `ans` is the previous result. Throws Error with a readable message. */
export function calc(src, ans = 0) {
  const tk = tokens(src);
  let i = 0;
  const peek = () => tk[i]?.t,
    next = () => tk[i++];
  const want = (t) => {
    if (peek() !== t) throw new Error(peek() ? `Expected "${t}" but found "${tk[i].v ?? tk[i].t}"` : `Missing "${t}"`);
    i++;
  };
  function expr() {
    let a = term();
    while (peek() === '+' || peek() === '-') a = next().t === '+' ? a + term() : a - term();
    return a;
  }
  function term() {
    let a = unary();
    for (;;) {
      const t = peek();
      if (t === '*') {
        i++;
        a *= unary();
      } else if (t === '/') {
        i++;
        const b = unary();
        if (b === 0) throw new Error('Division by zero');
        a /= b;
      } else if (t === '%') {
        i++;
        if (tk[i]?.v === 'of') {
          i++;
          a = (a / 100) * unary();
        } // "20% of 150"
        else if (!tk[i] || tk[i].t === ')' || tk[i].t === ',')
          a /= 100; // trailing "5%" is 0.05
        else {
          const b = unary();
          if (b === 0) throw new Error('Division by zero');
          a %= b;
        }
      } else return a;
    }
  }
  function unary() {
    if (peek() === '-') {
      i++;
      return -unary();
    }
    if (peek() === '+') {
      i++;
      return unary();
    }
    return power();
  }
  function power() {
    const a = primary();
    if (peek() === '^') {
      i++;
      return a ** unary();
    } // right assoc: unary -> power
    return a;
  }
  function primary() {
    const k = next();
    if (!k) throw new Error('Unexpected end of expression');
    if (k.t === 'n') return k.v;
    if (k.t === '(') {
      const v = expr();
      want(')');
      return v;
    }
    if (k.t === 'i') {
      if (k.v === 'ans') return ans;
      if (k.v in CONST) return CONST[k.v];
      if (k.v in FN) {
        want('(');
        const args = [];
        if (peek() !== ')')
          do args.push(expr());
          while (peek() === ',' && i++);
        want(')');
        if (!args.length) throw new Error(`${k.v}() needs an argument`);
        return FN[k.v](...args);
      }
      throw new Error(`Unknown name "${k.v}"`);
    }
    throw new Error(`Unexpected "${k.t}"`);
  }
  if (!tk.length) throw new Error('Empty expression');
  const v = expr();
  if (i < tk.length) throw new Error(`Unexpected "${tk[i].v ?? tk[i].t}"`);
  if (Number.isNaN(v)) throw new Error('Result is not a number');
  if (!Number.isFinite(v)) throw new Error('Result is too large');
  return v;
}

/** Exact integers up to 2^53; otherwise 12 significant digits, no float noise (0.1+0.2 -> 0.3), exponent form from 1e15. */
export function fmt(n) {
  if (Number.isSafeInteger(n)) return String(n);
  if (Math.abs(n) >= 1e15) {
    const [m, e] = n.toExponential(11).split('e');
    return `${+m}e${+e}`;
  }
  return String(+n.toPrecision(12)).replace('e+', 'e');
}
