import {
  StackNavigator,
} from 'react-navigation';

import PhotoGrid from './PhotoGrid';
import PhotoDetail from './PhotoDetail';

const SharedElements = (filter) => ({
  filter,
  shouldClone(id, routeName) { return true; },
  createAnimatedStyles(items) { }
});

const CrossFade = (filter) => ({
  filter,
  createAnimatedStyle(id: string, routeName: string, transitionProps) {
    const {position, scene: {index}} = transitionProps;
    const opacity = position.interpolate({
      inputRange: [index - 1, index, index + 1],
      outputRange: [0, 1, 0],
    });
    const rotate = position.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });
    return {
      opacity,
      transform: [{ rotate }]
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
  // { from: 'PhotoGrid', to: 'PhotoDetail', transition: CrossFadeScene },
  // { from: 'PhotoDetail', to: 'PhotoGrid', transition: CrossFadeScene },
  { from: 'PhotoGrid', to: 'PhotoDetail', transition: SharedImage },
  { from: 'PhotoDetail', to: 'PhotoGrid', transition: SharedImage },
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