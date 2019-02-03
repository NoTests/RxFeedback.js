import * as rx from "rxjs";
import { SchedulerLike, SubscriptionLike, BehaviorSubject, MonoTypeOperatorFunction } from "rxjs";
import { map } from 'rxjs/internal/operators/map';
import { scan } from 'rxjs/internal/operators/scan';
import { observeOn } from 'rxjs/internal/operators/observeOn';
import { subscribeOn } from 'rxjs/internal/operators/subscribeOn';
import { tap } from 'rxjs/internal/operators/tap';
import { startWith } from 'rxjs/internal/operators/startWith';
import { catchError } from 'rxjs/internal/operators/catchError';
import { delay } from 'rxjs/internal/operators/delay';
import { retryWhen } from 'rxjs/internal/operators/retryWhen';
import { switchMap } from 'rxjs/internal/operators/switchMap';
import { deepEqual, unhandledCase, canonicalString } from "./js+extensions";

/**
 * Feedback loop transforming `State` into a sequence of `Event`s.
 */
export type FeedbackLoop<State, Event> = (
  state: rx.Observable<State>,
  scheduler: SchedulerLike
) => rx.Observable<Event>;

/**
 * Lifts feedback loop that operates on a subset of state and emits embeddable events to the parent feedback loop.
 * 
 * @param loops Lifted feedback loops.
 * @param mappings State and event transformers.
 */
export function liftFeedbackLoop<
  InnerState,
  InnerEvent,
  OuterState,
  OuterEvent
>(
  loops: FeedbackLoop<InnerState, InnerEvent>[],
  mappings: {
    mapState: (outerState: OuterState) => InnerState;
    mapEvent: (outerEvent: InnerEvent) => OuterEvent;
  }
): FeedbackLoop<OuterState, OuterEvent> {
  return (outerState, scheduler) => {
    const embededLoops = loops.map(loop =>
      loop(outerState.pipe(map(mappings.mapState)), scheduler)
        .pipe(map(mappings.mapEvent))
    );
    return rx.merge(...embededLoops);
  };
}

/**
 * Single request sending state machine.
 */
export type SingleRequest<Request, SuccessResult, ErrorResult> =
  | { kind: "idle" }
  | { kind: "try"; request: Request }
  | { kind: "success"; result: SuccessResult }
  | { kind: "failed"; result: ErrorResult };

export namespace SingleRequest {
  /**
   * Creates idle request.
   */
  export function idle<Request, SuccessResult, ErrorResult>(): SingleRequest<
    Request,
    SuccessResult,
    ErrorResult
  > {
    return { kind: "idle" };
  }

  /**
   * Creates in flight request.
   * @param request The in flight request. 
   */
  export function tryRequest<Request, SuccessResult, ErrorResult>(
    request: Request
  ): SingleRequest<Request, SuccessResult, ErrorResult> {
    return { kind: "try", request: request };
  }

  /**
   * Creates sucessful request result.
   * @param result The request success result.
   */
  export function success<Request, SuccessResult, ErrorResult>(
    result: SuccessResult
  ): SingleRequest<Request, SuccessResult, ErrorResult> {
    return { kind: "success", result: result };
  }

  /**
   * Creates failed request result.
   * @param result The request failed result.
   */
  export function failed<Request, SuccessResult, ErrorResult>(
    result: ErrorResult
  ): SingleRequest<Request, SuccessResult, ErrorResult> {
    return { kind: "failed", result: result };
  }
}

/**
 * Is the sigle request in the idle state.
 * @param request The single request being tested.
 */
export function isIdle<Request, SuccessResult, ErrorResult>(
  request: SingleRequest<Request, SuccessResult, ErrorResult>
): boolean {
  return request.kind === "idle";
}

/**
 * Is the single request being attempted.
 * @param request The single request being tested.
 */
export function isTry<Request, SuccessResult, ErrorResult>(
  request: SingleRequest<Request, SuccessResult, ErrorResult>
): Request | null {
  if (request.kind === "try") {
    return request.request;
  }
  return null;
}

/**
 * Is the single request successfully executed.
 * @param request Is the single request successfully executed.
 */
export function isSuccess<Request, SuccessResult, ErrorResult>(
  request: SingleRequest<Request, SuccessResult, ErrorResult>
): SuccessResult | null {
  if (request.kind === "success") {
    return request.result;
  }
  return null;
}

/**
 * Did the request execution fail.
 * @param request Did the request execution fail.
 */
