import {
  View,
  Image,
} from 'react-native';
import TransitionView from './TransitionView';
import TransitionItems from './TransitionItems';
import createTransitionComponent from './createTransitionComponent';

export default {
  View: createTransitionComponent(View),
  Image: createTransitionComponent(Image),
  Items: TransitionItems,
  createTransitionComponent,
}