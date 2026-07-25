"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("rxjs/testing");
const chai_1 = require("chai");
const rxjs_1 = require("rxjs");
const map_1 = require("rxjs/internal/operators/map");
const filter_1 = require("rxjs/internal/operators/filter");
const dematerialize_1 = require("rxjs/internal/operators/dematerialize");
const __1 = require("..");
const js_extensions_1 = require("../js+extensions");
/**
 * Feedback loops don't handle errors anymore, so the tests guard them the same way
 * a `system` would by using `errorHandling.feedbackErrorGuard`.
 */
function ignoreErrors() {
    return (0, __1.materializedRetryStrategy)({ kind: "ignoreErrorJustComplete" });
}
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
                const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                const [recordedEvents, recordEvent] = createRecorder(testScheduler);
                testScheduler.run(() => {
                    let source = testScheduler.createColdObservable('abcd', {
                        'a': [{ identifier: 0, value: '1' }],
                        'b': [{ identifier: 0, value: '2' }],
                        'c': [{ identifier: 0, value: '2' }, { identifier: 1, value: '3' }],
                        'd': [{ identifier: 1, value: '3' }]
                    }).pipe(track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) }));
                    let events = __1.Feedbacks.reactWithLatest((state) => state.map(element => ({ id: element.identifier, request: element })), (initial, state) => {
                        recordEvent({ kind: 'InitialEffectsCalled', initial });
                        return state.pipe((0, map_1.map)(test => `Got ${test.value}`), track({
                            onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                            onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                        }));
                    })(source);
                    testScheduler.expectObservable(events, "^---------!").toBe('abc', {
                        a: 'Got 1',
                        b: 'Got 2',
                        c: 'Got 3'
                    });
                });
                (0, chai_1.expect)(recordedEvents).to.deep.equal([
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
                const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                const [recordedEvents, recordEvent] = createRecorder(testScheduler);
                testScheduler.run(() => {
                    const error = 'This is error';
                    let source = testScheduler.createColdObservable('a#cd', {
                        'a': [{ identifier: 0, value: '1' }],
                        'b': [{ identifier: 0, value: '2' }],
                        'c': [{ identifier: 0, value: '2' }, { identifier: 1, value: '3' }],
                        'd': [{ identifier: 1, value: '3' }]
                    }, error).pipe(track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) }));
                    let events = __1.Feedbacks.reactWithLatest((state) => state.map(element => ({ id: element.identifier, request: element })), (initial, state) => {
                        recordEvent({ kind: 'InitialEffectsCalled', initial });
                        return state.pipe((0, map_1.map)(test => `Got ${test.value}`), track({
                            onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                            onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                        }));
                    })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, "^---------!").toBe('a|', {
                        a: 'Got 1',
                    });
                });
                (0, chai_1.expect)(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 1, event: { kind: 'Disposed', id: 0 } },
                    { frame: 1, event: { kind: 'DisposedSource' } }
                ]);
            });
            it('Completed', function () {
                const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                const [recordedEvents, recordEvent] = createRecorder(testScheduler);
                testScheduler.run(() => {
                    let source = testScheduler.createColdObservable('a|cd', {
                        'a': [{ identifier: 0, value: '1' }],
                        'b': [{ identifier: 0, value: '2' }],
                        'c': [{ identifier: 0, value: '2' }, { identifier: 1, value: '3' }],
                        'd': [{ identifier: 1, value: '3' }]
                    }).pipe(track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) }));
                    let events = __1.Feedbacks.reactWithLatest((state) => state.map(element => ({ id: element.identifier, request: element })), (initial, state) => {
                        recordEvent({ kind: 'InitialEffectsCalled', initial });
                        return state.pipe((0, map_1.map)(test => `Got ${test.value}`), track({
                            onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                            onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                        }));
                    })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, "^---------!").toBe('a|', {
                        a: 'Got 1',
                    });
                });
                (0, chai_1.expect)(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 1, event: { kind: 'Disposed', id: 0 } },
                    { frame: 1, event: { kind: 'DisposedSource' } }
                ]);
            });
            it("Request Error", function () {
                const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                const [recordedEvents, recordEvent] = createRecorder(testScheduler);
                testScheduler.run(() => {
                    const error = new Error();
                    let source = testScheduler.createColdObservable('a---bc', {
                        'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                        'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                        'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                    }).pipe(track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) }));
                    let events = __1.Feedbacks.reactWithLatest((state) => state.map(element => ({ id: element.identifier, request: element })), (initial, state) => {
                        recordEvent({ kind: 'InitialEffectsCalled', initial });
                        return state.pipe((0, map_1.map)(test => {
                            if (test.value == '3') {
                                throw error;
                            }
                            return `Got ${test.value}`;
                        }), track({
                            onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                            onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                        }));
                    })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, "^---------!").toBe('(ab)|', {
                        a: 'Got 1',
                        b: 'Got 2',
                    });
                });
                (0, chai_1.expect)(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 1, value: '2' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 1 } },
                    { frame: 4, event: { kind: 'Disposed', id: 0 } },
                    { frame: 4, event: { kind: 'Disposed', id: 1 } },
                    { frame: 4, event: { kind: 'DisposedSource' } }
                ]);
            });
            it("Request Completed", function () {
                const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                const [recordedEvents, recordEvent] = createRecorder(testScheduler);
                testScheduler.run(() => {
                    let source = testScheduler.createColdObservable('abc', {
                        'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                        'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                        'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                    }).pipe(track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) }));
                    let events = __1.Feedbacks.reactWithLatest((state) => state.map(element => ({ id: element.identifier, request: element })), (initial, state) => {
                        recordEvent({ kind: 'InitialEffectsCalled', initial });
                        return state.pipe((0, map_1.map)((test) => {
                            if (test.value == '3') {
                                return { kind: 'C' };
                            }
                            return { kind: 'N', value: `Got ${test.value}` };
                        }), (0, dematerialize_1.dematerialize)(), track({
                            onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                            onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                        }));
                    })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, "^---------!").toBe('(ab)', {
                        a: 'Got 1',
                        b: 'Got 2'
                    });
                });
                (0, chai_1.expect)(recordedEvents).to.deep.equal([
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
                const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                const [recordedEvents, recordEvent] = createRecorder(testScheduler);
                testScheduler.run(() => {
                    const error = new Error();
                    let source = testScheduler.createColdObservable('a---bc', {
                        'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                        'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                        'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                    }).pipe(track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) }));
                    let events = __1.Feedbacks.reactWithLatest((state) => state.map(element => ({ id: element.identifier, request: element })), (initial, state) => {
                        recordEvent({ kind: 'InitialEffectsCalled', initial });
                        return state.pipe((0, map_1.map)(test => {
                            if (test.value == '3') {
                                throw error;
                            }
                            return `Got ${test.value}`;
                        }), track({
                            onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                            onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                        }));
                    })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, "^---------!").toBe('(ab)|', {
                        a: 'Got 1',
                        b: 'Got 2',
                    });
                });
                (0, chai_1.expect)(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 1, value: '2' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 1 } },
                    { frame: 4, event: { kind: 'Disposed', id: 0 } },
                    { frame: 4, event: { kind: 'Disposed', id: 1 } },
                    { frame: 4, event: { kind: 'DisposedSource' } }
                ]);
            });
            it("Unsubscribe", function () {
                const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                const [recordedEvents, recordEvent] = createRecorder(testScheduler);
                testScheduler.run(() => {
                    let source = testScheduler.createColdObservable('a---bc', {
                        'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                        'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                        'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                    }).pipe(track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) }));
                    let events = __1.Feedbacks.reactWithLatest((state) => state.map(element => ({ id: element.identifier, request: element })), (initial, state) => {
                        recordEvent({ kind: 'InitialEffectsCalled', initial });
                        return state.pipe((0, map_1.map)((test) => {
                            return `Got ${test.value}`;
                        }), track({
                            onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                            onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                        }));
                    })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, '^----!').toBe('(ab)c', {
                        a: 'Got 1',
                        b: 'Got 2',
                        c: 'Got 3'
                    });
                });
                (0, chai_1.expect)(recordedEvents).to.deep.equal([
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
                const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                const [recordedEvents, recordEvent] = createRecorder(testScheduler);
                const never = rxjs_1.NEVER.pipe((0, map_1.map)(_ => 'Should not happen'));
                testScheduler.run(() => {
                    let source = testScheduler.createColdObservable('abcde', {
                        'a': [{ identifier: 0, value: '1' }],
                        'b': [{ identifier: 0, value: '1' }],
                        'c': [],
                        'd': [{ identifier: 0, value: '3' }],
                        'e': [{ identifier: 1, value: '4' }]
                    }).pipe(track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) }));
                    let events = __1.Feedbacks.react((state) => state[0], (initial) => {
                        recordEvent({ kind: 'InitialEffectsCalled', initial });
                        return (0, rxjs_1.concat)((0, rxjs_1.of)(`Got ${initial.value}`), never).pipe(track({
                            onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                            onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                        }));
                    })(source);
                    testScheduler.expectObservable(events, "^---------!").toBe('a--bc', {
                        a: 'Got 1',
                        b: 'Got 3',
                        c: 'Got 4'
                    });
                });
                (0, chai_1.expect)(recordedEvents).to.deep.equal([
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
                const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
                const [recordedEvents, recordEvent] = createRecorder(testScheduler);
                const never = rxjs_1.NEVER.pipe((0, map_1.map)(_ => 'Should not happen'));
                testScheduler.run(() => {
                    let source = testScheduler.createColdObservable('a---b--c--d--e', {
                        'a': [{ identifier: 0, value: '1' }, { identifier: 2, value: '5' }],
                        'b': [{ identifier: 0, value: '1' }, { identifier: 2, value: '6' }],
                        'c': [{ identifier: 2, value: '6' }],
                        'd': [{ identifier: 0, value: '3' }, { identifier: 2, value: '6' }],
                        'e': [{ identifier: 3, value: '5' }]
                    }).pipe(track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) }));
                    let events = __1.Feedbacks.reactSet((state) => new Set(state), (initial) => {
                        recordEvent({ kind: 'InitialEffectsCalled', initial });
                        return (0, rxjs_1.concat)((0, rxjs_1.of)(`Got ${initial.value}`), never).pipe(track({
                            onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                            onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                        }));
                    })(source);
                    testScheduler.expectObservable(events, "^-------------------!").toBe('(ab)c-----d--e', {
                        a: 'Got 1',
                        b: 'Got 5',
                        c: 'Got 6',
                        d: 'Got 3',
                        e: 'Got 5'
                    });
                });
                const orderDeterministic1 = [
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
                const orderDeterministic2 = [
                    { frame: 20, event: { kind: 'Disposed', id: 3 } },
                    { frame: 20, event: { kind: 'DisposedSource', } }
                ];
                const possibility1 = [...orderDeterministic1,
                    { frame: 13, event: { kind: 'Disposed', id: 0 } },
                    { frame: 13, event: { kind: 'Disposed', id: 2 } },
                    ...orderDeterministic2
                ];
                const possibility2 = [...orderDeterministic1,
                    { frame: 13, event: { kind: 'Disposed', id: 2 } },
                    { frame: 13, event: { kind: 'Disposed', id: 0 } },
                    ...orderDeterministic2
                ];
                if (!((0, js_extensions_1.deepEqual)(recordedEvents, possibility1) || (0, js_extensions_1.deepEqual)(recordedEvents, possibility2))) {
                    chai_1.expect.fail(recordedEvents, possibility1);
                }
            });
        });
    });
    describe("system", function () {
        const increment = { kind: 'increment' };
        const fail = { kind: 'fail' };
        function reduce(state, event) {
            switch (event.kind) {
                case 'increment': return state + 1;
                case 'fail': throw new Error('Reduce failed');
            }
        }
        it("Reduces the feedback events on the provided scheduler", function () {
            const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
            testScheduler.run(() => {
                const events = testScheduler.createColdObservable('-a-a', {
                    'a': increment
                });
                const states = (0, __1.system)(0, reduce, [_state => events], testScheduler);
                testScheduler.expectObservable(states, '^-----!').toBe('ab-c', {
                    a: 0,
                    b: 1,
                    c: 2
                });
            });
        });
        it("Feeds the state back into the feedback loops", function () {
            const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
            testScheduler.run(() => {
                const states = (0, __1.system)(0, reduce, [state => state.pipe((0, filter_1.filter)(x => x < 2), (0, map_1.map)(_ => increment))], testScheduler);
                testScheduler.expectObservable(states, '^-----!').toBe('(abc)', {
                    a: 0,
                    b: 1,
                    c: 2
                });
            });
        });
        it("Recovers from a failing reduce by using onReduceError", function () {
            const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
            const recordedErrors = [];
            testScheduler.run(() => {
                const events = testScheduler.createColdObservable('-a-b-a', {
                    'a': increment,
                    'b': fail
                });
                const states = (0, __1.system)(0, reduce, [_state => events], testScheduler, {
                    onReduceError: (state, error) => {
                        recordedErrors.push(error);
                        return state * 100;
                    },
                    feedbackErrorGuard: feedbackEvents => feedbackEvents
                });
                testScheduler.expectObservable(states, '^-------!').toBe('ab-c-d', {
                    a: 0,
                    b: 1,
                    c: 100,
                    d: 101
                });
            });
            (0, chai_1.expect)(recordedErrors).to.deep.equal([new Error('Reduce failed')]);
        });
        it("Terminates the system when onReduceError rethrows", function () {
            const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
            testScheduler.run(() => {
                const events = testScheduler.createColdObservable('-a-b', {
                    'a': increment,
                    'b': fail
                });
                const states = (0, __1.system)(0, reduce, [_state => events], testScheduler, Object.assign(Object.assign({}, (0, __1.defaultErrorHandling)()), { onReduceError: (_state, error) => { throw error; } }));
                testScheduler.expectObservable(states, '^-----!').toBe('ab-#', {
                    a: 0,
                    b: 1
                }, new Error('Reduce failed'));
            });
        });
        it("Logs the error and keeps the last good state by default", function () {
            const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
            const loggedErrors = recordConsoleErrors();
            try {
                testScheduler.run(() => {
                    const events = testScheduler.createColdObservable('-a-b-a', {
                        'a': increment,
                        'b': fail
                    });
                    const states = (0, __1.system)(0, reduce, [_state => events], testScheduler);
                    testScheduler.expectObservable(states, '^-------!').toBe('ab-b-c', {
                        a: 0,
                        b: 1,
                        c: 2
                    });
                });
            }
            finally {
                loggedErrors.restore();
            }
            (0, chai_1.expect)(loggedErrors.errors).to.deep.equal([new Error('Reduce failed')]);
        });
        it("Retries a failing feedback loop with exponential backoff capped at 5 seconds by default", function () {
            const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
            const subscriptionFrames = [];
            testScheduler.run(() => {
                const failing = (0, rxjs_1.defer)(() => {
                    subscriptionFrames.push(testScheduler.frame);
                    return (0, rxjs_1.throwError)(() => new Error('Feedback failed'));
                });
                const states = (0, __1.system)(0, reduce, [_state => failing], testScheduler);
                testScheduler.expectObservable(states, '^ 20s !').toBe('a', {
                    a: 0
                });
            });
            // 1s, 2s, 4s, 5s, 5s, ... between the retries.
            (0, chai_1.expect)(subscriptionFrames).to.deep.equal([0, 1000, 3000, 7000, 12000, 17000]);
        });
        it("Guards every feedback loop separately with feedbackErrorGuard", function () {
            const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
            const errorHandling = Object.assign(Object.assign({}, (0, __1.defaultErrorHandling)()), { feedbackErrorGuard: ignoreErrors() });
            testScheduler.run(() => {
                const failing = testScheduler.createColdObservable('--#', {}, new Error('Feedback failed'));
                const working = testScheduler.createColdObservable('-a-a', {
                    'a': increment
                });
                const states = (0, __1.system)(0, reduce, [
                    _state => failing,
                    _state => working
                ], testScheduler, errorHandling);
                testScheduler.expectObservable(states, '^-----!').toBe('ab-c', {
                    a: 0,
                    b: 1,
                    c: 2
                });
            });
        });
        it("Schedules the default feedback loop retries on the system scheduler", function () {
            // The virtual time of the test scheduler only advances when the retries are
            // actually scheduled on it, the scheduler isn't patched outside of `run`.
            const testScheduler = new testing_1.TestScheduler(assertDeepEqual);
            testScheduler.maxFrames = 10000;
            const subscriptionFrames = [];
            const failing = (0, rxjs_1.defer)(() => {
                subscriptionFrames.push(testScheduler.frame);
                return (0, rxjs_1.throwError)(() => new Error('Feedback failed'));
            });
            const subscription = (0, __1.system)(0, reduce, [_state => failing], testScheduler).subscribe();
            testScheduler.flush();
            subscription.unsubscribe();
            (0, chai_1.expect)(subscriptionFrames).to.deep.equal([0, 1000, 3000, 7000]);
        });
        it("Defaults the scheduler to the queue scheduler", function () {
            const states = [];
            const subscription = (0, __1.system)(0, reduce, [
                _state => (0, rxjs_1.of)(increment, increment),
                _state => (0, rxjs_1.throwError)(() => new Error('Feedback failed')).pipe(ignoreErrors())
            ]).subscribe(state => { states.push(state); });
            subscription.unsubscribe();
            (0, chai_1.expect)(states).to.deep.equal([0, 1, 2]);
        });
    });
});
function track(args) {
    return source => {
        return new rxjs_1.Observable((observer) => {
            args.onSubscribed && args.onSubscribed();
            const subscription = source.subscribe({
                next: next => { args.onNext && args.onNext(next); observer.next(next); },
                error: error => { args.onError && args.onError(error); observer.error(error); },
                complete: () => { args.onComplete && args.onComplete(); observer.complete(); }
            });
            return new rxjs_1.Subscription(() => {
                subscription.unsubscribe();
                args.onDispose && args.onDispose();
            });
        });
    };
}
function recordConsoleErrors() {
    const errors = [];
    const originalConsoleError = console.error;
    console.error = (...args) => { errors.push(...args); };
    return {
        errors: errors,
        restore: () => { console.error = originalConsoleError; }
    };
}
function assertDeepEqual(actual, expected) {
    (0, chai_1.expect)(actual).to.deep.equal(expected);
}
//# sourceMappingURL=test.js.map