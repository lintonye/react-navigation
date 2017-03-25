/* @flow */

import React, { PropTypes, Component } from 'react';
import { Animated, StyleSheet, NativeModules, PanResponder, Platform, View, I18nManager, Keyboard } from 'react-native';
import invariant from 'invariant';
import _ from 'lodash';

import Transitioner from './Transitioner';
import Card from './Card';
import CardStackStyleInterpolator from './CardStackStyleInterpolator';
import Header from './Header';
import NavigationPropTypes from '../PropTypes';
import NavigationActions from '../NavigationActions';
import addNavigationHelpers from '../addNavigationHelpers';
import SceneView from './SceneView';

import clamp from 'clamp';

import type {
  NavigationAction,
  NavigationScreenProp,
  NavigationScene,
  NavigationSceneRenderer,
  NavigationSceneRendererProps,
  NavigationTransitionProps,
  NavigationRouter,
  Style,
} from '../TypeDefinition';

import type { HeaderMode } from './Header';

import type { TransitionConfig } from './TransitionConfigs';

import TransitionConfigs from './TransitionConfigs';

import TransitionItems from './Transition/TransitionItems';
import { convertStyleMap } from './Transition/transitionHelpers';

const emptyFunction = () => {};

const NativeAnimatedModule = NativeModules &&
  NativeModules.NativeAnimatedModule;

// The clone items delta must be bigger than the other value to avoid unwanted flickering.
const OVERLAY_OPACITY_INPUT_RANGE_DELTA = 0.0001;
const CLONE_ITEMS_OPACITY_INPUT_RANGE_DELTA = 0.01;

type Props = {
  screenProps?: {},
  headerMode: HeaderMode,
  headerComponent?: ReactClass<*>,
  mode: 'card' | 'modal',
  navigation: NavigationScreenProp<*, NavigationAction>,
  router: NavigationRouter,
  cardStyle?: Style,
  onTransitionStart?: () => void,
  onTransitionEnd?: () => void,
  style: Style,
  gestureResponseDistance?: ?number,
  /**
   * Optional custom animation when transitioning between screens.
   */
  transitionConfig?: () => TransitionConfig,
};

type DefaultProps = {
  mode: 'card' | 'modal',
  headerComponent: ReactClass<*>,
};

type State = {
  transitionItems: TransitionItems,
};

/**
 * The duration of the card animation in milliseconds.
 */
const ANIMATION_DURATION = 200;

/**
 * The gesture distance threshold to trigger the back behavior. For instance,
 * `1 / 3` means that moving greater than 1 / 3 of the width of the screen will
 * trigger a back action
 */
const POSITION_THRESHOLD = 1 / 3;

/**
 * The threshold (in pixels) to start the gesture action.
 */
const RESPOND_THRESHOLD = 12;

/**
 * The distance of touch start from the edge of the screen where the gesture will be recognized
 */
const GESTURE_RESPONSE_DISTANCE = 35;


/**
 * The ratio between the gesture velocity and the animation velocity. This allows
 * the velocity of a swipe release to carry on into the new animation.
 *
 * TODO: Understand and compute this ratio rather than using an approximation
 */
const GESTURE_ANIMATED_VELOCITY_RATIO = -4;

class CardStack extends Component<DefaultProps, Props, void> {
  _render: NavigationSceneRenderer;
  _renderScene: NavigationSceneRenderer;
  _childNavigationProps: {
    [key: string]: NavigationScreenProp<*, NavigationAction>,
  } = {};
  state: State;

  /**
   * Used to identify the starting point of the position when the gesture starts, such that it can
   * be updated according to its relative position. This means that a card can effectively be
   * "caught"- If a gesture starts while a card is animating, the card does not jump into a
   * corresponding location for the touch.
   */
  _gestureStartValue: number = 0;

  // tracks if a touch is currently happening
  _isResponding: boolean = false;

  /**
   * immediateIndex is used to represent the expected index that we will be on after a
   * transition. To achieve a smooth animation when swiping back, the action to go back
   * doesn't actually fire until the transition completes. The immediateIndex is used during
   * the transition so that gestures can be handled correctly. This is a work-around for
   * cases when the user quickly swipes back several times.
   */
  _immediateIndex: ?number = null;

  static Card = Card;
  static Header = Header;

