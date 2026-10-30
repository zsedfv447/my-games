import type { ScreenDef } from '../router';
import { titleScreen } from './title';
import { homeScreen } from './home';
import { adventureScreen } from './adventure';
import { archetypesScreen } from './archetypes';
import { settingsScreen } from './settings';
import { galleryScreen } from './gallery';
import { storiesScreen, storyScreen } from './story';
import { placeholderScreens } from './placeholders';
import { prepareScreen } from './prepare';
import { battleScreen } from './battle';
import { stagesScreen } from './stages';
import { teamScreen } from './team';
import { cardScreen, cardsScreen } from './cards';
import { summonHistoryScreen, summonRatesScreen, summonScreen } from './summon';
import { summonRitualScreen } from './summon-ritual';

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
  storiesScreen,
  prepareScreen,
  battleScreen,
  stagesScreen,
  teamScreen,
  cardsScreen,
  cardScreen,
  summonScreen,
  summonRatesScreen,
  summonHistoryScreen,
  summonRitualScreen,
];
