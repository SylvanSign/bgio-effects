import type { BoardProps } from 'boardgame.io/react';
import type { Emitter, Handler, WildcardHandler } from 'mitt';
import { useCallback, useContext, useEffect } from 'react';
import { EffectsContext } from '../contexts';
import type { EffectsPluginConfig } from '../../types';
import type { ListenerArgs, InternalEffectShape } from '../types';
import { hookErrorMessage } from './utils';

type NaiveEffectListener = (payload: any, boardProps: BoardProps) => void;
type NaiveWildcardListener = (
  effectName: string | symbol,
  payload: any,
  boardProps: BoardProps
) => void;
type NaiveListener = NaiveWildcardListener | NaiveEffectListener;
type NaiveArgs = [
  string,
  NaiveListener,
  React.DependencyList,
  NaiveListener?,
  React.DependencyList?
];

/**
 * No-op fallback for `useCallback` that is never actually called.
 */
// istanbul ignore next
function noop() {}

/**
 * Subscribe to a Mitt instance with automatic callback memoization & clean-up.
 * @param  emitter - The Mitt instance to subscribe to.
 * @param  effectType - Name of the effect to listen for. '*' listens to any.
 * @param  handler - Function to call when the event is emitted.
 * @param  dependencies - Array of variables the handler depends on.
 */
function useMittSubscription(
  emitter: Emitter,
  effectType: string,
  handler?: NaiveListener,
  dependencies: React.DependencyList | undefined = []
) {
  const hasHandler = !!handler;
  handler = handler || noop;
  /**
   * This is not strictly speaking a safe use of `useCallback.`
   * Code like `useEffectListener('x', flag ? () => {} : () => {}, [])`
   * will be buggy. The initially passed function will never be updated because
   * the functions themselves aren’t included as dependencies (to avoid
   * infinite loops). It seems there is no technically correct way to
   * wrap `useCallback` in a custom hook if the function comes from outside
   * the hook. The only 100% correct solution here would be to require users
   * to pass a stable function they got from `useCallback` themselves,
   * which for now we’ve avoided in order to simplify the API.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedHandler: Handler | WildcardHandler = useCallback(
    effectType === '*'
      ? (effectName, { payload, boardProps }: InternalEffectShape) =>
          (handler as NaiveWildcardListener)(effectName, payload, boardProps)
      : ({ payload, boardProps }: InternalEffectShape) =>
          (handler as NaiveEffectListener)(payload, boardProps),
    [...dependencies, effectType]
  );

  useEffect(() => {
    if (!hasHandler) return;

    let cleanup: void | (() => void);

    const cb = (...args: any[]) => {
      if (typeof cleanup === 'function') cleanup();
      cleanup = (memoizedHandler as any)(...args);
    };

    emitter.on(effectType, cb);

    return () => {
      emitter.off(effectType, cb);
      if (typeof cleanup === 'function') cleanup();
    };
  }, [effectType, emitter, memoizedHandler, hasHandler]);
}

/**
 * Subscribe to events emitted by the effects state.
 * @param effectType - Name of the effect to listen for. '*' listens to any.
 * @param callback - Function to call when the event is emitted.
 * @param dependencyArray - Array of variables the callback function depends on.
 * @param onEndCallback - Function to call when the effect ends.
 * @param onEndDependencyArray - Array of variables onEndCallback depends on.
 */
export function useEffectListener<
  C extends EffectsPluginConfig,
  G extends any = any
>(...args: ListenerArgs<C['effects'], G>): void {
  const { emitter, endEmitter } = useContext(EffectsContext);
  const [effectType, cb, deps, onEndCb, onEndDeps] = args as NaiveArgs;

  if (!emitter || !endEmitter)
    throw new Error(hookErrorMessage('useEffectListener'));
  if (!deps)
    throw new TypeError(
      'useEffectListener must receive a dependency list as its third argument.'
    );
  if (onEndCb && !onEndDeps)
    throw new TypeError(
      'useEffectListener must receive a dependency list as its fifth argument when using an onEffectEnd callback.'
    );

  useMittSubscription(emitter, effectType, cb, deps);
  useMittSubscription(endEmitter, effectType, onEndCb, onEndDeps);
}
