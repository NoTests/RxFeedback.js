"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Feedbacks = exports.unhandledErrors = exports.SingleRequest = void 0;
exports.liftFeedbackLoop = liftFeedbackLoop;
exports.isIdle = isIdle;
exports.isTry = isTry;
exports.isSuccess = isSuccess;
exports.isFailed = isFailed;
exports.system = system;
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
const delay_1 = require("rxjs/internal/operators/delay");
const retryWhen_1 = require("rxjs/internal/operators/retryWhen");
const switchMap_1 = require("rxjs/internal/operators/switchMap");
const js_extensions_1 = require("./js+extensions");
/**
 * Lifts feedback loop that operates on a subset of state and emits embeddable events to the parent feedback loop.
 *
 * @param loops Lifted feedback loops.
 * @param mappings State and event transformers.
 */
function liftFeedbackLoop(loops, mappings) {
    return (outerState, scheduler) => {
        const embededLoops = loops.map(loop => loop(outerState.pipe((0, map_1.map)(mappings.mapState)), scheduler)
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
 * @returns The current state of the system.
 */
function system(initialState, reduce, feedback) {
    return rx.defer(() => {
        const state = new rx.ReplaySubject(1);
        const scheduler = rx.queueScheduler;
        const events = feedback.map(x => x(state, scheduler));
        const mergedEvent = rx.merge(...events).pipe((0, observeOn_1.observeOn)(scheduler));
        const eventsWithEffects = mergedEvent
            .pipe((0, scan_1.scan)(reduce, initialState), (0, tap_1.tap)(x => {
            state.next(x);
        }), (0, subscribeOn_1.subscribeOn)(scheduler), (0, startWith_1.startWith)(initialState), (0, observeOn_1.observeOn)(scheduler));
        const hackOnSubscribed = rx.defer(() => {
            state.next(initialState);
            return rx.empty();
        });
        return rx.merge(...[eventsWithEffects, hackOnSubscribed])
            .pipe((0, catchError_1.catchError)(e => {
            dispatchError(e);
            return rx.throwError(e);
        }));
    });
}
/**
 * Default retry strategy for a feedback loop.
 */
function defaultRetryStrategy() {
    return {
        kind: "exponentialBackoff",
        initialTimeout: 1,
        maxBackoffFactor: 8
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
 */
function materializedRetryStrategy(strategy) {
    return (source) => {
        switch (strategy.kind) {
            case "ignoreErrorJustComplete":
                return source.pipe((0, catchError_1.catchError)(e => {
                    dispatchError(e);
                    return rx.empty();
                }));
            case "ignoreErrorAndReturn":
                return source.pipe((0, catchError_1.catchError)(e => {
                    dispatchError(e);
                    return rx.of(strategy.value);
                }));
            case "exponentialBackoff":
                return rx.defer(() => {
                    let counter = 1;
                    return source.pipe((0, tap_1.tap)(() => {
                        counter = 1;
                    }, () => {
                        if (counter * 2 <= strategy.maxBackoffFactor) {
                            counter *= 2;
                        }
                    }), (0, retryWhen_1.retryWhen)(e => e.pipe((0, switchMap_1.switchMap)(x => {
                        dispatchError(x);
                        return rx.of(0).pipe((0, delay_1.delay)(strategy.initialTimeout * counter * 1000));
                    }))));
                });
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
     * @param retryStrategy The retry strategy for the effects in case an error happends.
     * @returns The feedback loop performing the effects.
     */
    function react(request, effects, retryStrategy) {
        return reactWithLatest(state => {
            const requestInstance = request(state);
            return requestInstance != null
                ? [{ id: requestInstance, request: requestInstance }]
                : [];
        }, (request, _, scheduler) => effects(request, scheduler), retryStrategy);
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
     * @param retryStrategy The retry strategy for the effects in case an error happends.
     * @returns The feedback loop performing the effects.
     */
    function reactSet(requests, effects, retryStrategy) {
        return reactWithLatest(state => {
            const requestInstances = requests(state);
            const identifiableRequests = [];
            requestInstances.forEach(request => {
                identifiableRequests.push({ id: request, request: request });
            });
            return identifiableRequests;
        }, (request, _, scheduler) => effects(request, scheduler), retryStrategy);
    }
    Feedbacks.reactSet = reactSet;
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
    function reactWithLatest(request, effects, retryStrategy) {
        const retryer = materializedRetryStrategy(retryStrategy);
        return (state, scheduler) => {
            const events = new rx.Observable((observer) => {
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
                    .subscribe(requests => {
                    const state = requestLifetimeTracker;
                    if (state.isUnsubscribed) {
                        return;
                    }
                    let lifetimeToUnsubscribeByIdentifier = Object.assign({}, state.lifetimeByIdentifier);
                    requests.forEach(indexedRequest => {
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
                            let requestsSubscription = effects(request, latestRequestSubject.asObservable(), scheduler)
                                .pipe((0, observeOn_1.observeOn)(scheduler), retryer)
                                .subscribe(event => {
                                const lifetime = state.lifetimeByIdentifier[requestID];
                                if (!(lifetime && lifetime.lifetimeIdentifier === lifetimeIdentifier)) {
                                    return;
                                }
                                if (state.isUnsubscribed) {
                                    return;
                                }
                                observer.next(event);
                            }, error => {
                                const lifetime = state.lifetimeByIdentifier[requestID];
                                if (!(lifetime && lifetime.lifetimeIdentifier === lifetimeIdentifier)) {
                                    return;
                                }
                                if (state.isUnsubscribed) {
                                    return;
                                }
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
                    if (state.isUnsubscribed) {
                        return;
                    }
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
    Feedbacks.reactWithLatest = reactWithLatest;
})(Feedbacks || (exports.Feedbacks = Feedbacks = {}));
//# sourceMappingURL=index.js.map