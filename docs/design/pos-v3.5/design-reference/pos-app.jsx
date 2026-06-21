/* POS v3.0 — Rahma Qanater general-retail terminal.
 * Adapted from the POS Pulse design-system terminal template (screens.jsx + app.jsx merged).
 * Arabic-first RTL · dark theme default with light toggle · cash/card tender with change math.
 * All components come from the bound design-system bundle; no restyled lookalikes.
 */

function useDS() {
  return window.RetailTowerOSPOSPulseDesignSystem_3dd5f2;
}

/* ── Mock data ─────────────────────────────────────────────────────────── */
/* Each operator signs in by STAFF CODE (typed) + a 6-digit PIN. */
const POS_OPERATORS = [
  { id: 'op1', code: '1001', name: 'منى خليل', en: 'Mona Khalil', role: 'cashier' },
  { id: 'op2', code: '1002', name: 'يوسف حسن', en: 'Yousef Hassan', role: 'cashier' },
  { id: 'op3', code: '2001', name: 'دينا فاروق', en: 'Dina Farouk', role: 'manager' },
];

const ROLE_NAMES = { cashier: 'صيدلي', manager: 'مدير الصيدلية', admin: 'مشرف' };

const CATEGORIES = [
  { id: 'all', ar: 'الأصناف السريعة', en: 'Quick items' },
  { id: 'pain', ar: 'مسكنات وخافض حرارة', en: 'Pain & fever' },
  { id: 'rx', ar: 'أدوية بروشتة', en: 'Prescription' },
  { id: 'cold', ar: 'برد وسعال', en: 'Cold & flu' },
  { id: 'vitamins', ar: 'فيتامينات ومكملات', en: 'Vitamins' },
  { id: 'medical', ar: 'مستلزمات طبية', en: 'Medical supplies' },
  { id: 'care', ar: 'عناية شخصية', en: 'Personal care' },
];

/* Medicines are VAT-exempt (vatable:false); supplies & care carry 14%.
 * rx:true ⇒ صرف بروشتة (prescription required to add).
 * units>1 ⇒ sellable by single unit (strip/tablet/piece) as well as by pack. */
const POS_PRODUCTS = [
  { id: 'p01', ar: 'باراسيتامول ٥٠٠ مجم', en: 'Paracetamol 500mg', price: 1800, code: '7224031000017', pack: 'علبة ٢٠ قرص', packLabel: 'علبة', units: 20, unitLabel: 'قرص', cat: 'pain', quick: true, vatable: false },
  { id: 'p02', ar: 'إيبوبروفين ٤٠٠ مجم', en: 'Ibuprofen 400mg', price: 3600, code: '7224031000024', pack: 'علبة ٣٠ قرص', packLabel: 'علبة', units: 30, unitLabel: 'قرص', cat: 'pain', quick: true, vatable: false },
  { id: 'p03', ar: 'أسبرين أطفال ٧٥ مجم', en: 'Baby aspirin 75mg', price: 1450, code: '7224031000031', pack: 'شريط ٣٠ قرص', packLabel: 'شريط', units: 30, unitLabel: 'قرص', cat: 'pain', vatable: false },
  { id: 'p04', ar: 'أموكسيسيلين ٥٠٠ مجم', en: 'Amoxicillin 500mg', price: 5200, code: '7224031000048', pack: 'علبة ١٦ كبسولة', packLabel: 'علبة', units: 16, unitLabel: 'كبسولة', cat: 'rx', quick: true, vatable: false, rx: true },
  { id: 'p05', ar: 'أزيثرومايسين ٥٠٠ مجم', en: 'Azithromycin 500mg', price: 7800, code: '7224031000055', pack: 'علبة ٣ أقراص', packLabel: 'علبة', units: 3, unitLabel: 'قرص', cat: 'rx', vatable: false, rx: true },
  { id: 'p06', ar: 'إنسولين سريع المفعول', en: 'Rapid-acting insulin', price: 14500, code: '7224031000062', pack: 'قلم ٣ مل', packLabel: 'قلم', units: 1, cat: 'rx', vatable: false, rx: true },
  { id: 'p07', ar: 'شراب كحة للأطفال ١٠٠ مل', en: 'Children cough syrup 100ml', price: 2850, code: '7224031000079', pack: 'زجاجة ١٠٠ مل', packLabel: 'زجاجة', units: 1, cat: 'cold', quick: true, vatable: false },
  { id: 'p08', ar: 'مضاد احتقان الأنف بخاخ', en: 'Nasal decongestant spray', price: 3200, code: '7224031000086', pack: 'بخاخ ١٥ مل', packLabel: 'بخاخ', units: 1, cat: 'cold', vatable: false },
  { id: 'p09', ar: 'أقراص استحلاب للحلق', en: 'Throat lozenges', price: 1600, code: '7224031000093', pack: 'علبة ٢٤ قرص', packLabel: 'علبة', units: 24, unitLabel: 'قرص', cat: 'cold', quick: true, vatable: false },
  { id: 'p10', ar: 'فيتامين سي ١٠٠٠ مجم فوار', en: 'Vitamin C 1000mg', price: 2400, code: '7224031000109', pack: 'أنبوب ٢٠ قرص', packLabel: 'أنبوب', units: 20, unitLabel: 'قرص', cat: 'vitamins', quick: true, vatable: false },
  { id: 'p11', ar: 'زنك + فيتامين د٣', en: 'Zinc + Vitamin D3', price: 4800, code: '7224031000116', pack: 'علبة ٣٠ قرص', packLabel: 'علبة', units: 30, unitLabel: 'قرص', cat: 'vitamins', vatable: false },
  { id: 'p12', ar: 'ملتي فيتامين للكبار', en: 'Adult multivitamin', price: 6500, code: '7224031000123', pack: 'علبة ٦٠ قرص', packLabel: 'علبة', units: 60, unitLabel: 'قرص', cat: 'vitamins', vatable: false },
  { id: 'p13', ar: 'جهاز قياس ضغط الدم', en: 'Blood pressure monitor', price: 89500, code: '7224031000130', pack: 'جهاز + حقيبة', packLabel: 'جهاز', units: 1, cat: 'medical', vatable: true },
  { id: 'p14', ar: 'ترمومتر رقمي', en: 'Digital thermometer', price: 8500, code: '7224031000147', pack: 'قطعة', packLabel: 'قطعة', units: 1, cat: 'medical', quick: true, vatable: true },
  { id: 'p15', ar: 'شرائط قياس سكر', en: 'Glucose test strips', price: 18500, code: '7224031000154', pack: 'علبة ٥٠ شريط', packLabel: 'علبة', units: 50, unitLabel: 'شريط', cat: 'medical', quick: true, vatable: true },
  { id: 'p16', ar: 'ضمادات معقمة', en: 'Sterile bandages', price: 1200, code: '7224031000161', pack: 'علبة ١٠ قطع', packLabel: 'علبة', units: 10, unitLabel: 'قطعة', cat: 'medical', vatable: true },
  { id: 'p17', ar: 'كحول إيثيلي ٧٠٪ · ٤٠٠ مل', en: 'Ethyl alcohol 70%', price: 1850, code: '7224031000178', pack: 'زجاجة ٤٠٠ مل', packLabel: 'زجاجة', units: 1, cat: 'medical', quick: true, vatable: true },
  { id: 'p18', ar: 'كريم مرطب طبي ٥٠ مل', en: 'Medical moisturiser 50ml', price: 5600, code: '7224031000185', pack: 'أنبوب ٥٠ مل', packLabel: 'أنبوب', units: 1, cat: 'care', vatable: true },
  { id: 'p19', ar: 'واقي شمس SPF50 · ٥٠ مل', en: 'Sunscreen SPF50', price: 12800, code: '7224031000192', pack: 'أنبوب ٥٠ مل', packLabel: 'أنبوب', units: 1, cat: 'care', vatable: true },
  { id: 'p20', ar: 'شامبو طبي للقشرة', en: 'Medicated dandruff shampoo', price: 7200, code: '7224031000208', pack: 'زجاجة ٢٠٠ مل', packLabel: 'زجاجة', units: 1, cat: 'care', vatable: true },
];

/* Frequently-bought-together pairs (id → suggested ids). */
const BOUGHT_TOGETHER = {
  p01: ['p10'], p02: ['p01'], p04: ['p10'], p05: ['p10'],
  p07: ['p09'], p08: ['p09'], p09: ['p07'],
  p13: ['p15'], p14: ['p17'], p15: ['p14'], p16: ['p17'], p17: ['p16'],
  p06: ['p15'], p10: ['p11'],
};

/* Drug-interaction / duplicate-class pairs that should warn (honesty-first). */
const INTERACTIONS = [
  { ids: ['p01', 'p02'], msg: 'مسكّنان معًا — راجع إجمالي الجرعة اليومية' },
  { ids: ['p02', 'p03'], msg: 'مضادات التهاب متعددة (NSAIDs) — خطر معِدي' },
  { ids: ['p01', 'p03'], msg: 'مسكّنان معًا — راجع الجرعة' },
  { ids: ['p04', 'p05'], msg: 'مضادان حيويان معًا — تأكد من الوصفة' },
];

/* Nearest-batch expiry per product (YYYY-MM). Today is 2026-06. */
const EXPIRY = {
  p01: '2027-04', p02: '2026-09', p03: '2027-01', p04: '2026-08', p05: '2026-07',
  p06: '2026-07', p07: '2026-11', p08: '2027-03', p09: '2026-12', p10: '2027-06',
  p11: '2027-02', p12: '2027-08', p13: '2029-01', p14: '2030-01', p15: '2026-10',
  p16: '2028-05', p17: '2027-09', p18: '2026-09', p19: '2027-05', p20: '2027-12',
};
const BATCH = { /* demo batch refs */ };
/* Near-expiry = within ~5 months of 2026-06. */
function expiryMonths(id) {
  const e = EXPIRY[id]; if (!e) return 999;
  const [y, m] = e.split('-').map(Number);
  return (y - 2026) * 12 + (m - 6);
}
function nearExpiry(id) { return expiryMonths(id) <= 4; }

const VAT_RATE = 0.14;

/* ── Health-insurance plans (co-pay split) ─────────────────────────────────
 * Each plan covers a percentage of the ELIGIBLE basket only. Eligible =
 * dispensed medicines (VAT-exempt lines); medical devices & personal-care
 * (vatable) are never reimbursed and stay 100% on the patient. The terminal
 * never claims more than it knows: coverage shows per-line, the patient co-pay
 * is what the drawer actually collects. */
const INSURERS = [
  { id: 'ins1', ar: 'الهيئة العامة للتأمين الصحي', en: 'Universal Health Insurance', coverPct: 100, prefix: 'UHI' },
  { id: 'ins2', ar: 'مصر للتأمين الصحي', en: 'Misr Health', coverPct: 80, prefix: 'MHI' },
  { id: 'ins3', ar: 'بوبا — الرعاية الذهبية', en: 'Bupa Gold Care', coverPct: 90, prefix: 'BUP' },
  { id: 'ins4', ar: 'تكافل الشركات', en: 'Corporate Takaful', coverPct: 70, prefix: 'TKF' },
];
/* Reimbursable basket = VAT-exempt medicine lines only. */
function insuranceEligible(cart) {
  return cart.reduce((s, l) => s + (l.vatable ? 0 : l.price * l.qty), 0);
}

/* Manager override code — 6 digits, required to cancel/remove items (demo: ٢٢٤٤٦٦). */
const ADMIN_PIN = '224466';

/* unit price = pack price ÷ units, rounded to the piaster. */
function unitPrice(p) { return Math.max(1, Math.round(p.price / (p.units || 1))); }
function splittable(p) { return (p.units || 1) > 1; }

/* Pre-loaded gift / store vouchers (code → value in minor units). */
const VOUCHERS = {
  'VCH-100': 10000,
  'VCH-250': 25000,
  'VCH-500': 50000,
};

/* Deferred-sale (credit) accounts — persons & companies with a running balance. */
const CREDIT_ACCOUNTS = [
  { id: 'c1', ar: 'عيادة د. سامر للباطنة', en: 'Dr. Samer Clinic', kind: 'company', balance: 142500 },
  { id: 'c2', ar: 'دار رعاية الأمل', en: 'Al-Amal Care Home', kind: 'company', balance: 38000 },
  { id: 'c3', ar: 'أحمد عبد الله', en: 'Ahmed Abdullah', kind: 'person', balance: 9500 },
  { id: 'c4', ar: 'مدرسة المستقبل', en: 'Future School', kind: 'company', balance: 0 },
];
const KIND_LABEL = { company: 'جهة', person: 'فرد' };

/* Stock levels per product (on-hand · reorder point) for the inventory view. */
const STOCK = {
  p01: { on: 142, par: 40 }, p02: { on: 8, par: 24 }, p03: { on: 60, par: 20 },
  p04: { on: 36, par: 18 }, p05: { on: 12, par: 10 }, p06: { on: 9, par: 12 },
  p07: { on: 30, par: 24 }, p08: { on: 22, par: 20 }, p09: { on: 80, par: 30 },
  p10: { on: 96, par: 48 }, p11: { on: 5, par: 24 }, p12: { on: 38, par: 16 },
  p13: { on: 4, par: 3 }, p14: { on: 11, par: 8 }, p15: { on: 0, par: 12 },
  p16: { on: 73, par: 30 }, p17: { on: 51, par: 20 }, p18: { on: 14, par: 10 },
  p19: { on: 0, par: 8 }, p20: { on: 19, par: 10 },
};
function stockState(s) {
  if (s.on === 0) return 'out';
  if (s.on <= s.par) return 'low';
  return 'ok';
}

function formatMinor(minor) {
  const whole = Math.floor(minor / 100);
  const frac = String(Math.abs(minor % 100)).padStart(2, '0');
  return `EGP ${whole.toLocaleString('en-US')}.${frac}`;
}

/* Money is always Latin-numeral mono, isolated LTR inside RTL copy. */
function Money({ v, className }) {
  return <span dir="ltr" className={`mono${className ? ' ' + className : ''}`}>{formatMinor(v)}</span>;
}

/* Animated count-up for money — rolls to its value (change due, totals). */
function MoneyRoll({ v, className }) {
  const [shown, setShown] = React.useState(v);
  const ref = React.useRef({ raf: 0, from: v });
  React.useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(v); return; }
    const from = ref.current.from;
    const start = performance.now();
    const dur = 520;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (v - from) * eased));
      if (t < 1) ref.current.raf = requestAnimationFrame(tick);
      else ref.current.from = v;
    };
    cancelAnimationFrame(ref.current.raf);
    ref.current.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current.raf);
  }, [v]);
  return <span dir="ltr" className={`mono change-roll${className ? ' ' + className : ''}`}>{formatMinor(shown)}</span>;
}

function cartTotals(cart) {
  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const vat = cart.reduce((s, l) => s + (l.vatable ? Math.round(l.price * l.qty * VAT_RATE) : 0), 0);
  return { subtotal, vat, total: subtotal + vat };
}

/* Free-entry cash keypad — value is minor units (piasters). Typed digits
 * fill from the right like a real register: 1·0·0·0·0 ⇒ EGP 100.00. */
function AmountPad({ value, onChange, autoLabel }) {
  const v = value == null ? 0 : value;
  const press = (d) => onChange(Math.min(v * 10 + d, 99999999));
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return (
    <div className="amount-pad">
      <div className="amount-pad__display" dir="ltr">{value == null ? <span className="amount-pad__ph">EGP 0.00</span> : formatMinor(v)}</div>
      <div className="amount-pad__grid">
        {keys.map((k) => (
          <button key={k} type="button" className="amount-pad__key" onClick={() => press(k)}>{k.toLocaleString('ar-EG')}</button>
        ))}
        <button type="button" className="amount-pad__key" onClick={() => onChange(v * 100)}>٠٠</button>
        <button type="button" className="amount-pad__key" onClick={() => press(0)}>٠</button>
        <button type="button" className="amount-pad__key amount-pad__key--del" onClick={() => onChange(Math.floor(v / 10))} aria-label="مسح رقم">⌫</button>
      </div>
    </div>
  );
}

