import type {KeyInput} from '@dogfight/shared/types';
export type InputController=KeyInput & {justPressed(code:string):boolean;endFrame():void};
export function createInput(target:Window):InputController{
 const down=new Set<string>();const pressed=new Set<string>();
 target.addEventListener('keydown',event=>{if(!down.has(event.code))pressed.add(event.code);down.add(event.code);});
 target.addEventListener('keyup',event=>down.delete(event.code));
 return {isDown(code){return down.has(code);},justPressed(code){return pressed.has(code);},endFrame(){pressed.clear();}};
}
