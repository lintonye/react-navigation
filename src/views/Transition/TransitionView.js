// @flow

import React, { Component } from 'react';
import {
  View,
  UIManager,
  findNodeHandle,
} from 'react-native';

import { TransitionItem } from './TransitionItems';

class TransitionView extends Component {
  _view: any;
  static contextTypes = {
    registerTransitionView: React.PropTypes.func,
    unregisterTransitionView: React.PropTypes.func,
  };
  render() {
    // collapsable={false} is required for UIManager.measureInWindow to get the actual measurements
    // instead of undefined, see https://github.com/facebook/react-native/issues/9382
    return (
      <View collapsable={false}
        ref={c => this._view = c}>
        {this.props.children}
      </View>
    )
  }
  componentDidMount() {
    const { registerTransitionView } = this.context;
    if (!registerTransitionView) return;

    const { name, containerRouteName } = this.props;
    const nativeHandle = findNodeHandle(this._view);
    registerTransitionView(new TransitionItem
      (
      name,
      containerRouteName,
      React.Children.only(this.props.children),
      nativeHandle,
    ));
  }

  componentWillUnmount() {
    const { unregisterTransitionView } = this.context;
    if (!unregisterTransitionView) return;

    const { name, containerRouteName } = this.props;
    unregisterTransitionView(name, containerRouteName);
  }
}

export default TransitionView;