import * as rx from "rxjs";
import { SchedulerLike } from "rxjs";
import { map } from 'rxjs/internal/operators/map';
import { scan } from 'rxjs/internal/operators/scan';
import { observeOn } from 'rxjs/internal/operators/observeOn';
import { subscribeOn } from 'rxjs/internal/operators/subscribeOn';
import { tap } from 'rxjs/internal/operators/tap';
import { startWith } from 'rxjs/internal/operators/startWith';
import { catchError } from 'rxjs/internal/operators/catchError';
import { switchAll } from 'rxjs/internal/operators/switchAll';
import { take } from 'rxjs/internal/operators/take';
import { delay } from 'rxjs/internal/operators/delay';
import { retryWhen } from 'rxjs/internal/operators/retryWhen';
import { switchMap } from 'rxjs/internal/operators/switchMap';
import { distinctUntilChanged } from 'rxjs/internal/operators/distinctUntilChanged';
import { shareReplay } from 'rxjs/internal/operators/shareReplay';
import { filter } from 'rxjs/internal/operators/filter';
import { mergeMap } from 'rxjs/internal/operators/mergeMap';
import js from "./js+extensions";

export type FeedbackLoop<State, Event> = (
  state: rx.Observable<State>,
  scheduler: SchedulerLike
) => rx.Observable<Event>;

export function embedFeedbackLoop<
  InnerState,
  InnerEvent,
  OuterState,
  OuterEvent
>(
  loops: FeedbackLoop<InnerState, InnerEvent>[],
  how: {
    selectState: (outerState: OuterState) => InnerState;
    embedEvent: (outerEvent: InnerEvent) => OuterEvent;
  }
): FeedbackLoop<OuterState, OuterEvent> {
  return (outerState, scheduler) => {
    const embededLoops = loops.map(loop =>
      loop(outerState.pipe(map(how.selectState)), scheduler)
        .pipe(map(how.embedEvent))
    );
    return rx.merge(...embededLoops);
  };
}

export type SingleMessage<Message, SuccessResult, ErrorResult> =
  | { kind: "idle" }
  | { kind: "try"; message: Message }
  | { kind: "success"; result: SuccessResult }
  | { kind: "failed"; result: ErrorResult };

export namespace SingleMessage {
  export function idle<Message, SuccessResult, ErrorResult>(): SingleMessage<
    Message,
    SuccessResult,
    ErrorResult
  > {
    return { kind: "idle" };
  }

  export function tryMessage<Message, SuccessResult, ErrorResult>(
    message: Message
  ): SingleMessage<Message, SuccessResult, ErrorResult> {
    return { kind: "try", message: message };
  }

  export function success<Message, SuccessResult, ErrorResult>(
    result: SuccessResult
  ): SingleMessage<Message, SuccessResult, ErrorResult> {
    return { kind: "success", result: result };
  }

  export function failed<Message, SuccessResult, ErrorResult>(
    result: ErrorResult
  ): SingleMessage<Message, SuccessResult, ErrorResult> {
    return { kind: "failed", result: result };
  }
}

export function isIdle<Message, SuccessResult, ErrorResult>(
  message: SingleMessage<Message, SuccessResult, ErrorResult>
): boolean {
  return message.kind === "idle";
}

export function isTry<Message, SuccessResult, ErrorResult>(
  message: SingleMessage<Message, SuccessResult, ErrorResult>
): Message | null {
  if (message.kind === "try") {
    return message.message;
  }
  return null;
}

export function isSuccess<Message, SuccessResult, ErrorResult>(
  message: SingleMessage<Message, SuccessResult, ErrorResult>
): SuccessResult | null {
  if (message.kind === "success") {
    return message.result;
  }
  return null;
}

export function isFailed<Message, SuccessResult, ErrorResult>(
  message: SingleMessage<Message, SuccessResult, ErrorResult>
): ErrorResult | null {
  if (message.kind === "failed") {
    return message.result;
  }
  return null;
}

export function system<State, Event>(
  initialState: State,
  reduce: (state: State, event: Event) => State,
  feedbacks: Array<FeedbackLoop<State, Event>>
): rx.Observable<State> {
  return rx.defer(() => {
    const state = new rx.ReplaySubject<State>(1);
    const scheduler = rx.queueScheduler;
    const events = feedbacks.map(x => x(state, scheduler));
    const mergedEvents: rx.Observable<Event> = rx.merge(
      ...events
    ).pipe(
      observeOn(scheduler)
    );

    const eventsWithEffects = mergedEvents
      .pipe(
        scan(reduce, initialState),
        tap(x => {
          state.next(x);
        }),
        subscribeOn(scheduler),
        startWith(initialState),
        observeOn(scheduler)
      );

    const hackOnSubscribed: rx.Observable<State> = rx.defer(() => {
      state.next(initialState);
      return rx.empty();
    });

    return rx.merge(...[eventsWithEffects, hackOnSubscribed])
      .pipe(
        catchError(
          e => {
            dispatchError(e);
            return rx.throwError(e);
          }
        )
      );
  });
}

