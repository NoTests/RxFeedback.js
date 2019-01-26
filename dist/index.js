"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var rx = require("rxjs");
var rxjs_1 = require("rxjs");
var map_1 = require("rxjs/internal/operators/map");
var scan_1 = require("rxjs/internal/operators/scan");
var observeOn_1 = require("rxjs/internal/operators/observeOn");
var subscribeOn_1 = require("rxjs/internal/operators/subscribeOn");
var tap_1 = require("rxjs/internal/operators/tap");
var startWith_1 = require("rxjs/internal/operators/startWith");
var catchError_1 = require("rxjs/internal/operators/catchError");
var delay_1 = require("rxjs/internal/operators/delay");
var retryWhen_1 = require("rxjs/internal/operators/retryWhen");
var switchMap_1 = require("rxjs/internal/operators/switchMap");
var js_extensions_1 = require("./js+extensions");
/**
 * Lifts feedback loop that operates on a subset of state and emits embeddable mutations to a parent feedback loop.
 *
 * @param loops Lifted feedback loops.
 * @param mappings State and event transformers.
 */
function liftFeedbackLoop(loops, mappings) {
    return function (outerState, scheduler) {
        var embededLoops = loops.map(function (loop) {
            return loop(outerState.pipe(map_1.map(mappings.mapState)), scheduler)
                .pipe(map_1.map(mappings.mapMutation));
        });
        return rx.merge.apply(rx, embededLoops);
    };
}
exports.liftFeedbackLoop = liftFeedbackLoop;
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
})(SingleRequest = exports.SingleRequest || (exports.SingleRequest = {}));
/**
 * Is the sigle request in the idle state.
 * @param request The single request being tested.
 */
function isIdle(request) {
    return request.kind === "idle";
}
exports.isIdle = isIdle;
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
exports.isTry = isTry;
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
exports.isSuccess = isSuccess;
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
exports.isFailed = isFailed;
/**
  The system simulation will be started upon subscription and stopped after subscription is disposed.

  System state is represented as a `State` parameter.
  Mutations are represented by `Mutation` parameter.

 * @param initialState The initial state of the system.
 * @param reduce Calculates the new system state from the existing state and a transition mutation (system integrator, reducer).
 * @param feedback The feedback loops that produce mutations depending on the current system state.
 * @returns The current state of the system.
 */