  static propTypes = {
    /**
     * Custom style applied to the card.
     */
    cardStyle: PropTypes.any,

    /**
     * Style of the stack header. `float` means the header persists and is shared
     * for all screens. When set to `screen`, each header is rendered within the
     * card, and will animate in together.
     *
     * The default for `modal` mode is `screen`, and the default for `card` mode
     * is `screen` on Android and `float` on iOS.
     */
    headerMode: PropTypes.oneOf(['float', 'screen', 'none']),

    /**
     * Custom React component to be used as a header
     */
    headerComponent: PropTypes.func,

    /**
     * Style of the cards movement. Value could be `card` or `modal`.
     * Default value is `card`.
     */
    mode: PropTypes.oneOf(['card', 'modal']),

    /**
     * The distance from the edge of the card which gesture response can start
     * for. Default value is `30`.
     */
    gestureResponseDistance: PropTypes.number,

    /**
     * Optional custom animation when transitioning between screens.
     */
    transitionConfig: PropTypes.func,

    /**
     * The navigation prop, including the state and the dispatcher for the back
     * action. The dispatcher must handle the back action
     * ({ type: NavigationActions.BACK }), and the navigation state has this shape:
     *
     * ```js
     * const navigationState = {
     *   index: 0, // the index of the selected route.
     *   routes: [ // A list of routes.
     *     {key: 'page 1'}, // The 1st route.
     *     {key: 'page 2'}, // The second route.
     *   ],
     * };
     * ```
     */
    navigation: PropTypes.shape({
      state: NavigationPropTypes.navigationState.isRequired,
      dispatch: PropTypes.func.isRequired,
    }).isRequired,

    /**
     * Custom style applied to the cards stack.
     */
    style: View.propTypes.style,
  };

  static childContextTypes = {
    registerTransitionItem: React.PropTypes.func,
    unregisterTransitionItem: React.PropTypes.func,
  }

  static defaultProps: DefaultProps = {
    mode: 'card',
    headerComponent: Header,
  };

