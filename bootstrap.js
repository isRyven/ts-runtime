globalThis.console = {
	log: function() {
		__print.apply(undefined, arguments); /* new line */
	}
}

/* early exit */
if (__scriptArgs.length < 2) {
	exit(1);
}

/* CJS-Like Module Loader */

function ModuleLoader(path, opt) {
	opt = opt || {};
	/* common module cache */
	this.cache = assign({}, opt.precache);
	/* module namespace */
	this.module = new Module(path, {});
	/* mark if module is fully loaded */
	this.loaded = false;
	/* common closure */
	this.closure = either(opt.closure, {});
	/* search paths */
	this.paths = opt.paths ? opt.paths.slice(0) : [];
	/* custom handlers */
	this.loadFile = opt.handlers && opt.handlers.load;
	this.checkFile = opt.handlers && opt.handlers.check;
}

/* requires module and caches it */
ModuleLoader.prototype.require = function(path) {
	var checkedModule = this.__tryRequireFromCache(path);
	if (checkedModule) {
		return checkedModule;
	} 
	if (!this.loadFile || !this.checkFile) {
		throw new TypeError('no file loader is set');
	}
	var newModule = this.__tryRequireModule(path);
	if (newModule) {
		var resolvedPath = resolvePath(path);
		this.cache[resolvedPath] = newModule; 
		return newModule.exports;
	}
	throw new Error('could not load module: ' + path);
}

/* creates new module on each require, never caches */
ModuleLoader.prototype.requireModule = function(path, closure) /* : Module */ {
	if (!this.loadFile || !this.checkFile) {
		throw new TypeError('no file loader is set');
	}
	return this.__tryRequireModule(path, closure);
}

ModuleLoader.prototype.__tryRequireFromCache = function(path) {
	var resolvedPath = resolvePath("", path);
	var cachedModule = this.cache[resolvedPath];
	if (cachedModule) {
		return cachedModule.exports;
	}
}

ModuleLoader.prototype.__tryRequireModule = function(path, closure) {
	if (!path) 
		throw new TypeError("expected valid path argument");
	var searchPaths = [];
	if (isPath(path)) {
		if (isPathRelative(path)) {
			var resolvedPath = resolvePath(this.module.dirpath, path);
		}
		searchPaths.push(resolvedPath || path);
	} else {
		var moduleName = path + ".js";
		for (var i = 0; i < this.paths.length; ++i) {
			var searchDir = this.paths[i];
			var finalPath = joinPaths(searchDir, moduleName);
			searchPaths.push(finalPath);
		}
	}
	for (var i = 0; i < searchPaths.length; ++i) {
		var modulePath = searchPaths[i];
		var newModule = this.__tryLoadNewModule(modulePath, closure);
		if (newModule) {
			return newModule;	
		}
	}
	throw new Error(
		"cannot find specified module '" + path + "'\n" +
		"tried next search paths: " + JSON.stringify(searchPaths) 
	);
}

ModuleLoader.prototype.__tryLoadNewModule = function(modulePath, closure) {
	if (!this.checkFile(modulePath)) {
		return;
	}
	var source = this.loadFile(modulePath);
	if (endsWith(modulePath, ".json")) {
		return new Module(modulePath, JSON.parse(source)); 
	}
	var newModuleLoader = new ModuleLoader(modulePath, { 
		precache: this.cache,
		closure: closure ? assign({}, this.closure, closure) : this.closure,
		paths: this.paths,
		handlers: { load: this.loadFile, check: this.checkFile }
	});
	var newModuleEvalClosure = assign({}, newModuleLoader.closure, {
		exports: newModuleLoader.module.exports,
		module:  newModuleLoader.module,
		require: newModuleLoader.require.bind(newModuleLoader),
		__filename: newModuleLoader.module.path,
		__dirname: newModuleLoader.module.dirpath
	});
	__eval(source, newModuleEvalClosure);
	return newModuleLoader.module;
}

/* inserts module into cache */
ModuleLoader.prototype.cacheModule = function(path, module) {
	if (!(module instanceof Module))
		throw new TypeError('invalid receiver');
	if (!path)
		throw new TypeError('expected valid path');
	if (path in this.cache)
		throw new Error("module with the same name already exists in the cache");
	this.cache[path] = module;
}

function Module(path, exports) {
	this.path = path;
	this.dirpath = getDirpath(path);
	this.exports = either(exports, {});
}

function getDirpath(path) {
	return path.replace(/(\/)*\w+\.\w+$/, "");
}

