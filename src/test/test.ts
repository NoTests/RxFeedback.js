import { TestScheduler } from 'rxjs/testing';
import { expect } from 'chai';
import { ObservableNotification, MonoTypeOperatorFunction, Observable, Observer, Subscription, defer, of, concat, throwError, NEVER } from 'rxjs';
import { map } from 'rxjs/internal/operators/map';
import { filter } from 'rxjs/internal/operators/filter';
import { dematerialize } from 'rxjs/internal/operators/dematerialize';
import { Feedbacks, ErrorHandling, defaultErrorHandling, materializedRetryStrategy, system } from '..';
import { deepEqual } from '../js+extensions';

/**
 * Feedback loops don't handle errors anymore, so the tests guard them the same way
 * a `system` would by using `errorHandling.feedbackErrorGuard`.
 */
function ignoreErrors<Event>(): MonoTypeOperatorFunction<Event> {
    return materializedRetryStrategy<Event>({ kind: "ignoreErrorJustComplete" });
}

describe("System", function () {
    type TestChild = {
        identifier: number,
        value: String
    }

    type SignificantEvent = {
        kind: 'InitialEffectsCalled',
        initial: TestChild
    } | {
        kind: 'Subscribed',
        id: number
    } | {
        kind: 'Disposed',
        id: number
    } | {
        kind: 'DisposedSource'
    };

    type RecordedEvent = { frame: number, event: SignificantEvent };

    function createRecorder(scheduler: TestScheduler): [RecordedEvent[], (event: SignificantEvent) => void] {
        var recordedEvents: RecordedEvent[] = [];
        function record(event: SignificantEvent) {
            recordedEvents.push({ frame: scheduler.frame, event: event });
        }
        return [recordedEvents, record];
    }

    describe("Feedback", function () {
        describe("reactWithLatest", function () {
            it("Subscription", function () {
                const testScheduler = new TestScheduler(assertDeepEqual);

                const [recordedEvents, recordEvent] = createRecorder(testScheduler);

                testScheduler.run(() => {
                        let source: Observable<TestChild[]> = testScheduler.createColdObservable<TestChild[]>('abcd', {
                            'a': [{ identifier: 0, value: '1' }],
                            'b': [{ identifier: 0, value: '2' }],
                            'c': [{ identifier: 0, value: '2' }, { identifier: 1, value: '3' }],
                            'd': [{ identifier: 1, value: '3' }]
                        }).pipe(
                            track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) })
                        );
                        let events = Feedbacks.reactWithLatest(
                            (state: TestChild[])  => state.map(element => ({ id: element.identifier, request: element })),
                            (initial: TestChild, state: Observable<TestChild>): Observable<String> => {
                            recordEvent({ kind: 'InitialEffectsCalled', initial });
                            return state.pipe(
                                map(test => `Got ${test.value}`),
                                track({
                                    onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                                    onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                                })
                            );
                        })(source);
                    testScheduler.expectObservable(events, "^---------!").toBe('abc', {
                        a: 'Got 1',
                        b: 'Got 2',
                        c: 'Got 3'
                    });
                });
                expect(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 2, event: { kind: 'InitialEffectsCalled', initial: { identifier: 1, value: '3' } } },
                    { frame: 2, event: { kind: 'Subscribed', id: 1 } },
                    { frame: 3, event: { kind: 'Disposed', id: 0 } },
                    { frame: 10, event: { kind: 'Disposed', id: 1 } },
                    { frame: 10, event: { kind: 'DisposedSource', } }
                ]);
            });

            it('Error', function() {
                const testScheduler = new TestScheduler(assertDeepEqual);

                const [recordedEvents, recordEvent] = createRecorder(testScheduler);

                testScheduler.run(() => {
                    const error = 'This is error';
                    let source: Observable<TestChild[]> = testScheduler.createColdObservable<TestChild[]>('a#cd', {
                        'a': [{ identifier: 0, value: '1' }],
                        'b': [{ identifier: 0, value: '2' }],
                        'c': [{ identifier: 0, value: '2' }, { identifier: 1, value: '3' }],
                        'd': [{ identifier: 1, value: '3' }]
                    }, error).pipe(
                        track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) })
                    );
                    let events = Feedbacks.reactWithLatest(
                        (state: TestChild[])  => state.map(element => ({ id: element.identifier, request: element })),
                        (initial: TestChild, state: Observable<TestChild>): Observable<String> => {
                        recordEvent({ kind: 'InitialEffectsCalled', initial });
                        return state.pipe(
                            map(test => `Got ${test.value}`),
                            track({
                                onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                                onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                            })
                        );
                    })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, "^---------!").toBe('a|', {
                        a: 'Got 1',
                    });
                });

                expect(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 1, event: { kind: 'Disposed', id: 0 } },
                    { frame: 1, event: { kind: 'DisposedSource' } }
                ]);
            });

            it('Completed', function() {
                const testScheduler = new TestScheduler(assertDeepEqual);

                const [recordedEvents, recordEvent] = createRecorder(testScheduler);

                testScheduler.run(() => {
                    let source: Observable<TestChild[]> = testScheduler.createColdObservable<TestChild[]>('a|cd', {
                        'a': [{ identifier: 0, value: '1' }],
                        'b': [{ identifier: 0, value: '2' }],
                        'c': [{ identifier: 0, value: '2' }, { identifier: 1, value: '3' }],
                        'd': [{ identifier: 1, value: '3' }]
                    }).pipe(
                        track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) })
                    );
                    let events = Feedbacks.reactWithLatest(
                        (state: TestChild[])  => state.map(element => ({ id: element.identifier, request: element })),
                        (initial: TestChild, state: Observable<TestChild>): Observable<String> => {
                        recordEvent({ kind: 'InitialEffectsCalled', initial });
                        return state.pipe(
                            map(test => `Got ${test.value}`),
                            track({
                                onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                                onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                            })
                        );
                    })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, "^---------!").toBe('a|', {
                        a: 'Got 1',
                    });
                });

                expect(recordedEvents).to.deep.equal([
                    { frame: 0, event: { kind: 'InitialEffectsCalled', initial: { identifier: 0, value: '1' } } },
                    { frame: 0, event: { kind: 'Subscribed', id: 0 } },
                    { frame: 1, event: { kind: 'Disposed', id: 0 } },
                    { frame: 1, event: { kind: 'DisposedSource' } }
                ]);
            });

            it("Request Error", function () {
                const testScheduler = new TestScheduler(assertDeepEqual);

                const [recordedEvents, recordEvent] = createRecorder(testScheduler);

                testScheduler.run(() => {
                    const error = new Error();
                        let source: Observable<TestChild[]> = testScheduler.createColdObservable<TestChild[]>('a---bc', {
                            'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                            'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                            'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                        }).pipe(
                            track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) })
                        );
                        let events = Feedbacks.reactWithLatest(
                            (state: TestChild[])  => state.map(element => ({ id: element.identifier, request: element })),
                            (initial: TestChild, state: Observable<TestChild>): Observable<String> => {
                            recordEvent({ kind: 'InitialEffectsCalled', initial });
                            return state.pipe(
                                map(test => {
                                    if (test.value == '3') {
                                        throw error;
                                    }
                                    return `Got ${test.value}`;
                                }),
                                track({
                                    onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                                    onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                                })
                            );
                        })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, "^---------!").toBe('(ab)|', {
                        a: 'Got 1',
                        b: 'Got 2',
                    });
                });
                expect(recordedEvents).to.deep.equal([
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
                const testScheduler = new TestScheduler(assertDeepEqual);

                const [recordedEvents, recordEvent] = createRecorder(testScheduler);

                testScheduler.run(() => {
                        let source: Observable<TestChild[]> = testScheduler.createColdObservable<TestChild[]>('abc', {
                            'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                            'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                            'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                        }).pipe(
                            track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) })
                        );
                        let events = Feedbacks.reactWithLatest(
                            (state: TestChild[])  => state.map(element => ({ id: element.identifier, request: element })),
                            (initial: TestChild, state: Observable<TestChild>): Observable<String> => {
                            recordEvent({ kind: 'InitialEffectsCalled', initial });
                            return state.pipe(
                                map((test): ObservableNotification<string> => {
                                    if (test.value == '3') {
                                        return { kind: 'C' };
                                    }
                                    return { kind: 'N', value: `Got ${test.value}` };
                                }),
                                dematerialize(),
                                track({
                                    onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                                    onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                                })
                            );
                        })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, "^---------!").toBe('(ab)', {
                        a: 'Got 1',
                        b: 'Got 2'
                    });
                });
                expect(recordedEvents).to.deep.equal([
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
                const testScheduler = new TestScheduler(assertDeepEqual);

                const [recordedEvents, recordEvent] = createRecorder(testScheduler);

                testScheduler.run(() => {
                    const error = new Error();
                        let source: Observable<TestChild[]> = testScheduler.createColdObservable<TestChild[]>('a---bc', {
                            'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                            'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                            'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                        }).pipe(
                            track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) })
                        );
                        let events = Feedbacks.reactWithLatest(
                            (state: TestChild[])  => state.map(element => ({ id: element.identifier, request: element })),
                            (initial: TestChild, state: Observable<TestChild>): Observable<String> => {
                            recordEvent({ kind: 'InitialEffectsCalled', initial });
                            return state.pipe(
                                map(test => {
                                    if (test.value == '3') {
                                        throw error;
                                    }
                                    return `Got ${test.value}`;
                                }),
                                track({
                                    onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                                    onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                                })
                            );
                        })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, "^---------!").toBe('(ab)|', {
                        a: 'Got 1',
                        b: 'Got 2',
                    });
                });
                expect(recordedEvents).to.deep.equal([
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
                const testScheduler = new TestScheduler(assertDeepEqual);

                const [recordedEvents, recordEvent] = createRecorder(testScheduler);

                testScheduler.run(() => {
                        let source: Observable<TestChild[]> = testScheduler.createColdObservable<TestChild[]>('a---bc', {
                            'a': [{ identifier: 0, value: '1' }, { identifier: 1, value: '2' }],
                            'b': [{ identifier: 0, value: '3' }, { identifier: 1, value: '2' }],
                            'c': [{ identifier: 0, value: '4' }, { identifier: 1, value: '2' }],
                        }).pipe(
                            track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) })
                        );
                        let events = Feedbacks.reactWithLatest(
                            (state: TestChild[])  => state.map(element => ({ id: element.identifier, request: element })),
                            (initial: TestChild, state: Observable<TestChild>): Observable<String> => {
                            recordEvent({ kind: 'InitialEffectsCalled', initial });
                            return state.pipe(
                                map((test) => {
                                    return `Got ${test.value}`;
                                }),
                                track({
                                    onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                                    onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                                })
                            );
                        })(source).pipe(ignoreErrors());
                    testScheduler.expectObservable(events, '^----!').toBe('(ab)c', {
                        a: 'Got 1',
                        b: 'Got 2',
                        c: 'Got 3'
                    });
                });
                expect(recordedEvents).to.deep.equal([
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

        describe("react", function() {
            it("Subscription", function () {
                const testScheduler = new TestScheduler(assertDeepEqual);

                const [recordedEvents, recordEvent] = createRecorder(testScheduler);

                const never: Observable<string> = NEVER.pipe(map(_ => 'Should not happen'));

                testScheduler.run(() => {
                        let source: Observable<TestChild[]> = testScheduler.createColdObservable<TestChild[]>('abcde', {
                            'a': [{ identifier: 0, value: '1' }],
                            'b': [{ identifier: 0, value: '1' }],
                            'c': [],
                            'd': [{ identifier: 0, value: '3' }],
                            'e': [{ identifier: 1, value: '4' }]
                        }).pipe(
                            track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) })
                        );
                        let events = Feedbacks.react(
                            (state: TestChild[])  => state[0],
                            (initial: TestChild): Observable<String> => {
                            recordEvent({ kind: 'InitialEffectsCalled', initial });
                            return concat(of(`Got ${initial.value}`), never).pipe(
                                track({
                                    onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                                    onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                                })
                            );
                        })(source);
                    testScheduler.expectObservable(events, "^---------!").toBe('a--bc', {
                        a: 'Got 1',
                        b: 'Got 3',
                        c: 'Got 4'
                    });
                });
                expect(recordedEvents).to.deep.equal([
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

        describe("reactSet", function() {
            it("Subscription", function () {
                const testScheduler = new TestScheduler(assertDeepEqual);

                const [recordedEvents, recordEvent] = createRecorder(testScheduler);

                const never: Observable<string> = NEVER.pipe(map(_ => 'Should not happen'));

                testScheduler.run(() => {
                        let source: Observable<TestChild[]> = testScheduler.createColdObservable<TestChild[]>('a---b--c--d--e', {
                            'a': [{ identifier: 0, value: '1' }, { identifier: 2, value: '5'}],
                            'b': [{ identifier: 0, value: '1' }, { identifier: 2, value: '6'}],
                            'c': [{ identifier: 2, value: '6'}],
                            'd': [{ identifier: 0, value: '3' }, { identifier: 2, value: '6'}],
                            'e': [{ identifier: 3, value: '5' }]
                        }).pipe(
                            track({ onDispose: () => recordEvent({ kind: 'DisposedSource' }) })
                        );
                        let events = Feedbacks.reactSet(
                            (state: TestChild[]) => new Set(state),
                            (initial: TestChild): Observable<String> => {
                            recordEvent({ kind: 'InitialEffectsCalled', initial });
                            return concat(of(`Got ${initial.value}`), never).pipe(
                                track({
                                    onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                                    onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                                })
                            );
                        })(source);
                    testScheduler.expectObservable(events, "^-------------------!").toBe('(ab)c-----d--e', {
                        a: 'Got 1',
                        b: 'Got 5',
                        c: 'Got 6',
                        d: 'Got 3',
                        e: 'Got 5'
                    });
                });

                const orderDeterministic1: RecordedEvent[] = [
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
                const orderDeterministic2: RecordedEvent[] = [
                    { frame: 20, event: { kind: 'Disposed', id: 3 } },
                    { frame: 20, event: { kind: 'DisposedSource', } }
                ];
                const possibility1: RecordedEvent[] = [...orderDeterministic1,
                    { frame: 13, event: { kind: 'Disposed', id: 0 } },
                    { frame: 13, event: { kind: 'Disposed', id: 2 } },
                    ...orderDeterministic2
                ];
                const possibility2: RecordedEvent[] = [...orderDeterministic1,
                    { frame: 13, event: { kind: 'Disposed', id: 2 } },
                    { frame: 13, event: { kind: 'Disposed', id: 0 } },
                    ...orderDeterministic2
                ];
                if (!(deepEqual(recordedEvents, possibility1) || deepEqual(recordedEvents, possibility2))) {
                    expect.fail(recordedEvents, possibility1);
                }
            });
        });
    });

    describe("system", function () {
        type CounterEvent = { kind: 'increment' } | { kind: 'fail' };

        const increment: CounterEvent = { kind: 'increment' };
        const fail: CounterEvent = { kind: 'fail' };

        function reduce(state: number, event: CounterEvent): number {
            switch (event.kind) {
                case 'increment': return state + 1;
                case 'fail': throw new Error('Reduce failed');
            }
        }

        it("Reduces the feedback events on the provided scheduler", function () {
            const testScheduler = new TestScheduler(assertDeepEqual);

            testScheduler.run(() => {
                const events = testScheduler.createColdObservable<CounterEvent>('-a-a', {
                    'a': increment
                });

                const states = system<number, CounterEvent>(
                    0,
                    reduce,
                    [_state => events],
                    testScheduler
                );

                testScheduler.expectObservable(states, '^-----!').toBe('ab-c', {
                    a: 0,
                    b: 1,
                    c: 2
                });
            });
        });

        it("Feeds the state back into the feedback loops", function () {
            const testScheduler = new TestScheduler(assertDeepEqual);

            testScheduler.run(() => {
                const states = system<number, CounterEvent>(
                    0,
                    reduce,
                    [state => state.pipe(filter(x => x < 2), map(_ => increment))],
                    testScheduler
                );

                testScheduler.expectObservable(states, '^-----!').toBe('(abc)', {
                    a: 0,
                    b: 1,
                    c: 2
                });
            });
        });

        it("Recovers from a failing reduce by using onReduceError", function () {
            const testScheduler = new TestScheduler(assertDeepEqual);

            const recordedErrors: {}[] = [];

            testScheduler.run(() => {
                const events = testScheduler.createColdObservable<CounterEvent>('-a-b-a', {
                    'a': increment,
                    'b': fail
                });

                const states = system<number, CounterEvent>(
                    0,
                    reduce,
                    [_state => events],
                    testScheduler,
                    {
                        onReduceError: (state, error) => {
                            recordedErrors.push(error);
                            return state * 100;
                        },
                        feedbackErrorGuard: feedbackEvents => feedbackEvents
                    }
                );

                testScheduler.expectObservable(states, '^-------!').toBe('ab-c-d', {
                    a: 0,
                    b: 1,
                    c: 100,
                    d: 101
                });
            });

            expect(recordedErrors).to.deep.equal([new Error('Reduce failed')]);
        });

        it("Terminates the system when onReduceError rethrows", function () {
            const testScheduler = new TestScheduler(assertDeepEqual);

            testScheduler.run(() => {
                const events = testScheduler.createColdObservable<CounterEvent>('-a-b', {
                    'a': increment,
                    'b': fail
                });

                const states = system<number, CounterEvent>(
                    0,
                    reduce,
                    [_state => events],
                    testScheduler,
                    {
                        ...defaultErrorHandling<number, CounterEvent>(),
                        onReduceError: (_state, error) => { throw error; }
                    }
                );

                testScheduler.expectObservable(states, '^-----!').toBe('ab-#', {
                    a: 0,
                    b: 1
                }, new Error('Reduce failed'));
            });
        });

        it("Logs the error and keeps the last good state by default", function () {
            const testScheduler = new TestScheduler(assertDeepEqual);

            const loggedErrors = recordConsoleErrors();

            try {
                testScheduler.run(() => {
                    const events = testScheduler.createColdObservable<CounterEvent>('-a-b-a', {
                        'a': increment,
                        'b': fail
                    });

                    const states = system<number, CounterEvent>(
                        0,
                        reduce,
                        [_state => events],
                        testScheduler
                    );

                    testScheduler.expectObservable(states, '^-------!').toBe('ab-b-c', {
                        a: 0,
                        b: 1,
                        c: 2
                    });
                });
            } finally {
                loggedErrors.restore();
            }

            expect(loggedErrors.errors).to.deep.equal([new Error('Reduce failed')]);
        });

        it("Retries a failing feedback loop with exponential backoff capped at 5 seconds by default", function () {
            const testScheduler = new TestScheduler(assertDeepEqual);

            const subscriptionFrames: number[] = [];

            testScheduler.run(() => {
                const failing: Observable<CounterEvent> = defer(() => {
                    subscriptionFrames.push(testScheduler.frame);
                    return throwError(() => new Error('Feedback failed'));
                });

                const states = system<number, CounterEvent>(
                    0,
                    reduce,
                    [_state => failing],
                    testScheduler
                );

                testScheduler.expectObservable(states, '^ 20s !').toBe('a', {
                    a: 0
                });
            });

            // 1s, 2s, 4s, 5s, 5s, ... between the retries.
            expect(subscriptionFrames).to.deep.equal([0, 1000, 3000, 7000, 12000, 17000]);
        });

        it("Guards every feedback loop separately with feedbackErrorGuard", function () {
            const testScheduler = new TestScheduler(assertDeepEqual);

            const errorHandling: ErrorHandling<number, CounterEvent> = {
                ...defaultErrorHandling<number, CounterEvent>(),
                feedbackErrorGuard: ignoreErrors()
            };

            testScheduler.run(() => {
                const failing = testScheduler.createColdObservable<CounterEvent>('--#', {}, new Error('Feedback failed'));
                const working = testScheduler.createColdObservable<CounterEvent>('-a-a', {
                    'a': increment
                });

                const states = system<number, CounterEvent>(
                    0,
                    reduce,
                    [
                        _state => failing,
                        _state => working
                    ],
                    testScheduler,
                    errorHandling
                );

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
            const testScheduler = new TestScheduler(assertDeepEqual);
            testScheduler.maxFrames = 10000;

            const subscriptionFrames: number[] = [];
            const failing: Observable<CounterEvent> = defer(() => {
                subscriptionFrames.push(testScheduler.frame);
                return throwError(() => new Error('Feedback failed'));
            });

            const subscription = system<number, CounterEvent>(
                0,
                reduce,
                [_state => failing],
                testScheduler
            ).subscribe();
            testScheduler.flush();
            subscription.unsubscribe();

            expect(subscriptionFrames).to.deep.equal([0, 1000, 3000, 7000]);
        });

        it("Defaults the scheduler to the queue scheduler", function () {
            const states: number[] = [];

            const subscription = system<number, CounterEvent>(
                0,
                reduce,
                [
                    _state => of(increment, increment),
                    _state => throwError(() => new Error('Feedback failed')).pipe(ignoreErrors())
                ]
            ).subscribe(state => { states.push(state); });
            subscription.unsubscribe();

            expect(states).to.deep.equal([0, 1, 2]);
        });
    });
});

function track<T>(args: { 
    onDispose?: () => void, 
    onSubscribed?: () => void, 
    onNext?: (element: T) => void, 
    onError?: (error: {}) => void,
    onComplete?: () => void
}): MonoTypeOperatorFunction<T> {
    return source => {
        return new Observable((observer: Observer<T>): Subscription => {
            args.onSubscribed && args.onSubscribed()
            const subscription = source.subscribe({
                next: next => { args.onNext && args.onNext(next); observer.next(next); },
                error: error => { args.onError && args.onError(error); observer.error(error); },
                complete: () => { args.onComplete && args.onComplete(); observer.complete(); }
            });
            return new Subscription(() => {
                subscription.unsubscribe();
                args.onDispose && args.onDispose();
            });
        });
    };
}

function recordConsoleErrors(): { errors: {}[], restore: () => void } {
    const errors: {}[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: {}[]) => { errors.push(...args); };
    return {
        errors: errors,
        restore: () => { console.error = originalConsoleError; }
    };
}

function assertDeepEqual(actual: {}, expected: {}) {
    expect(actual).to.deep.equal(expected);
}