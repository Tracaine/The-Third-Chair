export class FakeDirector {
    handler;
    calls = 0;
    constructor(handler) {
        this.handler = handler;
    }
    propose(input) { this.calls += 1; return Promise.resolve(this.handler(input)); }
}
export class FakeNarrator {
    handler;
    calls = 0;
    constructor(handler) {
        this.handler = handler;
    }
    narrate(input) { this.calls += 1; return Promise.resolve(this.handler(input)); }
}
export class FailureInjector {
    stage;
    constructor(stage) {
        this.stage = stage;
    }
    check(stage) { if (this.stage === stage)
        throw new Error(`INJECTED_FAILURE:${stage}`); }
}
//# sourceMappingURL=fakes.js.map