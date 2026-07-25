"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Feedbacks = exports.unhandledErrors = exports.SingleRequest = void 0;
exports.liftFeedbackLoop = liftFeedbackLoop;
exports.isIdle = isIdle;
exports.isTry = isTry;
exports.isSuccess = isSuccess;
exports.isFailed = isFailed;
exports.system = system;
exports.defaultErrorHandling = defaultErrorHandling;
exports.defaultRetryStrategy = defaultRetryStrategy;
exports.materializedRetryStrategy = materializedRetryStrategy;
const rx = require("rxjs");
const rxjs_1 = require("rxjs");
const map_1 = require("rxjs/internal/operators/map");
const scan_1 = require("rxjs/internal/operators/scan");
const observeOn_1 = require("rxjs/internal/operators/observeOn");
const subscribeOn_1 = require("rxjs/internal/operators/subscribeOn");
const tap_1 = require("rxjs/internal/operators/tap");
const startWith_1 = require("rxjs/internal/operators/startWith");
const catchError_1 = require("rxjs/internal/operators/catchError");
const retry_1 = require("rxjs/internal/operators/retry");
const js_extensions_1 = require("./js+extensions");
/**
 * Lifts feedback loop that operates on a subset of state and emits embeddable events to the parent feedback loop.
 *
 * @param loops Lifted feedback loops.
 * @param mappings State and event transformers.
 */
function liftFeedbackLoop(loops, mappings) {
    return outerState => {
        const embededLoops = loops.map(loop => loop(outerState.pipe((0, map_1.map)(mappings.mapState)))
            .pipe((0, map_1.map)(mappings.mapEvent)));
        return rx.merge(...embededLoops);
    };
}
var SingleRequest;
(function (SingleRequest) {
    /**
     * Creates idle request.
     */
    function idle() {
        return { kind: "idle" };
    }
    SingleRequest.idle = idle;
    /**
     * Creates in flight request.
     * @param request The in flight request.
     */
    function tryRequest(request) {
        return { kind: "try", request: request };
    }
    SingleRequest.tryRequest = tryRequest;
    /**
     * Creates sucessful request result.
     * @param result The request success result.
     */
    function success(result) {
        return { kind: "success", result: result };
    }
    SingleRequest.success = success;
    /**
     * Creates failed request result.
     * @param result The request failed result.
     */
    function failed(result) {
        return { kind: "failed", result: result };
    }
    SingleRequest.failed = failed;
})(SingleRequest || (exports.SingleRequest = SingleRequest = {}));
/**
 * Is the sigle request in the idle state.
 * @param request The single request being tested.
 */
function isIdle(request) {
    return request.kind === "idle";
}
/**
 * Is the single request being attempted.
 * @param request The single request being tested.
 */
function isTry(request) {
    if (request.kind === "try") {
        return request.request;
    }
    return null;
}
/**
 * Is the single request successfully executed.
 * @param request Is the single request successfully executed.
 */
function isSuccess(request) {
    if (request.kind === "success") {
        return request.result;
    }
    return null;
}
/**
 * Did the request execution fail.
 * @param request Did the request execution fail.
 */
