class PhotoGrid extends Component {
  ....
  renderCell(photo) {
    return (
      <View>
        <Transition.View id={`image-${photo.url}`}>
          <Image />
        </Transition.View>
        <Text>{photo.title}</Text>
      </View>
    );
  }
}

const PhotoDetail = ({photo}) => (
  <View>
    <Transition.View id={`image-${photo.url}`}>
      <Image />
    </Transition.View>
    <Transition.View id={`title`}>
      <Text>{photo.title}</Text>
    </Transition.View>
    <Transition.View id={`description`}>
      <Text>{photo.description}</Text>
    </Transition.View>
  </View>
);

const TitleAppear = OpacityAppear(/title/);

const DescAppear = OpacityAppear(/description/);

const SharedImage = SharedElements(/image-.+/);

const SharedElements = (animateIdRegex) => (duration:number) => (
  {
    shouldAnimate(view: TransitionView):boolean {
      //
    }
    createAnimations(
      viewsOnFromRoute: Array<TransitionView>,
      viewsOnToRoute: Array<TransitionView>
    ) {
      ...
      // return a map of animated styles for all views with an "animateId" prop.
    }
    createSceneAnimation() {
      const inputRange = [0, 1];
      return {
        fromScene: {
          opacity: {
            inputRange,
            outputRange: [1, 0],
          }
        },
        toScene: {
          opacity: {
            inputRange,
            outputRange: [0, 1],
          }
        }
      }
    }
  }
);


const together = (..transitions:Array<Transition>):Transition => {
  return {
    createAnimations(
      transitionProps: NavigationTransitionProps, 
      prevTranstionProps: NavigationTransitionProps, 
      viewsOnFromRoute: Array<TransitionView>,
      viewsOnToRoute: Array<TransitionView>
    ) {
      return transitions.reduce((result, transition) => ({
        ...result,
        ...transition.createAnimations(transitionProps, prevTranstionProps, viewsOnFromRoute, viewsOnToRoute),        
      }), {});
    }
  }
}

const seq = (..transitions:Array<Transition>):Transition => {
}

const MyApp = StackNavigator({
  PhotoGrid: {
    screen: PhotoGrid,
  },
  PhotoDetail: {
    screen: PhotoDetail,
  },
  Settings: {
    screen: Settings,
  },
}, {
    transitions: [
      {
        from: 'PhotoGrid', 
        to: 'PhotoDetail', 
        // [SharedImage(), 0.9 -> [TitleAppear(), DescAppear()]] 
        transition: together(SharedImage(), seq(Idle(0.9), together(TitleAppear(), DescAppear())))
      },
      {
        from: 'PhotoDetail', 
        to: 'PhotoGrid', 
        // TitleDisappear(0.1) -> DescDisappear(0.1) -> SharedImage()
        transition: seq(TitleDisappear(0.1), DescDisappear(0.1), SharedImage()),
      },
    ],
    configureTransition(transitionProps, prevTranstionProps) {
      //
    },
  }
});

// by default, transition views have the same animated style as its original 
// owner scene, i.e. if not configured, they will move, fade etc together 
// with the original owner scene, EVEN though they are separate from them.

progress.interpolate({
  inputRange,
  outputRange,
});

// [SharedImage(), 0.9 -> [TitleAppear(), DescAppear()]] 
{
  // SharedElements
  image1234: {
    left: {
      inputRange: [0, 1],
      outputRange: [fromLeft, toLeft],
    }
    ...
  },
  title: {
    opacity: {
      inputRange: [0, 0.9, 1],
      outputRange: [0, 0, 1],
    }
  }
}

// TitleDisappear(0.1) -> DescDisappear(0.1) -> SharedImage()
{
  title: {
    opacity: {
      inputRange: [0, 0.1, 1],
      outputRange: [1, 0, 0],
    }
  },
  description: {
    opacity: {
      inputRange: [0, 0.1, 0.2, 1],
      outputRange: [1, 1, 0, 0],
    }
  },
  image1234: {
    left: {
      inputRange: [0, 0.2, 1],
      outputRange: [fromLeft, fromLeft, toLeft],
    }
    ...
  },
}

// conflicts?

// TODOs:
//   - scene animations
//   - create additional elements (darkening layer etc.)
//   - perhaps we could just animate the transition views in place instead of cloning it?

class CardStack {
  _render(props) {
    ....
    return (
      <View>
        <View>
          {props.scenes.map(scene => (
            <Transition.View id={`$scene-${scene.route.routeName}`}>
              { this._renderScene(...) }
            </Transition.View>
          ))}
        </View>
        {
          floatingHeader && (
            <Transition.View id="$floatingHeader">
              { floatingHeader }
            </Transition.View>
          )
        }
        { transitionOverlay }
      </View>
    )
  }
}