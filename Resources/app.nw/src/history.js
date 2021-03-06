/*jslint node: true, browser: true, devel:true, white: false*/
/*global define*/
// Undo Manager for TM
define([], function () {
    function History(depth, histDelay) {
        if (depth === undefined) {
            depth = Infinity;
        }

        if (histDelay === undefined) {
            histDelay = 1250;
        }

        this.undone = [];
        this.done = [];
        this.undoDepth = depth;
        this.historyChangeDelay = histDelay;
        this.lastChangeTime = 0;
        this.lastInput = null;
    }

    function isPunctuation(keycode) {
        // punctuation: 186-222
        var punct = false;
        if (keycode >= 186 && keycode <= 222) {
            punct = true;
        }
        return punct;
    }

    function isWhitespace(keycode) {
        // tab: 9
        // space: 32 (removed, happens too often)
        var white = false;
        if (keycode === 9) { // || keycode === 32) {
            white = true;
        }
        return white;
    }

    function isDelete(keycode) {
        // backspace: 8
        // delete: 46
        var del = false;
        if (keycode === 8 || keycode === 46) {
            del = true;
        }
        return del;
    }

    function isNewline(keycode) {
        // enter: 13
        // insert: 45
        var enter = false;
        if (keycode === 13 || keycode === 45) {
            enter = true;
        }
        return enter;
    }

    function isSpecial(keyCode) {
        // backspace: 8
        // delete: 46
        // enter: 13
        // insert: 45
        // tab: 9
        // space: 32 (removed, happens too often)
        // punctuation: 186-222
        var special = false;
        if (isPunctuation(keyCode) || isWhitespace(keyCode)
                || isDelete(keyCode) || isNewline(keyCode)) {
            special = true;
        }
        return special;
    }

    function areSameType(curr, last) {
        var same = false;
        if ((isNewline(curr) && isNewline(last))
                || (isDelete(curr) && isDelete(last))
                || (isPunctuation(curr) && isPunctuation(last))
                || (isWhitespace(curr) && isWhitespace(last))) {
            same = true;
        }
        return same;
    }

    History.prototype.mergeWithLastChange = function (tm, change, selection) {
        var hist = tm.history,
            len = hist.done.length;
        hist.done[len - 1].change.to = change.to;
        hist.done[len - 1].selection = selection;
    };

    History.prototype.pushNewChange = function (tm, change, selection) {
        tm.history.done.push({change: change, selection: selection});
    };

    History.prototype.change = function (tm, change, selection) {
        var hist = tm.history,
            currTime = +new Date(),
            currInput = tm.lastInput; // syntactic sugar for seconds
        hist.clearRedos(tm);

        if (hist.done.length === hist.undoDepth) {
            hist.done.shift();
        }

        // register event on specific inputs:
        // whitespace?, punctuation, new line, delete, etc.
        // (all merge with prev if multiple occurances of same char).
        // Also be sure to ignore '[punctuation][space]' but break at
        // '[punctuation][new line]' and '[punctuation][delete]' but
        // join '[delete][delete]' etc.
        if (hist.lastChangeTime === 0
                || hist.lastChangeTime < currTime - hist.historyChangeDelay
                || isSpecial(currInput)
                || (isSpecial(hist.lastInput) && !isSpecial(currInput))) {
            if (!isSpecial(currInput)) {
                // time-based thing
                // OR
                // lastInput was special, but current input returns to normal
                // (e.g., [punctuation][space]).
                hist.pushNewChange(tm, change, tm.lastCursor);
            } else {
                // special input.
                if (currInput === hist.lastInput) {
                    // Same char as last time. Merge.
                    hist.mergeWithLastChange(tm, change, tm.lastCursor);

                    // check for timing? if exceeds time, don't merge?
                } else if (areSameType(currInput, hist.lastInput)) {
                    // Same char types (delete, punctuation, etc.). Merge.
                    hist.mergeWithLastChange(tm, change, tm.lastCursor);
                } else if (isPunctuation(hist.lastInput) && isWhitespace(currInput)) {
                    // [punctuation][space]. Merge since happens often.
                    hist.mergeWithLastChange(tm, change, tm.lastCursor);
                } else {
                    // Don't merge, push.
                    hist.pushNewChange(tm, change, tm.lastCursor);
                }
            }
        }

        hist.lastChangeTime = currTime;
        hist.lastInput = currInput;
    };

    History.prototype.redo = function (tm, selection) {
        var last = tm.history.undone.pop();
        if (last) {
            tm.value = last.change.to;

            var next = tm.history.undone[tm.history.undone.length - 1];
            if (next) {
                tm.selectionEnd = next.selection.selectionEnd;
                tm.selectionStart = next.selection.selectionStart;
            } else {
                tm.selectionEnd = last.selection.selectionEnd;
                tm.selectionStart = last.selection.selectionStart;
            }

            tm.history.done.push(last);
        }
    };
    History.prototype.undo = function (tm, selection) {
        var last = tm.history.done.pop(),
            undoLast;
        if (last) {
            undoLast = last;
            undoLast.change.to = tm.value;

            var prev = tm.history.done[tm.history.done.length - 1];
            if (prev) {
                tm.store = prev.change.to;
            } else {
                tm.store = last.change.from;
            }
            tm.value = last.change.from;

            tm.selectionEnd = last.selection.selectionEnd;
            tm.selectionStart = last.selection.selectionStart;

            tm.history.undone.push(undoLast);
            if (tm.history.canUndo(tm) === false) {
                tm.history.lastInput = null;
            }
        }
    };

    History.prototype.canUndo = function (tm) {
        return tm.history.done.length > 0;
    };

    History.prototype.canRedo = function (tm) {
        return tm.history.undone.length > 0;
    };

    History.prototype.clear = function (tm) {
        tm.history.done = [];
    };

    History.prototype.clearRedos = function (tm) {
        tm.history.undone = [];
    };
    return History;
});

