// @flow

import React, { Component } from 'react';
import {
  View,
  UIManager,
  findNodeHandle,
  Animated,
} from 'react-native';

import { TransitionItem } from './TransitionItems';

function cloneAsAnimatedComponent(element: React.Element<*>) {
  const isStatefulComponent = type => type.prototype && typeof type.prototype.render === 'function';
  if (typeof element.type === 'function' && element.type.name !== 'AnimatedComponent') {
    if (isStatefulComponent(element.type)) {
      const type = Animated.createAnimatedComponent(element.type);
      return React.createElement(type, element.props, element.props.children);
    } else {
      return (
        <Animated.View {...element.props}>
          {element}
        </Animated.View>
      );
    }
  } else {
    return element;
  }
}

class TransitionView extends Component {
  _view: any;
  static contextTypes = {
    registerTransitionView: React.PropTypes.func,
    unregisterTransitionView: React.PropTypes.func,
  };
  render() {
    // collapsable={false} is required for UIManager.measureInWindow to get the actual measurements
    // instead of undefined, see https://github.com/facebook/react-native/issues/9382
    /*return (
      <View collapsable={false}
        ref={c => this._view = c} style={{ flex: 1 }}>
        {this._getAnimatedChild()}
      </View>
    )*/
    return this._getAnimatedChild();
  }

  _getAnimatedChild() {
    return cloneAsAnimatedComponent(React.Children.only(this.props.children));
  }

  componentDidMount() {
    const { registerTransitionView } = this.context;
    if (!registerTransitionView) return;

    const { id, containerRouteName } = this.props;
    const nativeHandle = findNodeHandle(this._view);
    registerTransitionView(new TransitionItem
      (
      id,
      containerRouteName,
      this._getAnimatedChild(),
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