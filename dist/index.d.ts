import * as rx from "rxjs";
import { SchedulerLike } from "rxjs";
export declare type FeedbackLoop<State, Event> = (state: rx.Observable<State>, scheduler: SchedulerLike) => rx.Observable<Event>;
export declare function embedFeedbackLoop<InnerState, InnerEvent, OuterState, OuterEvent>(loops: FeedbackLoop<InnerState, InnerEvent>[], how: {
    selectState: (outerState: OuterState) => InnerState;
    embedEvent: (outerEvent: InnerEvent) => OuterEvent;
}): FeedbackLoop<OuterState, OuterEvent>;
export declare type SingleMessage<Message, SuccessResult, ErrorResult> = {
    kind: "idle";
} | {
    kind: "try";
    message: Message;
} | {
    kind: "success";
    result: SuccessResult;
} | {
    kind: "failed";
    result: ErrorResult;
};
export declare namespace SingleMessage {
    function idle<Message, SuccessResult, ErrorResult>(): SingleMessage<Message, SuccessResult, ErrorResult>;
    function tryMessage<Message, SuccessResult, ErrorResult>(message: Message): SingleMessage<Message, SuccessResult, ErrorResult>;
    function success<Message, SuccessResult, ErrorResult>(result: SuccessResult): SingleMessage<Message, SuccessResult, ErrorResult>;
    function failed<Message, SuccessResult, ErrorResult>(result: ErrorResult): SingleMessage<Message, SuccessResult, ErrorResult>;
}
export declare function isIdle<Message, SuccessResult, ErrorResult>(message: SingleMessage<Message, SuccessResult, ErrorResult>): boolean;
export declare function isTry<Message, SuccessResult, ErrorResult>(message: SingleMessage<Message, SuccessResult, ErrorResult>): Message | null;
export declare function isSuccess<Message, SuccessResult, ErrorResult>(message: SingleMessage<Message, SuccessResult, ErrorResult>): SuccessResult | null;
export declare function isFailed<Message, SuccessResult, ErrorResult>(message: SingleMessage<Message, SuccessResult, ErrorResult>): ErrorResult | null;
export declare function system<State, Event>(initialState: State, reduce: (state: State, event: Event) => State, feedbacks: Array<FeedbackLoop<State, Event>>): rx.Observable<State>;
export declare type TimeIntervalInSeconds = number;
export declare type FeedbackRetryStrategy<Event> = {
    kind: "ignoreErrorJustComplete";
} | {
    kind: "ignoreErrorAndReturn";
    value: Event;
} | {
    kind: "catchError";
    handle: (error: {}) => Event;
} | {
    kind: "exponentialBackoff";
    initialTimeout: TimeIntervalInSeconds;
    maxBackoffFactor: number;
};
export declare function defaultRetryStrategy<Event>(): FeedbackRetryStrategy<Event>;
export declare let unhandledErrors: rx.Observable<Error>;
export declare function materializedRetryStrategy<Event>(strategy: FeedbackRetryStrategy<Event>): ((source: rx.Observable<Event>) => rx.Observable<Event>);
export declare namespace Feedbacks {
    function react<State, Query, Event>(query: (state: State) => Query | null, effects: (query: Query) => rx.Observable<Event>, retryStrategy: FeedbackRetryStrategy<Event>): FeedbackLoop<State, Event>;
    function reactSet<State, Query, Event>(query: (state: State) => Set<Query>, effects: (query: Query) => rx.Observable<Event>, retryStrategy: FeedbackRetryStrategy<Event>): FeedbackLoop<State, Event>;
}
