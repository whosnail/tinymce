/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import { Fun, Optional } from '@ephox/katamari';
import { Compare, DomEvent, RawRect, SimRange, SugarElement, WindowSelection } from '@ephox/sugar';

const getBodyFromFrame = function (frame) {
  return Optional.some(SugarElement.fromDom(frame.dom.contentWindow.document.body));
};

const getDocFromFrame = function (frame) {
  return Optional.some(SugarElement.fromDom(frame.dom.contentWindow.document));
};

const getWinFromFrame = function (frame) {
  return Optional.from(frame.dom.contentWindow);
};

const getSelectionFromFrame = function (frame) {
  const optWin = getWinFromFrame(frame);
  return optWin.bind(WindowSelection.getExact);
};

const getFrame = function (editor) {
  return editor.getFrame();
};

const getOrDerive = function (name, f) {
  return function (editor) {
    const g = editor[name].getOrThunk(function () {
      const frame = getFrame(editor);
      return function () {
        return f(frame);
      };
    });

    return g();
  };
};

const getOrListen = function (editor, doc, name, type: string) {
  return editor[name].getOrThunk(function () {
    return function (handler) {
      return DomEvent.bind(doc, type, handler);
    };
  });
};

const getActiveApi = function (editor) {
  const frame = getFrame(editor);

  // Empty paragraphs can have no rectangle size, so let's just use the start container
  // if it is collapsed;
  const tryFallbackBox = function (win: Window) {
    const isCollapsed = function (sel: SimRange) {
      return Compare.eq(sel.start, sel.finish) && sel.soffset === sel.foffset;
    };

    const toStartRect = function (sel): Optional<RawRect> {
      const rect = sel.start.dom.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0 ? Optional.some(rect) : Optional.none();
    };

    return WindowSelection.getExact(win).filter(isCollapsed).bind(toStartRect);
  };

  return getBodyFromFrame(frame).bind(function (body) {
    return getDocFromFrame(frame).bind(function (doc) {
      return getWinFromFrame(frame).map(function (win) {

        const html = SugarElement.fromDom(doc.dom.documentElement);

        const getCursorBox: () => Optional<RawRect> = editor.getCursorBox.getOrThunk(function () {
          return function () {
            return WindowSelection.get(win).bind(function (sel) {
              return WindowSelection.getFirstRect(win, sel).orThunk(function () {
                return tryFallbackBox(win);
              });
            });
          };
        });

        const setSelection = editor.setSelection.getOrThunk(function () {
          return function (start, soffset, finish, foffset) {
            WindowSelection.setExact(win, start, soffset, finish, foffset);
          };
        });

        const clearSelection = editor.clearSelection.getOrThunk(function () {
          return function () {
            WindowSelection.clear(win);
          };
        });

        return {
          body: Fun.constant(body),
          doc: Fun.constant(doc),
          win: Fun.constant(win),
          html: Fun.constant(html),
          getSelection: Fun.curry(getSelectionFromFrame, frame),
          setSelection,
          clearSelection,
          frame: Fun.constant(frame),

          onKeyup: getOrListen(editor, doc, 'onKeyup', 'keyup'),
          onNodeChanged: getOrListen(editor, doc, 'onNodeChanged', 'SelectionChange'),
          onDomChanged: editor.onDomChanged, // consider defaulting with MutationObserver

          onScrollToCursor: editor.onScrollToCursor,
          onScrollToElement: editor.onScrollToElement,
          onToReading: editor.onToReading,
          onToEditing: editor.onToEditing,

          onToolbarScrollStart: editor.onToolbarScrollStart,
          onTouchContent: editor.onTouchContent,
          onTapContent: editor.onTapContent,
          onTouchToolstrip: editor.onTouchToolstrip,

          getCursorBox
        };
      });
    });
  });
};

const getBody = getOrDerive('getBody', getBodyFromFrame);
const getDoc = getOrDerive('getDoc', getDocFromFrame);
const getWin = getOrDerive('getWin', getWinFromFrame);
const getSelection = getOrDerive('getSelection', getSelectionFromFrame);

export {
  getBody,
  getDoc,
  getWin,
  getSelection,
  getFrame,
  getActiveApi
};
