const GalleryScreen = (props) => (
  <View>
    <Header transitionId="header" />
    <ListView renderRow={row => (
      <View>
        <Image transitionId={`photo-${row.id}`} />
      </View>
    )} />
    <Footer transitionId="footer" />
  </View>
);

const DetailScreen = ({item}) => (
  <View>
    <Header transitionId="header" />
    <View>
      <Image transitionId={`photo-${item.id}`} />
      <Text transitionId={`title-${item.id}`}>{item.title}</Text>
      <Text transitionId={`subtitle-${item.id}`}>{item.subtitle}</Text>
    </View>
    <Text transitionId={`description-${item.id}`}>{item.description}</Text>
    <Footer transitionId="footer" />
  </View>
);

const Lift = (filter) => (duration) => ({
  filter,
  duration,
  createAnimation(tviews) {
    return tviews.reduce((result, tview) => {
      result[tview.id] = {
        elevation: [0, 15],
      }
      return result;
    }, {});
  }
});

// TODO: z-index?
const Darken = (filter) => (duration) => ({
  filter,
  duration,
  createAnimation(tviews) {
    return tviews.reduce((result, tview) => {
      const style = createStyle(tview.boundingBox);
      const newViewId = 'darken-' + tview.id;
      result[newViewId] = {
        view: animatedStyle => <AnimatedView style={[style, animatedStyle]} />,
        backgroundColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,100)'],
      }
      return result;
    }, {});
  }
})

const DarkenGallery = Darken(/\$scene-GalleryScreen/);

const LiftPhotoContainer = Lift(/photoContainer-.+/);

const SharedElements = (easing) => (filter) => (duration) => ({
  filter,
  duration,
  createAnimation(tviews) {
    const pairs = partitionAsPairs(tviews);
    return pairs.reduce((result, pair) => {
      result[pair.fromTView.id] = {
        left: {
          outputRange: [pair.fromTView.left, pair.toTView.left],
          easing,
        },
      }
      return result;
    }, {});
  }
})

const SharedPhoto = SharedElements(easingArcMotion)(/photo-.+/);

const transitions = [
  {
    from: 'GalleryScreen',
    to: 'DetailScreen',
    transition: [DarkenGallery(0.1), LiftPhotoContainer(0.2) -> [SharedPhoto(), SharedPhotoContainer()]]
  }
]

// - shared photo: move in an arc => zoom
// - shared container: move along the same path as photo => zoom differently 