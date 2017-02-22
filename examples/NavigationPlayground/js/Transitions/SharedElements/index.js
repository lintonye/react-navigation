import {
  StackNavigator,
} from 'react-navigation';

import PhotoGrid from './PhotoGrid';
import PhotoDetail from './PhotoDetail';
import {Transition} from 'react-navigation';
import _ from 'lodash';

const {createTransition} = Transition;

const SharedElements = (filter) => ({
  filter,
  shouldClone(transitionItem) { return true; },
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
      const itemIdsOnBoth = _.intersectionWith(itemsOnFromRoute, itemsOnToRoute, (i1, i2) => i1.id === i2.id)
        .map(item => item.id);
      const {progress} = transitionProps;
      const createSharedItemStyle = (result, id) => {
        const fromItem = itemsOnFromRoute.find(item => item.id === id);
        const toItem = itemsOnFromRoute.find(item => item.id === id);
        const inputRange = [0, 1];
        const left = progress.interpolate({
          inputRange, outputRange: [fromItem.metrics.x, toItem.metrics.x]
        });
        const top = progress.interpolate({
          inputRange, outputRange: [fromItem.metrics.y, toItem.metrics.y]
        });
        const width = progress.interpolate({
          inputRange, outputRange: [fromItem.metrics.width, toItem.metrics.width]
        });
        const height = progress.interpolate({
          inputRange, outputRange: [fromItem.metrics.height, toItem.metrics.height]
        });
        result[id] = {left, top, width, height, right: null, bottom: null};
        return result;
      };
      const createHideStyle = (result, id) => {
        result[id] = { opacity: 0 };
        return result;
      };
      return {
        from: itemIdsOnBoth.reduce(createSharedItemStyle, {}),
        to: itemIdsOnBoth.reduce(createHideStyle, {}),
      }
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