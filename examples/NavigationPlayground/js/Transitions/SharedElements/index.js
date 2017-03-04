import {
  StackNavigator,
} from 'react-navigation';

import PhotoGrid from './PhotoGrid';
import PhotoDetail from './PhotoDetail';
import { Transition } from 'react-navigation';
import _ from 'lodash';
import faker from 'faker';

const {createTransition, together, Transitions} = Transition;

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

const DelayedFadeInToRoute = (filter) => ({
  filter,
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
    return {
      to: itemsOnToRoute.reduce((result, item) => {
        const opacity = transitionProps.progress.interpolate({
          inputRange: [0, 0.8, 1],
          outputRange: [0, 0, 1],
        })
        result[item.id] = { opacity };
        return result;
      }, {}),
    }
  }
});

const FastFadeOutFromRoute = (filter) => ({
  filter,
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
    return {
      from: itemsOnFromRoute.reduce((result, item) => {
        const opacity = transitionProps.progress.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [1, 0, 0],
        })
        result[item.id] = { opacity };
        return result;
      }, {}),
      to: itemsOnToRoute.reduce((result, item) => {
        result[item.id] = { opacity: 1};
        return result;
      }, {})
    }
  }
});

const SharedImage = createTransition(Transitions.SharedElement, /image-.+/);
const CrossFadeScene = createTransition(CrossFade, /\$scene.+/);

const DelayedFadeInDetail = createTransition(DelayedFadeInToRoute, /\$scene-PhotoDetail/);
const FastFadeOutDetail = createTransition(FastFadeOutFromRoute, /\$scene-.+/);

// TODO slide doesn't seem easy to implement, perhaps need to expose current route index and interpolate position instead of progress?
const Slide = (filter) => ({
  filter,
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
    const {layout: {initWidth}, progress} = transitionProps;
    const createStyle = (items, onFromRoute: boolean) => items.reduce((result, item) => {
      const translateX = progress.interpolate({
        inputRange: [0, 0.05, 1],
        outputRange: onFromRoute ? [0, -initWidth, -initWidth] : [initWidth, 0, 0],
      })
      result[item.id] = { transform: [{ translateX }] }
      return result;
    }, {});
    return {
      from: createStyle(itemsOnFromRoute, true),
      to: createStyle(itemsOnToRoute, false),
    };
  }
});

const StaggeredAppear = (filter) => ({
  filter,
  createAnimatedStyleMap(
    itemsOnFromRoute: Array<*>, 
    itemsOnToRoute: Array<*>, 
    transitionProps) {
    const createStyle = (startTime, axis, direction) => {
      const {progress} = transitionProps;
      const inputRange = [0, startTime, 1];
      const opacity = progress.interpolate({
        inputRange,
        outputRange:  [0, 0, 1],
      });
      const translate = progress.interpolate({
        inputRange,
        outputRange: [ direction * 400, direction * 400, 0],
      });
      axis = axis === 'x' ? 'translateX' : 'translateY';
      return {
        opacity,
        transform: [ { [axis]: translate } ],
      };
    }
    const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
    const axes = ['x', 'y'];
    const directions = [-1, 1];
    return {
      to: itemsOnToRoute.reduce((result, item) => {
        const startTime = clamp(Math.random(), 0.1, 0.9);
        const axis = faker.random.arrayElement(axes);
        const direction = faker.random.arrayElement(directions);
        result[item.id] = createStyle(startTime, axis, direction);
        return result;
      }, {}),
    };
  }
})

const SlideScenes = createTransition(Slide, /\$scene-.*/);
const StaggeredAppearImages = createTransition(StaggeredAppear, /image-.+/);

const NoOp = (filter) => ({
  filter,
  createAnimatedStyleMap() {
    console.log('NoOp transition called');
  }
});
const NoOpImage = createTransition(NoOp, /image-.+/);

const transitions = [
  // { from: 'PhotoGrid', to: 'PhotoDetail', transition: CrossFadeScene },
  // { from: 'PhotoDetail', to: 'PhotoGrid', transition: CrossFadeScene },
  // { from: 'PhotoGrid', to: 'PhotoDetail', transition: NoOpImage},
  // { from: 'PhotoDetail', to: 'PhotoGrid', transition: NoOpImage},
  // { from: 'PhotoGrid', to: 'PhotoDetail', transition: together(SharedImage, DelayedFadeInDetail)},
  // { from: 'PhotoDetail', to: 'PhotoGrid', transition: together(SharedImage, FastFadeOutDetail) },
  // { from: 'PhotoGrid', to: 'PhotoDetail', transition: DelayedFadeInDetail},
  // { from: 'PhotoDetail', to: 'PhotoGrid', transition: FastFadeOutDetail },
  { from: 'PhotoGrid', to: 'PhotoDetail', transition: SharedImage},
  { from: 'PhotoDetail', to: 'PhotoGrid', transition: SharedImage},
  // { from: 'PhotoGrid', to: 'PhotoDetail', transition: CrossFadeScene },
  // { from: 'PhotoDetail', to: 'PhotoGrid', transition: together(StaggeredAppearImages, SlideScenes) },
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