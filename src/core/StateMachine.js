/**
 * Minimal FSM. States are plain objects with optional enter/exit/update(dt).
 * Kept dependency-free so it works identically for the player controller
 * and enemy AI.
 */
export class StateMachine {
  constructor(states, initial) {
    this.states = states;
    this.current = null;
    this.currentName = null;
    this.transition(initial);
  }

  transition(name, payload) {
    if (this.currentName === name) return;
    if (this.current?.exit) this.current.exit(payload);
    this.currentName = name;
    this.current = this.states[name];
    if (!this.current) throw new Error(`Unknown state: ${name}`);
    if (this.current.enter) this.current.enter(payload);
  }

  update(dt) {
    if (this.current?.update) this.current.update(dt, this);
  }

  is(name) { return this.currentName === name; }
}
