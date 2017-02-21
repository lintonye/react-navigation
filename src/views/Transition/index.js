import {
  View,
  Image,
  Text,
} from 'react-native';
import TransitionItems from './TransitionItems';
import createTransitionComponent from './createTransitionComponent';

export default {
  View: createTransitionComponent(View),
  Image: createTransitionComponent(Image),
  Text: createTransitionComponent(Text),
  createTransitionComponent,
}