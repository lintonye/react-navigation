import {
  StackNavigator,
} from 'react-navigation';

import PhotoGrid from './PhotoGrid';
import PhotoDetail from './PhotoDetail';

const SharedElements = () => ({
  cloneOnOverlay(transitionItem) { return true; },
  createAnimatedStyles(items) {}
});

const CrossFade = () => ({
  createAnimatedStyles(transitionProps) {
    const {position, scene:{index}} = transitionProps;
    const opacity = position.interpolate({
      inputRange: [index-1, index, index+1],
      outputRange: [0, 1, 0],
    });
    return { opacity };
  }
})

const transitions = [
  {from: 'PhotoGrid', to: 'PhotoDetail', transition: CrossFade() }
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