function isFailed(request) {
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
 * @param scheduler The scheduler used to serialize the state machine transitions.
 * @param errorHandling The error handling policy of the system.
 * @returns The current state of the system.
 */
function system(initialState, reduce, feedback, scheduler = rx.queueScheduler, errorHandling = defaultErrorHandling(scheduler)) {
    return rx.defer(() => {
        const state = new rx.ReplaySubject(1);
        const events = feedback.map(x => errorHandling.feedbackErrorGuard(x(state).pipe((0, observeOn_1.observeOn)(scheduler))));
        const mergedEvent = rx.merge(...events).pipe((0, observeOn_1.observeOn)(scheduler));
        const reduceWithErrorHandling = (currentState, event) => {
            try {
                return reduce(currentState, event);
            }
            catch (error) {
                return errorHandling.onReduceError(currentState, error);
            }
        };
        const eventsWithEffects = mergedEvent
            .pipe((0, scan_1.scan)(reduceWithErrorHandling, initialState), (0, tap_1.tap)(x => {
            state.next(x);
        }), (0, subscribeOn_1.subscribeOn)(scheduler), (0, startWith_1.startWith)(initialState), (0, observeOn_1.observeOn)(scheduler));
        const hackOnSubscribed = rx.defer(() => {
            state.next(initialState);
            return rx.EMPTY;
        });
        return rx.merge(...[eventsWithEffects, hackOnSubscribed])
            .pipe((0, catchError_1.catchError)(e => {
            dispatchError(e);
            return rx.throwError(() => e);
        }));
    });
}
/**
 * The default error handling of a system.
 *
 * Errors thrown from `reduce` are logged to the console and the last good state is kept,
 * feedback loops are retried by using the `defaultRetryStrategy` (exponential backoff,
 * waiting at most 5 seconds between the retries).
 *
 * @param scheduler The scheduler used to schedule the feedback loop retries.
 */
function defaultErrorHandling(scheduler = rx.queueScheduler) {
    return {
        onReduceError: (state, error) => {
            console.error(error);
            return state;
        },
        feedbackErrorGuard: materializedRetryStrategy(defaultRetryStrategy(), scheduler)
    };
}
/**
 * Default retry strategy for a feedback loop.
 *
 * Exponential backoff, waiting at most 5 seconds between the retries (1s, 2s, 4s, 5s, 5s, ...).
 */
function defaultRetryStrategy() {
    return {
        kind: "exponentialBackoff",
        initialTimeout: 1,
        maxBackoffFactor: 5
    };
}
let dispatchErrors = new rx.Subject();
function dispatchError(error) {
    if (error instanceof Error || error.constructor === Error) {
        dispatchErrors.next(error);
        return;
    }
    dispatchErrors.next(new Error(error));
}
/**
 * Emits the unhandled error in a feedback loop that causes a retry strategy to activate.
 */
exports.unhandledErrors = dispatchErrors;
/**
 * Creates `Observable` transformation from configuration.
 *
 * @param strategy The strategy configuration.
 * @param scheduler The scheduler used to schedule the retries.
 */
function materializedRetryStrategy(strategy, scheduler = rx.queueScheduler) {
    return (source) => {
        switch (strategy.kind) {
            case "ignoreErrorJustComplete":
                return source.pipe((0, catchError_1.catchError)(e => {
                    dispatchError(e);
                    return rx.EMPTY;
                }));
            case "ignoreErrorAndReturn":
                return source.pipe((0, catchError_1.catchError)(e => {
                    dispatchError(e);
                    return rx.of(strategy.value);
                }));
            case "exponentialBackoff":
                return source.pipe((0, retry_1.retry)({
                    resetOnSuccess: true,
                    delay: (error, retryCount) => {
                        dispatchError(error);
                        const backoffFactor = Math.min(Math.pow(2, retryCount - 1), strategy.maxBackoffFactor);
                        return rx.timer(strategy.initialTimeout * backoffFactor * 1000, scheduler);
                    }
                }));
            case "catchError":
                return source.pipe((0, catchError_1.catchError)(e => {
                    dispatchError(e);
                    return rx.of(strategy.handle(e));
                }));
            default:
                return (0, js_extensions_1.unhandledCase)(strategy);
        }
    };
}
var Feedbacks;
(function (Feedbacks) {
    /**
     State: State type of the system.
     Request: Subset of state used to control the feedback loop.
  
     When `request` returns a value, that value is being passed into `effects` lambda to decide which effects should be performed.
     In case new `request` is different from the previous one, new effects are calculated by using `effects` lambda and then performed.
  
     When `request` returns `nil`, feedback loops doesn't perform any effect.
  
     * @param request The request to perform some effects.
     * @param effects The request effects.
     * @returns The feedback loop performing the effects.
     */
    function react(request, effects) {
        return reactWithLatest(state => {
            const requestInstance = request(state);
            return requestInstance != null
                ? [{ id: requestInstance, request: requestInstance }]
                : [];
        }, effects);
    }
    Feedbacks.react = react;
    /**
     State: State type of the system.
     Request: Subset of state used to control the feedback loop.
  
     When `request` returns a value, that value is being passed into `effects` lambda to decide which effects should be performed.
     In case new `request` is different from the previous one, new effects are calculated by using `effects` lambda and then performed.
  
     When `request` returns `nil`, feedback loops doesn't perform any effect.
  
     * @param requests Requests to perform some effects.
     * @param effects The request effects.
     * @returns The feedback loop performing the effects.
     */
    function reactSet(requests, effects) {
        return reactWithLatest(state => {
            const requestInstances = requests(state);
            const identifiableRequests = [];
            requestInstances.forEach(request => {
                identifiableRequests.push({ id: request, request: request });
            });
            return identifiableRequests;
        }, effects);
    }
    Feedbacks.reactSet = reactSet;
    /**
     State: State type of the system.
     Request: Subset of state used to control the feedback loop.
  
     For every uniquely identifiable request `effects` closure is invoked with the initial value of the request and future requests corresponding to the same identifier.
  
     Subsequent equal values of request are not emitted from the effects state parameter.
  
     * @param requests Requests to perform some effects.
     * @param effects The request effects.
     * @returns The feedback loop performing the effects.
     */
    function reactWithLatest(request, effects) {
        return (state) => {
            return new rx.Observable((observer) => {
                let requestLifetimeTracker = {
                    isUnsubscribed: false,
                    lifetimeByIdentifier: {}
                };
                function unsubscribe() {
                    requestLifetimeTracker.isUnsubscribed = true;
                    const inFlightRequests = requestLifetimeTracker.lifetimeByIdentifier;
                    requestLifetimeTracker.lifetimeByIdentifier = {};
                    Object.keys(inFlightRequests).forEach(key => { inFlightRequests[key].subscription.unsubscribe(); });
                }
                let subscription = state.pipe((0, map_1.map)(request))
                    .subscribe({
                    next: requests => {
                        const state = requestLifetimeTracker;
                        if (state.isUnsubscribed) {
                            return;
                        }
                        let lifetimeToUnsubscribeByIdentifier = Object.assign({}, state.lifetimeByIdentifier);
                        requests.forEach(indexedRequest => {
                            // Effects can terminate the feedback loop in the middle of this iteration.
                            if (state.isUnsubscribed) {
                                return;
                            }
                            const requestID = (0, js_extensions_1.canonicalString)(indexedRequest.id);
                            const request = indexedRequest.request;
                            let requestLifetime = state.lifetimeByIdentifier[requestID];
                            if (requestLifetime) {
                                delete lifetimeToUnsubscribeByIdentifier[requestID];
                                if ((0, js_extensions_1.deepEqual)(requestLifetime.latestRequest.value, request)) {
                                    return;
                                }
                                requestLifetime.latestRequest.next(request);
                            }
                            else {
                                let subscription = new rx.Subscription();
                                let latestRequestSubject = new rxjs_1.BehaviorSubject(request);
                                let lifetimeIdentifier = {};
                                state.lifetimeByIdentifier[requestID] = {
                                    subscription: subscription,
                                    lifetimeIdentifier: lifetimeIdentifier,
                                    latestRequest: latestRequestSubject
                                };
                                let requestsSubscription = effects(request, latestRequestSubject.asObservable())
                                    .subscribe({
                                    next: event => {
                                        const lifetime = state.lifetimeByIdentifier[requestID];
                                        if (!(lifetime && lifetime.lifetimeIdentifier === lifetimeIdentifier)) {
                                            return;
                                        }
                                        if (state.isUnsubscribed) {
                                            return;
                                        }
                                        observer.next(event);
                                    },
                                    error: error => {
                                        const lifetime = state.lifetimeByIdentifier[requestID];
                                        if (!(lifetime && lifetime.lifetimeIdentifier === lifetimeIdentifier)) {
                                            return;
                                        }
                                        if (state.isUnsubscribed) {
                                            return;
                                        }
                                        observer.error(error);
                                    }
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
                    },
                    error: error => {
                        const state = requestLifetimeTracker;
                        if (state.isUnsubscribed) {
                            return;
                        }
                        observer.error(error);
                    },
                    complete: () => {
                        observer.complete();
                    }
                });
                return new rx.Subscription(() => {
                    unsubscribe();
                    subscription.unsubscribe();
                });
            });
        };
    }
    Feedbacks.reactWithLatest = reactWithLatest;
})(Feedbacks || (exports.Feedbacks = Feedbacks = {}));
//# sourceMappingURL=index.js.map