import type { ScreenDef } from '../router';
import { titleScreen } from './title';
import { homeScreen } from './home';
import { adventureScreen } from './adventure';
import { archetypesScreen } from './archetypes';
import { settingsScreen } from './settings';
import { galleryScreen } from './gallery';
import { storyScreen } from './story';
import { placeholderScreens } from './placeholders';

/** GDD 2.5 全部畫面；正式畫面完成後取代同名的建置中畫面 */
export const SCREENS: ScreenDef[] = [
  ...placeholderScreens,
  titleScreen,
  homeScreen,
  adventureScreen,
  archetypesScreen,
  settingsScreen,
  galleryScreen,
  storyScreen,
];
