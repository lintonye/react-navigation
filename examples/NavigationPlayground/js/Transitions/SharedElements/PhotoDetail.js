// @flow
import React, { Component } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  Text,
  Easing,
} from 'react-native';

import { Transition } from 'react-navigation';

import Touchable from './Touchable';

const { width: windowWidth } = Dimensions.get("window");

const PhotoDetail = (props) => {
  const { photo } = props.navigation.state.params;
  const { url, title, description, image } = photo;
  const openMoreDetails = photo => props.navigation.navigate('PhotoMoreDetail', { photo });
  return (
    <View>
      <ScrollView>
        <View>
          <Touchable onPress={() => openMoreDetails(photo)}>
            <View>
              <Transition.Image id={`image-${url}`} source={image} style={styles.image} />
            </View>
          </Touchable>
          <Transition.Text id={`title-${url}`}
            style={[styles.text, styles.title]} fontSize={35}>{title}</Transition.Text>
          <Text style={[styles.text]}>{description}</Text>
        </View>
      </ScrollView>
    </View>
  )
};

PhotoDetail.navigationOptions = {
  title: 'Photo Detail'
}

const styles = StyleSheet.create({
  image: {
    width: windowWidth,
    height: windowWidth / 2,
  },
  title: {
    fontSize: 35,
    fontWeight: 'bold',
  },
  text: {
    margin: 15,
  }
})

export default PhotoDetail;