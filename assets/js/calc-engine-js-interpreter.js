// // Punch JS-Interpreter to make setters work on values in the global object
// const previousBoxThis_ = Interpreter.prototype.boxThis_;
// if (!previousBoxThis_.replaced) {
//     Interpreter.prototype.boxThis_ = function(value) {
//         if (value === Interpreter.SCOPE_REFERENCE) {
//             debugger;
//             value = this.globalObject;
//         }
//         previousBoxThis_.call(this, value);
//     }
//     previousBoxThis_.replaced = true;
// }

class UniqueQueue {
    _queue;
    _inQueue;

    constructor() {
        this._queue = [];
        this._inQueue = {};
    }
    get length() {
        return this._queue.length;
    } 
    enqueue(value) {
        if (!this._inQueue[value]) {
            this._queue.push(value);
            this._inQueue[value] = true;
        }
    }
    dequeue() {
        const next = this._queue.shift();
        delete this._inQueue[next];
        return next;
    }
    remove(value) {
        if (this._inQueue[value]) {
            delete this._inQueue[value];
            this._queue = this._queue.filter((x) => x !== value);
        }
    }
}

class DependencyStore {
    _dependencies;
    _triggers;

    constructor() {
        this._dependencies = {};
        this._triggers = {};
    }
    add(dependency, dependent) {
        // Register the dependency
        if (!this._dependencies[dependency]) {
            this._dependencies[dependency] = {};
        }
        this._dependencies[dependency][dependent] = true;
        // Register the trigger
        if (!this._triggers[dependent]) {
            this._triggers[dependent] = {};
        }
        this._triggers[dependent][dependency] = true;
    }
    reset(dependency) {
        // Clear out current triggers
        const previousDependencies = this._dependencies[dependency];
        if (previousDependencies) {
            for (let k in previousDependencies) {
                if (this._triggers[k]) {
                    delete this._triggers[k][dependency];
                }
            }
        }

        // Reset dependencies
        this._dependencies[dependency] = {};
    }
    triggers(dependency) {
        return Object.keys(this._triggers[dependency] || {});
    }
    dependencies(dependent) {
        return Object.keys(this._dependencies[dependent] || {});
    }
}

class CalculationEngine {
    // General utility methods
    static _getPath(prevPath, prop, isArray) {
        return isArray
            ? (prevPath || '') + '[' + prop + ']'
            : (prevPath && prevPath.length > 0 ? prevPath + '.' : '') + prop;
    }

    // TODO: properly test these...
    // I'm sure they can be simpler. Or just use a library. Why aren't I using a library?
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

    // Internal state
    _currentPath;
    _dependencyStore;

    _expressions;
    _state;
    _listenerState;
    _changeCallbacks;

    _expressionQueue;
    _running;

    // Constructor & required public methods
    constructor() {
        this._dependencyStore = new DependencyStore();
        this._changeCallbacks = [];
        this._expressionQueue = new UniqueQueue();

        this._state = {};
        this._listenerState = {};
        this._expressions = {};
    }

    registerChangeCallback(callback) {
        this._changeCallbacks.push(callback);
    }

    registerValue(path, value) {
        this.setValue(path, value);
    }
    registerExpression(path, expression) {
        this._expressions[path] = {
            expression: expression,
            isListener: false,
        };
        this.setValue(path, null);
        this._expressionQueue.enqueue(path);
    }
    registerListenerExpression(path, expression) {
        this._expressions[path] = {
            expression: expression,
            isListener: true,
        };
        this.setListenerValue(path, null);
        this._expressionQueue.enqueue(path);
    }

    deregisterValue(path) {
        delete this._state[path];
        this._triggerDependents(path);
    }
    deregisterExpression(path) {
        delete this._expressions[path];
        delete this._state[path];
        this._expressionQueue.remove(path);
        this._triggerDependents(path);
    }
    deregisterListenerExpression(path) {
        delete this._expressions[path];
        delete this._listenerState[path];
        this._expressionQueue.remove(path);
    }

    start() {
        setTimeout(this._run.bind(this), 0);
    }

    // Public methods that aren't necessary for general usage
    getTriggers(path) {
        return this._dependencyStore.triggers(path);
    }
    getDependencies(path) {
        return this._dependencyStore.dependencies(path);
    }

