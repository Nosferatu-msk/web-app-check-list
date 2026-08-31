declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import { Component } from 'react';
  import { TextProps, ColorValue } from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: ColorValue | string;
  }

  export default class Icon extends Component<IconProps> {}
}
