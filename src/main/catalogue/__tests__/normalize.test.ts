import { describe, expect, it } from 'vitest';

import { normalize } from '../normalize.js';

/**
 * 009-product-search-and-barcode-lookup T005 — `normalize.ts` folding contract.
 *
 * The single folding function the read model and every query share. Matching is
 * normalization-insensitive on BOTH sides (FR-12b): the stored `name_fold` /
 * `alias_fold` / `barcode_norm` columns are folded by this same function at
 * write-time, and the query is folded by it at read-time. The decisive property
 * is therefore IDEMPOTENCE — folding an already-folded value must be a no-op, or
 * the two sides could disagree.
 *
 * Fold rules (research §R4 / locked clarifications 2026-05-30):
 *   • Arabic letters:  alef أ/إ/آ/ٱ → ا · alef-maqsura ى → ي · taa-marbuta ة → ه
 *   • strip Arabic harakat (diacritics) + tatweel (ـ)
 *   • English: lowercase + strip accents/diacritics (NFD → drop combining marks)
 *   • Numerals: Arabic-Indic ٠–٩ → Latin 0–9
 *   • Whitespace: trim + collapse internal runs to a single space
 */

describe('normalize — Arabic letter folding (FR-12a)', () => {
  it('folds every alef variant (أ إ آ ٱ) to bare alef ا', () => {
    expect(normalize('أ')).toBe('ا');
    expect(normalize('إ')).toBe('ا');
    expect(normalize('آ')).toBe('ا');
    expect(normalize('ٱ')).toBe('ا');
  });

  it('folds alef-maqsura ى to yaa ي', () => {
    expect(normalize('مصطفى')).toBe('مصطفي');
  });

  it('folds taa-marbuta ة to heh ه', () => {
    expect(normalize('قطرة')).toBe('قطره');
  });

  it('strips harakat (diacritics) — مُحَمَّد → محمد', () => {
    expect(normalize('مُحَمَّد')).toBe('محمد');
  });

  it('strips tatweel (kashida) — بـــنادول → بنادول', () => {
    expect(normalize('بـــنادول')).toBe('بنادول');
  });
});

describe('normalize — English folding (FR-12)', () => {
  it('lowercases ASCII', () => {
    expect(normalize('Panadol')).toBe('panadol');
  });

  it('strips Latin accents/diacritics — café → cafe, naïve → naive', () => {
    expect(normalize('café')).toBe('cafe');
    expect(normalize('naïve')).toBe('naive');
  });
});

describe('normalize — numerals + whitespace', () => {
  it('folds Arabic-Indic digits ٠–٩ to Latin 0–9', () => {
    expect(normalize('٥٠٠')).toBe('500');
    expect(normalize('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('trims and collapses internal whitespace runs to a single space', () => {
    expect(normalize('  panadol   500  ')).toBe('panadol 500');
    expect(normalize('a\t\nb')).toBe('a b');
  });

  it('returns empty string for empty / whitespace-only input', () => {
    expect(normalize('')).toBe('');
    expect(normalize('   ')).toBe('');
  });
});

describe('normalize — both-sided idempotence (FR-12b, load-bearing)', () => {
  const samples = ['بَنادُول ٥٠٠', 'Panadol Café 500mg', 'مصطفى   إبراهيم', 'آﻻﻡ', 'ٱلْكِتَاب', ''];

  for (const sample of samples) {
    it(`normalize(normalize(${JSON.stringify(sample)})) === normalize(${JSON.stringify(sample)})`, () => {
      const once = normalize(sample);
      expect(normalize(once)).toBe(once);
    });
  }

  it('a mixed Arabic + Latin + Arabic-Indic query folds to its canonical form', () => {
    expect(normalize('بَنادُول ٥٠٠')).toBe('بنادول 500');
  });
});
