"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var rx = require("rxjs");
var map_1 = require("rxjs/internal/operators/map");
var scan_1 = require("rxjs/internal/operators/scan");
var observeOn_1 = require("rxjs/internal/operators/observeOn");
var subscribeOn_1 = require("rxjs/internal/operators/subscribeOn");
var tap_1 = require("rxjs/internal/operators/tap");
var startWith_1 = require("rxjs/internal/operators/startWith");
var catchError_1 = require("rxjs/internal/operators/catchError");
var switchAll_1 = require("rxjs/internal/operators/switchAll");
var take_1 = require("rxjs/internal/operators/take");
var delay_1 = require("rxjs/internal/operators/delay");
var retryWhen_1 = require("rxjs/internal/operators/retryWhen");
var switchMap_1 = require("rxjs/internal/operators/switchMap");
var distinctUntilChanged_1 = require("rxjs/internal/operators/distinctUntilChanged");
var shareReplay_1 = require("rxjs/internal/operators/shareReplay");
var filter_1 = require("rxjs/internal/operators/filter");
var mergeMap_1 = require("rxjs/internal/operators/mergeMap");
var js_extensions_1 = require("./js+extensions");
function embedFeedbackLoop(loops, how) {
    return function (outerState, scheduler) {
        var embededLoops = loops.map(function (loop) {
            return loop(outerState.pipe(map_1.map(how.selectState)), scheduler)
                .pipe(map_1.map(how.embedEvent));
        });
        return rx.merge.apply(rx, embededLoops);
    };
}
exports.embedFeedbackLoop = embedFeedbackLoop;
var SingleMessage;
(function (SingleMessage) {
    function idle() {
        return { kind: "idle" };
    }
    SingleMessage.idle = idle;
    function tryMessage(message) {
        return { kind: "try", message: message };
    }
    SingleMessage.tryMessage = tryMessage;
    function success(result) {
        return { kind: "success", result: result };
    }
    SingleMessage.success = success;
    function failed(result) {
        return { kind: "failed", result: result };
    }
    SingleMessage.failed = failed;
})(SingleMessage = exports.SingleMessage || (exports.SingleMessage = {}));
function isIdle(message) {
    return message.kind === "idle";
}
exports.isIdle = isIdle;
function isTry(message) {
    if (message.kind === "try") {
        return message.message;
    }
    return null;
}
exports.isTry = isTry;
function isSuccess(message) {
    if (message.kind === "success") {
        return message.result;
    }
    return null;
}
exports.isSuccess = isSuccess;
function isFailed(message) {
    if (message.kind === "failed") {
        return message.result;
    }
    return null;
}
exports.isFailed = isFailed;
function system(initialState, reduce, feedbacks) {
    return rx.defer(function () {
        var state = new rx.ReplaySubject(1);
        var scheduler = rx.queueScheduler;
        var events = feedbacks.map(function (x) { return x(state, scheduler); });
        var mergedEvents = rx.merge.apply(rx, events).pipe(observeOn_1.observeOn(scheduler));
        var eventsWithEffects = mergedEvents
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
function takeUntilWithCompleted(other, scheduler) {
    return function (source) {
        var completeAsSoonAsPossible = rx.empty(scheduler);
        return other
            .pipe(take_1.take(1), map_1.map(function (_) { return completeAsSoonAsPossible; }), startWith_1.startWith(source), switchAll_1.switchAll());
    };
}
function enqueue(scheduler) {
    return function (source) { return source.pipe(observeOn_1.observeOn(scheduler), subscribeOn_1.subscribeOn(scheduler)); };
}
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
exports.unhandledErrors = dispatchErrors;
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
                return js_extensions_1.default.unhandledCase(strategy);
        }
    };
}
exports.materializedRetryStrategy = materializedRetryStrategy;
var Feedbacks;
(function (Feedbacks) {
    function react(query, effects, retryStrategy) {
        var retryer = materializedRetryStrategy(retryStrategy);
        return function (state, scheduler) {
            return retryer(state.pipe(map_1.map(query), distinctUntilChanged_1.distinctUntilChanged(function (lhs, rhs) { return js_extensions_1.default.canonicalString(lhs) === js_extensions_1.default.canonicalString(rhs); }), switchMap_1.switchMap(function (maybeQuery) {
                if (maybeQuery === null) {
                    return rx.empty();
                }
                var source = rx.defer(function () { return effects(maybeQuery); });
                return retryer(source.pipe(enqueue(scheduler)));
            })));
        };
    }
    Feedbacks.react = react;
    function reactSet(query, effects, retryStrategy) {
        var retryer = materializedRetryStrategy(retryStrategy);
        return function (state, scheduler) {
            var querySequence = state.pipe(map_1.map(function (x) { return query(x); }), shareReplay_1.shareReplay(1));
            var serializedQuerySequence = querySequence.pipe(map_1.map(js_extensions_1.default.canonicalSetValues), shareReplay_1.shareReplay(1));
            var newQueries = rx.zip(querySequence, serializedQuerySequence.pipe(startWith_1.startWith(new Set()))).pipe(map_1.map(function (queries) {
                return js_extensions_1.default.canonicalDifference(queries[0], queries[1]);
            }));
            return retryer(newQueries.pipe(mergeMap_1.mergeMap(function (controls) {
                var allEffects = js_extensions_1.default
                    .toArray(controls)
                    .map(function (maybeQuery) {
                    var serializedMaybeQuery = js_extensions_1.default.canonicalString(maybeQuery);
                    return retryer(rx.defer(function () { return effects(maybeQuery); }).pipe(takeUntilWithCompleted(serializedQuerySequence.pipe(filter_1.filter(function (queries) { return !queries.has(serializedMaybeQuery); })), scheduler), enqueue(scheduler)));
                });
                return rx.merge.apply(rx, allEffects);
            })));
        };
    }
    Feedbacks.reactSet = reactSet;
})(Feedbacks = exports.Feedbacks || (exports.Feedbacks = {}));
//# sourceMappingURL=index.js.map