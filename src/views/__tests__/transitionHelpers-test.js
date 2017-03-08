// @flow

import { createTransition, initTransition } from '../Transition/transitionHelpers';
import { initTestTransition, assertIoRanges, ioRanges } from './transitionTestUtils';

describe('createTransition', () => {
  it('returns styleMap based on duration: A(0.1)', () => {
    const A = initTestTransition('a', [0, 1], [100, 200]);
    const styleMap = A(0.1).createAnimatedStyleMap();
    const { from: { id1: { a } } } = styleMap;
    assertIoRanges(a, ioRanges([0, 0.1], [100, 200]));
  });
});