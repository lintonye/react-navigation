import {
  StackNavigator,
} from 'react-navigation';

import PhotoGrid from './PhotoGrid';
import PhotoDetail from './PhotoDetail';

const SharedElements = (filter) => ({
  filter,
  shouldClone(id, routeName) { return true; },
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
      //TODO
  }
});

const CrossFade = (filter) => ({
  filter,
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
    const { progress } = transitionProps;
    const createStyles = (items: Array<*>, toAppear: boolean) => items.reduce((result, item) => {
      const opacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [toAppear ? 0 : 1, toAppear ? 1 : 0],
      })
      const rotate = progress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      });
      result[item.id] = {
        opacity,
        transform: [{ rotate }],
      }
      return result;
    }, {});
    return {
      from: createStyles(itemsOnFromRoute, false),
      to: createStyles(itemsOnToRoute, true),
    };
  }
})

function createIdRegexFilter(idRegexes) {
  return (id: string) => idRegexes.every(idRegex => id.match(idRegex));
}

function createTransition(Transition, ...idRegexes) {
  return Transition(createIdRegexFilter(idRegexes));
}

const SharedImage = createTransition(SharedElements, /image-.+/);
const CrossFadeScene = createTransition(CrossFade, /\$scene.+/);

const transitions = [
  { from: 'PhotoGrid', to: 'PhotoDetail', transition: CrossFadeScene },
  { from: 'PhotoDetail', to: 'PhotoGrid', transition: CrossFadeScene },
  // { from: 'PhotoGrid', to: 'PhotoDetail', transition: SharedImage },
  // { from: 'PhotoDetail', to: 'PhotoGrid', transition: CrossFadeScene },
];

const App = StackNavigator({
  PhotoGrid: {
    screen: PhotoGrid,
  },
  PhotoDetail: {
    screen: PhotoDetail,
  }
}, {
    transitions,
  });

export default App;