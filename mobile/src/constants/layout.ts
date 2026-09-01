import { StatusBar, Platform } from 'react-native';

export const STATUS_BAR_HEIGHT = StatusBar.currentHeight ?? 44;
export const NAV_BAR_HEIGHT = 42;
export const HOME_INDICATOR_HEIGHT = 6;

export const TAB_BAR_HEIGHT = 63;

export const BOTTOM_PADDING_TAB_SCREEN = TAB_BAR_HEIGHT + NAV_BAR_HEIGHT + HOME_INDICATOR_HEIGHT + 19;
export const BOTTOM_PADDING_NESTED_SCREEN = NAV_BAR_HEIGHT + HOME_INDICATOR_HEIGHT + 22;

export const HEADER_HEIGHT = 56;
export const HEADER_BACK_SIZE = 40;
export const HEADER_TITLE_SIZE = 17;

export const TOUCH_TARGET_MIN = 48;
