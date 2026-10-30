import './ui/theme.css';
import { gameData } from './data/load';

// 暫時的標題畫面；介面負責人會換成正式的畫面路由
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="title-screen">
    <h1>星骸契約</h1>
    <p>Starfall Covenant</p>
    <p class="hint">開發中・${gameData.archetypes.length} 個流派</p>
  </main>
`;