function takeUntilWithCompleted<E, O>(
  other: rx.Observable<O>,
  scheduler: SchedulerLike
): ((source: rx.Observable<E>) => rx.Observable<E>) { 
  return source => {
    const completeAsSoonAsPossible = rx.empty(scheduler);
    return other
      .pipe(
        take(1),
        map(_ => completeAsSoonAsPossible),
        startWith(source),
        switchAll()
      )
  }
}

function enqueue<E>(scheduler: SchedulerLike):
  (source: rx.Observable<E>) => rx.Observable<E> {
  return source => source.pipe(
    observeOn(scheduler),
    subscribeOn(scheduler)
  );
}

export type TimeIntervalInSeconds = number;

export type FeedbackRetryStrategy<Event> =
  | { kind: "ignoreErrorJustComplete" }
  | { kind: "ignoreErrorAndReturn"; value: Event }
  | { kind: "catchError"; handle: (error: {}) => Event }
  | {
      kind: "exponentialBackoff";
      initialTimeout: TimeIntervalInSeconds;
      maxBackoffFactor: number;
    };

export function defaultRetryStrategy<Event>(): FeedbackRetryStrategy<Event> {
  return {
    kind: "exponentialBackoff",
    initialTimeout: 1,
    maxBackoffFactor: 8
  };
}

let dispatchErrors = new rx.Subject<Error>();

function dispatchError(error: any) {
  if (error instanceof Error || error.constructor === Error) {
    dispatchErrors.next(error);
    return;
  }
  dispatchErrors.next(new Error(error));
}

export let unhandledErrors: rx.Observable<Error> = dispatchErrors;

export function materializedRetryStrategy<Event>(
  strategy: FeedbackRetryStrategy<Event>
): ((source: rx.Observable<Event>) => rx.Observable<Event>) {
  return (source): rx.Observable<Event> => {
    switch (strategy.kind) {
      case "ignoreErrorJustComplete":
        return source.pipe(
          catchError(e => {
            dispatchError(e);
            return rx.empty();
          })
        );
      case "ignoreErrorAndReturn":
        return source.pipe(
          catchError(e => {
            dispatchError(e);
            return rx.of(strategy.value);
          })
        );
      case "exponentialBackoff":
        return rx.defer(() => {
          let counter = 1;
          return source.pipe(
            tap(
              () => {
                counter = 1;
              },
              () => {
                if (counter * 2 <= strategy.maxBackoffFactor) {
                  counter *= 2;
                }
              }
            ),
            retryWhen(e =>
              e.pipe(
                switchMap(x => {
                  dispatchError(x);
                  return rx.of(0).pipe(
                    delay(
                      strategy.initialTimeout * counter * 1000
                    )
                  );
                })
              )
            )
          )
        });
      case "catchError":
        return source.pipe(
          catchError(e => {
            dispatchError(e);
            return rx.of(strategy.handle(e));
          })
        );
      default:
        return js.unhandledCase(strategy);
    }
  };
}

export namespace Feedbacks {
  export function react<State, Query, Event>(
    query: (state: State) => Query | null,
    effects: (query: Query) => rx.Observable<Event>,
    retryStrategy: FeedbackRetryStrategy<Event>
  ): FeedbackLoop<State, Event> {
    const retryer = materializedRetryStrategy(retryStrategy);
    return (state, scheduler) => {
      return retryer(
        state.pipe(
          map(query),
          distinctUntilChanged(
            (lhs, rhs) => js.canonicalString(lhs) === js.canonicalString(rhs)
          ),
          switchMap(maybeQuery => {
            if (maybeQuery === null) {
              return rx.empty();
            }

            let source: rx.Observable<Event> = rx.defer(() => effects(maybeQuery));
            return retryer(
              source.pipe(
                enqueue(scheduler)
              )
            );
          })
        )
      );
    };
  }

  export function reactSet<State, Query, Event>(
    query: (state: State) => Set<Query>,
    effects: (query: Query) => rx.Observable<Event>,
    retryStrategy: FeedbackRetryStrategy<Event>
  ): FeedbackLoop<State, Event> {
    const retryer = materializedRetryStrategy(retryStrategy);
    return (state, scheduler) => {
      const querySequence: rx.Observable<Set<Query>> = state.pipe(
        map(x => query(x)),
        shareReplay(1)
      )

      const serializedQuerySequence: rx.Observable<Set<string>> = querySequence.pipe(
        map(js.canonicalSetValues), 
        shareReplay(1)
      );

      const newQueries = rx.zip(
        querySequence,
        serializedQuerySequence.pipe(
          startWith(new Set<string>())
        )
      ).pipe(
        map(queries => {
          return js.canonicalDifference(queries[0], queries[1]);
        })
      );

      return retryer(
        newQueries.pipe(
          mergeMap(controls => {
            const allEffects = js
              .toArray(controls)
              .map((maybeQuery: Query): rx.Observable<Event> => {
                let serializedMaybeQuery = js.canonicalString(maybeQuery);
                return retryer(
                  rx.defer(() => effects(maybeQuery)).pipe(
                    takeUntilWithCompleted(
                      serializedQuerySequence.pipe(
                        filter(queries => !queries.has(serializedMaybeQuery))
                      ),
                      scheduler
                    ),
                    enqueue(scheduler)
                  )
                );
              });
            return rx.merge(...allEffects);
          })
        )
      );
    };
  }
}
