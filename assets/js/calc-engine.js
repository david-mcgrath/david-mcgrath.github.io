class DependencyTracker {
    _currentPath;
    _dependencies;
    _triggers;
    _changes;

    _stateProxy;

    constructor() {
        this._currentDependencies = {};
        this._dependencies = {};
        this._triggers = {};
        this._changes = {};
    }

    _registerChange(path) {
        this._changes[path] = true;
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
    _getProxy(objectToProxy, isWritable) {
        function getPath(prevPath, prop, isArray) {
            return isArray
                ? (prevPath || '') + '[' + prop + ']'
                : (prevPath && prevPath.length > 0 ? prevPath + '.' : '') + prop;
        }
        function getHandler(path, isArray, isWritable) {
            // TODO: Array.prototype.push.call etc. will modify the array, is this a problem?
            // Seems a bit round about, and will just break the dependency tracking
            // Also, setting the length can expand or truncate the array
            const arrayModifyingMethods = ['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'];
            // TODO: fix this, kludge
            const self = this;
            
            return isWritable
                ? {
                    get(target, prop) {
                        if (prop in target) {
                            if (isArray && arrayModifyingMethods.indexOf(prop) > -1) {
                                self._registerChange(getPath(path, prop, false));
                            }
                            self._registerDependency(getPath(path, prop, isArray && target.hasOwnProperty(prop)));
                        }
                        return target[prop];
                    },
                    set(target, prop, value) {
                        if (prop in target) {
                            if (isArray && arrayModifyingMethods.indexOf(prop) > -1) {
                                return undefined;
                            }
                            self._registerDependency(getPath(path, prop, isArray && target.hasOwnProperty(prop)));
                        }
                        target[prop] = value;
                    }
                }
                : {
                    get(target, prop) {
                        if (prop in target) {
                            if (isArray && arrayModifyingMethods.indexOf(prop) > -1) {
                                return undefined;
                            }
                            self._registerDependency(getPath(path, prop, isArray && target.hasOwnProperty(prop)));
                        }
                        return target[prop];
                    }
                };
        }
        function getProxy_recursive(obj, path) {
            const isArray = Array.isArray(obj);
            const inner = {};

            for (let k in obj) {
                if (obj.hasOwnProperty(k)) {
                    let v = obj[k];
                    inner[k] = v && typeof v === 'object'
                        ? getProxy_recursive.call(this, v, getPath(path, k, isArray))
                        : v;
                }
            }

            return new Proxy(inner, getHandler.call(this, path, isArray));
        }

        return getProxy_recursive.call(this, objectToProxy, '', getHandler);
    }
    _getReadOnlyProxy(objectToProxy) {
        return this._getProxy(objectToProxy, false);
    }
    _getWritableProxy(objectToProxy) {
        return this._getProxy(objectToProxy, true);
    }

    startTracking(path) {
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
    stopTracking() {
        this._currentPath = null;
    }
    getDependencies(path) {
        return Object.keys(this._dependencies[path] || {});
    }
    getTriggers(path) {
        return Object.keys(this._triggers[path] || {});
    }
}