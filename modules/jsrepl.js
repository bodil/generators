/*global setTimeout, Audio */

import CodeMirror from "codemirror/lib/codemirror";

require("codemirror/lib/codemirror.css");
require("codemirror/theme/ttcn.css");

require("codemirror/addon/edit/matchbrackets.js");
require("codemirror/addon/edit/closebrackets.js");
require("codemirror/addon/hint/show-hint.js");
require("codemirror/addon/hint/show-hint.css");
require("codemirror/addon/hint/anyword-hint.js");
require("codemirror/addon/selection/active-line.js");
require("codemirror/addon/comment/comment.js");

require("codemirror/mode/javascript/javascript.js");

require("./jsrepl/theme.less");

import ReadLine from "./jsrepl/readline";
import events from "pink/lib/events";
import text from "pink/lib/text";
import emacs from "pink/modules/editor/emacs";
import seq from "pink/lib/seq";

import ReplWorker from "webworker!./jsrepl/worker.es3";

import jsEdMod from "pink/modules/editor/language/javascript";
const jsModC = (() => {
  const langs = {};
  const out = jsEdMod(null, langs);
  return out["text/javascript"];
})();
const jsMod = new jsModC();

import { colors } from "./jsrepl/term";
const termColours = colors;
termColours[256] = "white";
termColours[257] = "black";

import ansi from "ansi-256-colors";

const resetC = ansi.reset;
const errorC = resetC + "\x1b[1m" + ansi.fg.standard[1];
const successC = resetC + "\x1b[1m" + ansi.fg.getRgb(1, 0, 1);
const valueC = resetC + ansi.fg.getRgb(0, 1, 0);
const logC = resetC + ansi.fg.getRgb(0, 0, 0);
const prompt = resetC + ansi.fg.grayscale[15] + "λ \x1b[1m" + ansi.fg.getRgb(0, 0, 0);

export default function REPL(slide, mode) {
  const args = slide.dataset;
  const target = slide.querySelector(".slideContainer");
  const initialCode = target.innerHTML;
  const imports = (args.import || "").split(" ").filter((s) => s.trim().length);

  this.onTabClose = () => {
    if (!this.cm.isClean()) {
      return "The current buffer has modifications.";
    }
  };

  // --- Comms

  this.onMessage = ([msg, data]) => {
    if (msg === "log") {
      this.console.writeln(logC + data + resetC);
    } else if (msg === "result") {
      if (data !== undefined) {
        this.console.writeln(valueC + data + resetC);
      }
    } else if (msg === "error") {
      this.console.writeln(errorC + data + resetC);
    } else {
      console.error("Unknown message from worker:", msg, data);
    }
  };

  this.evalCommand = (input) => {
    const expand = input[0] === "&",
          line = expand ? input.slice(1) : input;
    jsMod.compile(line).then((res) => {
      if (res.errors.length) {
        this.console.writeln(errorC + res.errors[0].message + resetC);
      } else {
        this.env.postMessage({eval: res.code, expand});
      }
    });
  };

  this.loadBuffer = (quiet) => {
    let cm = this.cm;
    cm.clearGutter("cm-errors");
    jsMod.compile(this.cm.getDoc().getValue()).then((res) => {
      if (res.errors.length) {
        this.console.writeln(errorC + res.errors[0].message + resetC);
      } else {
        this.env.postMessage({load: res.code});
        if (!quiet) {
          this.console.writeln(successC + "Buffer loaded." + resetC);
        }
      }
    });
  };

  this.focusConsole = () => {
    this.unfocus();
    this.console.focus();
  };

  this.focusEditor = () => {
    this.unfocus();
    this.cm.focus();
  };

  this.unfocus = () => {
    this.console.blur();
    // wow, much hack
    const input = document.createElement("input");
    input.setAttribute("type", "text");
    document.body.appendChild(input);
    input.focus();
    input.parentNode.removeChild(input);
  };

  // --- keybindings

  const keymap = {};
  keymap["Ctrl-K"] = emacs.kill;
  keymap["Ctrl-Y"] = emacs.yank;
  keymap["Ctrl-A"] = "goLineStartSmart";
  keymap["Ctrl-E"] = "goLineEnd";
  keymap["Ctrl-,"] = "toggleComment";
  keymap.Tab = (cm) => cm.indentLine(cm.getDoc().getCursor().line);
  keymap["Ctrl-\\"] = (cm) => CodeMirror.showHint(cm);
  keymap["Ctrl-'"] = (cm) => {
    const cur = cm.getDoc().getCursor();
    const token = cm.getTokenAt(cur, true);
    cm.getDoc().extendSelection({line: cur.line, ch: token.start},
                                {line: cur.line, ch: token.end});
  }
  keymap.Esc = (cm) => {
    this.unfocus();
  };

  // --- Terminal

  // --- CodeMirror config

  const options = {
    value: text.cleanText(initialCode, "html"),
    mode: "text/javascript",
    extraKeys: keymap,
    gutters: ["cm-errors"],
    // lineNumbers: true,
    lineWrapping: false,
    matchBrackets: true,
    autoCloseBrackets: true,
    styleActiveLine: true,
    theme: "ttcn"
  };

  // --- activate

  this.activate = () => {
    slide.classList.add("jsrepl");
    target.innerHTML = "";

    this.editorFrame = document.createElement("div");
    this.editorFrame.classList.add("editorFrame");
    target.appendChild(this.editorFrame);

    this.replFrame = document.createElement("div");
    this.replFrame.classList.add("replFrame");
    target.appendChild(this.replFrame);
    this.termContainer = document.createElement("div");
    this.termContainer.classList.add("termContainer");
    this.replFrame.appendChild(this.termContainer);

    this.cm = CodeMirror(this.editorFrame, options);
    this.cm.setSize("100%", "100%");

    this.env = new ReplWorker();
    this.env.onmessage = (e) => this.onMessage(e.data);
  }

  // --- stabilise

  this.stabilise = () => {
    this.cm.refresh();

    let width = Math.round(this.replFrame.clientWidth / this.cm.defaultCharWidth() * 0.9);
    this.console = new ReadLine({
      cols: width,
      rows: 10,
      useStyle: true,
      cursorBlink: true,
      prompt: prompt,
      parent: this.termContainer,
      colors: termColours
    });
    this.console.on("command", this.evalCommand);
    this.console.on("loadBuffer", this.loadBuffer);
    this.console.on("focusOut", this.focusEditor);

    this.cleanupHandler = events.on(window, "beforeunload", this.onTabClose, this);
    this.focusKeyHandler = events.on(window, "keydown", (e) => {
      if (e.keyCode === 79 && e.ctrlKey) {
        this.focusConsole();
        e.stopPropagation();
        e.preventDefault();
      } else if (e.keyCode === 83 && e.ctrlKey) {
        this.loadBuffer();
        e.stopPropagation();
        e.preventDefault();
      }
    }, this);

    this.loadBuffer();
  }

  // --- cleanup

  this.cleanup = () => {
    if (this.cleanupHandler) {
      events.off(window, "beforeunload", this.cleanupHandler);
      this.cleanupHandler = null;
    }
    if (this.focusKeyHandler) {
      events.off(window, "keydown", this.focusKeyHandler);
      this.focusKeyHandler = null;
    }
    this.console.cleanup();
    this.console = null;
    this.cm = null;
    if (this.env) {
      this.env.terminate();
      this.env = null;
    }
    target.innerHTML = initialCode;
    target.classList.remove("jsrepl");
  }
}
