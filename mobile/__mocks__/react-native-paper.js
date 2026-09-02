const React = require('react');
const { View, Text, TouchableOpacity } = require('react-native');

module.exports = {
  Text: Text,
  Button: ({ children, onPress, mode, ...props }) => 
    React.createElement(TouchableOpacity, { onPress, ...props }, 
      React.createElement(Text, null, children || 'Button')
    ),
  Surface: View,
  ActivityIndicator: ({ size, color }) => React.createElement(View, { testID: 'activity-indicator' }),
  SegmentedButtons: ({ buttons, value, onValueChange }) => 
    React.createElement(View, null, 
      buttons.map((b, i) => React.createElement(Text, { key: i }, b.label))
    ),
  List: {
    Item: ({ title, description, ...props }) => 
      React.createElement(View, null, 
        React.createElement(Text, null, title || ''), 
        description && React.createElement(Text, null, description)
      ),
  },
  Switch: ({ value, onValueChange, ...props }) => 
    React.createElement(TouchableOpacity, { 
      onPress: () => onValueChange && onValueChange(!value),
      ...props 
    }, React.createElement(Text, null, String(value))),
  TextInput: ({ value, onChangeText, mode, ...props }) => 
    React.createElement(Text, { testID: 'text-input' }, value || ''),
  FAB: ({ onPress, icon, ...props }) => 
    React.createElement(TouchableOpacity, { onPress }, 
      React.createElement(Text, null, 'FAB')
    ),
  Provider: ({ children }) => children,
  PaperProvider: ({ children }) => children,
};
