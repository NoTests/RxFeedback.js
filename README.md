#### RxFeedback 
TypeScript/JavaScript version of [RxFeedback](https://github.com/kzaher/RxFeedback)

[20min video pitch](https://academy.realm.io/posts/try-swift-nyc-2017-krunoslav-zaher-modern-rxswift-architectures/)

The simplest architecture for [RxJS](https://github.com/ReactiveX/RxJS)

<img src="https://github.com/kzaher/rxswiftcontent/raw/master/RxFeedback.png" width="502px" />

```typescript
    type FeedbackLoop<State, Event> = 
        (state: rx.Observable<State>, scheduler: IScheduler) => rx.Observable<Event>;

    declare module 'rxjs/Observable' {
        namespace Observable {
            function system<State, Event>(
                initialState: State,
                reduce: (state: State, event: Event) => State,
                feedback: FeedbackLoop<State, Event>[],
            ): Observable<State>;
        }
    }
```

# Why

* Straightforward
    * If it did happen -> Event
    * If it should happen -> Request
    * To fulfill Request -> Feedback loo
* Declarative
    * System behavior is first declaratively specified and effects begin after subscribe is called => Compile time proof there are no "unhandled states"
* Debugging is easier
    * A lot of logic is just normal pure function that can be debugged using Xcode debugger, or just printing the commands.

* Can be applied on any level
    * [Entire system](https://kafka.apache.org/documentation/)
    * application (state is stored inside a database, CoreData, Firebase, Realm)
    * view controller (state is stored inside `system` operator)
    * inside feedback loop (another `system` operator inside feedback loop)
* Works awesome with dependency injection
* Testing
    * Reducer is a pure function, just call it and assert results
    * In case effects are being tested -> TestScheduler
* Can model circular dependencies
* Completely separates business logic from effects (Rx).
    * Business logic can be transpiled between platforms


### Installing with [NPM](https://www.npmjs.com/)

```bash
$ npm install rxfeedback
```

```typescript
import * as RxFeedback from 'rxfeedback';
```