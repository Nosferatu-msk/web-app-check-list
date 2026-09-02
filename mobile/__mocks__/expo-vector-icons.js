const React = require('react');
const { Text } = require('react-native');

module.exports = {
  MaterialCommunityIcons: ({ name, size, color, ...props }) => 
    React.createElement(Text, { testID: `icon-${name}` }, `Icon:${name}`),
  MaterialIcons: ({ name, size, color, ...props }) => 
    React.createElement(Text, { testID: `icon-${name}` }, `Icon:${name}`),
  Ionicons: ({ name, size, color, ...props }) => 
    React.createElement(Text, { testID: `icon-${name}` }, `Icon:${name}`),
};
