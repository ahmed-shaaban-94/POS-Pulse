import { beforeAll, describe, expect, it } from 'vitest';

import {
  freshCatalogueDb,
  handleFor,
  initCatalogueSql,
  seedProduct,
} from './__helpers__/catalogue-fixture.js';
import { createProductRepo } from '../product-repo.js';

/**
 * 009 T032 (RED) — SC-9 folding-recall corpus.
 *
 * 100% recall under both-sided folding (FR-12a/FR-12b): a stored product must be
 * found whether the query uses a different Arabic letter form (alef variants,
 * alef-maqsura, taa-marbuta), carries harakat/tatweel, or differs in English
 * case / accents. Both the stored `name_fold` and the query are folded by the
 * SAME `normalize()` — the fixture's `seedProduct` derives `name_fold` via the
 * real `normalize()`, so this corpus exercises the genuine both-sided property,
 * not a hand-tuned column.
 *
 * Each case seeds ONE product with a canonical name and queries it with a
 * folding-variant of that name; recall MUST be 1 (the product is returned).
 */

beforeAll(async () => {
  await initCatalogueSql();
});

const TENANT = 'tenant-1';

function found(r: ReturnType<ReturnType<typeof createProductRepo>['search']>, id: string): boolean {
  return r.kind === 'results' && r.items.some((p) => p.product_id === id);
}

interface Case {
  label: string;
  stored: string; // canonical name_ar / name_en seeded
  query: string; // a folding-variant the cashier might type
  english?: boolean;
}

const CASES: Case[] = [
  // ── Arabic letter-form folding (FR-12a) ──
  { label: 'alef hamza-above أ → bare ا', stored: 'أسبرين', query: 'اسبرين' },
  { label: 'alef hamza-below إ → bare ا', stored: 'إبرة', query: 'ابره' },
  { label: 'alef madda آ → bare ا', stored: 'آيبوبروفين', query: 'ايبوبروفين' },
  { label: 'alef-maqsura ى → yaa ي', stored: 'دوايى', query: 'دوايي' },
  { label: 'taa-marbuta ة → heh ه', stored: 'حبة', query: 'حبه' },
  { label: 'harakat stripped (fatha/damma/kasra)', stored: 'بَنَادُول', query: 'بنادول' },
  { label: 'tatweel (kashida) stripped', stored: 'بنــــادول', query: 'بنادول' },
  { label: 'Arabic-Indic digits ٥٠٠ → 500', stored: 'بنادول ٥٠٠', query: 'بنادول 500' },
  // ── English case / accent folding (FR-12) ──
  { label: 'uppercase → lowercase', stored: 'ASPIRIN', query: 'aspirin', english: true },
  { label: 'mixed case', stored: 'IbuProfen', query: 'ibuprofen', english: true },
  { label: 'accent stripped (é → e)', stored: 'Café Vitamin', query: 'cafe', english: true },
  // ── both-sided: query carries the diacritic, stored is bare ──
  { label: 'reverse — query has harakat, stored bare', stored: 'بنادول', query: 'بَنادُول' },
  {
    label: 'reverse — query uppercase+accent, stored lower',
    stored: 'cafe',
    query: 'CAFÉ',
    english: true,
  },
  // ── whitespace normalization ──
  { label: 'collapsed internal whitespace', stored: 'فيتامين سي', query: 'فيتامين   سي' },
];

describe('T032 — SC-9 folding-recall corpus (100% recall, both-sided)', () => {
  for (const [i, c] of CASES.entries()) {
    it(`recalls: ${c.label}`, () => {
      const db = freshCatalogueDb();
      const id = `p-${String(i)}`;
      if (c.english) {
        seedProduct(db, { product_id: id, name_ar: 'منتج', name_en: c.stored });
      } else {
        seedProduct(db, { product_id: id, name_ar: c.stored, name_en: null });
      }
      const repo = createProductRepo(handleFor(db));

      expect(found(repo.search(TENANT, c.query), id), `recall for "${c.label}"`).toBe(true);
      db.close();
    });
  }
});