function isTruthy(item) {
	return Boolean(item);
}

function resolvePath(relto, path) {
	if (!isPathRelative(path)) return path;
	if (/^\w/.test(path)) return path;
	var resultedPath = relto.split(/[/\\]/).filter(isTruthy);
	var pathComponents = path.split(/[/\\]/).filter(isTruthy);
	var length = pathComponents.length;
	for (var i = 0; i < length; ++i) {
		if (pathComponents[i] == '..')
			resultedPath.pop();
		else if (pathComponents[i] != '.')
			resultedPath.push(pathComponents[i]);
	}
	return resultedPath.join("/");
}

function assign(objA) {
	if (!arguments.length)
		return {};
	for (var i = 1; i < arguments.length; ++i) {
		var objB = arguments[i];
		var keys = Object.keys(objB);
		for (var j = 0; j < keys.length; ++j) {
			var descriptor = Object.getOwnPropertyDescriptor(objB, keys[j]);
			Object.defineProperty(objA, keys[j], descriptor);
		}
	}
	return objA;
}

function isPath(path) {
	return (
		isPathRelative(path) ||
		(path[0] == '/' || /^\w\:/.test(path))
	);
}

function isPathRelative(path) {
	return path && path[0] == '.' && (startsWith(path, "./") || startsWith(path, "../"));
}

function either(a, b) {
	return a === undefined ? b : a;
}

function joinPaths(path1, path2) {
	var resultedPath = path1.split(/[/\\]/).filter(isTruthy);
	Array.prototype.push.apply(resultedPath, path2.split(/[/\\]/).filter(isTruthy));
	return resultedPath.join("/");
}

function startsWith(str, search, rawPos) {
    var pos = rawPos > 0 ? rawPos | 0 : 0;
    return str.substring(pos, pos + search.length) === search;
}

function endsWith(str, search, this_len) {
	if (this_len === undefined || this_len > str.length) {
		this_len = str.length;
	}
	return str.substring(this_len - search.length, this_len) === search;
};

function __eval(source, env) {
	if (typeof source === "string") {
		__eval_module(source, env);		
	} else {
		__eval_bytecode(source, env);
	}
}

function createScriptLoader(readFile, readFileRaw) {
	return function(filepath) {
		try {
			var data = readFile(filepath);
			if (endsWith(filepath, '.ts')) {
				var result = transpile(filepath, data, { 
					noEmitOnError: false,
					module: 'CommonJs' 
				});
				if (result.diagnostics.length) {
					result.diagnostics.forEach(function(diagnostic) {
						console.log(diagnostic);
					});
					__exit(1);
				}
				// console.log(result.output);
				return result.output;
			}
			return data;
		}
		catch (err) {
			return readFileRaw(filepath + "bin");
		}
	}
}

var loadScript = createScriptLoader(__readfile, __readfile_raw);
var loadInternalScript = createScriptLoader(__readfile_internal, __readfile_internal_raw);
var commonCache = {
	'fs': new Module('fs', {
		readFileSync: function(path, opt) {
			if (opt && opt.encoding == 'bin') {
				return __readfile_raw(path);
			} else {
				return __readfile(path);
			}
		},
		writeFileSync: function(path, data) {
			return __writefile(path, data);
		}
	}),
	'utils': new Module('utils', {
		format: __sprintf
	})
};

var rootLoader = new ModuleLoader("", {
	/* precached modules */
	precache: commonCache,
	/* common closure to propogate into each module */
	closure: {},
	/* custom handlers to load files, searches only in cache by default */
	handlers: {
		load: loadScript,
		check: function(filepath) {
			return __exists(filepath) || __exists(filepath + "bin");
		}
	}
});

var internalLoader = new ModuleLoader(__filename, {
	/* precached modules */
	precache: commonCache,
	/* common closure to propogate into each module */
	closure: {},
	/* custom handlers to load files, searches only in cache by default */
	handlers: {
		load: function(filepath) {
			try {
				return loadInternalScript(filepath);
			} catch (err) {
				return loadScript(filepath);
			}
		},
		check: function(filepath) {
			return __exists_internal(filepath) || __exists(filepath);
		}
	}
});

function normalizePath(text) {
	if (/\w/.test(text)) {
		return './' + text;
	}
	return text;
}

if (typeof Map === "undefined") {
	globalThis.Map = internalLoader.require("./map.min.js");
}

var transpile = internalLoader.require('./transpiler.js');

rootLoader.require(normalizePath(__scriptArgs[1], './'));