function system(initialState, reduce, feedback) {
    return rx.defer(function () {
        var state = new rx.ReplaySubject(1);
        var scheduler = rx.queueScheduler;
        var events = feedback.map(function (x) { return x(state, scheduler); });
        var mergedMutation = rx.merge.apply(rx, events).pipe(observeOn_1.observeOn(scheduler));
        var eventsWithEffects = mergedMutation
            .pipe(scan_1.scan(reduce, initialState), tap_1.tap(function (x) {
            state.next(x);
        }), subscribeOn_1.subscribeOn(scheduler), startWith_1.startWith(initialState), observeOn_1.observeOn(scheduler));
        var hackOnSubscribed = rx.defer(function () {
            state.next(initialState);
            return rx.empty();
        });
        return rx.merge.apply(rx, [eventsWithEffects, hackOnSubscribed]).pipe(catchError_1.catchError(function (e) {
            dispatchError(e);
            return rx.throwError(e);
        }));
    });
}
exports.system = system;
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
exports.defaultRetryStrategy = defaultRetryStrategy;
var dispatchErrors = new rx.Subject();
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
    return function (source) {
        switch (strategy.kind) {
            case "ignoreErrorJustComplete":
                return source.pipe(catchError_1.catchError(function (e) {
                    dispatchError(e);
                    return rx.empty();
                }));
            case "ignoreErrorAndReturn":
                return source.pipe(catchError_1.catchError(function (e) {
                    dispatchError(e);
                    return rx.of(strategy.value);
                }));
            case "exponentialBackoff":
                return rx.defer(function () {
                    var counter = 1;
                    return source.pipe(tap_1.tap(function () {
                        counter = 1;
                    }, function () {
                        if (counter * 2 <= strategy.maxBackoffFactor) {
                            counter *= 2;
                        }
                    }), retryWhen_1.retryWhen(function (e) {
                        return e.pipe(switchMap_1.switchMap(function (x) {
                            dispatchError(x);
                            return rx.of(0).pipe(delay_1.delay(strategy.initialTimeout * counter * 1000));
                        }));
                    }));
                });
            case "catchError":
                return source.pipe(catchError_1.catchError(function (e) {
                    dispatchError(e);
                    return rx.of(strategy.handle(e));
                }));
            default:
                return js_extensions_1.unhandledCase(strategy);
        }
    };
}
exports.materializedRetryStrategy = materializedRetryStrategy;
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
        return reactWithLatest(function (state) {
            var requestInstance = request(state);
            return requestInstance != null
                ? [{ id: requestInstance, request: requestInstance }]
                : [];
        }, function (request, _) { return effects(request); }, retryStrategy);
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
        return reactWithLatest(function (state) {
            var requestInstances = requests(state);
            var identifiableRequests = [];
            requestInstances.forEach(function (request) {
                identifiableRequests.push({ id: request, request: request });
            });
            return identifiableRequests;
        }, function (request, _) { return effects(request); }, retryStrategy);
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
        var retryer = materializedRetryStrategy(retryStrategy);
        return function (state, scheduler) {
            var mutations = new rx.Observable(function (observer) {
                var requestLifetimeTracker = {
                    isUnsubscribed: false,
                    lifetimeByIdentifier: {}
                };
                function unsubscribe() {
                    requestLifetimeTracker.isUnsubscribed = true;
                    var inFlightRequests = requestLifetimeTracker.lifetimeByIdentifier;
                    requestLifetimeTracker.lifetimeByIdentifier = {};
                    Object.keys(inFlightRequests).forEach(function (key) { inFlightRequests[key].subscription.unsubscribe(); });
                }
                var subscription = state.pipe(map_1.map(request))
                    .subscribe(function (requests) {
                    var state = requestLifetimeTracker;
                    if (state.isUnsubscribed) {
                        return;
                    }
                    var lifetimeToUnsubscribeByIdentifier = __assign({}, state.lifetimeByIdentifier);
                    requests.forEach(function (indexedRequest) {
                        var requestID = js_extensions_1.canonicalString(indexedRequest.id);
                        var request = indexedRequest.request;
                        var requestLifetime = state.lifetimeByIdentifier[requestID];
                        if (requestLifetime) {
                            delete lifetimeToUnsubscribeByIdentifier[requestID];
                            if (js_extensions_1.deepEqual(requestLifetime.latestRequest.value, request)) {
                                return;
                            }
                            requestLifetime.latestRequest.next(request);
                        }
                        else {
                            var subscription_1 = new rx.Subscription();
                            var latestRequestSubject = new rxjs_1.BehaviorSubject(request);
                            var lifetimeIdentifier_1 = {};
                            state.lifetimeByIdentifier[requestID] = {
                                subscription: subscription_1,
                                lifetimeIdentifier: lifetimeIdentifier_1,
                                latestRequest: latestRequestSubject
                            };
                            var requestsSubscription = effects(request, latestRequestSubject.asObservable())
                                .pipe(observeOn_1.observeOn(scheduler), retryer)
                                .subscribe(function (mutation) {
                                var lifetime = state.lifetimeByIdentifier[requestID];
                                if (!(lifetime && lifetime.lifetimeIdentifier === lifetimeIdentifier_1)) {
                                    return;
                                }
                                if (state.isUnsubscribed) {
                                    return;
                                }
                                observer.next(mutation);
                            }, function (error) {
                                var lifetime = state.lifetimeByIdentifier[requestID];
                                if (!(lifetime && lifetime.lifetimeIdentifier === lifetimeIdentifier_1)) {
                                    return;
                                }
                                if (state.isUnsubscribed) {
                                    return;
                                }
                                observer.error(error);
                            });
                            subscription_1.add(requestsSubscription);
                        }
                    });
                    var allUnsubscribeKeys = Object.keys(lifetimeToUnsubscribeByIdentifier);
                    allUnsubscribeKeys.forEach(function (key) {
                        if (state.lifetimeByIdentifier[key]
                            && state.lifetimeByIdentifier[key].lifetimeIdentifier === lifetimeToUnsubscribeByIdentifier[key].lifetimeIdentifier) {
                            delete state.lifetimeByIdentifier[key];
                        }
                        lifetimeToUnsubscribeByIdentifier[key].subscription.unsubscribe();
                    });
                }, function (error) {
                    var state = requestLifetimeTracker;
                    if (state.isUnsubscribed) {
                        return;
                    }
                    observer.error(error);
                }, function () {
                    observer.complete();
                });
                return new rx.Subscription(function () {
                    unsubscribe();
                    subscription.unsubscribe();
                });
            });
            return retryer(mutations);
        };
    }
    Feedbacks.reactWithLatest = reactWithLatest;
})(Feedbacks = exports.Feedbacks || (exports.Feedbacks = {}));
//# sourceMappingURL=index.js.map