/* Suggested cash notes: exact amount + the nearest banknote roll-ups. */
function quickAmounts(total) {
  const opts = [total];
  [5000, 10000, 20000, 50000, 100000].forEach((note) => {
    opts.push(Math.ceil(total / note) * note);
  });
  return [...new Set(opts.filter((v) => v >= total))].sort((a, b) => a - b).slice(0, 5);
}

/* ── Sign-in: staff code + 6-digit PIN ─────────────────────────────────── */
function SignInScreen({ onSignIn }) {
  const { PinPad } = useDS();
  const [code, setCode] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState(false);

  const matched = POS_OPERATORS.find((o) => o.code === code.trim());

  const submit = (value) => {
    if (!matched) { setError(true); return; }
    if ((value || pin).length === 6) {
      onSignIn(matched);
    } else {
      setError(true);
    }
  };

  return (
    <div className="sign-in-stage sign-in-stage--brand" data-screen-label="Sign in">
      <div className="brand-hero">
        <img className="brand-hero__bg" src="pos/retail-tower-hero.png" alt="" />
        <div className="brand-hero__scrim"></div>
        <div className="brand-hero__content">
          <span className="brand-hero__wordmark">
            <img src="pos/pos-pulse-logo.svg" alt="" width="44" height="44" />
            POS Pulse
          </span>
          <p className="brand-hero__tag">منظومة صرف دقيقة وموثوقة — كل عملية مُسجّلة ومنسوبة لصاحبها، متصلاً أو بدون اتصال.</p>
          <div className="brand-hero__meta">
            <span className="brand-hero__chip">صيدلية رحمة القناطر</span>
            <span className="brand-hero__chip brand-hero__chip--mono" dir="ltr">TERM-01</span>
          </div>
        </div>
      </div>
      <div className="sign-in-side">
        <div className="sign-in-pane">
          <div>
            <h1 className="sign-in-pane__title">تسجيل دخول الصيدلي</h1>
            <p className="sign-in-pane__sub">أدخل كود الموظف ثم الرقم السري المكوّن من ٦ أرقام — كل عمليات الوردية تُسجَّل باسمك. (Staff code, then 6-digit PIN.)</p>
          </div>
          <div className="sign-in-split">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <p className="ws-section__label" style={{ marginBottom: 'var(--space-2)' }}>كود الموظف · Staff code</p>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  className="catalogue-search-input"
                  style={{ fontFamily: 'var(--font-family-mono)', letterSpacing: '0.18em', textAlign: 'center', fontSize: '1.25rem' }}
                  placeholder="1001"
                  aria-label="كود الموظف"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(false); }}
                />
              </div>
              <div className={`roster-list__item${matched ? ' roster-list__item--selected' : ''}`} style={{ listStyle: 'none' }}>
                <div className="roster-list__item-btn" style={{ cursor: 'default' }}>
                  <span className="roster-list__avatar">{matched ? matched.name.split(' ').map((w) => w[0]).join('').slice(0, 2) : '—'}</span>
                  <span className="roster-list__name">{matched ? matched.name : 'أدخل كودًا صحيحًا'}</span>
                  <span className="roster-list__role">{matched ? ROLE_NAMES[matched.role] : '—'}</span>
                </div>
              </div>
              <p className="catalogue-hint" dir="ltr">Demo codes: 1001 · 1002 · 2001 (manager)</p>
            </div>
            <PinPad
              length={6}
              value={pin}
              error={error}
              disabled={!matched}
              onChange={(v) => { setPin(v); setError(false); }}
              onSubmit={submit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Admin authorization gate (manager PIN to cancel/remove items) ──────── */
function AdminGate({ gate, onClose }) {
  const { Dialog, PinPad } = useDS();
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState(false);

  React.useEffect(() => { setPin(''); setError(false); }, [gate]);

  if (!gate) return null;

  const attempt = (value) => {
    if ((value || pin) === ADMIN_PIN) {
      gate.run();
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <Dialog
      open={!!gate}
      onOpenChange={(o) => { if (!o) onClose(); }}
      variant="destructive"
      title="تتطلب موافقة المدير"
      description="إلغاء أو حذف الأصناف يحتاج رمز المدير (٦ أرقام)، ويُسجَّل في سجل المراجعة. (Manager approval — demo PIN ٢٢٤٤٦٦.)"
    >
      <div className="admin-gate">
        <div className="admin-gate__target">{gate.label}</div>
        <PinPad length={6} value={pin} error={error} onChange={(v) => { setPin(v); setError(false); }} onSubmit={attempt} />
        <p className="admin-gate__error">{error ? 'رمز غير صحيح — حاول مرة أخرى.' : ''}</p>
      </div>
    </Dialog>
  );
}

/* ── Sale screen: catalogue + cart ─────────────────────────────────────── */
function SaleScreen({ cart, onAdd, onInc, onDec, onRemove, onVoid, onHandoff, onHold, heldSales, onRecall, onSwitchMode, onAudit, scanPulse, searchRef }) {
  const { Button, Dialog } = useDS();
  const [query, setQuery] = React.useState('');
  const [cat, setCat] = React.useState('all');
  const [gate, setGate] = React.useState(null);
  const [rxPrompt, setRxPrompt] = React.useState(null);
  const [rxRef, setRxRef] = React.useState('');
  const [rxDose, setRxDose] = React.useState('');
  const [priceCheck, setPriceCheck] = React.useState(false);
  const [flash, setFlash] = React.useState(null);

  /* Rx items require a prescription reference before they enter the cart.
   * In price-check mode, tapping any item just flashes its price (no add). */
  const tryAdd = (p, mode) => {
    if (priceCheck) { setFlash(p); return; }
    if (p.rx) { setRxPrompt({ p, mode: mode || 'pack' }); setRxRef(''); setRxDose(''); }
    else onAdd(p, mode);
  };

  /* Bought-together suggestion from the most recent cart item. */
  const lastLine = cart[cart.length - 1];
  const suggestId = lastLine && (BOUGHT_TOGETHER[lastLine.id] || []).find((sid) => !cart.some((l) => l.id === sid));
  const suggestion = suggestId && POS_PRODUCTS.find((p) => p.id === suggestId);

  /* Active drug-interaction warnings for the current cart. */
  const ids = cart.map((l) => l.id);
  const warnings = INTERACTIONS.filter((w) => w.ids.every((id) => ids.includes(id)));

  const trimmed = query.trim();
  const searching = trimmed.length >= 2;
  const results = searching
    ? POS_PRODUCTS.filter(
        (p) =>
          p.ar.includes(trimmed) ||
          p.en.toLowerCase().includes(trimmed.toLowerCase()) ||
          p.code.startsWith(trimmed),
      )
    : [];

  const tiles = cat === 'all'
    ? POS_PRODUCTS.filter((p) => p.quick)
    : POS_PRODUCTS.filter((p) => p.cat === cat);
  const activeCat = CATEGORIES.find((c) => c.id === cat);

  /* Keyboard-wedge scanner: full barcode + Enter adds immediately. */
  const onSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const exact = POS_PRODUCTS.find((p) => p.code === trimmed);
    if (exact) {
      tryAdd(exact);
      setQuery('');
    } else if (results.length === 1) {
      tryAdd(results[0]);
      setQuery('');
    }
  };

  const { subtotal, vat, total } = cartTotals(cart);

  return (
    <div className="sale-layout" data-screen-label="Sale — catalogue + cart">
      <section className="catalogue-pane" aria-label="الكتالوج">
        <div className="catalogue-freshness-line">
          <span className="dot"></span>
          تحديث الكتالوج منذ <time className="mono" dir="ltr">7</time> دقائق
          <span style={{ marginInlineStart: 'auto', display: 'inline-flex', gap: 'var(--space-2)' }}>
            <button type="button" className={`pricecheck-toggle${priceCheck ? ' pricecheck-toggle--on' : ''}`} onClick={() => setPriceCheck((v) => !v)}>
              <i data-lucide="search-check"></i>
              فحص السعر {priceCheck ? '· مُفعّل' : ''}
            </button>
            <Button intent="ghost" onClick={() => {}}>تحديث</Button>
          </span>
        </div>
        <div>
          <input
            type="search"
            className="catalogue-search-input"
            dir="rtl"
            ref={searchRef}
            placeholder="ابحث بالاسم أو امسح الباركود… (search or scan)"
            aria-label="ابحث بالاسم أو امسح الباركود"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
          />
          <p className="catalogue-hint">اكتب حرفين على الأقل للبحث بالاسم — الماسح الضوئي يضيف الصنف فورًا بزر Enter</p>
        </div>

        {searching && results.length > 0 && (
          <div className="catalogue-results" role="listbox" aria-label="نتائج البحث">
            {results.map((p) => (
              <button key={p.id} type="button" role="option" aria-selected="false" className="catalogue-result-row" onClick={() => { tryAdd(p); setQuery(''); }}>
                <span className="name">{p.ar}{p.rx && <span className="rx-badge" style={{ marginInlineStart: 6 }}>Rx</span>}<small dir="ltr">{p.en}</small></span>
                <span className="price" dir="ltr">{formatMinor(p.price)}</span>
                <span className="meta" dir="ltr">{p.code} · {p.pack}</span>
              </button>
            ))}
          </div>
        )}

        {searching && results.length === 0 && (
          <div className="empty-state">
            <h3 className="empty-state__heading">لا توجد نتيجة لـ «{trimmed}»</h3>
            <p className="empty-state__description">راجع الكتابة أو امسح باركود الصنف. لم يُضَف أي صنف إلى السلة.</p>
          </div>
        )}

        {!searching && (
          <React.Fragment>
            <div className="cat-chips" role="tablist" aria-label="فئات الأصناف">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === cat}
                  className={`cat-chip${c.id === cat ? ' cat-chip--selected' : ''}`}
                  onClick={() => setCat(c.id)}
                >
                  {c.ar} <small dir="ltr">{c.en}</small>
                </button>
              ))}
            </div>
            <p className="quick-section-label" dir="ltr">{activeCat.en} · {tiles.length}</p>
            <div className="quick-grid">
              {tiles.map((p) => (
                <button key={p.id} type="button" className="quick-tile" onClick={() => tryAdd(p)}>
                  <span className="quick-tile__top">
                    <span className="quick-tile__name">{p.ar}</span>
                    {p.rx && <span className="rx-badge">Rx</span>}
                  </span>
                  <span className="quick-tile__en" dir="ltr">{p.en}</span>
                  <span className="quick-tile__price" dir="ltr">{formatMinor(p.price)}{splittable(p) ? <small style={{ opacity: 0.7 }}> · {p.unitLabel} {formatMinor(unitPrice(p))}</small> : ''}</span>
                </button>
              ))}
            </div>
          </React.Fragment>
        )}
      </section>

      <aside className="cart-pane" aria-label="السلة">
        <span key={scanPulse} className="scan-flash" aria-hidden="true"></span>
        {heldSales.length > 0 && (
          <div className="held-tray" aria-label="مبيعات معلّقة">
            <span className="held-tray__label">معلّقة · Held</span>
            {heldSales.map((h) => (
              <button key={h.id} type="button" className="held-chip" onClick={() => onRecall(h.id)}>
                {h.label} <span className="mono" dir="ltr">{h.count}·{formatMinor(h.total)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="cart-pane__header">
          <h2 className="cart-pane__title">البيع الحالي</h2>
          <button type="button" className="cart-pane__void" disabled={cart.length === 0} onClick={() => setGate({ label: 'إلغاء البيع بالكامل', run: () => { onVoid(); onAudit && onAudit('إلغاء البيع بالكامل', 'danger'); } })}>
            إلغاء البيع
          </button>
        </div>
        {warnings.length > 0 && (
          <div style={{ padding: '0 var(--space-3)' }}>
            {warnings.map((w, i) => (
              <div key={i} className="callout callout--warning" role="alert" style={{ marginBottom: 6 }}>
                <span className="callout__icon" aria-hidden="true"><i data-lucide="alert-triangle"></i></span>
                <div className="callout__body"><strong>تنبيه تداخل دوائي</strong><br />{w.msg}</div>
              </div>
            ))}
          </div>
        )}
        <div className="cart-pane__body">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <img className="cart-empty__mark" src="pos/pos-pulse-logo.svg" alt="" />
              <p className="cart-empty__title">السلة فارغة</p>
              <p className="cart-empty__hint">امسح باركود الصنف أو اختر من الأصناف السريعة للبدء. (Scan or tap an item to begin.)</p>
              <div className="cart-empty__keys">
                <span className="kbd">F2 <small>دفع</small></span>
                <span className="kbd">F3 <small>تعليق</small></span>
                <span className="kbd">/ <small>بحث</small></span>
              </div>
            </div>
          ) : (
            <ul className="cart-pane__line-list">
              {cart.map((line, idx) => (
                <li key={line.lineId} className="cart-pane__line-list-item">
                  <div className={`line-item-row${idx === cart.length - 1 ? ' line-item-row--new' : ''}`}>
                    <div className="line-item-row__main">
                      <span className="line-item-row__name">
                        {line.ar}
                        {line.rx && <span className="rx-badge" style={{ marginInlineStart: 6 }}>Rx</span>}
                      </span>
                      <button type="button" className="line-item-row__remove" aria-label={`حذف ${line.ar}`} onClick={() => setGate({ label: `حذف صنف: ${line.ar}`, run: () => { onRemove(line.lineId); onAudit && onAudit(`حذف صنف من السلة: ${line.ar}`, 'danger'); } })}>×</button>
                    </div>
                    <span className="line-item-row__meta-line" dir="rtl">
                      <span className="mono" dir="ltr">صلاحية {EXPIRY[line.id] || '—'}</span>
                      {nearExpiry(line.id) && <span className="expiry-flag">قريب الانتهاء</span>}
                    </span>
                    {line.units > 1 && (
                      <span className="seg" style={{ alignSelf: 'flex-start' }}>
                        <button type="button" className={line.mode === 'pack' ? 'seg--on' : ''} onClick={() => onSwitchMode(line.lineId, 'pack')}>{line.packLabel || 'عبوة'}</button>
                        <button type="button" className={line.mode === 'unit' ? 'seg--on' : ''} onClick={() => onSwitchMode(line.lineId, 'unit')}>{line.unitLabel || 'وحدة'} مفرد</button>
                      </span>
                    )}
                    <div className="line-item-row__qty-price">
                      <span className="quantity-stepper">
                        <button type="button" aria-label="تقليل الكمية" onClick={() => onDec(line.lineId)}>−</button>
                        <span className="qty" dir="ltr">{line.qty}</span>
                        <button type="button" aria-label="زيادة الكمية" onClick={() => onInc(line.lineId)}>+</button>
                      </span>
                      <span className="line-item-row__unit-price"><Money v={line.price} /></span>
                      <span className="line-item-row__subtotal"><Money v={line.price * line.qty} /></span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="cart-pane__footer">
          <div className="totals-rows">
            <div className="totals-row">
              <span>المجموع · {cart.reduce((s, l) => s + l.qty, 0)} صنف</span>
              <Money v={subtotal} />
            </div>
            <div className="totals-row">
              <span>ض.ق.م ١٤٪ (VAT)</span>
              <Money v={vat} />
            </div>
            <div className="totals-row totals-row--grand">
              <span>الإجمالي المطلوب</span>
              <Money v={total} />
            </div>
          </div>
          <div className="cart-actions-row">
            <button type="button" className="cart-pane__hold" disabled={cart.length === 0} onClick={onHold}>
              تعليق · Hold
            </button>
            <button type="button" className="cart-pane__handoff" disabled={cart.length === 0} onClick={onHandoff}>
              الانتقال للدفع — Hand off to payment
            </button>
          </div>
        </div>
      </aside>

      {suggestion && (
        <div className="suggest-bar">
          <span className="suggest-row__label">يُصرف معه عادةً:</span>
          <button type="button" className="suggest-chip" onClick={() => tryAdd(suggestion)}>
            + {suggestion.ar} <span className="mono" dir="ltr">{formatMinor(suggestion.price)}</span>
          </button>
        </div>
      )}

      {flash && (
        <div className="price-flash" onClick={() => setFlash(null)}>
          <div className="price-flash__card">
            <span className="price-flash__name">{flash.ar}{flash.rx && <span className="rx-badge" style={{ marginInlineStart: 6 }}>Rx</span>}</span>
            <span className="price-flash__en" dir="ltr">{flash.en} · {flash.pack}</span>
            <span className="price-flash__price" dir="ltr">{formatMinor(flash.price)}</span>
            {splittable(flash) && <span className="price-flash__hint" dir="ltr">{flash.unitLabel} مفرد {formatMinor(unitPrice(flash))}</span>}
            <span className="price-flash__hint">اضغط في أي مكان للإغلاق · فحص سعر فقط — لم يُضَف للسلة</span>
          </div>
        </div>
      )}

      <AdminGate gate={gate} onClose={() => setGate(null)} />

      <Dialog
        open={!!rxPrompt}
        onOpenChange={(o) => { if (!o) setRxPrompt(null); }}
        title="صرف بوصفة طبية"
        description="هذا الصنف يُصرف بروشتة. سجّل رقم الوصفة أو اسم الطبيب قبل الإضافة — يُحفظ في سجل المراجعة."
        primaryAction={{ label: 'تأكيد وإضافة', onClick: () => { if (rxPrompt) { onAdd(rxPrompt.p, rxPrompt.mode, { rxRef, dosage: rxDose }); onAudit && onAudit(`صرف بروشتة: ${rxPrompt.p.ar}${rxRef ? ' · ' + rxRef : ''}`, 'info'); } setRxPrompt(null); } }}
        secondaryAction={{ label: 'إلغاء', onClick: () => setRxPrompt(null) }}
      >
        <div className="rx-gate">
          {rxPrompt && <div className="rx-gate__item">{rxPrompt.p.ar}</div>}
          <input
            type="text"
            dir="rtl"
            placeholder="رقم الوصفة أو اسم الطبيب (Rx ref / doctor)"
            aria-label="مرجع الوصفة"
            value={rxRef}
            onChange={(e) => setRxRef(e.target.value)}
            autoComplete="off"
          />
          <input
            type="text"
            dir="rtl"
            placeholder="الجرعة والإرشادات — مثال: قرص كل ١٢ ساعة بعد الأكل"
            aria-label="الجرعة والإرشادات"
            value={rxDose}
            onChange={(e) => setRxDose(e.target.value)}
            autoComplete="off"
          />
        </div>
      </Dialog>
    </div>
  );
}

/* ── Tender screen ─────────────────────────────────────────────────────── */
const CREDIT_PCTS = [
  { pct: 0, label: 'بدون مقدّم' },
  { pct: 25, label: '٢٥٪' },
  { pct: 50, label: '٥٠٪' },
  { pct: 75, label: '٧٥٪' },
];

function TenderScreen({ cart, onBack, onConfirm }) {
  const { Button } = useDS();
  const { subtotal, vat, total } = cartTotals(cart);
  const [method, setMethod] = React.useState(null); // cash | card | voucher | insurance | credit
  const [tendered, setTendered] = React.useState(null); // cash received (cash + voucher/insurance remainder)
  const [voucherCode, setVoucherCode] = React.useState('');
  const [creditCustomer, setCreditCustomer] = React.useState(null);
  const [creditPct, setCreditPct] = React.useState(0);
  const [insurerId, setInsurerId] = React.useState(null);
  const [memberId, setMemberId] = React.useState('');

  const selectMethod = (m) => {
    setMethod(m);
    setTendered(null);
    setVoucherCode('');
    setCreditCustomer(null);
    setCreditPct(0);
    setInsurerId(null);
    setMemberId('');
  };

  /* ── Derived tender state ──────────────────────────────────────────── */
  const voucherValue = VOUCHERS[voucherCode.trim().toUpperCase()] || 0;
  const voucherKnown = voucherValue > 0;
  const voucherBad = voucherCode.trim().length >= 5 && !voucherKnown;
  const applied = method === 'voucher' ? Math.min(voucherValue, total) : 0;
  const remainder = total - applied; // owed after voucher

  const acct = CREDIT_ACCOUNTS.find((a) => a.id === creditCustomer);
  const downNow = method === 'credit' ? Math.round((total * creditPct) / 100) : 0;
  const deferred = method === 'credit' ? total - downNow : 0;

  // Insurance co-pay split
  const insurer = INSURERS.find((i) => i.id === insurerId);
  const eligible = insuranceEligible(cart);
  const nonEligible = total - eligible;
  const covered = insurer ? Math.round((eligible * insurer.coverPct) / 100) : 0;
  const patientDue = total - covered; // co-pay the drawer collects
  const memberOk = memberId.trim().length >= 4;

  let canConfirm = false;
  let change = 0;
  let methodLabel = '';
  if (method === 'cash') {
    change = tendered != null ? tendered - total : 0;
    canConfirm = tendered != null && tendered >= total;
    methodLabel = 'نقدي';
  } else if (method === 'card') {
    canConfirm = true;
    methodLabel = 'بطاقة';
  } else if (method === 'voucher') {
    methodLabel = remainder > 0 ? 'قسيمة + نقدي' : 'قسيمة';
    if (applied <= 0) {
      canConfirm = false;
    } else if (remainder <= 0) {
      canConfirm = true;
    } else {
      change = tendered != null ? tendered - remainder : 0;
      canConfirm = tendered != null && tendered >= remainder;
    }
  } else if (method === 'credit') {
    canConfirm = !!acct;
    methodLabel = 'آجل';
  } else if (method === 'insurance') {
    methodLabel = covered > 0 ? 'تأمين + نقدي' : 'تأمين';
    if (patientDue <= 0) {
      canConfirm = !!insurer && memberOk;
    } else {
      change = tendered != null ? tendered - patientDue : 0;
      canConfirm = !!insurer && memberOk && tendered != null && tendered >= patientDue;
    }
  }

  const confirm = () => {
    onConfirm({
      method,
      methodLabel,
      tendered: (method === 'cash' || method === 'voucher' || method === 'insurance') ? tendered : null,
      applied: method === 'insurance' ? covered : applied,
      downNow,
      change: change > 0 ? change : 0,
      deferred,
      customerName: method === 'insurance' && insurer ? insurer.ar : (acct ? acct.ar : null),
      insurer: insurer ? { ar: insurer.ar, en: insurer.en, coverPct: insurer.coverPct } : null,
      memberId: method === 'insurance' ? memberId.trim() : null,
      covered: method === 'insurance' ? covered : 0,
      patientDue: method === 'insurance' ? patientDue : 0,
    });
  };

  const methods = [
    { id: 'cash', icon: 'banknote', ar: 'نقدي', en: 'Cash' },
    { id: 'card', icon: 'credit-card', ar: 'بطاقة', en: 'Card' },
    { id: 'voucher', icon: 'ticket', ar: 'قسيمة', en: 'Voucher' },
    { id: 'insurance', icon: 'shield-plus', ar: 'تأمين', en: 'Insurance' },
    { id: 'credit', icon: 'calendar-clock', ar: 'آجل', en: 'Credit' },
  ];

  return (
    <div className="tender-layout" data-screen-label="Tender — payment">
      <div className="tender-main">
        <div className="catalogue-freshness-line">
          <Button intent="ghost" onClick={onBack}>‹ الرجوع للسلة</Button>
        </div>

        <div className="amount-due-card">
          <span className="amount-due-card__label">المطلوب دفعه (Amount due)</span>
          <span className="amount-due-card__value" dir="ltr">{formatMinor(total)}</span>
        </div>

        <div className="method-grid method-grid--four" role="radiogroup" aria-label="طريقة الدفع">
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={method === m.id}
              className={`method-card${method === m.id ? ' method-card--selected' : ''}`}
              onClick={() => selectMethod(m.id)}
            >
              <span><i data-lucide={m.icon}></i></span>
              {m.ar}
              <small>{m.en}</small>
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <div className="tender-slots">
            <div className="tender-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <span className="tender-row__label">المبلغ المستلم</span>
              <span className="tender-row__value" style={{ minWidth: 240, flex: 1 }}>
                <AmountPad value={tendered} onChange={setTendered} />
                <span className="quick-amounts" style={{ marginTop: 'var(--space-2)' }}>
                  {quickAmounts(total).map((v, i) => (
                    <button
                      key={v}
                      type="button"
                      className={`quick-amount-btn${tendered === v ? ' quick-amount-btn--selected' : ''}${i === 0 ? ' quick-amount-btn--label' : ''}`}
                      onClick={() => setTendered(v)}
                    >
                      {i === 0 ? 'بالضبط' : <span dir="ltr">{formatMinor(v)}</span>}
                    </button>
                  ))}
                </span>
              </span>
            </div>
            <div className="tender-row tender-row--totals">
              <span className="tender-row__label">الباقي للعميل</span>
              <span className="tender-row__value">
                <MoneyRoll v={change > 0 ? change : 0} className={change > 0 ? 'change-row__value--positive' : ''} />
              </span>
            </div>
          </div>
        )}

        {method === 'card' && (
          <div className="tender-slots">
            <div className="tender-row">
              <span className="tender-row__label">جهاز الدفع</span>
              <span className="tender-row__body">أكمل العملية على جهاز البطاقات ثم أكّد البيع. (Complete on the card terminal, then confirm.)</span>
            </div>
            <div className="tender-row tender-row--totals">
              <span className="tender-row__label">المبلغ المخصوم</span>
              <span className="tender-row__value"><Money v={total} /></span>
            </div>
          </div>
        )}

        {method === 'voucher' && (
          <React.Fragment>
            <div className="tender-slots">
              <div className="tender-row">
                <span className="tender-row__label">رمز القسيمة</span>
                <span className="tender-row__value voucher-field">
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="VCH-000"
                    aria-label="رمز القسيمة"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    aria-invalid={voucherBad}
                  />
                  {voucherKnown && <span className="voucher-applied" dir="ltr">−{formatMinor(applied)}</span>}
                </span>
              </div>
              {voucherKnown && remainder > 0 && (
                <React.Fragment>
                  <div className="tender-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <span className="tender-row__label">الباقي نقدًا</span>
                    <span className="tender-row__value" style={{ minWidth: 240, flex: 1 }}>
                      <AmountPad value={tendered} onChange={setTendered} />
                      <span className="quick-amounts" style={{ marginTop: 'var(--space-2)' }}>
                        {quickAmounts(remainder).map((v, i) => (
                          <button
                            key={v}
                            type="button"
                            className={`quick-amount-btn${tendered === v ? ' quick-amount-btn--selected' : ''}${i === 0 ? ' quick-amount-btn--label' : ''}`}
                            onClick={() => setTendered(v)}
                          >
                            {i === 0 ? 'بالضبط' : <span dir="ltr">{formatMinor(v)}</span>}
                          </button>
                        ))}
                      </span>
                    </span>
                  </div>
                  <div className="tender-row tender-row--totals">
                    <span className="tender-row__label">الباقي للعميل</span>
                    <span className="tender-row__value">
                      <MoneyRoll v={change > 0 ? change : 0} className={change > 0 ? 'change-row__value--positive' : ''} />
                    </span>
                  </div>
                </React.Fragment>
              )}
              {voucherKnown && remainder <= 0 && (
                <div className="tender-row tender-row--totals">
                  <span className="tender-row__label">الحالة</span>
                  <span className="tender-row__value change-row__value--positive">مغطّى بالكامل بالقسيمة — لا يوجد باقٍ نقدي</span>
                </div>
              )}
            </div>
            {voucherBad && <p className="voucher-error">رمز القسيمة غير معروف.</p>}
            <p className="voucher-hint" dir="ltr">Demo vouchers: VCH-100 · VCH-250 · VCH-500</p>
          </React.Fragment>
        )}

        {method === 'credit' && (
          <React.Fragment>
            <div className="account-grid" role="radiogroup" aria-label="حساب البيع الآجل">
              {CREDIT_ACCOUNTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={creditCustomer === a.id}
                  className={`account-row${creditCustomer === a.id ? ' account-row--selected' : ''}`}
                  onClick={() => setCreditCustomer(a.id)}
                >
                  <span className="account-row__avatar"><i data-lucide={a.kind === 'company' ? 'building-2' : 'user'}></i></span>
                  <span className="account-row__main">
                    <span className="account-row__name">{a.ar}</span>
                    <span className="account-row__meta" dir="ltr">{a.en} · رصيد سابق {formatMinor(a.balance)}</span>
                  </span>
                  <span className="account-row__kind">{KIND_LABEL[a.kind]}</span>
                </button>
              ))}
            </div>
            <div className="tender-slots">
              <div className="tender-row">
                <span className="tender-row__label">دفعة مقدّمة الآن</span>
                <span className="tender-row__value">
                  <span className="quick-amounts">
                    {CREDIT_PCTS.map((o) => (
                      <button
                        key={o.pct}
                        type="button"
                        className={`quick-amount-btn quick-amount-btn--label${creditPct === o.pct ? ' quick-amount-btn--selected' : ''}`}
                        onClick={() => setCreditPct(o.pct)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </span>
                </span>
              </div>
              <div className="tender-row">
                <span className="tender-row__label">يُدفع الآن (نقدًا)</span>
                <span className="tender-row__value"><Money v={downNow} /></span>
              </div>
              <div className="tender-row tender-row--totals">
                <span className="tender-row__label">الرصيد الآجل</span>
                <span className="tender-row__value tender-row__value--deferred" dir="ltr">{formatMinor(deferred)}</span>
              </div>
            </div>
            {!acct && <p className="voucher-hint">اختر العميل أو الشركة لتسجيل البيع الآجل باسمه.</p>}
          </React.Fragment>
        )}

        {method === 'insurance' && (
          <React.Fragment>
            <div className="account-grid" role="radiogroup" aria-label="جهة التأمين">
              {INSURERS.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  role="radio"
                  aria-checked={insurerId === i.id}
                  className={`account-row${insurerId === i.id ? ' account-row--selected' : ''}`}
                  onClick={() => setInsurerId(i.id)}
                >
                  <span className="account-row__avatar"><i data-lucide="shield-plus"></i></span>
                  <span className="account-row__main">
                    <span className="account-row__name">{i.ar}</span>
                    <span className="account-row__meta" dir="ltr">{i.en}</span>
                  </span>
                  <span className="account-row__kind account-row__kind--cover">تغطية {i.coverPct.toLocaleString('ar-EG')}٪</span>
                </button>
              ))}
            </div>
            <div className="tender-slots">
              <div className="tender-row">
                <span className="tender-row__label">رقم بطاقة التأمين</span>
                <span className="tender-row__value voucher-field">
                  <input
                    type="text"
                    dir="ltr"
                    placeholder={insurer ? `${insurer.prefix}-00000` : 'رقم العضوية'}
                    aria-label="رقم بطاقة التأمين"
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                  />
                  {insurer && memberOk && <span className="voucher-applied voucher-applied--ok" dir="ltr">✓</span>}
                </span>
              </div>
              {insurer && (
                <React.Fragment>
                  <div className="tender-row">
                    <span className="tender-row__label">الأصناف المغطّاة (أدوية)</span>
                    <span className="tender-row__value"><Money v={eligible} /></span>
                  </div>
                  {nonEligible > 0 && (
                    <div className="tender-row">
                      <span className="tender-row__label">غير مغطّى (مستلزمات/عناية)</span>
                      <span className="tender-row__value tender-row__value--muted"><Money v={nonEligible} /></span>
                    </div>
                  )}
                  <div className="tender-row">
                    <span className="tender-row__label">يتحمّله التأمين · {insurer.coverPct.toLocaleString('ar-EG')}٪</span>
                    <span className="tender-row__value insurance-covered" dir="ltr">−{formatMinor(covered)}</span>
                  </div>
                </React.Fragment>
              )}
              {insurer && patientDue > 0 && (
                <React.Fragment>
                  <div className="tender-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <span className="tender-row__label">مساهمة المريض نقدًا</span>
                    <span className="tender-row__value" style={{ minWidth: 240, flex: 1 }}>
                      <AmountPad value={tendered} onChange={setTendered} />
                      <span className="quick-amounts" style={{ marginTop: 'var(--space-2)' }}>
                        {quickAmounts(patientDue).map((v, i) => (
                          <button
                            key={v}
                            type="button"
                            className={`quick-amount-btn${tendered === v ? ' quick-amount-btn--selected' : ''}${i === 0 ? ' quick-amount-btn--label' : ''}`}
                            onClick={() => setTendered(v)}
                          >
                            {i === 0 ? 'بالضبط' : <span dir="ltr">{formatMinor(v)}</span>}
                          </button>
                        ))}
                      </span>
                    </span>
                  </div>
                  <div className="tender-row tender-row--totals">
                    <span className="tender-row__label">الباقي للعميل</span>
                    <span className="tender-row__value">
                      <MoneyRoll v={change > 0 ? change : 0} className={change > 0 ? 'change-row__value--positive' : ''} />
                    </span>
                  </div>
                </React.Fragment>
              )}
              {insurer && patientDue <= 0 && (
                <div className="tender-row tender-row--totals">
                  <span className="tender-row__label">مساهمة المريض</span>
                  <span className="tender-row__value change-row__value--positive">مغطّى بالكامل — لا توجد مساهمة نقدية</span>
                </div>
              )}
            </div>
            {!insurer && <p className="voucher-hint">اختر جهة التأمين ثم أدخل رقم بطاقة العضوية لاحتساب التغطية.</p>}
            {insurer && !memberOk && <p className="voucher-hint">أدخل رقم بطاقة التأمين لاعتماد المطالبة.</p>}
          </React.Fragment>
        )}

        <div>
          <Button intent="primary" size="lg" disabled={!canConfirm} onClick={confirm}>
            {method === 'credit' ? 'تسجيل البيع الآجل وطباعة الإيصال' : 'تأكيد البيع وطباعة الإيصال'}
          </Button>
        </div>
      </div>

      <aside className="cart-pane" aria-label="ملخص الطلب">
        <div className="handoff-summary">
          <div className="handoff-summary__banner">
            <span className="handoff-summary__banner-icon">✓</span>
            تم إرسال السلة للدفع
          </div>
          <div className="handoff-summary__title">ملخص الطلب</div>
          <div className="cart-pane__body">
            <ul className="cart-pane__line-list">
              {cart.map((line) => (
                <li key={line.lineId} className="cart-pane__line-list-item">
                  <div className="line-item-row">
                    <div className="line-item-row__main">
                      <span className="line-item-row__name">{line.ar}</span>
                    </div>
                    <div className="line-item-row__qty-price">
                      <span className="mono" dir="ltr">×{line.qty}</span>
                      <span className="line-item-row__subtotal"><Money v={line.price * line.qty} /></span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="cart-pane__footer">
            <div className="totals-rows">
              <div className="totals-row"><span>المجموع</span><Money v={subtotal} /></div>
              <div className="totals-row"><span>ض.ق.م ١٤٪</span><Money v={vat} /></div>
              {method === 'voucher' && applied > 0 && (
                <div className="totals-row"><span>قسيمة</span><Money v={-applied} /></div>
              )}
              <div className="totals-row totals-row--grand"><span>الإجمالي</span><Money v={total} /></div>
              {method === 'insurance' && insurer && (
                <React.Fragment>
                  <div className="totals-row"><span>يتحمّله التأمين</span><Money v={-covered} /></div>
                  <div className="totals-row totals-row--grand"><span>مساهمة المريض</span><Money v={patientDue} /></div>
                </React.Fragment>
              )}
              {method === 'credit' && acct && (
                <React.Fragment>
                  <div className="totals-row"><span>يُدفع الآن</span><Money v={downNow} /></div>
                  <div className="totals-row"><span>آجل على {acct.ar}</span><span className="tender-row__value--deferred" dir="ltr">{formatMinor(deferred)}</span></div>
                </React.Fragment>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ── Sales history ─────────────────────────────────────────────────────── */
function SalesHistoryScreen({ receipts, onOpenReceipt }) {
  const { DataTable, Badge, Button } = useDS();
  return (
    <div className="workspace-pad" data-screen-label="Sales history">
      <h1>المبيعات</h1>
      <p className="workspace-sub">مبيعات الوردية الحالية — تُسجَّل محليًا وتُزامَن مع المنصة. اضغط «عرض» لإعادة طباعة الإيصال.</p>
      <div className="table-card">
        <DataTable
          state={receipts.length ? 'data' : 'empty'}
          emptyMessage="لا توجد مبيعات في هذه الوردية بعد."
          columns={[
            { key: 'receipt', header: 'الإيصال', render: (v) => <span className="mono" dir="ltr">{v}</span> },
            { key: 'time', header: 'الوقت', render: (v) => <span className="mono" dir="ltr">{v}</span> },
            { key: 'operator', header: 'الكاشير' },
            { key: 'items', header: 'الأصناف' },
            { key: 'method', header: 'الدفع' },
            { key: 'amount', header: 'المبلغ', render: (v) => <span className="mono" dir="ltr">{v}</span> },
            { key: 'status', header: 'الحالة', render: (v) => {
              const map = { Synced: { intent: 'success', label: 'تمت المزامنة' }, Queued: { intent: 'warning', label: 'بالانتظار' }, Credit: { intent: 'info', label: 'آجل' }, Refund: { intent: 'danger', label: 'مرتجع' } };
              const m = map[v] || map.Queued;
              return <Badge intent={m.intent}>{m.label}</Badge>;
            } },
            { key: 'sale', header: 'الإيصال', render: (v) => v ? <Button intent="ghost" onClick={() => onOpenReceipt(v)}>عرض · View</Button> : null },
          ]}
          rows={receipts}
        />
      </div>
    </div>
  );
}

/* ── Returns / refunds (مرتجعات) ───────────────────────────────────────── */
function ReturnsScreen({ receipts, onRefund, onToast }) {
  const { Button } = useDS();
  const refundable = receipts.filter((r) => r.sale && !r.sale.isZ && r.status !== 'Refund');
  const [code, setCode] = React.useState('');
  const [loaded, setLoaded] = React.useState(null);
  const [picked, setPicked] = React.useState({});

  const lookup = () => {
    const target = code.trim().toUpperCase();
    const found = refundable.find((r) => r.receipt.toUpperCase() === target);
    if (found) { setLoaded(found); setPicked({}); }
    else { onToast('warning', 'إيصال غير موجود', `لا يوجد إيصال بالرقم ${code.trim()}`); }
  };

  const toggle = (id) => setPicked((p) => ({ ...p, [id]: !p[id] }));
  const lines = loaded ? loaded.sale.lines : [];
  const lkey = (l) => l.lineId || l.id;
  const lineGross = (l) => l.price * l.qty + (l.vatable ? Math.round(l.price * l.qty * VAT_RATE) : 0);
  const refundMinor = lines.filter((l) => picked[lkey(l)]).reduce((s, l) => s + lineGross(l), 0);
  const anyPicked = refundMinor > 0;

  return (
    <div className="workspace-pad" data-screen-label="Returns">
      <div className="ws-head">
        <div className="ws-head__titles">
          <h1 className="ws-head__title">المرتجعات <small>Returns &amp; refunds</small></h1>
          <p className="ws-head__sub">استرجع إيصالًا برقمه، اختر الأصناف المرتجعة، ثم أصدر الاسترداد. الاستبدال خلال ١٤ يومًا.</p>
        </div>
      </div>

      <div className="ws-grid-2">
        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="receipt-text"></i></span>
            <h3 className="panel__title">استرجاع إيصال <small>Look up receipt</small></h3>
          </div>
          <div className="return-lookup">
            <div className="return-lookup__field">
              <input type="text" dir="ltr" placeholder="R-10229" aria-label="رقم الإيصال" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup()} autoComplete="off" />
            </div>
            <Button intent="primary" onClick={lookup}>استرجاع · Find</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {refundable.slice(-4).reverse().map((r) => (
              <button key={r.receipt} type="button" className="held-chip" onClick={() => { setCode(r.receipt); setLoaded(r); setPicked({}); }}>
                <span dir="ltr">{r.receipt}</span> <span className="mono">{r.amount}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="undo-2"></i></span>
            <h3 className="panel__title">الأصناف المرتجعة <small>Items to return</small></h3>
          </div>
          {!loaded ? (
            <p className="cart-empty__hint" style={{ maxWidth: 'none' }}>استرجع إيصالًا أولًا لعرض أصنافه.</p>
          ) : (
            <React.Fragment>
              <div className="tender-slots">
                {lines.map((l) => (
                  <div key={lkey(l)} className="return-line">
                    <button type="button" className={`return-line__check${picked[lkey(l)] ? ' return-line__check--on' : ''}`} aria-pressed={!!picked[lkey(l)]} aria-label={`اختيار ${l.ar}`} onClick={() => toggle(lkey(l))}>{picked[lkey(l)] ? '✓' : ''}</button>
                    <span className="return-line__main">
                      <span className="return-line__name">{l.ar}{l.mode === 'unit' ? ` (${l.unitLabel || 'وحدة'} مفرد)` : ''}</span>
                      <span className="return-line__meta" dir="ltr">{l.qty} × {formatMinor(l.price)}</span>
                    </span>
                    <span className="return-line__amt"><Money v={lineGross(l)} /></span>
                  </div>
                ))}
              </div>
              <div className="refund-banner">
                <span className="refund-banner__label">قيمة الاسترداد · Refund</span>
                <span className="refund-banner__value" dir="ltr">−{formatMinor(refundMinor).replace('EGP ', '')}</span>
              </div>
              <Button intent="destructive" size="lg" disabled={!anyPicked} onClick={() => { onRefund(loaded, lines.filter((l) => picked[lkey(l)]), refundMinor); setLoaded(null); setCode(''); setPicked({}); }}>
                إصدار الاسترداد وطباعة الإيصال
              </Button>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────────── */
function DashboardScreen({ operator, receipts, conn, theme, onPrintLast, onToast, onCloseShift, onOpenDrawer }) {
  const { Button } = useDS();

  const count = receipts.length;
  const cashCount = receipts.filter((r) => r.method.startsWith('نقدي')).length;
  const cardCount = receipts.filter((r) => r.method.startsWith('بطاقة')).length;
  const voucherCount = receipts.filter((r) => r.method.includes('قسيمة')).length;
  const creditRows = receipts.filter((r) => r.status === 'Credit');

  // Parse the EGP amount strings back to minor units for accurate totals
  const parse = (s) => {
    const m = /([\d,]+)\.(\d{2})/.exec(s);
    if (!m) return 0;
    return parseInt(m[1].replace(/,/g, ''), 10) * 100 + parseInt(m[2], 10);
  };
  const totalMinor = receipts.reduce((s, r) => s + parse(r.amount), 0);
  const cashDrawerMinor = receipts.filter((r) => r.method.startsWith('نقدي')).reduce((s, r) => s + parse(r.amount), 0) + 50000; // + float
  const deferredMinor = creditRows.reduce((s, r) => s + parse(r.amount), 0);

  const methodRows = [
    { k: 'نقدي (Cash)', n: cashCount, intent: 'ok' },
    { k: 'بطاقة (Card)', n: cardCount, intent: 'ok' },
    { k: 'قسيمة (Voucher)', n: voucherCount, intent: 'ok' },
    { k: 'آجل (Credit)', n: creditRows.length, intent: 'gold' },
  ];

  // Hourly sales sparkline (count per hour from receipt times)
  const HOURS = ['08', '09', '10', '11', '12', '13', '14'];
  const buckets = HOURS.map((h) => ({ h, n: receipts.filter((r) => (r.time || '').slice(0, 2) === h).length }));
  const peakN = Math.max(1, ...buckets.map((b) => b.n));
  // Top-selling items this shift (aggregate sale lines by name)
  const topMap = {};
  receipts.forEach((r) => (r.sale && r.sale.lines ? r.sale.lines : []).forEach((l) => { if (l && !r.sale.isRefund) topMap[l.ar] = (topMap[l.ar] || 0) + l.qty; }));
  const topItems = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTop = topItems.length ? topItems[0][1] : 1;

  return (
    <div className="workspace-pad" data-screen-label="Dashboard">
      <div className="ws-head">
        <div className="ws-head__titles">
          <h1 className="ws-head__title">لوحة المتابعة <small>Dashboard</small></h1>
          <p className="ws-head__sub">وردية مفتوحة منذ <span className="mono" dir="ltr">08:00</span> · {operator ? operator.name : '—'} · <span dir="ltr">TERM-01</span></p>
        </div>
        <div className="ws-head__actions">
          <Button intent="secondary" onClick={() => onToast('success', 'تقرير X (قراءة)', 'طُبع ملخص الوردية الحالي دون إغلاقها')}>تقرير X · X-report</Button>
          <Button intent="primary" onClick={onCloseShift}>إغلاق الوردية · Z-report</Button>
        </div>
      </div>

      <div className="stat-strip" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="stat-cell">
          <span className="stat-cell__k">عدد المبيعات (Sales)</span>
          <span className="stat-cell__v" dir="ltr">{count}</span>
          <span className="stat-cell__sub">هذه الوردية</span>
        </div>
        <div className="stat-cell stat-cell--gold">
          <span className="stat-cell__k">إجمالي المبيعات (Gross)</span>
          <span className="stat-cell__v" dir="ltr">{formatMinor(totalMinor)}</span>
          <span className="stat-cell__sub">شامل ض.ق.م</span>
        </div>
        <div className="stat-cell">
          <span className="stat-cell__k">النقد في الدرج (Drawer)</span>
          <span className="stat-cell__v" dir="ltr">{formatMinor(cashDrawerMinor)}</span>
          <span className="stat-cell__sub">يشمل عهدة ٥٠٠</span>
        </div>
        <div className="stat-cell">
          <span className="stat-cell__k">أرصدة آجلة (Credit)</span>
          <span className="stat-cell__v" dir="ltr">{formatMinor(deferredMinor)}</span>
          <span className="stat-cell__sub">{creditRows.length} عملية</span>
        </div>
      </div>

      <div className="ws-grid-2" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="activity"></i></span>
            <h3 className="panel__title">المبيعات بالساعة <small>Sales by hour</small></h3>
          </div>
          <div className="spark">
            {buckets.map((b) => (
              <div className="spark__col" key={b.h}>
                <span className={`spark__bar${b.n === peakN && b.n > 0 ? ' spark__bar--peak' : ''}`} style={{ height: `${Math.round((b.n / peakN) * 100)}%` }}></span>
                <span className="spark__t" dir="ltr">{b.h}</span>
              </div>
            ))}
          </div>
          <p className="ws-head__sub" style={{ margin: 0 }}>أكثر ساعة ازدحامًا: <span className="mono" dir="ltr">{buckets.reduce((a, b) => (b.n >= a.n ? b : a), buckets[0]).h}:00</span></p>
        </div>

        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="trending-up"></i></span>
            <h3 className="panel__title">الأكثر مبيعًا <small>Top items</small></h3>
          </div>
          {topItems.length === 0 ? (
            <p className="ws-head__sub" style={{ margin: 0 }}>لا مبيعات بعد في هذه الوردية.</p>
          ) : topItems.map(([name, n], i) => (
            <div className="top-item-row" key={name}>
              <span className="top-item-row__rank" dir="ltr">{i + 1}</span>
              <span className="top-item-row__name">{name}</span>
              <span className="top-item-row__bar" style={{ width: `${Math.round((n / maxTop) * 80) + 8}px` }}></span>
              <span className="top-item-row__n" dir="ltr">×{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ws-grid-3">
        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="layers"></i></span>
            <h3 className="panel__title">المبيعات حسب الوسيلة <small>By method</small></h3>
          </div>
          <div className="def-rows">
            {methodRows.map((r) => (
              <div key={r.k} className={`def-row${r.intent === 'gold' ? ' def-row--gold' : ''}`}>
                <span className="def-row__k">{r.k}</span>
                <span className="def-row__v mono" dir="ltr">{r.n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="refresh-cw"></i></span>
            <h3 className="panel__title">صحة المزامنة <small>Sync health</small></h3>
          </div>
          <div className="def-rows">
            <div className="def-row"><span className="def-row__k">آخر مزامنة</span><span className="def-row__v mono" dir="ltr">7 min ago</span></div>
            <div className="def-row"><span className="def-row__k">بالانتظار</span><span className="def-row__v mono" dir="ltr">{conn === 'online' ? 0 : 2}</span></div>
            <div className="def-row"><span className="def-row__k">الحالة</span><span className="def-row__v">{conn === 'online' ? 'متصل' : conn === 'offline' ? 'غير متصل' : conn === 'syncing' ? 'جارٍ المزامنة' : 'بطيء'}</span></div>
          </div>
          <Button intent="secondary" onClick={() => onToast('success', 'بدأت المزامنة', 'جارٍ رفع العمليات المحلية')}>مزامنة الآن · Sync now</Button>
        </div>

        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="zap"></i></span>
            <h3 className="panel__title">إجراءات سريعة <small>Quick actions</small></h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Button intent="secondary" onClick={() => { onToast('success', 'فُتح الدرج', 'سُجِّل فتح الدرج باسمك'); onOpenDrawer && onOpenDrawer(); }}>فتح الدرج · Open drawer</Button>
            <Button intent="secondary" onClick={onPrintLast}>طباعة آخر إيصال · Reprint</Button>
            <Button intent="secondary" onClick={() => onToast('success', 'بدأ الجرد النقدي', 'افتح شاشة عدّ النقد لإقفال الوردية')}>جرد نقدي · Cash count</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Inventory ─────────────────────────────────────────────────────────── */
function InventoryScreen({ onToast }) {
  const { DataTable, Badge, Button } = useDS();
  const [query, setQuery] = React.useState('');
  const [cat, setCat] = React.useState('all');

  const trimmed = query.trim().toLowerCase();
  const rows = POS_PRODUCTS
    .filter((p) => cat === 'all' || p.cat === cat)
    .filter((p) => !trimmed || p.ar.includes(query.trim()) || p.en.toLowerCase().includes(trimmed) || p.code.startsWith(trimmed))
    .map((p) => ({ ...p, stock: STOCK[p.id], st: stockState(STOCK[p.id]) }));

  const lowCount = POS_PRODUCTS.filter((p) => stockState(STOCK[p.id]) !== 'ok').length;
  const stBadge = { ok: { intent: 'success', label: 'متوفر' }, low: { intent: 'warning', label: 'منخفض' }, out: { intent: 'danger', label: 'نفد' } };

  return (
    <div className="workspace-pad" data-screen-label="Inventory">
      <div className="ws-head">
        <div className="ws-head__titles">
          <h1 className="ws-head__title">المخزون <small>Inventory</small></h1>
          <p className="ws-head__sub">كتالوج للقراءة فقط — يُحدَّث من المنصة. {lowCount > 0 && <span style={{ color: 'var(--color-warning-emphasis)' }}>{lowCount} صنف يحتاج إعادة طلب.</span>}</p>
        </div>
        <div className="ws-head__actions">
          <Button intent="ghost" onClick={() => onToast('success', 'تحديث الكتالوج', 'جارٍ جلب أحدث الأسعار والمخزون')}>تحديث · Refresh</Button>
          <Button intent="secondary" onClick={() => onToast('success', 'صُدّر الجرد', 'حُفظ ملف CSV بمستويات المخزون')}>تصدير · Export</Button>
        </div>
      </div>

      <div className="inv-toolbar">
        <input type="search" dir="rtl" placeholder="ابحث بالاسم أو الباركود… (search)" aria-label="بحث المخزون" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        <div className="cat-chips">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={`cat-chip${c.id === cat ? ' cat-chip--selected' : ''}`} onClick={() => setCat(c.id)}>
              {c.id === 'all' ? 'الكل' : c.ar}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <DataTable
          state={rows.length ? 'data' : 'empty'}
          emptyMessage="لا يوجد صنف مطابق."
          columns={[
            { key: 'ar', header: 'الصنف', render: (v, row) => <span><span style={{ fontWeight: 600 }}>{v}</span><br /><span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }} dir="ltr">{row.en}</span></span> },
            { key: 'code', header: 'الباركود', render: (v) => <span className="mono" dir="ltr">{v}</span> },
            { key: 'pack', header: 'العبوة' },
            { key: 'price', header: 'السعر', render: (v) => <span className="mono" dir="ltr">{formatMinor(v)}</span> },
            { key: 'stock', header: 'المخزون', render: (v, row) => {
              const pct = Math.min(100, Math.round((v.on / Math.max(v.par * 2, 1)) * 100));
              return (
                <span className="stock-cell">
                  <span className="mono" dir="ltr" style={{ minWidth: 28 }}>{v.on}</span>
                  <span className="stock-bar"><span className={`stock-bar__fill${row.st === 'low' ? ' stock-bar__fill--low' : row.st === 'out' ? ' stock-bar__fill--out' : ''}`} style={{ width: `${pct}%` }}></span></span>
                </span>
              );
            } },
            { key: 'st', header: 'الحالة', render: (v) => <Badge intent={stBadge[v].intent}>{stBadge[v].label}</Badge> },
          ]}
          rows={rows}
        />
      </div>
    </div>
  );
}

/* ── Settings ──────────────────────────────────────────────────────────── */
function SettingsScreen({ theme, setTheme, operator, conn, onToast }) {
  const { Button, Input } = useDS();
  const [sounds, setSounds] = React.useState(true);
  const [autoPrint, setAutoPrint] = React.useState(true);
  const [bigText, setBigText] = React.useState(false);

  const Toggle = ({ on, set, name, meta }) => (
    <div className="toggle-row">
      <span className="toggle-row__main">
        <span className="toggle-row__name">{name}</span>
        <span className="toggle-row__meta">{meta}</span>
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={name} className={`switch${on ? ' switch--on' : ''}`} onClick={() => set(!on)}></button>
    </div>
  );

  return (
    <div className="workspace-pad" data-screen-label="Settings">
      <div className="ws-head">
        <div className="ws-head__titles">
          <h1 className="ws-head__title">الإعدادات <small>Settings</small></h1>
          <p className="ws-head__sub">إعداد الجهاز والأجهزة الطرفية وتفضيلات الكاشير.</p>
        </div>
      </div>

      <div className="ws-grid-2">
        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="monitor"></i></span>
            <h3 className="panel__title">هوية الجهاز <small>Terminal identity</small></h3>
          </div>
          <Input label="اسم الجهاز (Terminal label)" description="يظهر على الإيصالات" defaultValue="TERM-01" />
          <Input label="الفرع (Branch)" defaultValue="الفرع الرئيسي — Main branch" />
          <div>
            <Button intent="primary" onClick={() => onToast('success', 'حُفظت الإعدادات', 'هوية الجهاز محدَّثة')}>حفظ · Save</Button>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="printer"></i></span>
            <h3 className="panel__title">الأجهزة الطرفية <small>Hardware</small></h3>
          </div>
          <div>
            <div className="hw-row">
              <span className="hw-row__icon"><i data-lucide="printer"></i></span>
              <span className="hw-row__main"><span className="hw-row__name">طابعة الإيصالات</span><span className="hw-row__meta" dir="ltr">EPSON TM-T20 · USB · جاهزة</span></span>
              <span className="hw-row__action"><Button intent="ghost" onClick={() => onToast('success', 'طباعة تجريبية', 'أُرسلت صفحة اختبار للطابعة')}>اختبار</Button></span>
            </div>
            <div className="hw-row">
              <span className="hw-row__icon"><i data-lucide="inbox"></i></span>
              <span className="hw-row__main"><span className="hw-row__name">درج النقود</span><span className="hw-row__meta">متصل بالطابعة · مغلق</span></span>
              <span className="hw-row__action"><Button intent="ghost" onClick={() => onToast('success', 'فُتح الدرج', 'سُجِّل فتح الدرج باسمك')}>فتح</Button></span>
            </div>
            <div className="hw-row">
              <span className="hw-row__icon"><i data-lucide="scan-barcode"></i></span>
              <span className="hw-row__main"><span className="hw-row__name">الماسح الضوئي</span><span className="hw-row__meta" dir="ltr">Keyboard wedge · نشط</span></span>
              <span className="hw-row__action"><Button intent="ghost" onClick={() => onToast('success', 'وضع الاختبار', 'امسح أي صنف للتأكد من القراءة')}>اختبار</Button></span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="sliders-horizontal"></i></span>
            <h3 className="panel__title">تفضيلات الكاشير <small>Preferences</small></h3>
          </div>
          <div>
            <div className="toggle-row">
              <span className="toggle-row__main"><span className="toggle-row__name">المظهر (Appearance)</span><span className="toggle-row__meta">داكن افتراضي · فاتح بالتبديل</span></span>
              <span className="seg" style={{ marginInlineStart: 'auto' }}>
                <button type="button" className={theme === 'light' ? 'seg--on' : ''} onClick={() => setTheme('light')}><i data-lucide="sun"></i> فاتح</button>
                <button type="button" className={theme === 'dark' ? 'seg--on' : ''} onClick={() => setTheme('dark')}><i data-lucide="moon"></i> داكن</button>
              </span>
            </div>
            <Toggle on={sounds} set={setSounds} name="أصوات التنبيه (Beeps)" meta="نغمة عند كل عملية مسح" />
            <Toggle on={autoPrint} set={setAutoPrint} name="طباعة تلقائية (Auto-print)" meta="اطبع الإيصال فور تأكيد البيع" />
            <Toggle on={bigText} set={setBigText} name="نص أكبر (Large text)" meta="حجم أكبر لشاشات اللمس" />
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="shield-check"></i></span>
            <h3 className="panel__title">الجلسة والصلاحيات <small>Session</small></h3>
          </div>
          <div className="def-rows">
            <div className="def-row"><span className="def-row__k">الكاشير الحالي</span><span className="def-row__v">{operator ? operator.name : '—'}</span></div>
            <div className="def-row"><span className="def-row__k">الصلاحية</span><span className="def-row__v">{operator ? ROLE_NAMES[operator.role] : '—'}</span></div>
            <div className="def-row"><span className="def-row__k">رمز المدير للإلغاء</span><span className="def-row__v mono" dir="ltr">٢٢٤٤٦٦ (demo)</span></div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button intent="secondary" onClick={() => onToast('success', 'تحقق من التحديثات', 'الإصدار الحالي محدَّث · v3.0')}>فحص التحديث</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Thermal receipt (printable artifact) ──────────────────────────────── */
function Receipt({ sale, printing }) {
  if (!sale) return null;
  if (sale.isZ) {
    const z = sale.z;
    const s = sale.shift;
    return (
      <div className="receipt-paper" role="document" aria-label={`تقرير Z ${sale.receipt}`}>
        <div className="rcpt-center">
          <div className="rcpt-store">صيدلية رحمة القناطر</div>
          <div className="rcpt-muted">الفرع الرئيسي — Main branch</div>
          <div className="rcpt-strong rcpt-xl" style={{ marginTop: 8 }}>تقرير إغلاق وردية</div>
          <div className="rcpt-muted">Z-REPORT · END OF SHIFT</div>
        </div>
        <hr className="rcpt-div" />
        <div className="rcpt-row"><span className="rcpt-muted">رقم Z</span><span className="rcpt-strong" dir="ltr">{sale.receipt}</span></div>
        <div className="rcpt-row"><span className="rcpt-muted">الكاشير</span><span>{sale.operatorName}</span></div>
        <div className="rcpt-row"><span className="rcpt-muted">فُتحت</span><span dir="ltr">{s.openedAt}</span></div>
        <div className="rcpt-row"><span className="rcpt-muted">أُغلقت</span><span dir="ltr">{sale.time}</span></div>
        <div className="rcpt-row"><span className="rcpt-muted">عدد العمليات</span><span dir="ltr">{sale.receiptsCount}</span></div>
        <hr className="rcpt-div" />
        <div className="rcpt-row"><span>نقدي · Cash</span><span dir="ltr">{formatMinor(z.cashSales)}</span></div>
        <div className="rcpt-row"><span>بطاقة · Card</span><span dir="ltr">{formatMinor(z.cardSales)}</span></div>
        <div className="rcpt-row"><span>قسيمة · Voucher</span><span dir="ltr">{formatMinor(z.voucherSales)}</span></div>
        <div className="rcpt-row"><span>آجل · Credit</span><span dir="ltr">{formatMinor(z.creditSales)}</span></div>
        <hr className="rcpt-div" />
        <div className="rcpt-row"><span className="rcpt-muted">عهدة افتتاحية · Float</span><span dir="ltr">{formatMinor(s.float)}</span></div>
        <div className="rcpt-row"><span className="rcpt-muted">متوقع بالدرج · Expected</span><span dir="ltr">{formatMinor(z.expectedDrawer)}</span></div>
        <div className="rcpt-row"><span className="rcpt-muted">معدود · Counted</span><span dir="ltr">{formatMinor(z.counted)}</span></div>
        <div className="rcpt-row rcpt-strong"><span>الفرق · Variance</span><span dir="ltr">{z.variance === 0 ? '0.00' : (z.variance > 0 ? '+' : '−') + formatMinor(Math.abs(z.variance)).replace('EGP ', '')}</span></div>
        <hr className="rcpt-div" />
        <div className="rcpt-strong rcpt-center">أداء الوردية · Performance</div>
        <div className="rcpt-row"><span className="rcpt-muted">عدد المبيعات</span><span dir="ltr">{z.salesCount}</span></div>
        <div className="rcpt-row"><span className="rcpt-muted">متوسط الفاتورة</span><span dir="ltr">{formatMinor(z.avgBasket || 0)}</span></div>
        <div className="rcpt-row"><span className="rcpt-muted">أصناف مباعة</span><span dir="ltr">{z.itemsSold}</span></div>
        <div className="rcpt-row"><span className="rcpt-muted">مرتجعات</span><span dir="ltr">{z.refunds}</span></div>
        {z.handover && (
          <React.Fragment>
            <hr className="rcpt-div" />
            <div className="rcpt-strong">ملاحظة للوردية التالية:</div>
            <div className="rcpt-line">{z.handover}</div>
          </React.Fragment>
        )}
        <hr className="rcpt-div" />
        <div className="rcpt-center rcpt-footer">
          <div className="rcpt-barcode" role="img" aria-label="باركود التقرير"></div>
          <div dir="ltr" className="rcpt-muted">{sale.receipt}</div>
          <div className="rcpt-strong" style={{ marginTop: 8 }}>انتهت الوردية — Shift closed</div>
        </div>
      </div>
    );
  }
  const p = sale.payment;
  return (
    <div className={`receipt-paper${printing ? ' receipt-paper--printing' : ''}`} role="document" aria-label={`إيصال ${sale.receipt}`}>
      <div className="rcpt-center">
        <div className="rcpt-store">صيدلية رحمة القناطر</div>
        <div className="rcpt-muted">الفرع الرئيسي — Main branch</div>
        <div className="rcpt-muted" dir="ltr">TERM-01 · س.ت 442-198-553</div>
        {sale.isRefund ? (
          <React.Fragment>
            <div className="rcpt-strong" style={{ marginTop: 6 }}>إشعار استرداد</div>
            <div className="rcpt-muted">Refund note · مرتجع عن <span dir="ltr">{sale.original}</span></div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div className="rcpt-strong" style={{ marginTop: 6 }}>فاتورة ضريبية مبسّطة</div>
            <div className="rcpt-muted">Simplified tax invoice</div>
          </React.Fragment>
        )}
      </div>
      <hr className="rcpt-div" />
      <div className="rcpt-row"><span className="rcpt-muted">إيصال No.</span><span className="rcpt-strong" dir="ltr">{sale.receipt}</span></div>
      <div className="rcpt-row"><span className="rcpt-muted">التاريخ Date</span><span dir="ltr">{sale.date}</span></div>
      <div className="rcpt-row"><span className="rcpt-muted">الوقت Time</span><span dir="ltr">{sale.time}</span></div>
      <div className="rcpt-row"><span className="rcpt-muted">الكاشير Cashier</span><span>{sale.operatorName}</span></div>
      <hr className="rcpt-div" />
      {sale.lines.map((l) => (
        <div className="rcpt-line" key={l.lineId || l.id}>
          <div className="rcpt-line__name">{l.ar}{l.mode === 'unit' ? ` (${l.unitLabel || 'وحدة'} مفرد)` : ''}</div>
          <div className="rcpt-line__calc">
            <span dir="ltr">{l.qty} × {formatMinor(l.price)}</span>
            <span dir="ltr">{formatMinor(l.price * l.qty)}</span>
          </div>
        </div>
      ))}
      <hr className="rcpt-div" />
      <div className="rcpt-row"><span>المجموع Subtotal</span><span dir="ltr">{formatMinor(sale.subtotal)}</span></div>
      <div className="rcpt-row"><span>ض.ق.م VAT 14%</span><span dir="ltr">{formatMinor(sale.vat)}</span></div>
      {p.method === 'voucher' && p.applied > 0 && <div className="rcpt-row"><span>قسيمة Voucher</span><span dir="ltr">−{formatMinor(p.applied)}</span></div>}
      {p.method === 'insurance' && p.covered > 0 && <div className="rcpt-row"><span>تأمين Insurance</span><span dir="ltr">−{formatMinor(p.covered)}</span></div>}
      <div className="rcpt-row rcpt-xl rcpt-strong" style={{ marginTop: 4 }}><span>{sale.isRefund ? 'المسترد REFUND' : 'الإجمالي TOTAL'}</span><span dir="ltr">{sale.isRefund ? '−' : ''}{formatMinor(sale.total)}</span></div>
      {!sale.isRefund && <hr className="rcpt-div" />}
      {!sale.isRefund && (
      <div className="rcpt-row rcpt-strong"><span>الدفع Payment</span><span>{p.methodLabel}</span></div>
      )}
      {p.method === 'cash' && p.tendered != null && (
        <React.Fragment>
          <div className="rcpt-row"><span className="rcpt-muted">المدفوع Paid</span><span dir="ltr">{formatMinor(p.tendered)}</span></div>
          <div className="rcpt-row"><span className="rcpt-muted">الباقي Change</span><span dir="ltr">{formatMinor(p.change)}</span></div>
        </React.Fragment>
      )}
      {p.method === 'voucher' && p.tendered != null && (
        <React.Fragment>
          <div className="rcpt-row"><span className="rcpt-muted">نقدًا Cash</span><span dir="ltr">{formatMinor(p.tendered)}</span></div>
          <div className="rcpt-row"><span className="rcpt-muted">الباقي Change</span><span dir="ltr">{formatMinor(p.change)}</span></div>
        </React.Fragment>
      )}
      {p.method === 'credit' && (
        <React.Fragment>
          <div className="rcpt-row"><span className="rcpt-muted">العميل Account</span><span>{p.customerName}</span></div>
          <div className="rcpt-row"><span className="rcpt-muted">مقدّم Paid now</span><span dir="ltr">{formatMinor(p.downNow)}</span></div>
          <div className="rcpt-row rcpt-strong"><span>آجل Balance due</span><span dir="ltr">{formatMinor(p.deferred)}</span></div>
        </React.Fragment>
      )}
      {p.method === 'insurance' && (
        <React.Fragment>
          <div className="rcpt-row"><span className="rcpt-muted">جهة التأمين Insurer</span><span>{p.insurer ? p.insurer.ar : p.customerName}</span></div>
          {p.memberId && <div className="rcpt-row"><span className="rcpt-muted">رقم العضوية Member</span><span dir="ltr">{p.memberId}</span></div>}
          <div className="rcpt-row rcpt-strong"><span>مساهمة المريض Co-pay</span><span dir="ltr">{formatMinor(p.patientDue)}</span></div>
          {p.tendered != null && (
            <React.Fragment>
              <div className="rcpt-row"><span className="rcpt-muted">نقدًا Cash</span><span dir="ltr">{formatMinor(p.tendered)}</span></div>
              <div className="rcpt-row"><span className="rcpt-muted">الباقي Change</span><span dir="ltr">{formatMinor(p.change)}</span></div>
            </React.Fragment>
          )}
        </React.Fragment>
      )}
      {sale.lines.some((l) => l.rx) && (
        <React.Fragment>
          <hr className="rcpt-div" />
          <div className="rcpt-strong rcpt-center" style={{ marginBottom: 4 }}>إرشادات الدواء — Medication labels</div>
          {sale.lines.filter((l) => l.rx).map((l) => (
            <div className="rcpt-label" key={l.lineId || l.id}>
              <div className="rcpt-label__title">صيدلية رحمة القناطر</div>
              <div className="rcpt-label__name">{l.ar}</div>
              <div className="rcpt-label__dose">{l.dosage ? l.dosage : 'حسب إرشادات الطبيب'}</div>
              {l.rxRef && <div className="rcpt-muted" dir="rtl">وصفة: {l.rxRef}</div>}
            </div>
          ))}
        </React.Fragment>
      )}
      <hr className="rcpt-div" />
      <div className="rcpt-center rcpt-footer">
        <div className="rcpt-barcode" role="img" aria-label="باركود الإيصال"></div>
        <div dir="ltr" className="rcpt-muted">{sale.receipt}</div>
        <div className="rcpt-strong" style={{ marginTop: 8 }}>شكرًا لتعاملكم معنا</div>
        <div className="rcpt-muted">الاستبدال خلال 14 يومًا بالإيصال — Returns within 14 days</div>
      </div>
    </div>
  );
}

function ReceiptOverlay({ sale, printing, onClose }) {
  const { Button } = useDS();
  if (!sale) return null;
  const isZ = sale.isZ;
  return (
    <div className="receipt-overlay" onClick={isZ ? undefined : onClose}>
      <div className="receipt-shell" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-slot">
          <div className="receipt-printer-lip"></div>
          <Receipt sale={sale} printing={printing} />
        </div>
        <div className="receipt-actions">
          <Button intent="secondary" onClick={() => window.print()}>طباعة · Print</Button>
          <Button intent="primary" onClick={onClose}>{isZ ? 'إنهاء الوردية · Finish' : 'تم · Done'}</Button>
        </div>
      </div>
    </div>
  );
}

/* ── Open shift ────────────────────────────────────────────────────────── */
const FLOAT_OPTIONS = [50000, 75000, 100000, 150000];

function OpenShiftScreen({ operator, onOpen }) {
  const { Button } = useDS();
  const [float, setFloat] = React.useState(50000);
  const now = new Date();
  return (
    <div className="center-stage" data-screen-label="Open shift">
      <div className="shift-pane">
        <div className="shift-pane__crest"><i data-lucide="lock-open"></i></div>
        <div>
          <h1 className="shift-pane__title">فتح وردية <small>Open shift</small></h1>
          <p className="shift-pane__sub">{operator.name} · {ROLE_NAMES[operator.role]} · {now.toLocaleDateString('en-GB')} · <span dir="ltr">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></p>
        </div>
        <div>
          <p className="ws-section__label" style={{ marginBottom: 'var(--space-2)' }}>العهدة الافتتاحية · Opening float</p>
          <AmountPad value={float} onChange={setFloat} />
          <div className="quick-amounts" style={{ marginTop: 'var(--space-3)' }}>
            {FLOAT_OPTIONS.map((v) => (
              <button key={v} type="button" className={`quick-amount-btn${float === v ? ' quick-amount-btn--selected' : ''}`} onClick={() => setFloat(v)}>
                <span dir="ltr">{formatMinor(v)}</span>
              </button>
            ))}
          </div>
        </div>
        <Button intent="primary" size="lg" disabled={!float} onClick={() => onOpen(float)}>فتح الوردية وبدء البيع · Open &amp; start</Button>
      </div>
    </div>
  );
}

/* ── Close shift (Z-report) ────────────────────────────────────────────── */
function CloseShiftScreen({ shift, operator, receipts, onCancel, onClose }) {
  const { Button } = useDS();
  const parse = (s) => {
    const m = /([\d,]+)\.(\d{2})/.exec(s);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) * 100 + parseInt(m[2], 10) : 0;
  };
  const cashSales = receipts.filter((r) => r.method.startsWith('نقدي')).reduce((s, r) => s + parse(r.amount), 0);
  const cardSales = receipts.filter((r) => r.method.startsWith('بطاقة')).reduce((s, r) => s + parse(r.amount), 0);
  const voucherSales = receipts.filter((r) => r.method.includes('قسيمة')).reduce((s, r) => s + parse(r.amount), 0);
  const creditSales = receipts.filter((r) => r.status === 'Credit').reduce((s, r) => s + parse(r.amount), 0);
  const expectedDrawer = shift.float + cashSales;

  /* Denomination count — the instrument refuses to round: cash is tallied
   * note-by-note and coin-by-coin, variance recomputes live. EGP minor units. */
  const DENOMS = [
    { v: 20000 }, { v: 10000 }, { v: 5000 }, { v: 2000 }, { v: 1000 }, { v: 500 },
    { v: 100 }, { v: 50 }, { v: 25 },
  ];
  const NOTES = DENOMS.filter((d) => d.v >= 500);
  const COINS = DENOMS.filter((d) => d.v < 500);
  const [counts, setCounts] = React.useState({});
  const [touched, setTouched] = React.useState(false);
  const [handover, setHandover] = React.useState('');
  const setCount = (v, n) => { setCounts((c) => ({ ...c, [v]: Math.max(0, n || 0) })); setTouched(true); };
  const bump = (v, delta) => { setCounts((c) => ({ ...c, [v]: Math.max(0, (c[v] || 0) + delta) })); setTouched(true); };
  const countedTotal = DENOMS.reduce((s, d) => s + (counts[d.v] || 0) * d.v, 0);
  const piecesCounted = DENOMS.reduce((s, d) => s + (counts[d.v] || 0), 0);
  const counted = touched ? countedTotal : null;
  const variance = counted != null ? counted - expectedDrawer : 0;
  const vClass = variance === 0 ? 'variance--zero' : variance > 0 ? 'variance--over' : 'variance--short';
  const vLabel = variance === 0 ? 'مطابق' : variance > 0 ? 'فائض' : 'عجز';

  const denomRow = (d) => {
    const n = counts[d.v] || 0;
    const isNote = d.v >= 500;
    const faceNum = d.v >= 100 ? d.v / 100 : d.v;
    const unit = d.v >= 100 ? 'ج.م' : 'قرش';
    return (
      <div key={d.v} className={`denom-row${n ? ' denom-row--filled' : ''}`}>
        <span className={`denom-face denom-face--${isNote ? 'note' : 'coin'}`}>
          <span className="denom-face__num mono" dir="ltr">{faceNum}</span>
          <span className="denom-face__unit">{unit}</span>
        </span>
        <div className="denom-stepper">
          <button type="button" onClick={() => bump(d.v, -1)} disabled={!n} aria-label="إنقاص">−</button>
          <input dir="ltr" inputMode="numeric" value={n} onChange={(e) => setCount(d.v, parseInt((e.target.value || '').replace(/\D/g, ''), 10) || 0)} aria-label={`عدد فئة ${faceNum} ${unit}`} />
          <button type="button" onClick={() => bump(d.v, 1)} aria-label="زيادة">+</button>
        </div>
        <span className={`denom-ext mono${n ? '' : ' denom-ext--empty'}`} dir="ltr">{n ? formatMinor(n * d.v) : '—'}</span>
      </div>
    );
  };

  // Cashier performance figures for this shift
  const salesCount = receipts.filter((r) => r.status !== 'Refund').length;
  const grossAll = receipts.reduce((s, r) => s + parse(r.amount), 0);
  const avgBasket = salesCount ? Math.round(grossAll / salesCount) : 0;
  const refunds = receipts.filter((r) => r.status === 'Refund').length;
  const itemsSold = receipts.reduce((s, r) => s + (r.sale && r.sale.lines && !r.sale.isRefund ? r.sale.lines.reduce((a, l) => a + l.qty, 0) : 0), 0);

  return (
    <div className="workspace-pad" data-screen-label="Close shift — Z-report">
      <div className="ws-head">
        <div className="ws-head__titles">
          <h1 className="ws-head__title">إغلاق الوردية <small>Z-report</small></h1>
          <p className="ws-head__sub">{operator.name} · فُتحت <span dir="ltr">{shift.openedAt}</span> · {receipts.length} عملية</p>
        </div>
        <div className="ws-head__actions">
          <Button intent="ghost" onClick={onCancel}>إلغاء · Cancel</Button>
        </div>
      </div>

      <div className="ws-grid-2">
        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="layers"></i></span>
            <h3 className="panel__title">ملخص المبيعات <small>Sales summary</small></h3>
          </div>
          <div className="def-rows">
            <div className="def-row"><span className="def-row__k">نقدي · Cash</span><span className="def-row__v mono" dir="ltr">{formatMinor(cashSales)}</span></div>
            <div className="def-row"><span className="def-row__k">بطاقة · Card</span><span className="def-row__v mono" dir="ltr">{formatMinor(cardSales)}</span></div>
            <div className="def-row"><span className="def-row__k">قسيمة · Voucher</span><span className="def-row__v mono" dir="ltr">{formatMinor(voucherSales)}</span></div>
            <div className="def-row def-row--gold"><span className="def-row__k">آجل · Credit</span><span className="def-row__v mono" dir="ltr">{formatMinor(creditSales)}</span></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <span className="panel__icon"><i data-lucide="award"></i></span>
            <h3 className="panel__title">أداء الصيدلي <small>Cashier performance</small></h3>
          </div>
          <div className="perf-grid">
            <div className="perf-cell"><span className="perf-cell__k">عدد المبيعات</span><span className="perf-cell__v" dir="ltr">{salesCount}</span></div>
            <div className="perf-cell"><span className="perf-cell__k">متوسط الفاتورة</span><span className="perf-cell__v" dir="ltr">{formatMinor(avgBasket)}</span></div>
            <div className="perf-cell"><span className="perf-cell__k">أصناف مباعة</span><span className="perf-cell__v" dir="ltr">{itemsSold}</span></div>
            <div className="perf-cell"><span className="perf-cell__k">مرتجعات</span><span className="perf-cell__v" dir="ltr">{refunds}</span></div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBlock: 'var(--space-5)' }}>
        <div className="panel__head">
          <span className="panel__icon"><i data-lucide="wallet"></i></span>
          <h3 className="panel__title">جرد الدرج <small>Cash reconciliation</small></h3>
          <span className="panel__hint">عُدّ النقد فعليًا بالفئات — لا تقريب</span>
        </div>
        <div className="recon-layout">
          <div className="recon-counts">
            <div className="denom-group">
              <p className="ws-section__label">أوراق نقدية · Notes</p>
              <div className="denom-grid">{NOTES.map(denomRow)}</div>
            </div>
            <div className="denom-group">
              <p className="ws-section__label">نقود معدنية · Coins</p>
              <div className="denom-grid">{COINS.map(denomRow)}</div>
            </div>
          </div>
          <div className="recon-tally">
            <div className="def-rows">
              <div className="def-row"><span className="def-row__k">العهدة الافتتاحية · Float</span><span className="def-row__v mono" dir="ltr">{formatMinor(shift.float)}</span></div>
              <div className="def-row"><span className="def-row__k">مبيعات نقدية · Cash sales</span><span className="def-row__v mono" dir="ltr">{formatMinor(cashSales)}</span></div>
              <div className="def-row def-row--accent"><span className="def-row__k">المتوقع في الدرج · Expected</span><span className="def-row__v mono" dir="ltr">{formatMinor(expectedDrawer)}</span></div>
            </div>
            <div className="counted-card">
              <span className="counted-card__label">النقد المعدود · Counted {touched && <span className="counted-card__pieces" dir="ltr">{piecesCounted} pc</span>}</span>
              <span className="counted-card__value mono" dir="ltr">{counted != null ? formatMinor(counted) : '—'}</span>
            </div>
            <div className="recon-variance">
              <span className="recon-variance__k">الفرق · Variance</span>
              {counted != null
                ? <span className={`variance ${vClass}`} dir="ltr">{vLabel} {formatMinor(Math.abs(variance))}</span>
                : <span className="recon-variance__pending">عُدّ النقد أولًا</span>}
            </div>
            {touched && (
              <button type="button" className="recon-reset" onClick={() => { setCounts({}); setTouched(false); }}>تصفير العد · Reset count</button>
            )}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="panel__head">
          <span className="panel__icon"><i data-lucide="sticky-note"></i></span>
          <h3 className="panel__title">ملاحظة للوردية التالية <small>Handover note</small></h3>
        </div>
        <div className="handover-field">
          <textarea
            dir="rtl"
            placeholder="مثال: الطابعة تحتاج ورق · نقص إنسولين · عهدة سُلّمت للمدير"
            aria-label="ملاحظة التسليم"
            value={handover}
            onChange={(e) => setHandover(e.target.value)}
          ></textarea>
        </div>
      </div>

      <div className="shift-pane__actions" style={{ maxWidth: 480 }}>
        <Button intent="primary" size="lg" disabled={counted == null} onClick={() => onClose({ counted, variance, expectedDrawer, cashSales, cardSales, voucherSales, creditSales, salesCount, avgBasket, itemsSold, refunds, handover })}>
          طباعة تقرير Z وإغلاق الوردية
        </Button>
      </div>
    </div>
  );
}

/* ── Audit trail (سجل المراجعة) ─────────────────────────────────────────── */
function AuditScreen({ audit }) {
  const iconFor = { ok: 'check-circle-2', info: 'info', warning: 'alert-triangle', danger: 'shield-alert' };
  return (
    <div className="workspace-pad" data-screen-label="Audit trail">
      <div className="ws-head">
        <div className="ws-head__titles">
          <h1 className="ws-head__title">سجل المراجعة <small>Audit trail</small></h1>
          <p className="ws-head__sub">كل إجراء حسّاس مُسجَّل ومنسوب لصاحبه بالوقت — لا يُحذف. (Every sensitive action, attributed and time-stamped.)</p>
        </div>
      </div>
      <div className="table-card">
        {audit.map((e) => (
          <div key={e.id} className="audit-row">
            <span className={`audit-row__icon audit-row__icon--${e.intent}`}><i data-lucide={iconFor[e.intent] || 'dot'}></i></span>
            <span className="audit-row__main">
              <span className="audit-row__what">{e.what}</span>
              <span className="audit-row__who">{e.who}</span>
            </span>
            <span className="audit-row__time" dir="ltr">{e.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Customer-facing display (second screen) ───────────────────────────── */
function CustomerDisplay({ cart, thanks, onClose }) {
  const { subtotal, vat, total } = cartTotals(cart);
  return (
    <div className="cfd-overlay" data-screen-label="Customer display">
      <div className="cfd-top">
        <span className="cfd-top__brand">
          <img src="pos/pos-pulse-logo.svg" alt="" />
          صيدلية رحمة القناطر
        </span>
        <button type="button" className="cfd-close" onClick={onClose}>إغلاق شاشة العميل · Close</button>
      </div>
      <div className="cfd-body">
        {thanks ? (
          <div className="cfd-items" style={{ gridColumn: '1 / -1' }}>
            <div className="cfd-thanks">
              <span className="cfd-thanks__check">✓</span>
              <div className="cfd-thanks__word">شكرًا لتعاملكم معنا</div>
              {thanks.change > 0 && <div className="cfd-thanks__change" dir="ltr">الباقي {formatMinor(thanks.change)}</div>}
              <div className="cfd-thanks__ref" dir="ltr">{thanks.receipt}</div>
            </div>
          </div>
        ) : cart.length === 0 ? (
          <div className="cfd-items">
            <div className="cfd-empty">
              <img className="cfd-welcome-mark" src="pos/pos-pulse-logo.svg" alt="" />
              <div className="cfd-empty__word">أهلًا بك</div>
              <div>نتمنى لك تسوقًا سعيدًا — Welcome</div>
            </div>
          </div>
        ) : (
          <div className="cfd-items">
            {cart.map((l, i) => (
              <div key={l.lineId} className={`cfd-item${i === cart.length - 1 ? ' cfd-item--new' : ''}`}>
                <span className="cfd-item__name">{l.ar} <span className="cfd-item__qty" dir="ltr">×{l.qty}</span></span>
                <span className="cfd-item__price" dir="ltr">{formatMinor(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
        )}
        {thanks ? null : (
        <div className="cfd-total">
          <div className="cfd-total__card">
            <div className="cfd-total__label">الإجمالي المطلوب · Total</div>
            <div className="cfd-total__value" dir="ltr">{formatMinor(total)}</div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

/* ── App shell ─────────────────────────────────────────────────────────── */
const POS_NAV = [
  { id: 'dashboard', ar: 'لوحة المتابعة', en: 'Dashboard', icon: 'layout-dashboard' },
  { id: 'cart', ar: 'نقطة البيع', en: 'Sale', icon: 'shopping-cart' },
  { id: 'sales', ar: 'المبيعات', en: 'Sales', icon: 'receipt-text' },
  { id: 'returns', ar: 'المرتجعات', en: 'Returns', icon: 'undo-2' },
  { id: 'audit', ar: 'سجل المراجعة', en: 'Audit', icon: 'shield-check' },
  { id: 'inventory', ar: 'المخزون', en: 'Inventory', icon: 'package' },
  { id: 'settings', ar: 'الإعدادات', en: 'Settings', icon: 'settings' },
];

const CONN_CYCLE = ['online', 'degraded', 'offline', 'syncing'];
const CONN_MESSAGES = {
  degraded: 'الاتصال بطيء — Connection slow',
  offline: 'غير متصل — البيع من قائمة الانتظار المحلية (Offline — selling from local queue)',
  syncing: 'جارٍ المزامنة… (Syncing…)',
};

function PosApp() {
  const DS = useDS();
  const { NavRail, Toast, StatusBanner, ConnectionIndicator, OperatorBadge } = DS;

  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem('pos-v3-theme') || 'dark'; } catch (e) { return 'dark'; }
  });
  const [operator, setOperator] = React.useState(null);
  const [shift, setShift] = React.useState(null);
  const [route, setRoute] = React.useState('cart');
  const [conn, setConn] = React.useState('online');
  const [cart, setCart] = React.useState([]);
  const [tender, setTender] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [viewReceipt, setViewReceipt] = React.useState(null);
  const [booting, setBooting] = React.useState(() => {
    try { return !sessionStorage.getItem('pos-v3-booted'); } catch (e) { return true; }
  });
  const [bootOut, setBootOut] = React.useState(false);
  const [heldSales, setHeldSales] = React.useState([]);
  const [heldCounter, setHeldCounter] = React.useState(0);
  const [showCustomer, setShowCustomer] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  const [scanPulse, setScanPulse] = React.useState(0);
  const [drawerChange, setDrawerChange] = React.useState(null);
  const [cfdThanks, setCfdThanks] = React.useState(null);
  const [queue, setQueue] = React.useState([]);
  const [syncingNum, setSyncingNum] = React.useState(null);
  const [audit, setAudit] = React.useState(() => [
    { id: 2, time: '09:58', who: 'منى خليل', what: 'فتح الدرج — بيع نقدي R-10230', intent: 'info' },
    { id: 1, time: '08:00', who: 'منى خليل', what: 'فتح وردية — عهدة EGP 500.00', intent: 'ok' },
  ]);
  const auditSeq = React.useRef(2);
  const searchRef = React.useRef(null);
  const [receipts, setReceipts] = React.useState(() => {
    const mk = (receipt, time, operatorName, lines, payment, status) => {
      const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const vat = lines.reduce((s, l) => s + (l.vatable ? Math.round(l.price * l.qty * VAT_RATE) : 0), 0);
      return {
        receipt, time,
        operator: `${operatorName.split(' ')[0]} ${operatorName.split(' ')[1][0]}.`,
        items: lines.reduce((s, l) => s + l.qty, 0),
        method: payment.customerName ? `${payment.methodLabel} · ${payment.customerName}` : payment.methodLabel,
        amount: formatMinor(subtotal + vat),
        status,
        sale: { receipt, date: '12/06/2026', time, operatorName, lines, subtotal, vat, total: subtotal + vat, payment },
      };
    };
    return [
      mk('R-10228', '09:22', 'دينا فاروق',
        [{ lineId: 'p04:pack', id: 'p04', ar: 'أموكسيسيلين ٥٠٠ مجم', qty: 2, price: 5200, mode: 'pack', vatable: false }, { lineId: 'p15:pack', id: 'p15', ar: 'شرائط قياس سكر', qty: 1, price: 18500, mode: 'pack', vatable: true }],
        { method: 'credit', methodLabel: 'آجل', applied: 0, downNow: 0, deferred: 31490, customerName: 'عيادة د. سامر للباطنة' }, 'Credit'),
      mk('R-10229', '09:41', 'منى خليل',
        [{ lineId: 'p01:pack', id: 'p01', ar: 'باراسيتامول ٥٠٠ مجم', qty: 1, price: 1800, mode: 'pack', vatable: false }, { lineId: 'p10:pack', id: 'p10', ar: 'فيتامين سي ١٠٠٠ مجم فوار', qty: 2, price: 2400, mode: 'pack', vatable: false }],
        { method: 'cash', methodLabel: 'نقدي', applied: 0, tendered: 10000, change: 3400, downNow: 0, deferred: 0, customerName: null }, 'Synced'),
      mk('R-10230', '09:58', 'منى خليل',
        [{ lineId: 'p14:pack', id: 'p14', ar: 'ترمومتر رقمي', qty: 1, price: 8500, mode: 'pack', vatable: true }],
        { method: 'card', methodLabel: 'بطاقة', applied: 0, downNow: 0, deferred: 0, customerName: null }, 'Synced'),
    ];
  });

  React.useEffect(() => { window.lucide && window.lucide.createIcons(); });
  React.useEffect(() => {
    try { localStorage.setItem('pos-v3-theme', theme); } catch (e) { /* noop */ }
  }, [theme]);

  /* Boot splash — runs once per browser session. */
  React.useEffect(() => {
    if (!booting) return;
    const t1 = window.setTimeout(() => setBootOut(true), 1700);
    const t2 = window.setTimeout(() => {
      setBooting(false);
      try { sessionStorage.setItem('pos-v3-booted', '1'); } catch (e) { /* noop */ }
    }, 2150);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [booting]);

  /* Keyboard shortcuts: F2 pay · F3 hold · F8 customer display · / search · Esc back. */
  React.useEffect(() => {
    const onKey = (e) => {
      if (!operator || !shift || booting) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
      if (e.key === '/' && !typing) { e.preventDefault(); setRoute('cart'); window.setTimeout(() => searchRef.current && searchRef.current.focus(), 60); return; }
      if (e.key === 'F2') { e.preventDefault(); if (route === 'cart' && !tender && cart.length > 0) setTender(true); return; }
      if (e.key === 'F3') { e.preventDefault(); if (route === 'cart' && !tender && cart.length > 0) holdSale(); return; }
      if (e.key === 'F8') { e.preventDefault(); setShowCustomer((s) => !s); return; }
      if (e.key === 'Escape') { if (showCustomer) setShowCustomer(false); else if (tender) setTender(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const addToCart = (p, mode, meta) => {
    const m = mode || 'pack';
    const lineId = `${p.id}:${m}`;
    const price = m === 'unit' ? unitPrice(p) : p.price;
    setCart((c) => {
      const found = c.find((l) => l.lineId === lineId);
      if (found) return c.map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l));
      return [...c, {
        lineId, id: p.id, ar: p.ar, en: p.en, code: p.code, mode: m,
        units: p.units || 1, unitLabel: p.unitLabel, packLabel: p.packLabel,
        price, qty: 1, vatable: !!p.vatable, rx: !!p.rx,
        rxRef: meta && meta.rxRef, dosage: meta && meta.dosage,
      }];
    });
    setScanPulse((n) => n + 1);
  };
  /* Switch a line between pack and single-unit pricing. */
  const switchMode = (lineId, mode) => setCart((c) => {
    const line = c.find((l) => l.lineId === lineId);
    if (!line) return c;
    const p = POS_PRODUCTS.find((x) => x.id === line.id);
    const newId = `${line.id}:${mode}`;
    const price = mode === 'unit' ? unitPrice(p) : p.price;
    const existing = c.find((l) => l.lineId === newId);
    if (existing) return c.flatMap((l) => l.lineId === newId ? [{ ...l, qty: l.qty + line.qty }] : l.lineId === lineId ? [] : [l]);
    return c.map((l) => (l.lineId === lineId ? { ...l, lineId: newId, mode, price } : l));
  });
  const inc = (id) => setCart((c) => c.map((l) => (l.lineId === id ? { ...l, qty: l.qty + 1 } : l)));
  const dec = (id) => setCart((c) => c.flatMap((l) => (l.lineId === id ? (l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []) : [l])));
  const removeLine = (id) => setCart((c) => c.filter((l) => l.lineId !== id));
  const voidSale = () => { setCart([]); setTender(false); };

  const confirmSale = (payment) => {
    const { methodLabel, change, deferred, customerName } = payment;
    const { subtotal, vat, total } = cartTotals(cart);
    const num = `R-${10229 + receipts.length}`;
    const isCredit = deferred > 0;
    const now = new Date();
    const lines = cart.map((l) => ({ lineId: l.lineId, id: l.id, ar: l.ar, en: l.en, qty: l.qty, price: l.price, mode: l.mode, unitLabel: l.unitLabel, packLabel: l.packLabel, vatable: l.vatable, rx: l.rx, rxRef: l.rxRef, dosage: l.dosage }));
    const sale = {
      receipt: num,
      date: now.toLocaleDateString('en-GB'),
      time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      operatorName: operator ? operator.name : '—',
      lines, subtotal, vat, total,
      payment,
    };
    setReceipts((r) => [
      ...r,
      {
        receipt: num,
        time: sale.time,
        operator: operator ? `${operator.name.split(' ')[0]} ${operator.name.split(' ')[1][0]}.` : '—',
        items: cart.reduce((s, l) => s + l.qty, 0),
        method: customerName ? `${methodLabel} · ${customerName}` : methodLabel,
        amount: formatMinor(total),
        status: isCredit ? 'Credit' : (conn === 'online' ? 'Synced' : 'Queued'),
        sale,
      },
    ]);
    setCart([]);
    setTender(false);
    setViewReceipt(sale); // print preview pops up
    setPrinting(true);
    window.setTimeout(() => setPrinting(false), 1400);
    logAudit(`بيع ${num} · ${methodLabel} · ${formatMinor(total)}`, 'ok');
    // Cash drawer kicks open on cash / voucher / insurance co-pay tender
    if (payment.method === 'cash' || payment.method === 'voucher' || payment.method === 'insurance') {
      setDrawerChange(change > 0 ? change : 0);
      window.setTimeout(() => setDrawerChange(null), 2600);
    }
    // Customer-facing display shows a thank-you, then resets
    if (showCustomer) {
      setCfdThanks({ change: change > 0 ? change : 0, receipt: num });
      window.setTimeout(() => setCfdThanks(null), 3600);
    }
    // Offline sales are durably captured locally and stack in the sync queue
    if (!isCredit && (conn === 'offline' || conn === 'degraded')) {
      setQueue((q) => [...q, { num, total, time: sale.time, count: cart.reduce((s, l) => s + l.qty, 0) }]);
    }
    let description = num;
    if (isCredit) description = `${num} · آجل ${formatMinor(deferred)} على ${customerName}`;
    else if (change > 0) description = `${num} · الباقي ${formatMinor(change)}`;
    setToast({
      intent: 'success',
      title: isCredit ? 'تم تسجيل بيع آجل' : 'تمت طباعة الإيصال',
      description,
    });
    window.setTimeout(() => setToast(null), 4600);
  };

  const cycleConn = () => setConn((c) => {
    const next = CONN_CYCLE[(CONN_CYCLE.indexOf(c) + 1) % CONN_CYCLE.length];
    if (next === 'offline') logAudit('انقطع الاتصال — التحويل إلى البيع المحلي', 'warning');
    else if (next === 'syncing' && queue.length > 0) logAudit(`بدء مزامنة ${queue.length} عملية محفوظة محليًا`, 'info');
    return next;
  });

  /* Sequential drain: while syncing, upload one queued sale at a time —
   * the head row flips to "uploading", commits to Synced, then leaves the
   * queue and the next advances. When empty, the link settles to online. */
  React.useEffect(() => {
    if (conn !== 'syncing') { if (syncingNum) setSyncingNum(null); return; }
    if (queue.length === 0) return;
    const head = queue[0];
    const wasLast = queue.length === 1;
    setSyncingNum(head.num);
    const t = window.setTimeout(() => {
      setReceipts((rs) => rs.map((r) => (r.receipt === head.num ? { ...r, status: 'Synced' } : r)));
      setQueue((q) => q.slice(1));
      setSyncingNum(null);
      if (wasLast) {
        logAudit('اكتملت المزامنة — رُفعت كل العمليات المحفوظة محليًا', 'ok');
        window.setTimeout(() => setConn('online'), 480);
      }
    }, 880);
    return () => window.clearTimeout(t);
  }, [conn, queue]);

  /* Park the current cart; recall restores it and clears the slot. */
  const holdSale = () => {
    if (cart.length === 0) return;
    const { total } = cartTotals(cart);
    const id = Date.now();
    const num = heldCounter + 1;
    setHeldCounter(num);
    const label = `تعليق #${num}`;
    setHeldSales((h) => [...h, { id, num, label, cart, total, count: cart.reduce((s, l) => s + l.qty, 0) }]);
    setCart([]);
    logAudit(`تعليق بيع #${num} · ${formatMinor(total)}`, 'info');
    pushToast('success', `تم تعليق البيع #${num}`, `${cart.reduce((s, l) => s + l.qty, 0)} صنف · ${formatMinor(total)}`);
  };
  const recallSale = (id) => {
    const held = heldSales.find((h) => h.id === id);
    if (!held) return;
    if (cart.length > 0) holdSale();
    setCart(held.cart);
    setHeldSales((h) => h.filter((x) => x.id !== id));
    pushToast('success', 'استُرجع البيع المعلّق', `${held.count} صنف · ${formatMinor(held.total)}`);
  };

  /* Refund: log a negative receipt + show a refund slip. */
  const refundSale = (original, lines, refundMinor) => {
    const now = new Date();
    const num = `RF-${10229 + receipts.length}`;
    const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const vat = Math.round(sub * VAT_RATE);
    const sale = {
      receipt: num,
      date: now.toLocaleDateString('en-GB'),
      time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      operatorName: operator ? operator.name : '—',
      isRefund: true,
      original: original.receipt,
      lines, subtotal: sub, vat, total: sub + vat,
      payment: { method: 'refund', methodLabel: 'استرداد نقدي', applied: 0, downNow: 0, deferred: 0, customerName: null },
    };
    setReceipts((r) => [...r, {
      receipt: num,
      time: sale.time,
      operator: operator ? `${operator.name.split(' ')[0]} ${operator.name.split(' ')[1][0]}.` : '—',
      items: lines.reduce((s, l) => s + l.qty, 0),
      method: `مرتجع · ${original.receipt}`,
      amount: '−' + formatMinor(refundMinor),
      status: 'Refund',
      sale,
    }]);
    setViewReceipt(sale);
    setPrinting(true);
    window.setTimeout(() => setPrinting(false), 1400);
    logAudit(`استرداد ${num} عن ${original.receipt} · ${formatMinor(refundMinor)}`, 'danger');
    pushToast('success', 'تم الاسترداد', `${num} · ${formatMinor(refundMinor)} عن ${original.receipt}`);
  };

  const pushToast = (intent, title, description) => {
    setToast({ intent, title, description });
    window.setTimeout(() => setToast(null), 4200);
  };
  const logAudit = (what, intent, who) => {
    auditSeq.current += 1;
    setAudit((a) => [{
      id: auditSeq.current,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      who: who || (operator ? operator.name : '—'),
      what, intent: intent || 'info',
    }, ...a]);
  };
  const reprintLast = () => {
    const last = receipts[receipts.length - 1];
    if (last && last.sale) setViewReceipt(last.sale);
    else pushToast('warning', 'لا يوجد إيصال', 'لم تُسجَّل أي عملية بعد');
  };

  const openShift = (float) => {
    setShift({ open: true, float, openedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), openedBy: operator.name });
    setRoute('cart');
    logAudit(`فتح وردية — عهدة ${formatMinor(float)}`, 'ok');
    pushToast('success', 'فُتحت الوردية', `عهدة افتتاحية ${formatMinor(float)}`);
  };

  const closeShift = (z) => {
    // Build a Z-report "receipt" and show it; closing it ends the session.
    const zSale = {
      receipt: `Z-${shift.openedAt.replace(':', '')}`,
      date: new Date().toLocaleDateString('en-GB'),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      operatorName: operator.name,
      isZ: true,
      shift,
      receiptsCount: receipts.length,
      z,
    };
    const vlabel = z.variance === 0 ? 'مطابق' : z.variance > 0 ? `فائض ${formatMinor(Math.abs(z.variance))}` : `عجز ${formatMinor(Math.abs(z.variance))}`;
    logAudit(`إغلاق وردية — جرد الدرج: ${vlabel}`, z.variance === 0 ? 'ok' : 'warning');
    setViewReceipt(zSale);
  };

  const finishCloseShift = () => {
    setViewReceipt(null);
    setShift(null);
    setOperator(null);
    setCart([]);
    setTender(false);
    setRoute('cart');
  };

  const topBar = (
    <React.Fragment>
      <header className="top-bar">
        <span className="top-bar__wordmark" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <img className="top-bar__wordmark-logo" src="pos/pos-pulse-logo.svg" alt="" width="26" height="26" />
          POS Pulse
        </span>
        <div className="identity-strip">
          <span className="identity-strip__tenant">صيدلية رحمة القناطر</span>
          <span className="identity-strip__sep">·</span>
          <span className="identity-strip__branch">الفرع الرئيسي — Main branch</span>
          <span className="identity-strip__terminal" dir="ltr">TERM-01</span>
        </div>
        <div className="top-bar__right">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setShowCustomer(true)}
            aria-label="شاشة العميل"
            title="شاشة العميل (F8)"
          >
            <span><i data-lucide="monitor"></i></span>
            شاشة العميل
          </button>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="تبديل المظهر"
          >
            <span key={`ticon-${theme}`}><i data-lucide={theme === 'dark' ? 'sun' : 'moon'}></i></span>
            {theme === 'dark' ? 'فاتح' : 'داكن'}
          </button>
          <span onClick={cycleConn} title="اضغط لتبديل حالة الاتصال (تجريبي)">
            <ConnectionIndicator state={conn} />
          </span>
          {operator && (
            <React.Fragment>
              <OperatorBadge displayName={operator.name} role={operator.role} />
              <button
                type="button"
                className="btn btn--ghost btn--md"
                onClick={() => { setOperator(null); setCart([]); setTender(false); setRoute('cart'); }}
              >
                تسجيل الخروج
              </button>
            </React.Fragment>
          )}
        </div>
      </header>
      {conn !== 'online' && <StatusBanner state={conn} message={CONN_MESSAGES[conn]} />}
    </React.Fragment>
  );

  const bootSplash = booting ? (
    <div className={`boot-splash${bootOut ? ' boot-splash--out' : ''}`}>
      <img className="boot-crest" src="pos/pos-pulse-logo.svg" alt="" />
      <div className="boot-word">POS Pulse</div>
      <div className="boot-sub">Retail Tower OS · صيدلية رحمة القناطر</div>
      <div className="boot-progress"><span className="boot-progress__fill"></span></div>
      <div className="boot-ready" dir="ltr">{bootOut ? 'TERMINAL READY' : 'Initialising TERM-01…'}</div>
    </div>
  ) : null;

  if (!operator) {
    return (
      <div className="pos-frame" data-theme={theme} dir="rtl" lang="ar">
        {bootSplash}
        {topBar}
        <SignInScreen onSignIn={(op) => { setOperator(op); setRoute('cart'); }} />
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="pos-frame" data-theme={theme} dir="rtl" lang="ar">
        {bootSplash}
        {topBar}
        <OpenShiftScreen operator={operator} onOpen={openShift} />
        <ReceiptOverlay sale={viewReceipt} printing={printing} onClose={() => (viewReceipt && viewReceipt.isZ ? finishCloseShift() : setViewReceipt(null))} />
      </div>
    );
  }

  let content;
  if (route === 'cart') {
    content = tender ? (
      <TenderScreen cart={cart} onBack={() => setTender(false)} onConfirm={confirmSale} />
    ) : (
      <SaleScreen
        cart={cart}
        onAdd={addToCart}
        onInc={inc}
        onDec={dec}
        onRemove={removeLine}
        onVoid={voidSale}
        onHandoff={() => setTender(true)}
        onHold={holdSale}
        heldSales={heldSales}
        onRecall={recallSale}
        onSwitchMode={switchMode}
        onAudit={logAudit}
        scanPulse={scanPulse}
        searchRef={searchRef}
      />
    );
  } else if (route === 'sales') {
    content = <SalesHistoryScreen receipts={receipts} onOpenReceipt={(s) => setViewReceipt(s)} />;
  } else if (route === 'returns') {
    content = <ReturnsScreen receipts={receipts} onRefund={refundSale} onToast={pushToast} />;
  } else if (route === 'audit') {
    content = <AuditScreen audit={audit} />;
  } else if (route === 'dashboard') {
    content = <DashboardScreen operator={operator} receipts={receipts} conn={conn} theme={theme} onPrintLast={reprintLast} onToast={pushToast} onCloseShift={() => setRoute('closeshift')} onOpenDrawer={() => { setDrawerChange(0); window.setTimeout(() => setDrawerChange(null), 2600); logAudit('فتح الدرج يدويًا', 'info'); }} />;
  } else if (route === 'closeshift') {
    content = <CloseShiftScreen shift={shift} operator={operator} receipts={receipts} onCancel={() => setRoute('dashboard')} onClose={closeShift} />;
  } else if (route === 'inventory') {
    content = <InventoryScreen onToast={pushToast} />;
  } else {
    content = <SettingsScreen theme={theme} setTheme={setTheme} operator={operator} conn={conn} onToast={pushToast} />;
  }

  const entries = POS_NAV.map((n) => ({
    id: n.id,
    label: (
      <span className="nav-bilabel">
        <span>{n.ar}</span>
        <small dir="ltr">{n.en}</small>
      </span>
    ),
    icon: <i data-lucide={n.icon}></i>,
  }));

  return (
    <div className="pos-frame" data-theme={theme} dir="rtl" lang="ar">
      {bootSplash}
      {topBar}
      <div className="pos-body">
        <NavRail entries={entries} activeId={route} onSelect={(id) => setRoute(id)} />
        <main className="pos-content">{content}</main>
      </div>
      {toast && (
        <div className="toast-region">
          <Toast intent={toast.intent} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />
        </div>
      )}
      {showCustomer && <CustomerDisplay cart={cart} thanks={cfdThanks} onClose={() => setShowCustomer(false)} />}
      {drawerChange != null && (
        <div className="drawer-moment">
          <div className="drawer-moment__tray">
            <span className="drawer-moment__icon"><i data-lucide="archive"></i></span>
            <span className="drawer-moment__label">
              <span className="drawer-moment__title">الدرج مفتوح · Drawer open</span>
              <span className="drawer-moment__sub">{drawerChange > 0 ? 'سلّم الباقي للعميل' : 'أغلق الدرج بعد الإيداع'}</span>
            </span>
            {drawerChange > 0 && <span className="drawer-moment__change" dir="ltr">{formatMinor(drawerChange)}</span>}
          </div>
        </div>
      )}
      {(queue.length > 0 || (conn === 'syncing' && syncingNum)) && (
        <aside className={`sync-queue${conn === 'syncing' ? ' sync-queue--active' : ''}`} dir="rtl" aria-label="قائمة الانتظار المحلية">
          <div className="sync-queue__head">
            <span className={`sync-queue__beacon sync-queue__beacon--${conn === 'syncing' ? 'sync' : 'wait'}`}></span>
            <span className="sync-queue__titles">
              <span className="sync-queue__title">قائمة الانتظار المحلية</span>
              <span className="sync-queue__en" dir="ltr">Local sync queue · {queue.length}</span>
            </span>
            {conn === 'syncing'
              ? <span className="sync-queue__pill sync-queue__pill--sync"><i data-lucide="radio-tower"></i> رفع</span>
              : <span className="sync-queue__pill sync-queue__pill--wait"><i data-lucide="hard-drive-download"></i> محلي</span>}
          </div>
          <p className="sync-queue__note">
            {conn === 'syncing'
              ? 'جارٍ الرفع إلى المركز — لا تُغلق الطرفية'
              : 'محفوظة محليًا — تُرفع تلقائيًا عند عودة الاتصال'}
          </p>
          <div className="sync-queue__list">
            {queue.map((q) => {
              const up = q.num === syncingNum;
              return (
                <div key={q.num} className={`sync-row${up ? ' sync-row--up' : ''}`}>
                  <span className={`sync-row__dot${up ? ' sync-row__dot--up' : ''}`}></span>
                  <span className="sync-row__main">
                    <span className="sync-row__num mono" dir="ltr">{q.num}</span>
                    <span className="sync-row__meta">{q.count} صنف · <span dir="ltr">{q.time}</span></span>
                  </span>
                  <span className="sync-row__right">
                    <span className="sync-row__amt mono" dir="ltr">{formatMinor(q.total)}</span>
                    <span className={`sync-row__state${up ? ' sync-row__state--up' : ''}`}>{up ? 'جارٍ الرفع…' : 'بالانتظار'}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </aside>
      )}
      <ReceiptOverlay sale={viewReceipt} printing={printing} onClose={() => (viewReceipt && viewReceipt.isZ ? finishCloseShift() : setViewReceipt(null))} />
    </div>
  );
}

window.PosApp = PosApp;