  constructor(props: Props, context) {
    super(props, context);
    this.state = {
      transitionItems: new TransitionItems(),
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (this.props !== nextProps) {
      return true;
    } else {
      return (
        this.state.transitionItems !== nextState.transitionItems &&
        nextState.transitionItems.areAllMeasured() &&
        // prevent unnecesary updates when registering/unregistering transition items
        this.state.transitionItems.count() === nextState.transitionItems.count()
      );
    }
  }

  componentWillReceiveProps(nextProps) {
    // console.log('routeName', getRoute(this.props), 'nextRoute', getRoute(nextProps))

    if (this.props.navigation !== nextProps.navigation) {
      const getRoute = props => props.navigation && {
        ...props.navigation.state.routes[props.navigation.state.index],
        index: props.navigation.state.index,
      };
      const fromRoute = getRoute(this.props);
      const toRoute = getRoute(nextProps);
      this._fromRoute = fromRoute;
      this._toRoute = toRoute;
      this._receivedDifferentNavigationProp = true;
      // When coming back from scene, onLayout won't be triggered, we'll need to do it manually.
      this._setTransitionItemsState(prevItems => prevItems.removeAllMetrics(), 
        () => this._onLayout());
    }
  }

  getChildContext() {
    const self = this;
    return {
      registerTransitionItem(item: TransitionItem) {
        // console.log('==> registering', item.toString());
        self._setTransitionItemsState(prevItems => prevItems.add(item));
      },
      unregisterTransitionItem(id: string, routeName: string) {
        // console.log('==> unregistering', id, routeName);
        self._setTransitionItemsState(prevItems => prevItems.remove(id, routeName));
      },
    };
  }

  componentWillMount() {
    this._render = this._render.bind(this);
    this._renderScene = this._renderScene.bind(this);
  }

  // Just for testing //TODO delete when done with performance fixing
  // componentDidUpdate(prevProps, prevState) {
  //   this.updateCount = this.updateCount || 0;
  //   this.updateCount++;
  //   console.log(`====================================> ${this.updateCount} cardStack updated propsChanged=${this.props !== prevProps}, stateChanged=${this.state !== prevState}, areAllMeasured=${this.state.transitionItems.areAllMeasured()}, prevState.areAllMeasured=${prevState.transitionItems.areAllMeasured()} sameItems?=${this.state.transitionItems===prevState.transitionItems}`);
  // }

  render() {
    return (
      <Transitioner
        configureTransition={this._configureTransition}
        navigation={this.props.navigation}
        render={this._render}
        style={this.props.style}
        onTransitionStart={this.props.onTransitionStart}
        onTransitionEnd={this.props.onTransitionEnd}
      />
    );
  }

  _configureTransition = (
    // props for the new screen
    transitionProps: NavigationTransitionProps,
    // props for the old screen
    prevTransitionProps: NavigationTransitionProps
  ) => {
    const isModal = this.props.mode === 'modal';
    // Copy the object so we can assign useNativeDriver below
    // (avoid Flow error, transitionSpec is of type NavigationTransitionSpec).
    const transitionSpec = {
      ...this._getTransitionConfig(
        transitionProps,
        prevTransitionProps
      ),
    };
    const transition = this._getTransition();
    if (
      !!NativeAnimatedModule &&
       // Native animation support also depends on the transforms used:
      transition && transition.canUseNativeDriver()
    ) {
      // Internal undocumented prop
      transitionSpec.useNativeDriver = true;
    }
    return transitionSpec;
  };

  _renderHeader(
    transitionProps: NavigationTransitionProps,
    headerMode: HeaderMode
  ): ?React.Element<*> {
    const headerConfig = this.props.router.getScreenConfig(
      transitionProps.navigation,
      'header'
    ) || {};

    return (
      <this.props.headerComponent
        {...transitionProps}
        router={this.props.router}
        style={headerConfig.style}
        mode={headerMode}
        onNavigateBack={() => this.props.navigation.goBack(null)}
        renderLeftComponent={(props: NavigationTransitionProps) => {
          const header = this.props.router.getScreenConfig(
            props.navigation,
            'header'
          ) || {};
          return header.left;
        }}
        renderRightComponent={(props: NavigationTransitionProps) => {
          const header = this.props.router.getScreenConfig(
            props.navigation,
            'header'
          ) || {};
          return header.right;
        }}
        renderTitleComponent={(props: NavigationTransitionProps) => {
          const header = this.props.router.getScreenConfig(
            props.navigation,
            'header'
          ) || {};
          // When we return 'undefined' from 'renderXComponent', header treats them as not
          // specified and default 'renderXComponent' functions are used. In case of 'title',
          // we return 'undefined' in case of 'string' too because the default 'renderTitle'
          // function in header handles them.
          if (typeof header.title === 'string') {
            return undefined;
          }
          return header.title;
        }}
      />
    );
  }

  _hideTransitionViewUntilDone(transitionProps, onFromRoute: boolean) {
    const {progress} = transitionProps;
    const opacity = (onFromRoute
      ? progress.interpolate({
          inputRange: [0, CLONE_ITEMS_OPACITY_INPUT_RANGE_DELTA, 1],
          outputRange: [1, 0, 0],
        })
      : progress.interpolate({
          inputRange: [0, 1 - CLONE_ITEMS_OPACITY_INPUT_RANGE_DELTA, 1],
          outputRange: [0, 0, 1],
        })
    );
    return { opacity };
  }

  _replaceFromToInStyleMap(styleMap, fromRouteName: string, toRouteName: string) {
    return {
      [fromRouteName]: styleMap.from,
      [toRouteName]: styleMap.to,
    }
  }

  _findTransitionContainer() {
    const fromRouteName = this._fromRoute && this._fromRoute.routeName;
    const toRouteName = this._toRoute && this._toRoute.routeName;
    const transitions = this.props.transitionConfigs.filter(c => (
      (c.from === fromRouteName || c.from === '*') &&
      (c.to === toRouteName || c.to === '*')));
    invariant(transitions.length <= 1, `More than one transitions found from "${fromRouteName}" to "${toRouteName}".`);
    return transitions[0];
  }

  _getTransition() {
    const tc = this._findTransitionContainer();
    return tc && tc.transition;
  }

  _getFilteredFromToItems(transition, fromRouteName: string, toRouteName: string) {
    const isRoute = route => item => item.routeName === route;
    const filterPass = item => transition && (!!!transition.filter || transition.filter(item.id));

    const filteredItems = this.state.transitionItems.items().filter(filterPass);

    const fromItems = filteredItems.filter(isRoute(fromRouteName));
    const toItems = filteredItems.filter(isRoute(toRouteName));
    return { from: fromItems, to: toItems };
  }

  _interpolateStyleMap(styleMap, transitionProps: NavigationTransitionProps) {
    const interpolate = (value) => {
      const delta = this._toRoute.index - this._fromRoute.index;
      const { position } = transitionProps;
      let { inputRange, outputRange } = value;
      // Make sure the full [0, 1] inputRange is covered to avoid accidental output values
      inputRange = [0, ...inputRange, 1].map(r => this._fromRoute.index + r * delta);
      outputRange = [outputRange[0], ...outputRange, outputRange[outputRange.length - 1]];
      if (delta < 0) {
        inputRange = inputRange.reverse();
        outputRange = outputRange.reverse();
      }
      return position.interpolate({
        ...value,
        inputRange,
        outputRange,
      });
    };
    return convertStyleMap(styleMap, interpolate, 'processTransform');
  }

  _createInPlaceTransitionStyleMap(
    transitionProps: NavigationTransitionProps,
    prevTransitionProps:NavigationTransitionProps) {
    const fromRouteName = this._fromRoute && this._fromRoute.routeName;
    const toRouteName = this._toRoute && this._toRoute.routeName;

    const transition = this._getTransition();
    if (!transition || !this.state.transitionItems.areAllMeasured()) {
      return null;
    }

    const { from: fromItems, to: toItems } = this._getFilteredFromToItems(transition, fromRouteName, toRouteName);
    const itemsToClone = transition.getItemsToClone && transition.getItemsToClone(fromItems, toItems);

    const hideUntilDone = (items, onFromRoute: boolean) => items && items.reduce((result, item) => {
      result[item.id] = this._hideTransitionViewUntilDone(transitionProps, onFromRoute);
      return result;
    }, {}); 

    const styleMap = transition.getStyleMap && 
      this._interpolateStyleMap(transition.getStyleMap(fromItems, toItems, transitionProps), transitionProps);
    let inPlaceStyleMap = {
      from: {
        ...styleMap && styleMap.from,
        ...hideUntilDone(itemsToClone, true), //TODO should we separate itemsToClone into from and to?
      },
      to: {
        ...styleMap && styleMap.to,
        ...hideUntilDone(itemsToClone, false),
      }
    };
    inPlaceStyleMap = this._replaceFromToInStyleMap(inPlaceStyleMap, fromRouteName, toRouteName);
    
    return inPlaceStyleMap;
  }

  _renderOverlay(transitionProps) {
    const fromRouteName = this._fromRoute && this._fromRoute.routeName;
    const toRouteName = this._toRoute && this._toRoute.routeName;
    const transition = this._getTransition();
    if (transition && this.state.transitionItems.areAllMeasured()) {
      const { from: fromItems, to: toItems } = this._getFilteredFromToItems(transition, fromRouteName, toRouteName);
      const itemsToClone = transition.getItemsToClone && transition.getItemsToClone(fromItems, toItems);
      if (!itemsToClone) return null;

      let styleMap = transition.getStyleMapForClones && 
        this._interpolateStyleMap(transition.getStyleMapForClones(fromItems, toItems, transitionProps), transitionProps);
      styleMap = styleMap && this._replaceFromToInStyleMap(styleMap, fromRouteName, toRouteName);

      // TODO what if an item is the parent of another item?
      const clones = itemsToClone.map(item => {
        const animatedStyle = styleMap && styleMap[item.routeName] && styleMap[item.routeName][item.id];
        return React.cloneElement(item.reactElement, {
          style: [item.reactElement.props.style, styles.clonedItem, animatedStyle],
        }, []);
      });
      const animatedContainerStyle = {
        opacity: transitionProps.progress.interpolate({
          inputRange: [0, OVERLAY_OPACITY_INPUT_RANGE_DELTA, 1 - OVERLAY_OPACITY_INPUT_RANGE_DELTA, 1],
          outputRange: [0, 1, 1, 0],
        })
      };
      return (
        <Animated.View style={[styles.overlay, animatedContainerStyle]} pointerEvents="none">
          {clones}
        </Animated.View>
      );
    } else {
      return null;
    }
  }

  _animatedSubscribe(props) {
    // Hack to make this work with native driven animations. We add a single listener
    // so the JS value of the following animated values gets updated. We rely on
    // some Animated private APIs and not doing so would require using a bunch of
    // value listeners but we'd have to remove them to not leak and I'm not sure
    // when we'd do that with the current structure we have. `stopAnimation` callback
    // is also broken with native animated values that have no listeners so if we
    // want to remove this we have to fix this too.
    this._animatedSubscribeValue(props.layout.width);
    this._animatedSubscribeValue(props.layout.height);
    this._animatedSubscribeValue(props.position);
  }
  _animatedSubscribeValue(animatedValue) {
    if (!animatedValue.__isNative) {
      return;
    }
    if (Object.keys(animatedValue._listeners).length === 0) {
      animatedValue.addListener(emptyFunction);
    }
  }

  _reset(position: Animated.Value, resetToIndex: number, velocity: number): void {
    Animated.timing(position, {
        toValue: resetToIndex,
        duration: ANIMATION_DURATION,
        useNativeDriver: position.__isNative,
        velocity: velocity * GESTURE_ANIMATED_VELOCITY_RATIO,
        bounciness: 0,
      })
      .start();
  }

  _goBack(props: NavigationTransitionProps, velocity: number) {

    const toValue = Math.ceil(props.navigationState.index - 1, 0);

    // set temporary index for gesture handler to respect until the action is
    // dispatched at the end of the transition.
    this._immediateIndex = toValue;

    Animated.timing(props.position, {
        toValue,
        duration: ANIMATION_DURATION,
        useNativeDriver: props.position.__isNative,
        velocity: velocity * GESTURE_ANIMATED_VELOCITY_RATIO,
        bounciness: 0,
      })
      .start(({finished}) => {
        this._immediateIndex = null;
        if (!this._isResponding) {
          this.props.navigation.dispatch(
            NavigationActions.back({ key: props.scene.route.key })
          );
        }
      });
  }

  _render(
      props: NavigationTransitionProps, 
      prevTransitionProps:NavigationTransitionProps): React.Element<*> {
    let floatingHeader = null;
    const headerMode = this._getHeaderMode();
    if (headerMode === 'float') {
      floatingHeader = this._renderHeader(props, headerMode);
    }

    const responder = PanResponder.create({
      onPanResponderTerminate: () => {
        this._isResponding = false;
        this._reset(props.position, props.navigation.state.index, 0);
      },
      onPanResponderGrant: () => {
        props.position.stopAnimation((value: number) => {
          this._isResponding = true;
          this._gestureStartValue = value;
        });
      },
      onMoveShouldSetPanResponder: (
        event: { nativeEvent: { pageY: number, pageX: number } },
        gesture: any
      ) => {
        if (props.navigationState.index !== props.scene.index) {
          return false;
        }
        const layout = props.layout;
        const isVertical = false; // todo: bring back gestures for mode=modal
        const index = props.navigationState.index;
        const immediateIndex = this._immediateIndex == null ? index : this._immediateIndex;
        const currentDragDistance = gesture[isVertical ? 'dy' : 'dx'];
        const currentDragPosition = event.nativeEvent[
          isVertical ? 'pageY' : 'pageX'
        ];
        const axisLength = isVertical
          ? layout.height.__getValue()
          : layout.width.__getValue();
        const axisHasBeenMeasured = !! axisLength;

        // Measure the distance from the touch to the edge of the screen
        const screenEdgeDistance = currentDragPosition - currentDragDistance;
        // GESTURE_RESPONSE_DISTANCE is about 30 or 35
        if (screenEdgeDistance > GESTURE_RESPONSE_DISTANCE) {
          // Reject touches that started in the middle of the screen
          return false;
        }

        const hasDraggedEnough = Math.abs(currentDragDistance) > RESPOND_THRESHOLD;

        const isOnFirstCard = immediateIndex === 0;
        const shouldSetResponder = hasDraggedEnough && axisHasBeenMeasured && !isOnFirstCard;
        return shouldSetResponder;
      },
      onPanResponderMove: (event: any, gesture: any) => {
        // Handle the moving touches for our granted responder
        const layout = props.layout;
        const isVertical = false;
        const startValue = this._gestureStartValue;
        const axis = isVertical ? 'dy' : 'dx';
        const index = props.navigationState.index;
        const distance = isVertical
          ? layout.height.__getValue()
          : layout.width.__getValue();
        const currentValue = I18nManager.isRTL && axis === 'dx'
          ? startValue + gesture[axis] / distance
          : startValue - gesture[axis] / distance;
        const value = clamp(index - 1, currentValue, index);
        props.position.setValue(value);
      },
      onPanResponderTerminationRequest: (event: any, gesture: any) => {
        // Returning false will prevent other views from becoming responder while
        // the navigation view is the responder (mid-gesture)
        return false;
      },
      onPanResponderRelease: (event: any, gesture: any) => {
        if (!this._isResponding) {
          return;
        }
        this._isResponding = false;
        const isVertical = false;
        const axis = isVertical ? 'dy' : 'dx';
        const velocity = gesture[isVertical ? 'vy' : 'vx'];
        const index = props.navigationState.index;

        // To asyncronously get the current animated value, we need to run stopAnimation:
        props.position.stopAnimation((value: number) => {
          // If the speed of the gesture release is significant, use that as the indication
          // of intent
          if (velocity < -0.5) {
            this._reset(props.position, index, velocity);
            return;
          }
          if (velocity > 0.5) {
            this._goBack(props, velocity);
            return;
          }

          // Then filter based on the distance the screen was moved. Over a third of the way swiped,
          // and the back will happen.
          if (value <= index - POSITION_THRESHOLD) {
            this._goBack(props, velocity);
          } else {
            this._reset(props.position, index, velocity);
          }
        });
      },
    });
    const gesturesEnabled = this.props.mode === 'card' && Platform.OS === 'ios';
    const handlers = gesturesEnabled ? responder.panHandlers : {};

    const styleMap = this._createInPlaceTransitionStyleMap(props, prevTransitionProps);
    // console.log('==> inPlaceStyleMap', styleMap);

    const overlay = this._renderOverlay(props);

    return (
      <View
        {...handlers}
        style={styles.container}>
        <View style={styles.scenes}>
          {props.scenes.map((scene: any) => this._renderScene({
            ...props,
            scene,
            navigation: this._getChildNavigation(scene),
          }, prevTransitionProps, styleMap))}
        </View>
        {floatingHeader}
        {overlay}
      </View>
    );
  }

  _getHeaderMode(): HeaderMode {
    if (this.props.headerMode) {
      return this.props.headerMode;
    }
    if (Platform.OS === 'android' || this.props.mode === 'modal') {
      return 'screen';
    }
    return 'float';
  }

  _getTransitionConfig(
    // props for the new screen
    transitionProps: NavigationTransitionProps,
    // props for the old screen
    prevTransitionProps: NavigationTransitionProps
  ): TransitionConfig {
    const defaultConfig = TransitionConfigs.defaultTransitionConfig(
      transitionProps,
      prevTransitionProps,
      this.props.mode === 'modal'
    ).transitionSpec;
    const tc = this._findTransitionContainer();
    if (tc) {
      return {
        ...defaultConfig,
        ...tc.config,
      }
    } 

    return defaultConfig;
  }

  _renderInnerCard(
    SceneComponent: ReactClass<*>,
    props: NavigationSceneRendererProps
  ): React.Element<*> {
    const header = this.props.router.getScreenConfig(
      props.navigation,
      'header'
    );
    const headerMode = this._getHeaderMode();
    if (headerMode === 'screen') {
      const isHeaderHidden = header && header.visible === false;
      const maybeHeader = isHeaderHidden
        ? null
        : this._renderHeader(props, headerMode);
      return (
        <View style={styles.container}>
          <View style={{ flex: 1 }}>
            <SceneView
              screenProps={this.props.screenProps}
              navigation={props.navigation}
              component={SceneComponent}
            />
          </View>
          {maybeHeader}
        </View>
      );
    }
    return (
      <SceneView
        screenProps={this.props.screenProps}
        navigation={props.navigation}
        component={SceneComponent}
      />
    );
  }

  _getChildNavigation = (
    scene: NavigationScene
  ): NavigationScreenProp<*, NavigationAction> => {
    let navigation = this._childNavigationProps[scene.key];
    if (!navigation || navigation.state !== scene.route) {
      navigation = this._childNavigationProps[
        scene.key
      ] = addNavigationHelpers({
        ...this.props.navigation,
        state: scene.route,
      });
    }
    return navigation;
  };

  _measure(item: TransitionItem): Promise < Metrics > {
    return new Promise((resolve, reject) => {
      UIManager.measureInWindow(
        item.nativeHandle,
        (x, y, width, height) => {
          if ([x, y, width, height].every(n => _.isNumber(n))) {
            resolve({ x, y, width, height });
          } else {
            reject(`x=${x}, y=${y}, width=${width}, height=${height}. The view (${item.toString()}) is not found.  Is it collapsed on Android?`);
          }
        }
      );
    });
  }

  _setTransitionItemsState(fun, callback) {
    this.setState(prevState => {
      const newItems = fun(prevState.transitionItems);
      return (newItems !== prevState.transitionItems 
        ? {...prevState, transitionItems: newItems}
        : prevState
      );
    }, callback);
  }

  async _measureItems() {
    const then = new Date();
    const items = this.state.transitionItems.items().filter(i => i.shouldMeasure && !i.isMeasured());
    let toUpdate = [];
    for (let item of items) {
      const { id, routeName } = item;
      try {
        const metrics = await this._measure(item);
        toUpdate.push({ id, routeName, metrics });
        // console.log('measured:', id, routeName, metrics);
      } catch (err) {
        console.warn(err);
      }
    }
    if (toUpdate.length > 0) {
      // console.log('measured, setting meatured state:', toUpdate)
      this._setTransitionItemsState(prevItems => prevItems.updateMetrics(toUpdate));
    }
    console.log(`====> _measureItems took ${new Date() - then} ms`);
  }

  async _onLayout() {
    // This guarantees that the measurement is only done after navigation.
    // avoid unnecesary state updates when onLayout is called, e.g. when scrolling a ListView
    if (!this._receivedDifferentNavigationProp) return;
    this._receivedDifferentNavigationProp = false;

    const fromRoute = this._fromRoute;
    const toRoute = this._toRoute;
    if (fromRoute && toRoute) {
      const transition = this._getTransition();
      let itemsToMeasure = [];
      if (transition && transition.getItemsToMeasure) {
        const { from, to } = this._getFilteredFromToItems(transition, fromRoute.routeName, toRoute.routeName);
        itemsToMeasure = transition.getItemsToMeasure(from, to);
      }
      this._setTransitionItemsState(prevItems => prevItems.setShouldMeasure(itemsToMeasure), 
        () => this._measureItems());
    }
  }

  /**
   * By default, keep the current scene and not show the incoming scene (by setting their opacity)
   * to prevent flickering and overdraw issues.
   * 
   * @param {*} props
   */
  _createDefaultHideCardStyle(
    props: NavigationSceneRendererProps,
    prevTransitionProps: NavigationTransitionProps) {
    const currentIndex = props.index;
    const prevIndex = prevTransitionProps && prevTransitionProps.index;
    const sceneIndex = props.scene.index;
    const opacity = (prevIndex === null && currentIndex === sceneIndex) || prevIndex === sceneIndex ? 1 : 0;
    // console.log('prevIndex', prevIndex, 'sceneIndex', sceneIndex, 'opacity', opacity);
    return { opacity };
  }

  _renderScene(
    props: NavigationSceneRendererProps, 
    prevTransitionProps: NavigationTransitionProps,
    transitionStyleMap): React.Element<*> {
    const isModal = this.props.mode === 'modal';

    let panHandlers = null;

    const cardStackConfig = this.props.router.getScreenConfig(
      props.navigation,
      'cardStack'
    ) || {};

    const SceneComponent = this.props.router.getComponentForRouteName(
      props.scene.route.routeName
    );

    const defaultHideCardStyle = this._createDefaultHideCardStyle(props, prevTransitionProps);

    return (
      <Card
        {...props}
        key={`card_${props.scene.key}`}
        panHandlers={null}
        renderScene={(sceneProps: *) =>
          this._renderInnerCard(SceneComponent, sceneProps)}
        style={[defaultHideCardStyle, this.props.cardStyle]}
        onLayout={this._onLayout.bind(this)}
        style={[defaultHideCardStyle, this.props.cardStyle]}
        transitionStyleMap={transitionStyleMap}
      />
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Header is physically rendered after scenes so that Header won't be
    // covered by the shadows of the scenes.
    // That said, we'd have use `flexDirection: 'column-reverse'` to move
    // Header above the scenes.
    flexDirection: 'column-reverse',
  },
  scenes: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    elevation: 100, // make sure it's on the top on Android. TODO is this a legit way?
  },
  clonedItem: {
    position: 'absolute',
  }
});

export default CardStack;