export function isFailed<Request, SuccessResult, ErrorResult>(
  request: SingleRequest<Request, SuccessResult, ErrorResult>
): ErrorResult | null {
  if (request.kind === "failed") {
    return request.result;
  }
  return null;
}

/**
  The system simulation will be started upon subscription and stopped after subscription is disposed.

  System state is represented as a `State` parameter.
  Events are represented by the `Event` parameter.

 * @param initialState The initial state of the system.
 * @param reduce Calculates the new system state from the existing state and a transition event (system integrator, reducer).
 * @param feedback The feedback loops that produce events depending on the current system state.
 * @returns The current state of the system.
 */
export function system<State, Event>(
  initialState: State,
  reduce: (state: State, event: Event) => State,
  feedback: Array<FeedbackLoop<State, Event>>
): rx.Observable<State> {
  return rx.defer(() => {
    const state = new rx.ReplaySubject<State>(1);
    const scheduler = rx.queueScheduler;
    const events = feedback.map(x => x(state, scheduler));
    const mergedEvent: rx.Observable<Event> = rx.merge(
      ...events
    ).pipe(
      observeOn(scheduler)
    );

    const eventsWithEffects = mergedEvent
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

/**
 * Time interval in seconds.
 */
export type TimeIntervalInSeconds = number;

/**
 * Configuration of commonly used retry strategies for feedback loop.
 */
export type FeedbackRetryStrategy<Event> =
  | { kind: "ignoreErrorJustComplete" }
  | { kind: "ignoreErrorAndReturn"; value: Event }
  | { kind: "catchError"; handle: (error: {}) => Event }
  | {
      kind: "exponentialBackoff";
      initialTimeout: TimeIntervalInSeconds;
      maxBackoffFactor: number;
    };

/**
 * Default retry strategy for a feedback loop.
 */
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

/**
 * Emits the unhandled error in a feedback loop that causes a retry strategy to activate.
 */
export let unhandledErrors: rx.Observable<Error> = dispatchErrors;

/**
 * Creates `Observable` transformation from configuration.
 * 
 * @param strategy The strategy configuration.
 */
export function materializedRetryStrategy<Event>(
  strategy: FeedbackRetryStrategy<Event>
): MonoTypeOperatorFunction<Event> {
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
        return unhandledCase(strategy);
    }
  };
}

export namespace Feedbacks {
  /**
   State: State type of the system.
   Request: Subset of state used to control the feedback loop.

   When `request` returns a value, that value is being passed into `effects` lambda to decide which effects should be performed.
   In case new `request` is different from the previous one, new effects are calculated by using `effects` lambda and then performed.

   When `request` returns `nil`, feedback loops doesn't perform any effect.

   * @param request The request to perform some effects.
   * @param effects The request effects.
   * @param retryStrategy The retry strategy for the effects in case an error happends.
   * @returns The feedback loop performing the effects.
   */
  export function react<State, Request, Event>(
    request: (state: State) => Request | null,
    effects: (request: Request) => rx.Observable<Event>,
    retryStrategy: FeedbackRetryStrategy<Event>
  ): FeedbackLoop<State, Event> {
    return reactWithLatest(
      state => {
        const requestInstance = request(state);
        return requestInstance != null 
          ? [{ id: requestInstance, request: requestInstance }] 
          : []
      }, 
      (request, _) => effects(request), 
      retryStrategy
    );
  }

  /**
   State: State type of the system.
   Request: Subset of state used to control the feedback loop.

   When `request` returns a value, that value is being passed into `effects` lambda to decide which effects should be performed.
   In case new `request` is different from the previous one, new effects are calculated by using `effects` lambda and then performed.

   When `request` returns `nil`, feedback loops doesn't perform any effect.

   * @param requests Requests to perform some effects.
   * @param effects The request effects.
   * @param retryStrategy The retry strategy for the effects in case an error happends.
   * @returns The feedback loop performing the effects.
   */
  export function reactSet<State, Request, Event>(
    requests: (state: State) => Set<Request>,
    effects: (request: Request) => rx.Observable<Event>,
    retryStrategy: FeedbackRetryStrategy<Event>
  ): FeedbackLoop<State, Event> {
    return reactWithLatest(
      state => {
        const requestInstances = requests(state);
        const identifiableRequests: { id: {}, request: Request }[] = []
        requestInstances.forEach(request => {
          identifiableRequests.push({ id: request, request: request });
        });
        return identifiableRequests;
      }, 
      (request, _) => effects(request), 
      retryStrategy
    ); 
  }

  /**
   State: State type of the system.
   Request: Subset of state used to control the feedback loop.

   For every uniquely identifiable request `effects` closure is invoked with the initial value of the request and future requests corresponding to the same identifier.

   Subsequent equal values of request are not emitted from the effects state parameter.

   * @param requests Requests to perform some effects.
   * @param effects The request effects.
   * @param retryStrategy The retry strategy for the effects in case an error happends.
   * @returns The feedback loop performing the effects.
   */
  export function reactWithLatest<State, Request, Event>(
    request: (state: State) => { id: any, request: Request }[],
    effects: (initialRequest: Request, latestRequest: rx.Observable<Request>) => rx.Observable<Event>,
    retryStrategy: FeedbackRetryStrategy<Event>
  ): FeedbackLoop<State, Event> {
    type RequestLifetimeTracking = {
      isUnsubscribed: Boolean,
      lifetimeByIdentifier: { [serializedRequestID: string]: RequestLifetime }
    };
    type LifetimeToken = {};
    type RequestLifetime = {
      subscription: SubscriptionLike,
      lifetimeIdentifier: LifetimeToken,
      latestRequest: BehaviorSubject<Request>
    };

    const retryer: MonoTypeOperatorFunction<Event> = materializedRetryStrategy(retryStrategy);
    return (state, scheduler): rx.Observable<Event> => {
      const events = new rx.Observable((observer: rx.Observer<Event>) => {
        let requestLifetimeTracker: RequestLifetimeTracking = {
          isUnsubscribed: false,
          lifetimeByIdentifier: {}
        };

        function unsubscribe() {
          requestLifetimeTracker.isUnsubscribed = true;
          const inFlightRequests = requestLifetimeTracker.lifetimeByIdentifier;
          requestLifetimeTracker.lifetimeByIdentifier = {};
          Object.keys(inFlightRequests).forEach(key => { inFlightRequests[key].subscription.unsubscribe(); });
        }

        let subscription = state.pipe(map(request))
          .subscribe(requests => {
            const state = requestLifetimeTracker;
            if (state.isUnsubscribed) { return; }

            let lifetimeToUnsubscribeByIdentifier = { ...state.lifetimeByIdentifier };

            requests.forEach(indexedRequest => {
              const requestID = canonicalString(indexedRequest.id);
              const request = indexedRequest.request;
              let requestLifetime = state.lifetimeByIdentifier[requestID];
              if (requestLifetime) {
                delete lifetimeToUnsubscribeByIdentifier[requestID];
                if (deepEqual(requestLifetime.latestRequest.value, request)) { return; }
                requestLifetime.latestRequest.next(request);
              } else {
                let subscription = new rx.Subscription();
                let latestRequestSubject = new BehaviorSubject(request);
                let lifetimeIdentifier: LifetimeToken = {};
                state.lifetimeByIdentifier[requestID] = {
                  subscription: subscription,
                  lifetimeIdentifier: lifetimeIdentifier,
                  latestRequest: latestRequestSubject
                };
                let requestsSubscription = effects(request, latestRequestSubject.asObservable())
                  .pipe(observeOn(scheduler), retryer)
                  .subscribe(event => {
                    const lifetime = state.lifetimeByIdentifier[requestID];
                    if (!(lifetime && lifetime.lifetimeIdentifier === lifetimeIdentifier)) { return; }
                    if (state.isUnsubscribed) { return; }
                    observer.next(event);
                  }, error => {
                    const lifetime = state.lifetimeByIdentifier[requestID];
                    if (!(lifetime && lifetime.lifetimeIdentifier === lifetimeIdentifier)) { return; }
                    if (state.isUnsubscribed) { return; }
                    observer.error(error);
                  });
                subscription.add(requestsSubscription);
              }
            });
            const allUnsubscribeKeys = Object.keys(lifetimeToUnsubscribeByIdentifier);
            allUnsubscribeKeys.forEach(key => { 
              if (state.lifetimeByIdentifier[key] 
                && state.lifetimeByIdentifier[key].lifetimeIdentifier === lifetimeToUnsubscribeByIdentifier[key].lifetimeIdentifier) {
                delete state.lifetimeByIdentifier[key]; 
              }
              lifetimeToUnsubscribeByIdentifier[key].subscription.unsubscribe();
            });
          }, error => {
            const state = requestLifetimeTracker;
            if (state.isUnsubscribed) { return; }

            observer.error(error);
          }, () => {
            observer.complete();
          });
        
        return new rx.Subscription(() => {
          unsubscribe();
          subscription.unsubscribe();
        });
      });

      return retryer(events);
    };
  }
}
