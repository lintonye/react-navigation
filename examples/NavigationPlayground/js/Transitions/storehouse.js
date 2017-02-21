// https://capptivate.co/2015/01/11/storehouse-2/
// https://video.capptivate.co/videos/StorehouseStory/StorehouseStory.mov

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

const MyApp = StackNavigator({
  GalleryScreen: {
    screen: GalleryScreen,
  },
  DetailScreen: {
    screen: DetailScreen,
  }
}, {
  transitions: [
    {
      from: 'GalleryScreen', 
      to: 'DetailScreen', 
      transition: [SharedPhoto(), PushAwayHeader(0.1), PushAwayFooter(0.1)]
        -> [SlideInHeader(0.1), SlideInFooter(0.1)]
    },
    {
      from: 'DetailScreen', 
      to: 'GalleryScreen', 
      transition: [SharedPhoto2(), SlideInHeader(0.1), SlideInFooter(0.1)]
    },
  ]
})

const SharedPhoto = SharedElements({
  sharedElements: [/photo-.+/, /title-.+/, /subtitle-.+/],
  
});

//TODO how to animate description (Gallery -> Detail)?
// - should it be part of SharedPhoto, or a standalone transition?
// - if standalone, how to communicate values between SharedPhoto and the new transition?
