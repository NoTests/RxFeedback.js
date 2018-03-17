import * as rx from 'rxjs';
import { Observable } from 'rxjs/Observable';
import { IScheduler } from 'rxjs/Scheduler';
import js from './js+extensions';

export type FeedbackLoop<State, Event> = (state: rx.Observable<State>, scheduler: IScheduler) => rx.Observable<Event>;

export function embedFeedbackLoop<InnerState, InnerEvent, OuterState, OuterEvent>(
    loops: FeedbackLoop<InnerState, InnerEvent>[],
    how: {
        selectState: (outerState: OuterState) => InnerState,
        embedEvent: (outerEvent: InnerEvent) => OuterEvent
    }
): FeedbackLoop<OuterState, OuterEvent> {
    return (outerState, scheduler) => {
        const embededLoops = loops.map(loop =>
            loop(outerState.map(how.selectState), scheduler).map(how.embedEvent)
        );
       return Observable.merge(...embededLoops);
    };
}

export type SingleMessage<Message, SuccessResult, ErrorResult> =
    { kind: 'idle' } |
    { kind: 'try', message: Message } |
    { kind: 'success', result: SuccessResult } |
    { kind: 'failed', result: ErrorResult };

export namespace SingleMessage {
    export function idle<Message, SuccessResult, ErrorResult>()
        : SingleMessage<Message, SuccessResult, ErrorResult> {
        return { kind: 'idle' };
    }

    export function tryMessage<Message, SuccessResult, ErrorResult>(message: Message)
        : SingleMessage<Message, SuccessResult, ErrorResult> {
        return { kind: 'try', message: message };
    }
    
    export function success<Message, SuccessResult, ErrorResult>(result: SuccessResult)
        : SingleMessage<Message, SuccessResult, ErrorResult> {
        return { kind: 'success', result: result };
    }
    
    export function failed<Message, SuccessResult, ErrorResult>(result: ErrorResult)
        : SingleMessage<Message, SuccessResult, ErrorResult> {
        return { kind: 'failed', result: result };
    }
}

export function isIdle<Message, SuccessResult, ErrorResult>(message: SingleMessage<Message, SuccessResult, ErrorResult>)
    : boolean {
    return message.kind === 'idle';
}

export function isTry<Message, SuccessResult, ErrorResult>(message: SingleMessage<Message, SuccessResult, ErrorResult>)
    : Message | null {
    if (message.kind === 'try') {
        return message.message;
    } 
    return null;
}

export function isSuccess<Message, SuccessResult, ErrorResult>(message: SingleMessage<Message, SuccessResult, ErrorResult>)
    : SuccessResult | null {
    if (message.kind === 'success') {
        return message.result;
    } 
    return null;
}

export function isFailed<Message, SuccessResult, ErrorResult>(message: SingleMessage<Message, SuccessResult, ErrorResult>)
    : ErrorResult | null {
    if (message.kind === 'failed') {
        return message.result;
    } 
    return null;
}

function staticSystem<State, Event>(
    initialState: State,
    reduce: (state: State, event: Event) => State,
    feedbacks: Array<FeedbackLoop<State, Event>>,
): Observable<State> {
    return Observable.defer(() => {
        const state = new rx.ReplaySubject<State>(1);
        const scheduler = rx.Scheduler.queue;
        const events = feedbacks.map(x => x(state, scheduler));
        const mergedEvents: Observable<Event> = Observable.merge(...events)
            .observeOn(scheduler);

        const eventsWithEffects = mergedEvents.scan(reduce, initialState)
            .do(x => {
                state.next(x);
            })
            .subscribeOn(scheduler)
            .startWith(initialState)
            .observeOn(scheduler);

        const hackOnSubscribed: Observable<State> = Observable.defer(() => {
            state.next(initialState);
            return Observable.empty();
        });

        return Observable.merge(...[eventsWithEffects, hackOnSubscribed]);
    });
}

function takeUntilWithCompletedStatic<E, O>(
    this: Observable<E>,
    other: Observable<O>,
    scheduler: IScheduler
): Observable<E> {
    const completeAsSoonAsPossible = Observable.empty<E>(scheduler);
    return other.take(1)
        .map(_ => completeAsSoonAsPossible)
        .startWith(this)
        .switch();
}

function enqueueStatic<E>(this: Observable<E>, scheduler: IScheduler) {
    return this.observeOn(scheduler).subscribeOn(scheduler);
}

