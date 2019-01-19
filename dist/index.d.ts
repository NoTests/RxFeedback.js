import * as rx from "rxjs";
import { SchedulerLike, MonoTypeOperatorFunction } from "rxjs";
/**
 * Feedback loop transforming `State` into a sequence of `Mutation`s.
 */
export declare type FeedbackLoop<State, Mutation> = (state: rx.Observable<State>, scheduler: SchedulerLike) => rx.Observable<Mutation>;
/**
 * Lifts feedback loop that operates on a subset of state and emits embeddable mutations to a parent feedback loop.
 *
 * @param loops Lifted feedback loops.
 * @param mappings State and event transformers.
 */
export declare function liftFeedbackLoop<InnerState, InnerMutation, OuterState, OuterMutation>(loops: FeedbackLoop<InnerState, InnerMutation>[], mappings: {
    mapState: (outerState: OuterState) => InnerState;
    mapMutation: (outerMutation: InnerMutation) => OuterMutation;
}): FeedbackLoop<OuterState, OuterMutation>;
/**
 * Single request sending state machine.
 */
export declare type SingleRequest<Request, SuccessResult, ErrorResult> = {
    kind: "idle";
} | {
    kind: "try";
    request: Request;
} | {
    kind: "success";
    result: SuccessResult;
} | {
    kind: "failed";
    result: ErrorResult;
};
export declare namespace SingleMessage {
    /**
     * Creates idle request.
     */
    function idle<Request, SuccessResult, ErrorResult>(): SingleRequest<Request, SuccessResult, ErrorResult>;
    /**
     * Creates in flight request.
     * @param request The in flight request.
     */
    function tryRequest<Request, SuccessResult, ErrorResult>(request: Request): SingleRequest<Request, SuccessResult, ErrorResult>;
    /**
     * Creates sucessful request result.
     * @param result The request success result.
     */
    function success<Request, SuccessResult, ErrorResult>(result: SuccessResult): SingleRequest<Request, SuccessResult, ErrorResult>;
    /**
     * Creates failed request result.
     * @param result The request failed result.
     */
    function failed<Request, SuccessResult, ErrorResult>(result: ErrorResult): SingleRequest<Request, SuccessResult, ErrorResult>;
}
/**
 * Is the sigle request in the idle state.
 * @param request The single request being tested.
 */
export declare function isIdle<Request, SuccessResult, ErrorResult>(request: SingleRequest<Request, SuccessResult, ErrorResult>): boolean;
/**
 * Is the single request being attempted.
 * @param request The single request being tested.
 */
export declare function isTry<Request, SuccessResult, ErrorResult>(request: SingleRequest<Request, SuccessResult, ErrorResult>): Request | null;
/**
 * Is the single request successfully executed.
 * @param request Is the single request successfully executed.
 */
export declare function isSuccess<Request, SuccessResult, ErrorResult>(request: SingleRequest<Request, SuccessResult, ErrorResult>): SuccessResult | null;
/**
 * Did the request execution fail.
 * @param request Did the request execution fail.
 */
export declare function isFailed<Request, SuccessResult, ErrorResult>(request: SingleRequest<Request, SuccessResult, ErrorResult>): ErrorResult | null;
/**
  The system simulation will be started upon subscription and stopped after subscription is disposed.

  System state is represented as a `State` parameter.
  Mutations are represented by `Mutation` parameter.

 * @param initialState The initial state of the system.
 * @param reduce Calculates the new system state from the existing state and a transition mutation (system integrator, reducer).
 * @param feedback The feedback loops that produce mutations depending on the current system state.
 * @returns The current state of the system.
 */
export declare function system<State, Mutation>(initialState: State, reduce: (state: State, event: Mutation) => State, feedback: Array<FeedbackLoop<State, Mutation>>): rx.Observable<State>;
/**
 * Time interval in seconds.
 */
export declare type TimeIntervalInSeconds = number;
/**
 * Configuration of commonly used retry strategies for feedback loop.
 */
export declare type FeedbackRetryStrategy<Mutation> = {
    kind: "ignoreErrorJustComplete";
} | {
    kind: "ignoreErrorAndReturn";
    value: Mutation;
} | {
    kind: "catchError";
    handle: (error: {}) => Mutation;
} | {
    kind: "exponentialBackoff";
    initialTimeout: TimeIntervalInSeconds;
    maxBackoffFactor: number;
};
/**
 * Default retry strategy for a feedback loop.
 */
export declare function defaultRetryStrategy<Mutation>(): FeedbackRetryStrategy<Mutation>;
/**
 * Emits the unhandled error in a feedback loop that causes a retry strategy to activate.
 */
export declare let unhandledErrors: rx.Observable<Error>;
/**
 * Creates `Observable` transformation from configuration.
 *
 * @param strategy The strategy configuration.
 */
export declare function materializedRetryStrategy<Mutation>(strategy: FeedbackRetryStrategy<Mutation>): MonoTypeOperatorFunction<Mutation>;
export declare namespace Feedbacks {
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
    function react<State, Request, Mutation>(request: (state: State) => Request | null, effects: (request: Request) => rx.Observable<Mutation>, retryStrategy: FeedbackRetryStrategy<Mutation>): FeedbackLoop<State, Mutation>;
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
    function reactSet<State, Request, Mutation>(requests: (state: State) => Set<Request>, effects: (request: Request) => rx.Observable<Mutation>, retryStrategy: FeedbackRetryStrategy<Mutation>): FeedbackLoop<State, Mutation>;
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
    function reactWithLatest<State, Request, Mutation>(request: (state: State) => {
        id: any;
        request: Request;
    }[], effects: (initialRequest: Request, latestRequest: rx.Observable<Request>) => rx.Observable<Mutation>, retryStrategy: FeedbackRetryStrategy<Mutation>): FeedbackLoop<State, Mutation>;
}
