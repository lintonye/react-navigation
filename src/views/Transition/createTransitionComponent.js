// @flow

import React from 'react';
import {
  View,
  UIManager,
  findNodeHandle,
  Animated,
} from 'react-native';

import { TransitionItem } from './TransitionItems';
import TransitionConfigs from '../TransitionConfigs';

const statefulize = Component => {
  class Statefulized extends React.Component {
    render() { return <Component {...this.props} />; }
  }
  return Statefulized;
};

const createAnimatedComponent = Component => {
  const isStatelessComponent = type => type.prototype && !!!type.prototype.render;
  let C = Component;
  if (isStatelessComponent(Component)) {
    C = statefulize(Component);
  }
  return Animated.createAnimatedComponent(C);
};

function findTransitionConfig(transitionProps, transitionConfigs) {
  // TODO return transitionConfig by from/to route
  return transitionConfigs && transitionConfigs[0];
}

function createAnimatedStyle(transitionProps, transitionConfigs) {
    const config = findTransitionConfig(transitionProps, transitionConfigs);
    return (config 
      ? config.transition.createAnimatedStyles(transitionProps)
      : TransitionConfigs.defaultTransitionConfig(transitionProps).screenInterpolator(transitionProps));
}

function createTransitionComponent(Component) {
  class TransitionComponent extends React.Component {
    _component: any;
    static contextTypes = {
      registerTransitionView: React.PropTypes.func,
      unregisterTransitionView: React.PropTypes.func,
      transitionProps: React.PropTypes.object,
      transitionConfigs: React.PropTypes.array,
      routeName: React.PropTypes.string,
    };

    // This is needed to pass the invariant in PointerEventsContainer
    setNativeProps(props) {
      this._component.setNativeProps(props);
    }

    render() {
      // collapsable={false} is required for UIManager.measureInWindow to get the actual measurements
      // instead of undefined, see https://github.com/facebook/react-native/issues/9382
      /*return (
        <View collapsable={false}
          ref={c => this._component = c} style={{ flex: 1 }}>
          {this._getAnimatedChild()}
        </View>
      )*/
      const {id, ...rest} = this.props;
      const {routeName, transitionProps, transitionConfigs} = this.context;
      const AnimatedComponent = createAnimatedComponent(Component);
      return (
        <AnimatedComponent {...rest} ref={c => this._component = c}
          style={[this.props.style, createAnimatedStyle(transitionProps, transitionConfigs)]}
        />
      );
    }

    componentDidMount() {
      const { registerTransitionView } = this.context;
      if (!registerTransitionView) return;

      const nativeHandle = findNodeHandle(this._component);
      registerTransitionView(new TransitionItem
        (
        this.props.id,
        this.context.routeName,
        this.render(),
        nativeHandle,
      ));
    }

    componentWillUnmount() {
      const { unregisterTransitionView } = this.context;
      if (!unregisterTransitionView) return;

      unregisterTransitionView(this.props.id, this.context.routeName);
    }
  }
  return TransitionComponent;
}

export default createTransitionComponent;