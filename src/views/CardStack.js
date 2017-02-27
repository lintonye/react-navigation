/* @flow */

import React, { PropTypes, Component } from 'react';
import {
  StyleSheet,
  NativeModules,
  Platform,
  View,
  UIManager,
} from 'react-native';
import invariant from 'invariant';
import _ from 'lodash';

import Transitioner from './Transitioner';
import Card from './Card';
import CardStackStyleInterpolator from './CardStackStyleInterpolator';
import CardStackPanResponder from './CardStackPanResponder';
import Header from './Header';
import NavigationPropTypes from '../PropTypes';
import NavigationActions from '../NavigationActions';
import addNavigationHelpers from '../addNavigationHelpers';
import SceneView from './SceneView';

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

import type {
  HeaderMode,
} from './Header';

import type { TransitionConfig } from './TransitionConfigs';

import TransitionConfigs from './TransitionConfigs';

import TransitionItems from './Transition/TransitionItems';

const NativeAnimatedModule = NativeModules && NativeModules.NativeAnimatedModule;

type Props = {
  screenProps?: {};
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

class CardStack extends Component<DefaultProps, Props, void> {
  _render: NavigationSceneRenderer;
  _renderScene: NavigationSceneRenderer;
  _childNavigationProps: {
    [key: string]: NavigationScreenProp<*, NavigationAction>
  } = {};
  state: State;

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
      return nextState.transitionItems.areAllMeasured();
    }
  }

  componentWillReceiveProps(nextProps) {
    // console.log('routeName', getRoute(this.props), 'nextRoute', getRoute(nextProps))

    if (this.props.navigation !== nextProps.navigation) {
      const getRoute = props => props.navigation && props.navigation.state.routes[props.navigation.state.index];
      const fromRoute = getRoute(this.props);
      const toRoute = getRoute(nextProps);
      this._fromRoute = fromRoute;
      this._toRoute = toRoute;
      // When coming back from scene, onLayout won't be triggered, we'll need to do it manually.
      this.setState(prevState => ({
        transitionItems: prevState.transitionItems.removeAllMetrics(),
      }), () => this._onLayout());
    }
  }

  getChildContext() {
    const self = this;
    return {
      registerTransitionItem(item: TransitionItem) {
        // if (item.nativeHandle===7) console.log('==> registering', item.toString());
        self.setState((prevState: State) => ({
          transitionItems: prevState.transitionItems.add(item),
        }));
      },
      unregisterTransitionItem(id: string, routeName: string) {
        // console.log('==> unregistering', id, routeName);
        self.setState((prevState: State) => ({
          transitionItems: prevState.transitionItems.remove(id, routeName),
        }));
      },
    };
  }

  componentWillMount() {
    this._render = this._render.bind(this);
    this._renderScene = this._renderScene.bind(this);
  }

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
      ).transitionSpec,
    };
    if (
       !!NativeAnimatedModule
       // Native animation support also depends on the transforms used:
       && CardStackStyleInterpolator.canUseNativeDriver(isModal)
    ) {
      // Internal undocumented prop
      transitionSpec.useNativeDriver = false; //TODO make this user configurable
    }
    return transitionSpec;
  }

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
          const header = this.props.router.getScreenConfig(props.navigation, 'header') || {};
          return header.left;
        }}
        renderRightComponent={(props: NavigationTransitionProps) => {
          const header = this.props.router.getScreenConfig(props.navigation, 'header') || {};
          return header.right;
        }}
        renderTitleComponent={(props: NavigationTransitionProps) => {
          const header = this.props.router.getScreenConfig(props.navigation, 'header') || {};
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
          inputRange: [0, 0.01, 1],
          outputRange: [1, 0, 0],
        })
      : progress.interpolate({
          inputRange: [0, 0.99, 1],
          outputRange: [0, 0, 1],
        })
    );
    return { opacity };
  }

  _replaceFromToInStyleMap(styleMap, routeName: string, prevRouteName: ?string) {
    return {
      // ...styleMap,
      [prevRouteName || '$from']: styleMap.from, //TODO what should we do if prevRouteName === null?
      [routeName]: styleMap.to,
    }
  }

  _getTransition(routeName: string, prevRouteName: string) {
    const transitions = this.props.transitionConfigs.filter(c => (
      (c.from === prevRouteName || c.from === '*') &&
      (c.to === routeName || c.to === '*')));
    invariant(transitions.length <= 1, `More than one transitions found from "${prevRouteName}" to "${routeName}".`);
    return transitions[0] && transitions[0].transition;
  }

  _getFilteredFromToItems(transition, fromRouteName: string, toRouteName: string) {
    const isRoute = route => item => item.routeName === route;
    const filterPass = item => transition && (!!!transition.filter || transition.filter(item.id));

    const filteredItems = this.state.transitionItems.items().filter(filterPass);

    const fromItems = filteredItems.filter(isRoute(fromRouteName));
    const toItems = filteredItems.filter(isRoute(toRouteName));
    return { from: fromItems, to: toItems };
  }

  _createInPlaceTransitionStyleMap(
    transitionProps: NavigationTransitionProps,
    prevTransitionProps:NavigationTransitionProps) {
    const routeName = transitionProps && transitionProps.scene.route.routeName;
    const prevRouteName = prevTransitionProps && prevTransitionProps.scene.route.routeName;

    const transition = this._getTransition(routeName, prevRouteName);
    if (!transition || !this.state.transitionItems.areAllMeasured()) {
      return null;
    }

    const { from: fromItems, to: toItems } = this._getFilteredFromToItems(transition, prevRouteName, routeName);
    const itemsToClone = transition.getItemsToClone && transition.getItemsToClone(fromItems, toItems);

    const hideUntilDone = (items, onFromRoute: boolean) => items.reduce((result, item) => {
      result[item.id] = this._hideTransitionViewUntilDone(transitionProps, onFromRoute);
      return result;
    }, {}); 

    const styleMap = transition.createAnimatedStyleMap && transition.createAnimatedStyleMap(fromItems, toItems, transitionProps);
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
    inPlaceStyleMap = this._replaceFromToInStyleMap(inPlaceStyleMap, routeName, prevRouteName);
    console.log('==> inPlaceStyleMap', inPlaceStyleMap)
    
    return inPlaceStyleMap;
  }

  _renderOverlay(transitionProps) {
    const fromRouteName = this._fromRoute && this._fromRoute.routeName;
    const toRouteName = this._toRoute && this._toRoute.routeName;
    const transition = this._getTransition(toRouteName, fromRouteName);
    if (transition) {
      const { from: fromItems, to: toItems } = this._getFilteredFromToItems(transition, fromRouteName, toRouteName);
      const itemsToClone = transition.getItemsToClone && transition.getItemsToClone(fromItems, toItems);

      let styleMap = transition.createAnimatedStyleMapForClones && transition.createAnimatedStyleMapForClones(fromItems, toItems, transitionProps);
      styleMap = styleMap && this._replaceFromToInStyleMap(styleMap, toRouteName, fromRouteName);

      // TODO what if an item is the parent of another item?
      const clones = itemsToClone.map(item => {
        const animatedStyle = styleMap && styleMap[item.routeName] && styleMap[item.routeName][item.id];
        return React.cloneElement(item.reactElement, {
          style: [item.reactElement.props.style, styles.clonedItem, animatedStyle],
        }, []);
      });
      return (
        <View style={styles.overlay} pointerEvents="none">
          {clones}
        </View>
      );
    } else {
      return null;
    }
  }

  _render(
      props: NavigationTransitionProps, 
      prevTransitionProps:NavigationTransitionProps): React.Element<*> {
    let floatingHeader = null;
    const headerMode = this._getHeaderMode();
    if (headerMode === 'float') {
      floatingHeader = this._renderHeader(props, headerMode);
    }

    const styleMap = this._createInPlaceTransitionStyleMap(props, prevTransitionProps);

    const overlay = this._renderOverlay(props);
    return (
      <View style={styles.container}>
        <View
          style={styles.scenes}
        >
          {props.scenes.map(
            (scene: *) => this._renderScene({
              ...props,
              scene,
              navigation: this._getChildNavigation(scene),
            }, styleMap)
          )
          }
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
    );
    if (this.props.transitionConfig) {
      return {
        ...defaultConfig,
        ...this.props.transitionConfig(),
      };
    }

    return defaultConfig;
  }

  _renderInnerCard(
    SceneComponent: ReactClass<*>,
    props: NavigationSceneRendererProps,
  ): React.Element<*> {
    const header = this.props.router.getScreenConfig(props.navigation, 'header');
    const headerMode = this._getHeaderMode();
    if (headerMode === 'screen') {
      const isHeaderHidden = header && header.visible === false;
      const maybeHeader =
        isHeaderHidden ? null : this._renderHeader(props, headerMode);
      return (
        <View style={styles.container}>
          <SceneView
            screenProps={this.props.screenProps}
            navigation={props.navigation}
            component={SceneComponent}
          />
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
      navigation = this._childNavigationProps[scene.key] = addNavigationHelpers({
        ...this.props.navigation,
        state: scene.route,
      });
    }
    return navigation;
  }

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
      this.setState((prevState: State): State => ({
        ...prevState,
        transitionItems: prevState.transitionItems.updateMetrics(toUpdate),
      }));
    }
    console.log(`====> _measureItems took ${new Date() - then} ms`);
  }

  async _onLayout() {
    const fromRoute = this._fromRoute;
    const toRoute = this._toRoute;
    if (fromRoute && toRoute) {
      const transition = this._getTransition(toRoute.routeName, fromRoute.routeName);
      let itemsToMeasure = [];
      if (transition && transition.getItemsToMeasure) {
        const { from, to } = this._getFilteredFromToItems(transition, fromRoute.routeName, toRoute.routeName);
        itemsToMeasure = transition.getItemsToMeasure(from, to);
      }
      this.setState(prevState => ({
        ...prevState,
        transitionItems: prevState.transitionItems.setShouldMeasure(itemsToMeasure),
      }), () => this._measureItems());
    }
  }

  _renderScene(props: NavigationSceneRendererProps, transitionStyleMap): React.Element<*> {
    const isModal = this.props.mode === 'modal';

    let panHandlers = null;

    const cardStackConfig = this.props.router.getScreenConfig(
      props.navigation,
      'cardStack'
    ) || {};

    // On iOS, the default behavior is to allow the user to pop a route by
    // swiping the corresponding Card away. On Android this is off by default
    const gesturesEnabledConfig = cardStackConfig.gesturesEnabled;
    const gesturesEnabled = typeof gesturesEnabledConfig === 'boolean' ?
      gesturesEnabledConfig :
      Platform.OS === 'ios';
    if (gesturesEnabled) {
      let onNavigateBack = null;
      if (this.props.navigation.state.index !== 0) {
        onNavigateBack = () => this.props.navigation.dispatch(
          NavigationActions.back({ key: props.scene.route.key })
        );
      }
      const panHandlersProps = {
        ...props,
        onNavigateBack,
        gestureResponseDistance: this.props.gestureResponseDistance,
      };
      panHandlers = isModal ?
        CardStackPanResponder.forVertical(panHandlersProps) :
        CardStackPanResponder.forHorizontal(panHandlersProps);
    }

    const SceneComponent = this.props.router.getComponentForRouteName(props.scene.route.routeName);

    return (
      <Card
        {...props}
        key={`card_${props.scene.key}`}
        onLayout={this._onLayout.bind(this)}
        panHandlers={panHandlers}
        renderScene={(sceneProps: *) => this._renderInnerCard(SceneComponent, sceneProps)}
        style={this.props.cardStyle}
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