    // Getters and setters
    getValue(path) {
        return this._state[path];
    }
    setValue(path, value) {
        this._state[path] = value;
        for (let callback of this._changeCallbacks) {
            callback(path, value);
        }
        this._triggerDependents(path);
    }
    getListenerValue(path) {
        return this._listenerState[path];
    }
    setListenerValue(path, value) {
        this._listenerState[path] = value;
        for (let callback of this._changeCallbacks) {
            callback(path, value);
        }
    }

    // Private methods
    _registerDependency(path) {
        if (this._currentPath) {
            this._dependencyStore.add(this._currentPath, path);
        }
    }
    _triggerDependents(path) {
        const triggers = this.getTriggers(path);
        for (let trigger of triggers) {
            this._expressionQueue.enqueue(trigger);
        }
        this._run();
    }
    _startTracking(path) {
        this._currentPath = path;
        this._dependencyStore.reset(path);
    }
    _stopTracking() {
        this._currentPath = null;
    }

    // The actual calculation
    // TODO: scoping, e.g. in an array it'll be that scope by default, need to use $parent etc. to get out
    _executeCalculation(path, calculation, state) {
        const tracker = this;
        let resultValueSet = false;
        let resultValue = tracker.getValue(path);
        const interpreter = new Interpreter(calculation, (interpreter, globalObject) => {
            // Initialise functions used in the state replication
            const getIntermediateHandler = (path, value) => (function () {
                this._registerDependency(path);
                return value;
            }).bind(tracker);
            const getFinalHandler = (path) => (function () {
                this._registerDependency(path);
                return this.getValue(path);
            }).bind(tracker);

            // TODO: Maybe don't require unflattening before this?
            const replicateState_r = (state, path) => {
                const isArray = Array.isArray(state);
                const result = path
                    ? interpreter.nativeToPseudo(isArray ? [] : {})
                    : globalObject;
                
                for (let k in state) {
                    if (state.hasOwnProperty(k)) {
                        let v = state[k];
                        let subPath = CalculationEngine._getPath(path, k, isArray);
                        let resultHandler = v && typeof v === 'object'
                            ? getIntermediateHandler(subPath, replicateState_r(v, subPath))
                            : getFinalHandler(subPath);
                        interpreter.setProperty(result, k, Interpreter.VALUE_IN_DESCRIPTOR, {
                            get: interpreter.createNativeFunction(resultHandler)
                        });
                    }
                }

                return result;
            }

            // Replicate the state of the tree in the format expected by the calculations, and initialise dependency tracking handlers
            replicateState_r(CalculationEngine.unflattenObject(state), null);

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

            // Initialise the $value variable that can be set in the calculation to be used as the result
            interpreter.setProperty(globalObject, '$value', Interpreter.VALUE_IN_DESCRIPTOR, {
                get: interpreter.createNativeFunction(function () {
                    return resultValue;
                }),
                set: interpreter.createNativeFunction(function (value) {
                    debugger;
                    resultValueSet = true;
                    resultValue = value;
                    return value;
                })
            });
        });

        interpreter.run();

        let result = resultValueSet
            ? resultValue
            : interpreter.value;

        // Only allow primitives
        let type = typeof result;
        if (type === 'undefined') {
            return null;
        }
        if (result === null || type === 'number' || type === 'boolean' || type === 'string') {
            return result;
        }

        throw 'Only primitive types (number, boolean, string, and null) can be returned from calculations.';

        // return result instanceof Interpreter.Object
        //     ? result.data
        //     : result;
    }

    _calculateStep(path, expression, state) {
        this._startTracking(path);
        let result = null;
        try {
            result = this._executeCalculation(path, expression, state);
        }
        catch (exception) {
            let msg = 'Calculation \'' + path + '\' failed. ' + (exception?.message || exception);
            console.error(msg);
        }
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
            let path = this._expressionQueue.dequeue();
            let expression = this._expressions[path];

            let result = this._calculateStep(path, expression.expression, this._state);
            if (expression.isListener) {
                let previous = this.getListenerValue(path);
    
                if (previous !== result) {
                    this.setListenerValue(path, result);
                }
            }
            else {
                let previous = this.getValue(path);
    
                if (previous !== result) {
                    this.setValue(path, result);
                }
            }

            setTimeout(this._run.bind(this), 0);
        }

        this._running = false;
    }
}