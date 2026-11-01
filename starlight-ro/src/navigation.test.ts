import {expect,it} from 'vitest';
import {nextWarp,questDestination} from './navigation';
import {quests} from './data/quests';
it('routes from cave to town through forest without teleporting',()=>{expect(nextWarp('cave','town')?.to).toBe('forest');expect(nextWarp('meadow','town')?.to).toBe('town');expect(nextWarp('town','town')).toBeNull();});
it('finds source monsters for a collection goal',()=>{expect(questDestination(quests.find(q=>q.id==='honey')!)?.map).toBe('forest');});
it('keeps job quest destination at the town job officer',()=>{expect(questDestination(quests.find(q=>q.id==='job')!)?.npc).toBe('job');});
