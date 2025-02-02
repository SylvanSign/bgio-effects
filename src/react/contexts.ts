import { createContext } from 'react';
import type { Emitter } from 'mitt';
import type { BoardProps } from 'boardgame.io/react';
import { QueueAPI } from './types';

export const EffectsContext = createContext<{
  emitter: Emitter | null;
  endEmitter: Emitter | null;
}>({ emitter: null, endEmitter: null });

export const EffectsQueueContext = createContext<QueueAPI | undefined>(
  undefined
);

export const EffectsPropsContext = createContext<BoardProps | undefined>(
  undefined
);
