import _ from 'lodash';

export function together(...transitions) {
  const filter = (id: string) => transitions.some(t => t.filter(id));
  const getItemsOp = (op: string) => (
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>) => transitions.reduce((result, t) => {
      const opResult = t[op] && t[op](itemsOnFromRoute, itemsOnToRoute);
      if (opResult) result = _.union(result, opResult);
      return result;
    }, []);
  const getItemsToClone = getItemsOp('getItemsToClone');
  const getItemsToMeasure = getItemsOp('getItemsToMeasure');

  const mergeStyleMap = (left, right) => ({
    from: {...left.from, ...right.from},
    to: {...left.to, ...right.to},
  });

  const createStyleMapOp = (op: string) => (
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) => transitions.reduce((result, t) => {
      const opResult = t[op] && t[op](itemsOnFromRoute, itemsOnToRoute, transitionProps);
      if (opResult) result = mergeStyleMap(result, opResult);
      return result;
  }, {});
  const createAnimatedStyleMap = createStyleMapOp('createAnimatedStyleMap');
  const createAnimatedStyleMapForClones = createStyleMapOp('createAnimatedStyleMapForClones');
  return {
    filter,
    getItemsToClone,
    getItemsToMeasure,
    createAnimatedStyleMap,
    createAnimatedStyleMapForClones,
  };
}