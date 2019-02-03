"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var testing_1 = require("rxjs/testing");
var chai_1 = require("chai");
var rxjs_1 = require("rxjs");
var map_1 = require("rxjs/internal/operators/map");
var dematerialize_1 = require("rxjs/internal/operators/dematerialize");
var __1 = require("..");
var js_extensions_1 = require("../js+extensions");
describe("System", function () {
    function createRecorder(scheduler) {
        var recordedEvents = [];
        function record(event) {
            recordedEvents.push({ frame: scheduler.frame, event: event });
        }
        return [recordedEvents, record];
    }
    describe("Feedback", function () {
        describe("reactWithLatest", function () {
            it("Subscription", function () {
                var testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                var _a = createRecorder(testScheduler), recordedEvents = _a[0], recordEvent = _a[1];
                testScheduler.run(function () {
                    var source = testScheduler.createColdObservable('abcd', {
                        'a': [{ identifier: 0, value: '1' }],
                        'b': [{ identifier: 0, value: '2' }],
                        'c': [{ identifier: 0, value: '2' }, { identifier: 1, value: '3' }],
                        'd': [{ identifier: 1, value: '3' }]
                    }).pipe(track({ onDispose: function () { return recordEvent({ kind: 'DisposedSource' }); } }));
                    var events = __1.Feedbacks.reactWithLatest(function (state) { return state.map(function (element) { return ({ id: element.identifier, request: element }); }); }, function (initial, state) {
                        recordEvent({ kind: 'InitialEffectsCalled', initial: initial });
                        return state.pipe(map_1.map(function (test) { return "Got " + test.value; }), track({
                            onSubscribed: function () { return recordEvent({ kind: 'Subscribed', id: initial.identifier }); },
                            onDispose: function () { return recordEvent({ kind: 'Disposed', id: initial.identifier }); }
                        }));
                    }, __1.defaultRetryStrategy())(source, testScheduler);
                    testScheduler.expectObservable(events, "^---------!").toBe('abc', {
                        a: 'Got 1',
                        b: 'Got 2',
                        c: 'Got 3'
                    });
                });
                chai_1.expect(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 2, event: { kind: 'InitialEffectsCalled', initial: { identifier: 1, value: '3' } } },
                    { frame: 2, event: { kind: 'Subscribed', id: 1 } },
                    { frame: 3, event: { kind: 'Disposed', id: 0 } },
                    { frame: 10, event: { kind: 'Disposed', id: 1 } },
                    { frame: 10, event: { kind: 'DisposedSource', } }
                ]);
            });
            it('Error', function () {
                var testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                var _a = createRecorder(testScheduler), recordedEvents = _a[0], recordEvent = _a[1];
                testScheduler.run(function () {
                    var error = 'This is error';
                    var source = testScheduler.createColdObservable('a#cd', {
                        'a': [{ identifier: 0, value: '1' }],
                        'b': [{ identifier: 0, value: '2' }],
                        'c': [{ identifier: 0, value: '2' }, { identifier: 1, value: '3' }],
                        'd': [{ identifier: 1, value: '3' }]
                    }, error).pipe(track({ onDispose: function () { return recordEvent({ kind: 'DisposedSource' }); } }));
                    var events = __1.Feedbacks.reactWithLatest(function (state) { return state.map(function (element) { return ({ id: element.identifier, request: element }); }); }, function (initial, state) {
                        recordEvent({ kind: 'InitialEffectsCalled', initial: initial });
                        return state.pipe(map_1.map(function (test) { return "Got " + test.value; }), track({
                            onSubscribed: function () { return recordEvent({ kind: 'Subscribed', id: initial.identifier }); },
                            onDispose: function () { return recordEvent({ kind: 'Disposed', id: initial.identifier }); }
                        }));
                    }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
                    testScheduler.expectObservable(events, "^---------!").toBe('a|', {
                        a: 'Got 1',
                    });
                });
                chai_1.expect(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 1, event: { kind: 'Disposed', id: 0 } },
                    { frame: 1, event: { kind: 'DisposedSource' } }
                ]);
            });
            it('Completed', function () {
                var testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                var _a = createRecorder(testScheduler), recordedEvents = _a[0], recordEvent = _a[1];
                testScheduler.run(function () {
                    var source = testScheduler.createColdObservable('a|cd', {
                        'a': [{ identifier: 0, value: '1' }],
                        'b': [{ identifier: 0, value: '2' }],
                        'c': [{ identifier: 0, value: '2' }, { identifier: 1, value: '3' }],
                        'd': [{ identifier: 1, value: '3' }]
                    }).pipe(track({ onDispose: function () { return recordEvent({ kind: 'DisposedSource' }); } }));
                    var events = __1.Feedbacks.reactWithLatest(function (state) { return state.map(function (element) { return ({ id: element.identifier, request: element }); }); }, function (initial, state) {
                        recordEvent({ kind: 'InitialEffectsCalled', initial: initial });
                        return state.pipe(map_1.map(function (test) { return "Got " + test.value; }), track({
                            onSubscribed: function () { return recordEvent({ kind: 'Subscribed', id: initial.identifier }); },
                            onDispose: function () { return recordEvent({ kind: 'Disposed', id: initial.identifier }); }
                        }));
                    }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
                    testScheduler.expectObservable(events, "^---------!").toBe('a|', {
                        a: 'Got 1',
                    });
                });
                chai_1.expect(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 1, event: { kind: 'Disposed', id: 0 } },
                    { frame: 1, event: { kind: 'DisposedSource' } }
                ]);
            });
            it("Request Error", function () {
                var testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                var _a = createRecorder(testScheduler), recordedEvents = _a[0], recordEvent = _a[1];
                testScheduler.run(function () {
                    var error = new Error();
                    var source = testScheduler.createColdObservable('abc', {
                        'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                        'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                        'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                    }).pipe(track({ onDispose: function () { return recordEvent({ kind: 'DisposedSource' }); } }));
                    var events = __1.Feedbacks.reactWithLatest(function (state) { return state.map(function (element) { return ({ id: element.identifier, request: element }); }); }, function (initial, state) {
                        recordEvent({ kind: 'InitialEffectsCalled', initial: initial });
                        return state.pipe(map_1.map(function (test) {
                            if (test.value == '3') {
                                throw error;
                            }
                            return "Got " + test.value;
                        }), track({
                            onSubscribed: function () { return recordEvent({ kind: 'Subscribed', id: initial.identifier }); },
                            onDispose: function () { return recordEvent({ kind: 'Disposed', id: initial.identifier }); }
                        }));
                    }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
                    testScheduler.expectObservable(events, "^---------!").toBe('(ab)', {
                        a: 'Got 1',
                        b: 'Got 2',
                    });
                });
                chai_1.expect(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 1, value: '2' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 1 } },
                    { frame: 1, event: { kind: 'Disposed', id: 0 } },
                    { frame: 10, event: { kind: 'Disposed', id: 1 } },
                    { frame: 10, event: { kind: 'DisposedSource' } }
                ]);
            });
            it("Request Completed", function () {
                var testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                var _a = createRecorder(testScheduler), recordedEvents = _a[0], recordEvent = _a[1];
                testScheduler.run(function () {
                    var source = testScheduler.createColdObservable('abc', {
                        'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                        'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                        'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                    }).pipe(track({ onDispose: function () { return recordEvent({ kind: 'DisposedSource' }); } }));
                    var events = __1.Feedbacks.reactWithLatest(function (state) { return state.map(function (element) { return ({ id: element.identifier, request: element }); }); }, function (initial, state) {
                        recordEvent({ kind: 'InitialEffectsCalled', initial: initial });
                        return state.pipe(map_1.map(function (test) {
                            if (test.value == '3') {
                                return rxjs_1.Notification.createComplete();
                            }
                            return rxjs_1.Notification.createNext("Got " + test.value);
                        }), dematerialize_1.dematerialize(), track({
                            onSubscribed: function () { return recordEvent({ kind: 'Subscribed', id: initial.identifier }); },
                            onDispose: function () { return recordEvent({ kind: 'Disposed', id: initial.identifier }); }
                        }));
                    }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
                    testScheduler.expectObservable(events, "^---------!").toBe('(ab)', {
                        a: 'Got 1',
                        b: 'Got 2'
                    });
                });
                chai_1.expect(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 1, value: '2' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 1 } },
                    { frame: 1, event: { kind: 'Disposed', id: 0 } },
                    { frame: 10, event: { kind: 'Disposed', id: 1 } },
                    { frame: 10, event: { kind: 'DisposedSource' } }
                ]);
            });
            it("Request Error", function () {
                var testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                var _a = createRecorder(testScheduler), recordedEvents = _a[0], recordEvent = _a[1];
                testScheduler.run(function () {
                    var error = new Error();
                    var source = testScheduler.createColdObservable('abc', {
                        'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                        'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                        'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                    }).pipe(track({ onDispose: function () { return recordEvent({ kind: 'DisposedSource' }); } }));
                    var events = __1.Feedbacks.reactWithLatest(function (state) { return state.map(function (element) { return ({ id: element.identifier, request: element }); }); }, function (initial, state) {
                        recordEvent({ kind: 'InitialEffectsCalled', initial: initial });
                        return state.pipe(map_1.map(function (test) {
                            if (test.value == '3') {
                                throw error;
                            }
                            return "Got " + test.value;
                        }), track({
                            onSubscribed: function () { return recordEvent({ kind: 'Subscribed', id: initial.identifier }); },
                            onDispose: function () { return recordEvent({ kind: 'Disposed', id: initial.identifier }); }
                        }));
                    }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
                    testScheduler.expectObservable(events, "^---------!").toBe('(ab)', {
                        a: 'Got 1',
                        b: 'Got 2',
                    });
                });
                chai_1.expect(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 1, value: '2' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 1 } },
                    { frame: 1, event: { kind: 'Disposed', id: 0 } },
                    { frame: 10, event: { kind: 'Disposed', id: 1 } },
                    { frame: 10, event: { kind: 'DisposedSource' } }
                ]);
            });
            it("Unsubscribe", function () {
                var testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                var _a = createRecorder(testScheduler), recordedEvents = _a[0], recordEvent = _a[1];
                testScheduler.run(function () {
                    var source = testScheduler.createColdObservable('a---bc', {
                        'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                        'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                        'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                    }).pipe(track({ onDispose: function () { return recordEvent({ kind: 'DisposedSource' }); } }));
                    var events = __1.Feedbacks.reactWithLatest(function (state) { return state.map(function (element) { return ({ id: element.identifier, request: element }); }); }, function (initial, state) {
                        recordEvent({ kind: 'InitialEffectsCalled', initial: initial });
                        return state.pipe(map_1.map(function (test) {
                            return "Got " + test.value;
                        }), track({
                            onSubscribed: function () { return recordEvent({ kind: 'Subscribed', id: initial.identifier }); },
                            onDispose: function () { return recordEvent({ kind: 'Disposed', id: initial.identifier }); }
                        }));
                    }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
                    testScheduler.expectObservable(events, '^----!').toBe('(ab)c', {
                        a: 'Got 1',
                        b: 'Got 2',
                        c: 'Got 3'
                    });
                });
                chai_1.expect(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 1, value: '2' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 1 } },
                    { frame: 5, event: { kind: 'Disposed', id: 0 } },
                    { frame: 5, event: { kind: 'Disposed', id: 1 } },
                    { frame: 5, event: { kind: 'DisposedSource' } }
                ]);
            });
        });
        describe("react", function () {
            it("Subscription", function () {
                var testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                var _a = createRecorder(testScheduler), recordedEvents = _a[0], recordEvent = _a[1];
                var never = rxjs_1.NEVER.pipe(map_1.map(function (_) { return 'Should not happen'; }));
                testScheduler.run(function () {
                    var source = testScheduler.createColdObservable('abcde', {
                        'a': [{ identifier: 0, value: '1' }],
                        'b': [{ identifier: 0, value: '1' }],
                        'c': [],
                        'd': [{ identifier: 0, value: '3' }],
                        'e': [{ identifier: 1, value: '4' }]
                    }).pipe(track({ onDispose: function () { return recordEvent({ kind: 'DisposedSource' }); } }));
                    var events = __1.Feedbacks.react(function (state) { return state[0]; }, function (initial) {
                        recordEvent({ kind: 'InitialEffectsCalled', initial: initial });
                        return rxjs_1.concat(rxjs_1.of("Got " + initial.value), never).pipe(track({
                            onSubscribed: function () { return recordEvent({ kind: 'Subscribed', id: initial.identifier }); },
                            onDispose: function () { return recordEvent({ kind: 'Disposed', id: initial.identifier }); }
                        }));
                    }, __1.defaultRetryStrategy())(source, testScheduler);
                    testScheduler.expectObservable(events, "^---------!").toBe('a--bc', {
                        a: 'Got 1',
                        b: 'Got 3',
                        c: 'Got 4'
                    });
                });
                chai_1.expect(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 2, event: { kind: 'Disposed', id: 0 } },
                    { frame: 3, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '3' } } },
                    { frame: 3, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 4, event: { kind: 'InitialEffectsCalled', initial: { identifier: 1, value: '4' } } },
                    { frame: 4, event: { kind: 'Subscribed', id: 1 } },
                    { frame: 4, event: { kind: 'Disposed', id: 0 } },
                    { frame: 10, event: { kind: 'Disposed', id: 1 } },
                    { frame: 10, event: { kind: 'DisposedSource', } }
                ]);
            });
        });
        describe("reactSet", function () {
            it("Subscription", function () {
                var testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                var _a = createRecorder(testScheduler), recordedEvents = _a[0], recordEvent = _a[1];
                var never = rxjs_1.NEVER.pipe(map_1.map(function (_) { return 'Should not happen'; }));
                testScheduler.run(function () {
                    var source = testScheduler.createColdObservable('a---b--c--d--e', {
                        'a': [{ identifier: 0, value: '1' }, { identifier: 2, value: '5' }],
                        'b': [{ identifier: 0, value: '1' }, { identifier: 2, value: '6' }],
                        'c': [{ identifier: 2, value: '6' }],
                        'd': [{ identifier: 0, value: '3' }, { identifier: 2, value: '6' }],
                        'e': [{ identifier: 3, value: '5' }]
                    }).pipe(track({ onDispose: function () { return recordEvent({ kind: 'DisposedSource' }); } }));
                    var events = __1.Feedbacks.reactSet(function (state) { return new Set(state); }, function (initial) {
                        recordEvent({ kind: 'InitialEffectsCalled', initial: initial });
                        return rxjs_1.concat(rxjs_1.of("Got " + initial.value), never).pipe(track({
                            onSubscribed: function () { return recordEvent({ kind: 'Subscribed', id: initial.identifier }); },
                            onDispose: function () { return recordEvent({ kind: 'Disposed', id: initial.identifier }); }
                        }));
                    }, __1.defaultRetryStrategy())(source, testScheduler);
                    testScheduler.expectObservable(events, "^-------------------!").toBe('(ab)c-----d--e', {
                        a: 'Got 1',
                        b: 'Got 5',
                        c: 'Got 6',
                        d: 'Got 3',
                        e: 'Got 5'
                    });
                });
                var orderDeterministic1 = [
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 2, value: '5' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 2 } },
                    { frame: 4, event: { kind: 'InitialEffectsCalled', initial: { identifier: 2, value: '6' } } },
                    { frame: 4, event: { kind: 'Subscribed', id: 2 } },
                    { frame: 4, event: { kind: 'Disposed', id: 2 } },
                    { frame: 7, event: { kind: 'Disposed', id: 0 } },
                    { frame: 10, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '3' } } },
                    { frame: 10, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 13, event: { kind: 'InitialEffectsCalled', initial: { identifier: 3, value: '5' } } },
                    { frame: 13, event: { kind: 'Subscribed', id: 3 } }
                ];
                var orderDeterministic2 = [
                    { frame: 20, event: { kind: 'Disposed', id: 3 } },
                    { frame: 20, event: { kind: 'DisposedSource', } }
                ];
                var possibility1 = orderDeterministic1.concat([{ frame: 13, event: { kind: 'Disposed', id: 0 } },
                    { frame: 13, event: { kind: 'Disposed', id: 2 } }], orderDeterministic2);
                var possibility2 = orderDeterministic1.concat([{ frame: 13, event: { kind: 'Disposed', id: 2 } },
                    { frame: 13, event: { kind: 'Disposed', id: 0 } }], orderDeterministic2);
                if (!(js_extensions_1.deepEqual(recordedEvents, possibility1) || js_extensions_1.deepEqual(recordedEvents, possibility2))) {
                    chai_1.expect.fail(recordedEvents, possibility1);
                }
            });
        });
    });
});
function track(args) {
    return function (source) {
        return rxjs_1.Observable.create(function (observer) {
            args.onSubscribed && args.onSubscribed();
            var subscription = source.subscribe(function (next) { args.onNext && args.onNext(next); observer.next(next); }, function (error) { args.onError && args.onError(error); observer.error(error); }, function () { args.onComplete && args.onComplete(); observer.complete(); });
            return new rxjs_1.Subscription(function () {
                subscription.unsubscribe();
                args.onDispose && args.onDispose();
            });
        });
    };
}
function assertDeepEqual(actual, expected) {
    chai_1.expect(actual).to.deep.equal(expected);
}
//# sourceMappingURL=test.js.map