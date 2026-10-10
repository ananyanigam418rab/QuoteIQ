import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL_CATALOG,SAMPLE_RFQ} from '../src/catalog.ts';
import {analyzeRfq,analyzeLine,parseSpec,splitRfq,summarize,buyerEmail,verifyAiExtraction} from '../src/engine.ts';
test('six sample lines parse independently without email header noise',()=>{const lines=splitRfq(SAMPLE_RFQ);assert.equal(lines.length,6);});
test('304 16ga 4x8 normalize to 0.0625 x 48 x 96 inches',()=>{const x=parseSpec('304 SS sheet 16ga 4x8 — qty 20 ASTM A240');assert.equal(x.thicknessIn,.0625);assert.equal(x.widthIn,48);assert.equal(x.lengthIn,96);assert.equal(x.grade,'304');assert.equal(x.quantity,20);});
test('0.060 inch correctly differs from 16 gauge but exact catalog matches',()=>{const x=analyzeLine('Stainless 304, 0.060 in, 48 x 96 — Qty 12, ASTM A240',INITIAL_CATALOG);assert.equal(x.matched?.sku,'RDC-SS304-060-4896');assert.equal(x.status,'review');assert.ok(x.warnings.some(x=>x.includes('inferred')));});
test('pipe diameter, schedule, length are parsed',()=>{const x=parseSpec('316L stainless pipe 2" sch 40 x 20ft — Qty 15 pcs, ASTM A312, MTR');assert.equal(x.diameterIn,2);assert.equal(x.schedule,'40');assert.equal(x.lengthIn,240);assert.equal(x.grade,'316L');});
test('never guesses a grade or pipe schedule',()=>{const x=analyzeLine('SS pipe 3 inch x 20ft — qty 10, domestic MTR',INITIAL_CATALOG);assert.equal(x.status,'clarify');assert.equal(x.matched,undefined);assert.ok(x.questions.some(q=>q.includes('grade')));assert.ok(x.questions.some(q=>q.includes('schedule')));});
test('cannot silently substitute 16ga for 18ga',()=>{const x=analyzeLine('304 stainless sheet 18ga 4x8 qty 9 ASTM A240',INITIAL_CATALOG);assert.equal(x.matched?.sku,'RDC-SS304-18G-4896');});
test('required compliance documents held for review',()=>{const x=analyzeLine('304 SS sheet 16ga 4x8 qty 20 ASTM A240 MTR COO',INITIAL_CATALOG);assert.equal(x.status,'review');assert.ok(x.warnings.some(q=>q.includes('MTR')));assert.ok(x.warnings.some(q=>q.includes('COO')));});
test('different ASTM standard never produces a matched priced line',()=>{const x=analyzeLine('304 SS sheet 16ga 4x8 qty 20 ASTM A312',INITIAL_CATALOG);assert.equal(x.matched,undefined);assert.equal(x.pricing,undefined);});
test('stock shortages held for human review',()=>{const x=analyzeLine('A36 HR plate 1/4 x 48 x 96 qty 160 ASTM A36',INITIAL_CATALOG);assert.equal(x.status,'review');assert.ok(x.warnings.some(q=>q.includes('Insufficient')));});
test('quotes total only ready or approved lines',()=>{const x=analyzeRfq(splitRfq(SAMPLE_RFQ),INITIAL_CATALOG);assert.equal(x.length,6);assert.equal(summarize(x).count,2);assert.ok(summarize(x).total>0);x[0].approved=true;assert.equal(summarize(x).count,3);});
test('buyer email contains ambiguity questions',()=>{const x=analyzeRfq(splitRfq(SAMPLE_RFQ),INITIAL_CATALOG);const mail=buyerEmail(x);assert.match(mail,/Which material grade/);assert.match(mail,/pipe schedule/);});

test('reject AI that changes quantity, grade, or requirement',()=>{
 const originals=['304 SS sheet 16ga 4x8 qty 20 ASTM A240 MTR'];
 assert.equal(verifyAiExtraction(originals,['304 SS sheet 16ga 4x8 qty 21 ASTM A240 MTR']),false);
 assert.equal(verifyAiExtraction(originals,['316L SS sheet 16ga 4x8 qty 20 ASTM A240 MTR']),false);
 assert.equal(verifyAiExtraction(originals,['304 SS sheet 16ga 4x8 qty 20 ASTM A240']),false);
 assert.equal(verifyAiExtraction(originals,originals),true);
});
