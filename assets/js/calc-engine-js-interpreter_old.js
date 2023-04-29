// TODO: Cleanup, make it work when the structure of the state changes (e.g. additional values in an array)

const testConfig = {
    $id: 123,
    $formId: 56,
    $workflow_state: 'initial',
    calc: {
        $expressions: {
            $value: 'calc2 * 2'
        },
        $value: null
    },
    calc2: {
        $expressions: {
            $value: 'var value = 0; value += a + b; for (var i = 0; i < c.length; i++) { value += c[i]; } value;'
        },
        $value: null
    },
    calc3: {
        $expressions: {
            $value: '"workflow state = " + $workflow_state'
        },
        $value: null
    },
    calc4: {
        $expressions: {
            $value: 'var test1 = $value; $value = 2; $value = $value + 5; var test = -99; test += 1;'
        }
    },
    // calc4: {
    //     $expressions: {
    //         value: 'calc4 + (calc4 > 1000 ? 0 : 1)'
    //     }
    // },
    a: {
        $value: 1
    },
    b: {
        $value: 2
    },
    c: {
        $value: [
            {
                $value: 3
            },
            {
                $value: 4
            }
        ]
    }
};
window.testConfig = testConfig;

// Punch JS-Interpreter to make setters work on values in the global object
const previousBoxThis_ = Interpreter.prototype.boxThis_;
if (!previousBoxThis_.replaced) {
    Interpreter.prototype.boxThis_ = function(value) {
        if (value === Interpreter.SCOPE_REFERENCE) {
            value = null;
        }
        previousBoxThis_.call(this, value);
    }
    previousBoxThis_.replaced = true;
}
// Interpreter.prototype.boxThis_ = function(value) {
//     if (value === undefined || value === null || value === Interpreter.SCOPE_REFERENCE) {
//         // `Undefined` and `null` are changed to the global object.
//         return this.globalObject;
//     }
//     if (!(value instanceof Interpreter.Object)) {
//         // Primitives must be boxed.
//         var box = this.createObjectProto(this.getPrototype(value));
//         box.data = value;
//         return box;
//     }
//     return value;
// };

class CalculationEngine {
    static _getPath(prevPath, prop, isArray) {
        return isArray
            ? (prevPath || '') + '[' + prop + ']'
            : (prevPath && prevPath.length > 0 ? prevPath + '.' : '') + prop;
    }

    // TODO: these are likely helpful utility methods
    static flattenObject(obj) {
        function flatten_r(obj, path) {
            const isArray = Array.isArray(obj);
            return Object.keys(obj).reduce(function (acc, x) {
                const subPath = CalculationEngine._getPath(path, x, isArray);
                const v = obj[x];
                if (v && typeof v === 'object') {
                    Object.assign(acc, flatten_r(v, subPath));
                }
                else {
                    acc[subPath] = v;
                }
                return acc;
            }, {});
        }
        return flatten_r(obj);
    }
    static unflattenObject(obj) {
        const root = {};

        Object.keys(obj).forEach(function (key) {
            const value = obj[key];

            const pathComponents = key
                .split('.')
                .flatMap((pc) => pc
                    .split('[')
                    .map((sc, i) => {
                        if (i === 0) {
                            return sc;
                        }
                        sc = parseInt(sc);
                        return !isNaN(sc)
                            ? sc
                            : null;
                    }).filter(function (sc) {
                        return sc !== null;
                    }).map(function (sc, i, all) {
                        return {
                            prop: sc,
                            isArray: i !== all.length - 1
                        };
                    }));

            let curr = root;
            let next = root;
            let property = null;

            for (let pc of pathComponents) {
                if (property !== null) {
                    curr[property] = next;
                    curr = next;
                }

                property = pc.prop;
                if (!curr[property]) {
                    next = pc.isArray ? [] : {};
                }
                else {
                    next = curr[property];
                }
            }

            curr[property] = value;
        });

        return root;
    }

    _getInitialState(config, expressions) {
        function r_getState(config, path) {
            const isArray = Array.isArray(config);
            const result = isArray ? [] : {};
            
            for (let k in config) {
                // Don't include $expressions in the state object
                if (config.hasOwnProperty(k) && k !== '$expressions') {
                    let v = config[k];
                    let subPath = CalculationEngine._getPath(path, k, isArray);
                    if (v && typeof v === 'object') {
                        if (v.$expressions) {
                            // Iterate through all expressions and register them, ignoring $exclude (and $expressions if it's in it for some reason)
                            for (let subKey in v.$expressions) {
                                if (v.$expressions.hasOwnProperty(subKey) && subKey !== '$expressions' && subKey !== '$exclude') {
                                    let expressionPath = CalculationEngine._getPath(subPath, subKey, false);
                                    v[subKey] = v[subKey] || null;
                                    expressions[expressionPath] = v.$expressions[subKey];
                                }
                            }
                        }

                        result[k] = r_getState(v, subPath);
                    }
                    else {
                        result[k] = v;
                    }
                }
            }

            return result;
        }

        return r_getState(config, null);
    }

    _currentPath;
    _dependencies;
    _triggers;

    _expressions;
    _state;
    _changeCallbacks;

    _expressionQueue;
    _expressionsInQueue;
    _running;

    constructor(config, changeCallback) {
        this._currentDependencies = {};
        this._dependencies = {};
        this._triggers = {};
        this._changeCallbacks = changeCallback ? [changeCallback] : [];

        this._expressions = {};

        this._state = this._getInitialState(config, this._expressions);

        this._expressionsInQueue = {};
        this._expressionQueue = [];
        for (let path in this._expressions) {
            this._expressionsInQueue[path] = true;
            this._expressionQueue.push(path);
        }

        this._run();
    }