Observable.prototype.takeUntilWithCompleted = takeUntilWithCompletedStatic;
Observable.prototype.enqueue = enqueueStatic;

declare module 'rxjs/Observable' {
    interface Observable<T> {
        takeUntilWithCompleted<E, O>(
            this: Observable<E>,
            other: Observable<O>,
            scheduler: IScheduler
        ): Observable<E>;
        enqueue<E>(this: Observable<E>, scheduler: IScheduler): Observable<E>;
    }
}

Observable.system = staticSystem;

declare module 'rxjs/Observable' {
    namespace Observable {
        function system<State, Event>(
            initialState: State,
            reduce: (state: State, event: Event) => State,
            feedbacks: Array<FeedbackLoop<State, Event>>,
        ): Observable<State>;
    }
}

export type TimeIntervalInSeconds = number;

export type FeedbackRetryStrategy<Event> =
    { kind: 'ignoreErrorJustComplete' } |
    { kind: 'ignoreErrorAndReturn', value: Event } |
    { kind: 'catchError', handle: (error: {}) => Event } |
    { kind: 'exponentialBackoff', initialTimeout: TimeIntervalInSeconds, maxBackoffFactor: number };

export function defaultRetryStrategy<Event>(): FeedbackRetryStrategy<Event> {
    return { kind: 'exponentialBackoff', initialTimeout: 1, maxBackoffFactor: 30 };
}

namespace Extensions {
    export function retryStrategy<Event>(strategy: FeedbackRetryStrategy<Event>):
        ((source: Observable<Event>) => Observable<Event>) {
        return (source): Observable<Event> => {
            switch (strategy.kind) {
                case 'ignoreErrorJustComplete':
                    return source.catch((e) => Observable.empty<Event>());
                case 'ignoreErrorAndReturn':
                    return source.catch((e) => Observable.of(strategy.value));
                case 'exponentialBackoff':
                    return Observable.defer(() => {
                        let counter = 1;
                        return source.do(
                            () => {
                                counter = 1;
                            },
                            () => {
                                if (counter * 2 <= strategy.maxBackoffFactor) {
                                    counter *= 2;
                                }
                            }
                        )
                            .retryWhen(e =>
                                e.switchMap(x =>
                                    Observable.of(0)
                                        .delay(strategy.initialTimeout * counter * 1000)
                                )
                            );
                    });
                case 'catchError':
                    return source.catch((e) => Observable.of(strategy.handle(e)));
                default:
                    return js.unhandledCase(strategy);
            }
        };
    }
}

export namespace Feedbacks {
    export function react<State, Query, Event>(
        query: (state: State) => (Query | null),
        effects: (query: Query) => Observable<Event>,
        retryStrategy: FeedbackRetryStrategy<Event>,
    ): FeedbackLoop<State, Event> {
        return (state, scheduler) => {
            return state.map(query)
                .distinctUntilChanged((lhs, rhs) => js.canonicalString(lhs) === js.canonicalString(rhs))
                .switchMap((maybeQuery) => {
                    if (maybeQuery === null) {
                        return Observable.empty();
                    }

                    const retryer = Extensions.retryStrategy(retryStrategy);
                    return retryer(effects(maybeQuery).enqueue(scheduler));
                });
        };
    }

    export function reactSet<State, Query, Event>(
        query: (state: State) => Set<Query>,
        effects: (query: Query) => Observable<Event>,
        retryStrategy: FeedbackRetryStrategy<Event>,
    ): FeedbackLoop<State, Event> {
        const retryer = Extensions.retryStrategy(retryStrategy);
        return (state, scheduler) => {
            const querySequence: Observable<Set<Query>> = state.map(query)
                .shareReplay(1);

            const newQueries = Observable.zip(
                querySequence,
                querySequence.map(js.canonicalSetValues).startWith(new Set<String>())
            )
                .map(queries => {
                    return js.canonicalDifference(queries[0], queries[1]);
                });

            return newQueries.flatMap(controls => {
                const allEffects = js.toArray(controls).map((maybeQuery: Query): Observable<Event> => {
                    return retryer(effects(maybeQuery)
                        .takeUntilWithCompleted(
                            querySequence.filter((queries) => !queries.has(maybeQuery)), 
                            scheduler
                        )
                        .enqueue(scheduler));
                });
                return Observable.merge(...allEffects);
            });
        };
    }
}