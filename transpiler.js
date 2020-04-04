var ts = require("./compiler.min.js");

if (__platform === "win32") {
    var newLine = "\r\n";
    var useCaseSensitiveFileNames = false;
} else {
    var newLine = "\n";
    var useCaseSensitiveFileNames = true;
}

var hostReport = {
    getCanonicalFileName: function (filename) { return filename },
    newLine: newLine,
    getNewLine: function () { return newLine },
    getCurrentDirectory: function() { return "" },
    write: function(msg) { __printf(msg); },
    getCurrentDirectory: function() { return "" },
    useCaseSensitiveFileNames: function() { return useCaseSensitiveFileNames; }
}

function getDefaultCompilerOptions() {
    return {
        target: 1 /* ES5 */,
        jsx: 1 /* Preserve */
    };
}
var commandLineOptionsStringToEnum;
function fixupCompilerOptions(options, diagnostics) {
    // Lazily create this value to fix module loading errors.
    commandLineOptionsStringToEnum = commandLineOptionsStringToEnum || ts.filter(ts.optionDeclarations, function (o) {
        return typeof o.type === "object" && !ts.forEachEntry(o.type, function (v) { return typeof v !== "number"; });
    });
    options = cloneCompilerOptions(options);
    var _loop_8 = function (opt) {
        if (!ts.hasProperty(options, opt.name)) {
            return "continue";
        }
        var value = options[opt.name];
        // Value should be a key of opt.type
        if (ts.isString(value)) {
            // If value is not a string, this will fail
            options[opt.name] = ts.parseCustomTypeOption(opt, value, diagnostics);
        }
        else {
            if (!ts.forEachEntry(opt.type, function (v) { return v === value; })) {
                // Supplied value isn't a valid enum value.
                diagnostics.push(ts.createCompilerDiagnosticForInvalidCustomType(opt));
            }
        }
    };
    for (var _i = 0, commandLineOptionsStringToEnum_1 = commandLineOptionsStringToEnum; _i < commandLineOptionsStringToEnum_1.length; _i++) {
        var opt = commandLineOptionsStringToEnum_1[_i];
        _loop_8(opt);
    }
    return options;
}

function cloneCompilerOptions(options) {
    var result = ts.clone(options);
    ts.setConfigFileInOptions(result, options && options.configFile);
    return result;
}

function createRefFileDiagnostic(refFile, message) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
    }
    if (!refFile) {
        return ts.createCompilerDiagnostic.apply(void 0, __spreadArrays([message], args));
    }
    else {
        return ts.createFileDiagnostic.apply(void 0, __spreadArrays([refFile.file, refFile.pos, refFile.end - refFile.pos, message], args));
    }
}

var __spreadArrays = function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};

function __transpile(inputFileName, input, compilerOptions) {
    var diagnostics = [];
    var options = compilerOptions ? fixupCompilerOptions(compilerOptions, diagnostics) : {};
    var outputText; // ?
    // mix in default options
    var defaultOptions = getDefaultCompilerOptions();
    for (var key in defaultOptions) {
        if (ts.hasProperty(defaultOptions, key) && options[key] === undefined) {
            options[key] = defaultOptions[key];
        }
    }
    for (var _i = 0, transpileOptionValueCompilerOptions_1 = ts.transpileOptionValueCompilerOptions; _i < transpileOptionValueCompilerOptions_1.length; _i++) {
        var option = transpileOptionValueCompilerOptions_1[_i];
        options[option.name] = option.transpileOptionValue;
    }
    // transpileModule does not write anything to disk so there is no need to verify that there are no conflicts between input and output paths.
    options.suppressOutputPathCheck = true;
    // Filename can be non-ts file.
    options.allowNonTsExtensions = true;
    // avoid checks
    options.skipDefaultLibCheck = true;
    // transform module imports to commonjs
    options.module = "CommonJS";
    // create source files
    var sourceFiles = new Map();
    var sourceFile = ts.createSourceFile(inputFileName, input, options.target);
    sourceFile.hasNoDefaultLib = true;
    sourceFiles.set(ts.normalizePath(inputFileName), sourceFile);

    // create host
    var newLine = ts.getNewLineCharacter(options);
    var compilerHost = {
        getSourceFile: function (fileName) {
            return sourceFiles.get(fileName);
        },
        writeFile: function (name, text) {
            if (ts.fileExtensionIs(name, ".map")) {
                ts.Debug.assertEqual(sourceMapText, undefined, "Unexpected multiple source map outputs, file:", name);
                // sourceMapText = text;
            }
            else {
                ts.Debug.assertEqual(outputText, undefined, "Unexpected multiple outputs, file:", name);
                outputText = text;
            }
        },
        getDefaultLibFileName: function () { return "lib.d.ts"; },
        useCaseSensitiveFileNames: function () { return true; },
        getCanonicalFileName: function (fileName) { return fileName; },
        getCurrentDirectory: function () { return ""; },
        getNewLine: function () { return newLine; },
        fileExists: function (fileName) { return fileName === inputFileName; },
        readFile: function () { return ""; },
        directoryExists: function () { return true; },
        getDirectories: function () { return []; }
    };

    var program = ts.createProgram([inputFileName], compilerOptions, compilerHost);
    ts.addRange(diagnostics, program.getSyntacticDiagnostics());
    var emitResult = program.emit();

    diagnostics = diagnostics.map(function(diagnostic) {
        return ts.formatDiagnostic(diagnostic, hostReport) 
    });

    return { output: outputText, diagnostics: diagnostics, emitSkipped: emitResult.emitSkipped };
}

function transpile(fileName, input, compilerOptions) {
    return __transpile(fileName, input, compilerOptions);
}

module.exports = transpile;
