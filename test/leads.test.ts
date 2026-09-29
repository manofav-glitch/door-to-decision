// Tap-the-lead nodes, exercised on cp-01's first ECG (answer: II, III, aVF).
import { describe, expect, it } from 'vitest';
import { compileContent } from '../src/content/compile.ts';
import { act, replay } from '../src/engine/engine.ts';

const c = compileContent(process.cwd()).cases['cvs-cp-01']!;
const at = replay(c, 'pci-capable', [{ kind: 'continue' }, { kind: 'pick', optionId: 'o1' }]);
const tap = (...leads: string[]) => act(c, at, { kind: 'leads', leads });

describe('ecg-leads node', () => {
  it('reaches the first lead question with a layout', () => {
    expect(at.nodeId).toBe('ste-leads');
    expect(c.leadLayouts['ecg/cp-01-ecg-1.svg']?.leads).toHaveLength(12);
  });
  it('exact set → best, in ECG order', () => {
    const r = tap('aVF', 'II', 'III');
    expect(r.picks[0]!.grade).toBe('best');
    expect(r.leads).toEqual({ chosen: ['II', 'III', 'aVF'], answer: ['II', 'III', 'aVF'] });
    expect(r.state.nodeId).toBe('reciprocal-leads');
  });
  it('half or more found and at most one extra → acceptable', () => {
    expect(tap('II', 'III').picks[0]!.grade).toBe('acceptable');
    expect(tap('II', 'III', 'aVF', 'V1').picks[0]!.grade).toBe('acceptable');
  });
  it('otherwise → suboptimal', () => {
    expect(tap('II').picks[0]!.grade).toBe('suboptimal');
    expect(tap('I', 'aVL').picks[0]!.grade).toBe('suboptimal');
    expect(tap('II', 'III', 'V1', 'V2').picks[0]!.grade).toBe('suboptimal');
  });
  it('rejects empty and unknown leads', () => {
    expect(() => tap()).toThrow(/at least one/);
    expect(() => tap('V7')).toThrow(/not a lead/);
  });
});
