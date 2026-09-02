const React = require('react');
const { View, Text, TouchableOpacity, ScrollView, FlatList, StyleSheet, Image, Alert } = React;

module.exports = {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet: {
    create: (styles) => styles,
    absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    hairlineWidth: 1,
  },
  Image,
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
  },
  StatusBar: {
    currentHeight: 44,
  },
  Linking: {
    openURL: jest.fn(),
  },
  Share: {
    share: jest.fn(),
  },
};