    flattenState(state) {
        if (!state) {
            state = this._state;
        }
        return CalculationEngine.flattenObject(state);
    }

    _registerDependency(path) {
        if (this._currentPath) {
            if (!this._dependencies[this._currentPath]) {
                this._dependencies[this._currentPath] = {};
            }
            this._dependencies[this._currentPath][path] = true;
            if (!this._triggers[path]) {
                this._triggers[path] = {};
            }
            this._triggers[path][this._currentPath] = true;
        }
    }

    _executeCalculation(path, calculation, state) {
        function getFinalHandler(tracker, path/*, value*/) {
            return function () {
                //console.log(path);
                tracker._registerDependency(path);
                return tracker.getValue(path);
                //return value;
            };
        }
        function getHandler(tracker, path, value) {
            return function () {
                //console.log(path);
                tracker._registerDependency(path);
                return value;
            };
        }
        function r_replicateState(tracker, interpreter, globalObject, state, path) {
            const isArray = Array.isArray(state);
            const result = path
                ? interpreter.nativeToPseudo(isArray ? [] : {})
                : globalObject;

            for (let k in state) {
                if (state.hasOwnProperty(k)) {
                    let v = state[k];
                    let subPath = CalculationEngine._getPath(path, k, isArray);
                    // Flatten <path>.$value to just <path> in the replicated state
                    if (v && v.hasOwnProperty('$value')) {
                        v = v.$value;
                        subPath = CalculationEngine._getPath(subPath, '$value', false);
                    }
                    let resultHandler = v && typeof v === 'object'
                        ? getHandler(tracker, subPath, r_replicateState(tracker, interpreter, globalObject, v, subPath))
                        : getFinalHandler(tracker, subPath, v);
                    interpreter.setProperty(result, k, Interpreter.VALUE_IN_DESCRIPTOR, {
                        get: interpreter.createNativeFunction(resultHandler)
                    });
                }
            }

            return result;
        }

        const tracker = this;
        let resultValueSet = false;
        let resultValue = tracker.getValue(path);
        const interpreter = new Interpreter(calculation, function (interpreter, globalObject) {
            // Replicate the state of the tree in the format expected by the calculations, and initialise dependency tracking handlers
            r_replicateState(tracker, interpreter, globalObject, state, null);

            // Initialise the $value variable that can be set in the calculation to be used as the result
            interpreter.setProperty(globalObject, '$value', Interpreter.VALUE_IN_DESCRIPTOR, {
                get: interpreter.createNativeFunction(function () {
                    return resultValue;
                }),
                set: interpreter.createNativeFunction(function (value) {
                    resultValueSet = true;
                    resultValue = value;
                    return value;
                })
            });
        });
        interpreter.run();
        return resultValueSet
            ? resultValue
            : interpreter.value;
    }

    _calculateStep(path, expression, state) {
        this._startTracking(path);
        let result = this._executeCalculation(path, expression, state);
        this._stopTracking();
        return result;
    }
    _run() {
        const maxSynchronousExpressions = 25;

        if (this._running) {
            return;
        }
        this._running = true;

        for (let i = 0; i < maxSynchronousExpressions && this._expressionQueue.length > 0; i++) {
            let path = this._expressionQueue.shift();
            delete this._expressionsInQueue[path];

            let result = this._calculateStep(path, this._expressions[path], this._state);
            let previous = this.getValue(path);

            if (previous !== result) {
                this.setValue(path, result);
            }

            setTimeout(this._run.bind(this), 0);
        }

        this._running = false;
    }
    triggerDependents(path) {
        let triggers = this.getTriggers(path);
        for (let i = 0; i < triggers.length; i++) {
            if (!this._expressionsInQueue[triggers[i]]) {
                this._expressionsInQueue[triggers[i]] = true;
                this._expressionQueue.push(triggers[i]);
            }
        }
        this._run();
    }

    _startTracking(path) {
        this._currentPath = path;

        // Clear out current triggers
        const previousDependencies = this._dependencies[path];
        if (previousDependencies) {
            for (let k in previousDependencies) {
                if (this._triggers[k]) {
                    delete this._triggers[k][path];
                }
            }
        }

        // Reset dependencies
        this._dependencies[path] = {};
    }
    _stopTracking() {
        this._currentPath = null;
    }
    getDependencies(path) {
        return Object.keys(this._dependencies[path] || {});
    }
    getTriggers(path) {
        return Object.keys(this._triggers[path] || {});
    }

    _getSetValue(path, set, value) {
        const pathComponents = (path || '').split('.').map(function (x) {
                return x.split('[').map(function (y) {
                    return y.split(']');
                }).reduce(function (a, b) { return a.concat(b); }, []);
            }).reduce(function (a, b) { return a.concat(b); }, []).filter(function (x) {
                return !!x;
            });
        
        let curr = this._state;
        for (let i = 0; i < pathComponents.length; i++) {
            if (set && i === pathComponents.length - 1) {
                curr[pathComponents[i]] = value;
            }
            curr = curr[pathComponents[i]];
        }
        return curr;
    }
    getValue(path) {
        return this._getSetValue(path);
    }
    setValue(path, value) {
        this._getSetValue(path, true, value);
        for (let callback of this._changeCallbacks) {
            callback(path, value);
        }
        //console.log(path + ': ' + value);
        this.triggerDependents(path);
    }
    registerChangeCallback(callback) {
        this._changeCallbacks.push(callback);
    }
}