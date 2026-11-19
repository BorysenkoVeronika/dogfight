import {Bus} from '@dogfight/shared/sim/bus';
import type {GameEvents} from '@dogfight/shared/types';
export const gameEvents=new Bus<GameEvents>();
