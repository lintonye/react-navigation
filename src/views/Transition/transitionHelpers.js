// @flow
import invariant from 'invariant';
import _ from 'lodash';

function createIdRegexFilter(idRegexes) {
  return (id: string) => idRegexes.every(idRegex => id.match(idRegex));
}

export function initTransition(Transition, ...idRegexes) {
  return Transition && Transition(createIdRegexFilter(idRegexes));
}

export function convertStyleMap(styleMap, convertStyleValue: (styleValue: any) => any) {
  const accumulateStyle = (result, styleValue, prop) => {
    let convertedValue;
    if (_.isArray(styleValue.outputRange)) {
      const inputRange = styleValue.inputRange || [0, 1];
      convertedValue = convertStyleValue({ ...styleValue, inputRange });
    } else {
      convertedValue = styleValue;
    }
    result[prop] = convertedValue;
    return result;
  };
  const accumulateStyles = (result, style, id) => {
    result[id] = _.reduce(style, accumulateStyle, {});
    return result;
  };
  return styleMap && _.reduce(styleMap, (result, styles, route) => {
    result[route] = _.reduce(styles, accumulateStyles, {});
    return result;
  }, {});
}

const mashStyleMap = (styleMap, duration: number) => {
  invariant(duration >= 0 && duration <= 1, 'duration must be in [0, 1]');
  const mash = (styleValue) => ({
    ...styleValue,
    inputRange: styleValue.inputRange.map(v => v * duration),
  });
  return convertStyleMap(styleMap, mash);
}

export function createTransition(transitionConfig) {
  const { createAnimatedStyleMap, createAnimatedStyleMapForClones, ...rest } = transitionConfig;
  const createStyleMapHO = (op, duration) => (...args) => {
    const originalStyleMap = transitionConfig[op] && transitionConfig[op](...args);
    return mashStyleMap(originalStyleMap, duration);
  };
  return (filter) => (duration: number) => ({
    filter,
    duration,
    createAnimatedStyleMap: createStyleMapHO('createAnimatedStyleMap', duration),
    createAnimatedStyleMapForClones: createStyleMapHO('createAnimatedStyleMapForClones', duration),
    ...rest,
  });
}
