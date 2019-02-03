import { TestScheduler } from 'rxjs/testing';
import { expect } from 'chai';
import { Notification, MonoTypeOperatorFunction, Observable, Observer, Subscription, of, concat, NEVER } from 'rxjs';
import { map } from 'rxjs/internal/operators/map';
import { dematerialize } from 'rxjs/internal/operators/dematerialize';
import { Feedbacks, defaultRetryStrategy } from '..';
import { deepEqual } from '../js+extensions';

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
                        }, defaultRetryStrategy())(source, testScheduler);
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
                    }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
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
                    }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
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
                        }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
                    testScheduler.expectObservable(events, "^---------!").toBe('(ab)', {
                        a: 'Got 1',
                        b: 'Got 2',
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
                                map((test): Notification<string> => {
                                    if (test.value == '3') {
                                        return Notification.createComplete();
                                    }
                                    return Notification.createNext(`Got ${test.value}`);
                                }),
                                dematerialize(),
                                track({
                                    onSubscribed: () => recordEvent({ kind: 'Subscribed', id: initial.identifier }),
                                    onDispose: () => recordEvent({ kind: 'Disposed', id: initial.identifier })
                                })
                            );
                        }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
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
                        }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
                    testScheduler.expectObservable(events, "^---------!").toBe('(ab)', {
                        a: 'Got 1',
                        b: 'Got 2',
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
                        }, { kind: "ignoreErrorJustComplete" })(source, testScheduler);
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
                        }, defaultRetryStrategy())(source, testScheduler);
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
                        }, defaultRetryStrategy())(source, testScheduler);
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
});

function track<T>(args: { 
    onDispose?: () => void, 
    onSubscribed?: () => void, 
    onNext?: (element: T) => void, 
    onError?: (error: {}) => void,
    onComplete?: () => void
}): MonoTypeOperatorFunction<T> {
    return source => {
        return Observable.create((observer: Observer<T>): Subscription => {
            args.onSubscribed && args.onSubscribed()
            const subscription = source.subscribe(
                next => { args.onNext && args.onNext(next); observer.next(next); },
                error => { args.onError && args.onError(error); observer.error(error); },
                () => { args.onComplete && args.onComplete(); observer.complete(); }
            );
            return new Subscription(() => {
                subscription.unsubscribe();
                args.onDispose && args.onDispose();
            });
        });
    };
}

function assertDeepEqual(actual: {}, expected: {}) {
    expect(actual).to.deep.equal(expected);
}