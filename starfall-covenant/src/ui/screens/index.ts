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
import { abyssScreen } from './abyss';
import { teamScreen } from './team';
import { cardScreen, cardsScreen } from './cards';
import { summonScreen, summonRatesScreen, summonHistoryScreen } from './summon';
import { summonRitualScreen } from './summon-ritual';
import { enhanceScreen } from './enhance';
import { evolveScreen } from './evolve';
import { shopScreen } from './shop';
import { loginBonusScreen } from './login-bonus';
import { achievementsScreen, questsScreen } from './quests';
import { collectionCardScreen, collectionScreen } from './collection';
import { helperScreen } from './helper';
import { notebookScreen } from './notebook';
import { titlesScreen } from './titles';
import { puzzleScreen } from './puzzle';

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
  abyssScreen,
  teamScreen,
  cardsScreen,
  cardScreen,
  summonScreen,
  summonRatesScreen,
  summonHistoryScreen,
  summonRitualScreen,
  enhanceScreen,
  evolveScreen,
  shopScreen,
  loginBonusScreen,
  questsScreen,
  achievementsScreen,
  collectionScreen,
  collectionCardScreen,
  helperScreen,
  notebookScreen,
  titlesScreen,
  puzzleScreen,
];
